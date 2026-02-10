<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::get('/users', function (Request $request) {
    return \App\Models\User::all();
})->middleware('auth:sanctum'); 


// Authentication routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class,'login']);
Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
// External Database routes
use App\Http\Controllers\ExternalDbController;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/databases/external', [ExternalDbController::class, 'listExternalDbs']);
    Route::post('/databases/external', [ExternalDbController::class, 'createExternalDb']);
    // RESTful routes used by the React frontend (index/store/update/destroy)
    Route::apiResource('databases/external', ExternalDbController::class)->only(['index','store','update','destroy']);
    Route::get('/databases/external/tables', [ExternalDbController::class, 'listTables']);
    Route::post('/databases/external/tables/{table}', [ExternalDbController::class, 'getTableData']);
    Route::get('/databases/external/tables/{table}/columns', [ExternalDbController::class, 'getTableColumns']);
});

//Export Data routes
use App\Http\Controllers\DataExportController;
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/export', [DataExportController::class, 'checkExportType']);
});

use App\Http\Controllers\QueryTemplateJsonOutput;

// template query JSON output route
Route::middleware(['web', 'auth:sanctum'])->get('/templates/{template_name}/json', [QueryTemplateJsonOutput::class, 'viewTemplate'])
    // allow spaces and most characters, but still disallow "/" so the URL segment is safe
    ->where('template_name', '[^/]+');

// QueryTemplate routes
use App\Http\Controllers\QueryTemplateController;

Route::middleware('auth:sanctum')->group(function () {
    Route::apiResource('query-templates', QueryTemplateController::class);
});

Route::post('/reset-password', function (Request $request) {
    $request->validate([
        'token' => 'required',
        'email' => 'required|email',
        'password' => 'required|confirmed',
    ]);
    $status = Password::reset(
        $request->only('email', 'password', 'password_confirmation', 'token'),
        function ($user, $password) {
            $user->forceFill([
                'password' => bcrypt($password)
            ])->save();

            $user->setRememberToken(Str::random(60));
        }
    );

    if ($status == Password::PASSWORD_RESET) {
        return response()->json(['message' => 'Password reset successfully'], 200);
    }

    throw ValidationException::withMessages([
        'email' => [__($status)],
    ]);
});

// route to get all export history
Route::get('/export/history', [DataExportController::class, 'getExportHistory'])->middleware('auth:sanctum');

// route to get all template history
Route::get('/templates/history', [QueryTemplateController::class, 'getAllTemplateHistory'])->middleware('auth:sanctum');
// route to get template histories
Route::get('/templates/{template_id}/history', [QueryTemplateController::class, 'getTemplateHistory'])->middleware('auth:sanctum');