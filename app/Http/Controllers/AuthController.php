<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;


class AuthController extends Controller
{
    public function register(Request $request){
        $fields = $request->validate([
            'name' => 'required|max:255',
            'email' => 'required|email|unique:users',
            'password' => 'required|confirmed'
        ]);

        $user = User::create($fields);
        
        $token = $user->createToken($request->name);


        return [
            'user' => $user,
            'token' => $token
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
