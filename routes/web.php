<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\DataExportController;

Route::get('/', function () {
    return view('welcome');
});

