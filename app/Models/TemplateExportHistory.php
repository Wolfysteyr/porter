<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Log;
use App\Models\QueryTemplate;

class TemplateExportHistory extends Model
{
    protected $table = 'template_export_history';

    protected $fillable = [
        'template_id',
        'export_type',
        'file_path',
        'target_database',
        'target_table',
        'message',
        'exported_at',
    ];

    public $timestamps = true;

    public function template()
    {
        return $this->belongsTo(QueryTemplate::class, 'template_id');
    }

    // template export history logging
    public static function saveToExportHistory($template_id, $export_type, $file_path, $target_database, $target_table, $message, $retry = true) {
        try {
            $history = new self(); 
            $history->template_id = $template_id;
            $history->export_type = $export_type;  // csv or database
            $history->file_path = $file_path;  // if csv, this is the filename
            $history->target_database = $target_database;  // if exported to db, this is the target db
            $history->target_table = $target_table;  // if exported to db, this is the target table
            $history->message = $message;  // success or error message
            $history->exported_at = now();
            $history->save();
        } catch (QueryException $e) {
            if ($retry && $message !== 'failed') {
                Log::warning('Retrying to save export history after failure: ' . $e->getMessage());
                self::saveToExportHistory($template_id, $export_type, $file_path, $target_database, $target_table, 'failed: ' . $e->getMessage(), false);
            } else {
                Log::error('Failed to save export history: ' . $e->getMessage());
            }
        }
    }
    // get entire export history 
    public static function getExportHistory(){
        return self::with('template') // eager load template relationship
            ->orderBy('exported_at', 'desc')
            ->get();
    } 
}
