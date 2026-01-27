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
        // Fetch templates with non-null auto
        $templates = QueryTemplate::whereNotNull('auto')
            ->where('auto->active', true)
            ->get();

        foreach ($templates as $tpl) {
            $auto = $tpl->auto ?? [];
            // Treat 'auto' strictly as config: schedule, interval, unit, active.
            // Do NOT read timestamps from 'auto'—use DB fields only.

            if (empty($auto['active'])) {
                continue;
            }

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
                            // Approximate weeks as N*7 days
                            $days = $interval * 7;
                            $cron = "0 0 */{$days} * *";
                            break;
                        case 'month':
                        case 'months':
                            $cron = "0 0 1 */{$interval} *";
                            break;
                        default:
                            // Unknown unit; skip this template
                            $this->error("Unknown auto.unit '{$auto['unit']}' for template {$tpl->id}");
                            continue 2;
                    }
                } elseif (!empty($auto['schedule'])) {
                    // Normalize common human-friendly schedules
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
                        // Allow "@daily" style
                        $cron = $named[ltrim($lower, '@')];
                    } else {
                        // Fall back to the provided string
                        $cron = $sched;
                    }
                }
            }

            if (empty($cron)) {
                continue;
            }

            $tz = config('app.timezone', 'Europe/Riga');
            $now = new \DateTime('now', new \DateTimeZone($tz));

            // Recompute next_auto_run_at based on current 'auto' config to reflect any changes
            $tpl->updateNextAutoRunAt();
            $tpl->save(); // Ensure it's saved if updated

            // Check if due using the updated next_auto_run_at
            if (empty($tpl->next_auto_run_at)) {
                continue; // No next run set
            }
            $nextRun = new \DateTime($tpl->next_auto_run_at, new \DateTimeZone($tz));
            $isDue = $now >= $nextRun;

            // Special case for new templates without last_auto_run_at: check if cron is due now
            if (!$isDue && empty($tpl->last_auto_run_at)) {
                try {
                    $expr = CronExpression::factory($cron);
                    $isDue = $expr->isDue($now);
                } catch (\Exception $e) {
                    // If cron invalid, skip
                    $isDue = false;
                }
            }

            if (!$isDue) {
                // Diagnostic output
                if ($dry || $this->output->isVerbose()) {
                    $this->line("Template {$tpl->id} not due yet. Next run: {$tpl->next_auto_run_at} (cron: {$cron})");
                }
                continue;
            }

            $lockKey = 'export_template_lock_' . $tpl->id;
            $lock = Cache::lock($lockKey, 300); // 5 min lock
            if ($lock->get()) {
                try {
                    // Prevent duplicates: Check last_auto_run_at against a safe window
                    // Use a 1-minute buffer to avoid skipping due to minor timing issues
                    $safePrevRun = date('Y-m-d H:i:s', strtotime('-1 minute'));
                    if (!empty($tpl->last_auto_run_at) && strtotime($tpl->last_auto_run_at) >= strtotime($safePrevRun)) {
                        $this->line("Skipped {$tpl->id} (already dispatched at {$tpl->last_auto_run_at})");
                    } else {
                        if ($dry) {
                            $this->info("Would dispatch template {$tpl->id}");
                        } else {
                            dispatch(new ExportTemplateJob($tpl->id));

                            // Update timestamps in DB fields only
                            $tpl->last_auto_run_at = now();
                            $tpl->updateNextAutoRunAt(); // Recompute from now after dispatch
                            $tpl->save();
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