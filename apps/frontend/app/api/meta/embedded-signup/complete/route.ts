import { NextRequest, NextResponse } from 'next/server';

import { apiClient } from '@/lib/api';

interface CompleteRequest {
  accessToken?: string;
  code?: string;
  wabaId?: string;
  phoneNumberId?: string;
  redirectUri?: string;
}

interface CompleteResponse {
  success: boolean;
  wabaId?: string;
  phoneNumberId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { message: 'Authorization token is required' },
        { status: 401 },
      );
    }

    const token = authHeader.slice('Bearer '.length);
    const body = (await request.json().catch(() => ({}))) as CompleteRequest;

    if (!body.accessToken && !body.code) {
      return NextResponse.json(
        { message: 'Access token or authorization code is required' },
        { status: 400 },
      );
    }

    console.log('[DEBUG] complete API route hit', {
      hasAccessToken: !!body.accessToken,
      hasCode: !!body.code,
      wabaId: body.wabaId,
      phoneNumberId: body.phoneNumberId,
    });

    const data = await apiClient<CompleteResponse>(
      '/meta/embedded-signup/complete',
      {
        method: 'POST',
        body: JSON.stringify(body),
        token,
      },
    );

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to complete embedded signup:', error);

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
