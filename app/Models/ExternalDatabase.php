<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExternalDatabase extends Model
{
    protected $fillable = [
        'name', 'database', 'driver', 'host', 'port', 'username', 'password', 'description',
    ];
}