<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;
use App\Models\QueryTemplate;
use App\Models\User;

class TemplateHistory extends Model
{
    protected $table = 'template_history';

    protected $fillable = [
        'template_id',
        'action',
        'committed_by',

        'template_snapshot', // stored as JSON -> temp_name, temp_db, temp_table, temp_query (columns, where, fks), 
        //export (type, target db & table or file, f&r options, column name changes, limit offset), 
        // auto (schedule, interval, unit, active) 
    ];

    protected $casts = [
        'template_snapshot' => 'array',
    ];

    public function template()
    {
        return $this->belongsTo(QueryTemplate::class, 'template_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'committed_by', 'id');
    }

    public $timestamps = true;


    public static function logTemplateAction($template_id, $action, $committed_by, $template_name, $template_db, $template_table, $template_query, $export_settings, $auto_settings)
    {
        $template_snapshot = [
            'template_name' => $template_name,
            'template_db' => $template_db,
            'template_table' => $template_table,
            'template_query' => $template_query,
            'export_settings' => $export_settings,
            'auto_settings' => $auto_settings,
        ];
        self::create([
            'template_id' => $template_id,
            'action' => $action,
            'committed_by' => $committed_by,
            'template_snapshot' => $template_snapshot,
        ]);
        Log::info("Template action logged: Template ID $template_id, Action: $action, Committed by: $committed_by");
    }
}
