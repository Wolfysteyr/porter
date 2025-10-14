<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PasswordSetupNotification extends Notification
{
    use Queueable;
    protected $token;
    /**
     * Create a new notification instance.
     */
    public function __construct($token)
    {
        $this->token = $token;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {

        $frontendUrl = config('app.frontend_url', 'http://localhost:8000');
        $resetURL = $frontendUrl . '/set-password?token=' . $this->token . '&email=' . urlencode($notifiable->email);
        return (new MailMessage)
            ->subject('Set up your password')
            ->greeting('Hello, ' . $notifiable->name . '!')
            ->line('To set up your password for Porter, please click the link below:')
            ->action('Set up password', $resetURL)
            ->line('This link will expire in 60 minutes.')
            ->line('If you did not request this, please ignore this email.');
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            //
        ];
    }
}
