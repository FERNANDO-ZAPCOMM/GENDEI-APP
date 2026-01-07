import { NextRequest, NextResponse } from 'next/server';

import { apiClient } from '@/lib/api';

interface CompleteDirectRequest {
  wabaId: string;
  phoneNumberId?: string;
  state: string;
}

interface CompleteDirectResponse {
  success: boolean;
  wabaId: string;
  phoneNumberId?: string;
  creatorId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as CompleteDirectRequest;

    if (!body.state) {
      return NextResponse.json(
        { message: 'State token is required' },
        { status: 400 },
      );
    }

    if (!body.wabaId) {
      return NextResponse.json(
        { message: 'WABA ID is required' },
        { status: 400 },
      );
    }

    console.log('[DEBUG] complete-direct API route hit', {
      wabaId: body.wabaId,
      phoneNumberId: body.phoneNumberId,
      statePreview: body.state?.slice(0, 25),
    });

    // No auth token needed - the state JWT is the authentication
    const data = await apiClient<CompleteDirectResponse>(
      '/meta/embedded-signup/complete-direct',
      {
        method: 'POST',
        body: JSON.stringify(body),
        // No token - this endpoint uses state JWT for auth
      },
    );

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to complete direct embedded signup:', error);

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
