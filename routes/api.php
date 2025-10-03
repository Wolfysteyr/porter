<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;


Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');


Route::post('/register', [AuthController::class, 'register']);

Route::post('/login', [AuthController::class, 'login']);

Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');

use App\Http\Controllers\ExternalDbController;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/databases/external/tables', [ExternalDbController::class, 'listTables']);
    Route::post('/databases/external/tables/{table}', [ExternalDbController::class, 'getTableData']);
    Route::get('/databases/external/tables/{table}/columns', [ExternalDbController::class, 'getTableColumns']);
});

// QueryTemplate routes
use App\Http\Controllers\QueryTemplateController;

Route::middleware('auth:sanctum')->group(function () {
    Route::apiResource('query-templates', QueryTemplateController::class);
});

