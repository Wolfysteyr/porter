<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

// AuthController handles user registration, login, and logout functionalities.
class AuthController extends Controller
{
    // Register a new user
    public function register(Request $request)
    {
        $fields = $request->validate([
            'name' => 'required|max:255',
            'email' => 'required|email|unique:users',
            'admin' => 'boolean'
        ]);


        // create user with random password
        $user = User::create([
            'name' => $fields['name'],
            'email' => $fields['email'],
            'password' => bcrypt(Str::random(16)), // random hash password
            'admin' => $request->has('admin') ? $fields['admin'] : 0,
        ]);

        // Create a password reset token
        $token = Password::createToken($user);

        // Send password reset notification to the user
        $user->sendPasswordResetNotification($token);

        return [
            'user' => $user,
        ];
    }

    // Login an existing user
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required'
        ]);

        // find user by email, then check password

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return [
                'errors' => [
                    'email' => ['The email is incorrect.'],

                ]
            ];
        }
        if (!Hash::check($request->password, $user->password)) {
            return [
                'errors' => [
                    'password' => ['The password is incorrect.'],
                ]
            ];
        }
        // create token
        $token = $user->createToken($user->name);

        return [
            'user' => $user,
            'token' => $token->plainTextToken
        ];
    }
    // Logout the authenticated user
    public function logout(Request $request)
    {

        $request->user()->tokens()->delete();

        return [
            'message' => 'Logged out'

        ];
    }

    // screw it, put the user update here too, i dont care
    public function updateUser(Request $request)
    {
        $request->validate([
            'name' => 'sometimes|required|max:255',
            'email' => 'sometimes|required|email|unique:users,email,' . $request->id,
            'admin' => 'sometimes|boolean',
            'access' => 'sometimes|json'
        ]);
        $user = User::findOrFail($request->id);
        $user->name = $request->name;
        $user->email = $request->email;
        if ($request->has('admin')) {
            $user->admin = $request->admin;
        }
        if ($request->has('access')) {
            if(is_array($request->access)){
                $user->access = json_encode($request->access);
            } else {
                $user->access = $request->access;
            }
        }
        $user->save();
        return [
            'user' => $user
        ];
    }
}
