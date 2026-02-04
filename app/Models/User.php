<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, HasApiTokens;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'admin', // 1 for admin, 0 for regular user
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */


    public function sendPasswordSetupNotification($token)
    {
        $this->notify(new \App\Notifications\PasswordSetupNotification($token));
    }

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
    ];
    

    public function queryTemplates()
    {
        return $this->hasMany(QueryTemplate::class, 'user_id');
    }

    public function templateHistories()
    {
        return $this->hasManyThrough(TemplateHistory::class, QueryTemplate::class, 'user_id', 'template_id', 'id', 'id');
    }
}
