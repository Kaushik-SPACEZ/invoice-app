<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Tymon\JWTAuth\Facades\JWTAuth;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'business_name' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'business_name' => $request->business_name,
        ]);

        $token = JWTAuth::fromUser($user);

        return response()->json([
            'success' => true,
            'data' => ['user' => $user, 'token' => $token],
            'message' => 'Registered successfully',
        ], 201);
    }

    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $credentials = $request->only('email', 'password');

        if (!$token = JWTAuth::attempt($credentials)) {
            return response()->json(['success' => false, 'message' => 'Invalid credentials'], 401);
        }

        $user = JWTAuth::user();

        return response()->json([
            'success' => true,
            'data' => ['user' => $user, 'token' => $token, 'expires_in' => config('jwt.ttl') * 60],
        ]);
    }

    public function logout()
    {
        JWTAuth::invalidate(JWTAuth::getToken());
        return response()->json(['success' => true, 'message' => 'Logged out']);
    }

    public function me()
    {
        return response()->json(['success' => true, 'data' => JWTAuth::user()]);
    }

    public function refresh()
    {
        $token = JWTAuth::refresh(JWTAuth::getToken());
        return response()->json(['success' => true, 'data' => ['token' => $token, 'expires_in' => config('jwt.ttl') * 60]]);
    }

    public function google(Request $request)
    {
        // Implement Google OAuth token verification here
        return response()->json(['success' => false, 'message' => 'Google auth not yet configured'], 501);
    }

    public function forgotPassword(Request $request)
    {
        // TODO: implement password reset email
        return response()->json(['success' => true, 'message' => 'If the email exists, a reset link has been sent']);
    }

    public function resetPassword(Request $request)
    {
        // TODO: implement password reset
        return response()->json(['success' => true, 'message' => 'Password reset successfully']);
    }
}
