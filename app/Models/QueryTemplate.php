<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\User;

class QueryTemplate extends Model
{
    protected $table = 'query_templates';

    protected $fillable = [
        'name',
        'query',
        'database',
        'table',
        'user_id',
    ];

    protected $casts = [
        'query' => 'array',
    ];


    public function user ()
    {
        return $this->belongsTo(User::class);
    }
}