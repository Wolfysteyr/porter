<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Export extends Model
{
    protected $table = 'export';

    protected $fillable = [
        'name',          // human-friendly label ("Orders export")
        'user_id',       // who triggered it
        'source_db',     // source database name or connection key
        'source_table',  // table queried
        'target_db',     // (optional) target database name/connection key
        'target_table',  // (optional) table to insert into
        'transfer_type', // 'csv' or 'direct'
        'filepath',      // path/URL to CSV (null if direct transfer)
        'row_count',     // how many rows were exported
        'status',        // 'pending', 'success', 'failed'
        'error_message', // store error if failed
    ];

    public function user ()
    {
        return $this->belongsTo(User::class);
    }
    
}
