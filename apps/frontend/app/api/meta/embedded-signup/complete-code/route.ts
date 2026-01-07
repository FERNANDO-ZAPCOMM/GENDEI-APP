import { NextRequest, NextResponse } from 'next/server';

import { apiClient } from '@/lib/api';

interface CompleteCodeRequest {
  code: string;
  state: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as CompleteCodeRequest;

    if (!body.code || !body.state) {
      return NextResponse.json(
        { message: 'Code and state are required' },
        { status: 400 },
      );
    }

    console.log('[DEBUG] complete-code API route hit', {
      codeLength: body.code?.length,
      statePreview: body.state?.slice(0, 25),
    });

    // No auth token needed - the state JWT is the authentication
    const data = await apiClient<{ success: boolean; creatorId: string; wabaId: string; phoneNumberId?: string }>(
      '/meta/embedded-signup/complete-code',
      {
        method: 'POST',
        body: JSON.stringify(body),
        // No token - this endpoint uses state JWT for auth
      },
    );

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to complete signup with code:', error);

    const status = error?.status ?? 500;
    const message = error?.message || 'Failed to complete WhatsApp setup';

    return NextResponse.json(
      {
        message,
        details: error?.data ?? null,
      },
      { status },
    );
  }
}
