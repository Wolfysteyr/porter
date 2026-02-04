<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\DataExportController;
use App\Http\Controllers\AuthController;

Route::get('/', function () {
    return view('welcome');
});

// redirect to front login page
Route::get('/login', function () {
    return redirect('/login'); 
});