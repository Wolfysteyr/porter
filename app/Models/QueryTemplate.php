<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\User;

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
        'UI'
    ];

    protected $casts = [
        'query' => 'array',
        'export' => 'array',
        'auto' => 'array',
        'last_auto_run_at' => 'datetime',
        'UI' => 'array',
    ];


    public function user ()
    {
        return $this->belongsTo(User::class);
    }
}