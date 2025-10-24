<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\QueryTemplate;
use App\Jobs\ExportTemplateJob;
use Cron\CronExpression;
use Illuminate\Support\Facades\Cache;

class DispatchAutoExports extends Command
{
    protected $signature = 'export:templates:auto {--dry-run}';
    protected $description = 'Dispatch exports for templates that have an auto schedule';

    public function handle()
    {
       
        $dry = $this->option('dry-run');
        // fetch templates with non-null auto
        $templates = QueryTemplate::whereNotNull('auto')->get();

        foreach ($templates as $tpl) {
            $auto = $tpl->auto ?? [];
            // The frontend provides an 'auto' shape like:
            // { schedule: automationSchedule, interval: automationPeriod, unit: automationUnit }
            // If schedule === 'every' then interval+unit are used to build a cron expression.
            // Otherwise we assume 'schedule' contains a cron expression string. If schedule is null/empty,
            // the template is not scheduled.
            $cron = null;
            if (isset($auto['schedule'])) {
                $this->info("Template number {$tpl->id} schedule: " . $auto['schedule'] . ' ' . ($auto['interval'] ?? '') . ' ' . ($auto['unit'] ?? ''));
                if ($auto['schedule'] === 'every') {
                    $interval = intval($auto['interval'] ?? 1);
                    if ($interval < 1) {
                        $interval = 1;
                    }
                    $unit = strtolower($auto['unit'] ?? 'minutes');
                    switch ($unit) {
                        case 'minute':
                        case 'minutes':
                            $cron = "*/{$interval} * * * *";
                            break;
                        case 'hour':
                        case 'hours':
                            $cron = "0 */{$interval} * * *";
                            break;
                        case 'day':
                        case 'days':
                            $cron = "0 0 */{$interval} * *";
                            break;
                        case 'week':
                        case 'weeks':
                            // approximate weeks as N*7 days
                            $days = $interval * 7;
                            $cron = "0 0 */{$days} * *";
                            break;
                        case 'month':
                        case 'months':
                            $cron = "0 0 1 */{$interval} *";
                            break;
                        default:
                            // unknown unit; skip this template
                            $this->error("Unknown auto.unit '{$auto['unit']}' for template {$tpl->id}");
                            continue 2;
                    }
                } elseif (!empty($auto['schedule'])) {
                    // normalize common human-friendly schedules (daily, hourly, weekly, etc.)
                    $sched = trim($auto['schedule']);
                    $lower = strtolower($sched);
                    $named = [
                        'hourly'   => '0 * * * *',
                        'daily'    => '0 0 * * *',
                        'weekly'   => '0 0 * * 0',
                        'monthly'  => '0 0 1 * *',
                        'yearly'   => '0 0 1 1 *',
                    ];

                    if (isset($named[$lower])) {
                        $cron = $named[$lower];
                    } elseif (strpos($sched, '@') === 0 && isset($named[ltrim($lower, '@')])) {
                        // allow "@daily" style by mapping to cron
                        $cron = $named[ltrim($lower, '@')];
                    } else {
                        // fall back to the provided string (will be validated later)
                        $cron = $sched;
                    }
                }
            }

            if (empty($cron)) {
                continue;
            }
            $tz = config('app.timezone', 'Europe/Riga');

            // check cron is due
            try {
                $expr = CronExpression::factory($cron);
            } catch (\Exception $e) {
                $this->error("Invalid cron for template {$tpl->id}: {$e->getMessage()}");
                continue;
            }

            $now = new \DateTime('now', new \DateTimeZone($tz));
            if (!$expr->isDue($now)) {
                // Diagnostic: show why nothing was dispatched during dry-run
                if ($dry || $this->output->isVerbose()) {
                    try {
                        $next = $expr->getNextRunDate($now)->format('Y-m-d H:i:s');
                        $this->line("Template {$tpl->id} not due yet. Next run: {$next} (cron: {$cron})");
                    } catch (\Throwable $e) {
                        $this->line("Template {$tpl->id} not due yet (cron: {$cron})");
                    }
                }
                continue;
            }

            $lockKey = 'export_template_lock_' . $tpl->id;
            $lock = Cache::lock($lockKey, 300); // 5 min lock
            if ($lock->get()) {
                try {
                    // Prevent duplicate dispatches by checking last_auto_run_at
                    // against the previous scheduled run time. If last_auto_run_at
                    // is >= previous run, we assume this schedule already ran.
                    try {
                        $prevRun = $expr->getPreviousRunDate($now)->format('Y-m-d H:i:s');
                    } catch (\Throwable $e) {
                        // If unable to compute previous run, fall back to time-window check
                        $prevRun = date('Y-m-d H:i:s', strtotime('-55 seconds'));
                    }

                    if (!empty($tpl->last_auto_run_at) && strtotime($tpl->last_auto_run_at) >= strtotime($prevRun)) {
                        $this->line("Skipped {$tpl->id} (already dispatched at {$tpl->last_auto_run_at})");
                    } else {
                        if ($dry) {
                            $this->info("Would dispatch template {$tpl->id}");
                        } else {
                            dispatch(new ExportTemplateJob($tpl->id));

                            // Update both the atomic DB column and the auto JSON last_run_at
                            $tpl->last_auto_run_at = now()->toDateTimeString();
                            $auto['last_run_at'] = now()->toDateTimeString();
                            $tpl->auto = $auto;
                            $tpl->save();

                            $this->info("Dispatched template {$tpl->id}");
                        }
                    }
                } finally {
                    $lock->release();
                }
            } else {
                $this->line("Skipped {$tpl->id} (lock held)");
            }
        }
    }
}