<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'porter@vtl.lv'],
            [
                'name' => 'Porter Admin',
                'password' => Hash::make('stranded'), // Change this to a secure password
                'admin' => true,
            ]
        );

        User::updateOrCreate(
            ['email' => 'mca@vtl.lv'],
            [
                'name' => 'Maksims Carevs',
                'password' => Hash::make('123'), 
                'admin' => false,
            ]
        );
    }
}
