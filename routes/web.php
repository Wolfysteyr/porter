<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\DataExportController;
use App\Http\Controllers\AuthController;

Route::get('/', function () {
    return view('welcome');
});



