<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;


class AuthController extends Controller
{
    public function register(Request $request){
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

        $user->sendPasswordResetNotification($token);

        return [
            'user' => $user,
            ];


    }
    public function login(Request $request){
        $request->validate([
            'email' => 'required|email',
            'password' => 'required'
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return [
                'errors' => [
                    'email' => ['The email is incorrect.'] , 
                    
                ]
            ];
        }  if (!Hash::check($request->password, $user->password)){
            return [
                'errors' => [
                    'password' => ['The password is incorrect.'],
                ]
            ];
        }

            $token = $user->createToken($user->name);

            return [
                'user' => $user,
                'token' => $token->plainTextToken
            ];
    
    }
    public function logout(Request $request){

        $request->user()->tokens()->delete();

        return [
            'message' => 'Logged out'
    
        ];
    }
}
