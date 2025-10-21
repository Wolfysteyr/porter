<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');


Route::post('/register', [AuthController::class, 'register']);

Route::post('/login', [AuthController::class, 'login']);

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