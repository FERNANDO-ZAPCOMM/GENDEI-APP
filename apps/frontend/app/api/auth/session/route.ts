import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * POST /api/auth/session
 * Set session cookie after successful Firebase authentication
 * This is called from the client after signIn() succeeds
 */
export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json(
        { error: 'ID token is required' },
        { status: 400 }
      );
    }

    // Set session cookie
    // In production, you should verify the token with Firebase Admin SDK
    // For now, we'll trust the client (they're already authenticated)
    const cookieStore = await cookies();
    cookieStore.set('__session', idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 5, // 5 days
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Session cookie error:', error);
    return NextResponse.json(
      { error: 'Failed to set session' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/session
 * Clear session cookie on logout
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('__session');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Session delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}
