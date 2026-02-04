<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\User;
use Cron\CronExpression;

class QueryTemplate extends Model
{
    protected $table = 'query_templates';

    protected $fillable = [
        'name',
        'database',
        'table',
        'query',
        'export',
        'user_id',
        'auto',
        'last_auto_run_at',
        'next_auto_run_at',
        'UI'
    ];

    protected $casts = [
        'query' => 'array',
        'export' => 'array',
        'auto' => 'array',
        'last_auto_run_at' => 'datetime',
        'next_auto_run_at' => 'datetime',
        'UI' => 'array',
    ];

    protected static function boot()
    {
        parent::boot();

        static::saving(function ($template) {
            if ($template->isDirty('auto')) {
                $template->updateNextAutoRunAt();
            }
        });
    }

    public function updateNextAutoRunAt()
    {
        $auto = $this->auto ?? [];
        if (empty($auto['active'])) {
            $this->next_auto_run_at = null;
            return;
        }

        $cron = null;
        if (isset($auto['schedule'])) {
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
                        $days = $interval * 7;
                        $cron = "0 0 */{$days} * *";
                        break;
                    case 'month':
                    case 'months':
                        $cron = "0 0 1 */{$interval} *";
                        break;
                    default:
                        $cron = null;
                }
            } elseif (!empty($auto['schedule'])) {
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
                    $cron = $named[ltrim($lower, '@')];
                } else {
                    $cron = $sched;
                }
            }
        }

        if (empty($cron)) {
            $this->next_auto_run_at = null;
            return;
        }

        try {
            $tz = config('app.timezone', 'Europe/Riga');
            $expr = CronExpression::factory($cron);
            $baseTime = !empty($this->last_auto_run_at) ? $this->last_auto_run_at : now();
            $this->next_auto_run_at = $expr->getNextRunDate($baseTime)->format('Y-m-d H:i:s');
        } catch (\Exception $e) {
            $this->next_auto_run_at = null;
        }
    }

    public function user ()
    {
        return $this->belongsTo(User::class);
    }

    public function templateHistories()
    {
        return $this->hasMany(TemplateHistory::class, 'template_id');
    }

}