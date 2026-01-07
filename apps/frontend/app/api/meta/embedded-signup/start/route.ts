import { NextRequest, NextResponse } from 'next/server';

import { apiClient } from '@/lib/api';
import type {
  EmbeddedSignupStartRequest,
  EmbeddedSignupStartResponse,
} from '@/lib/types';

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
    const body = (await request
      .json()
      .catch(() => ({}))) as EmbeddedSignupStartRequest;

    // Use a canonical, non-www redirect URL (Meta requires exact match)
    const redirectUrl = (() => {
      const envRedirect = process.env.NEXT_PUBLIC_EMBEDDED_SIGNUP_REDIRECT_URL;
      if (envRedirect) return envRedirect;

      const frontendBase =
        process.env.NEXT_PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL;
      if (frontendBase) return `${frontendBase.replace(/\/$/, '')}/meta/callback`;

      return 'https://go.zapcomm.app/meta/callback';
    })();

    const data = await apiClient<EmbeddedSignupStartResponse>(
      '/meta/embedded-signup/start',
      {
        method: 'POST',
        body: JSON.stringify({
          ...body,
          redirectUrl,
        }),
        token,
      },
    );

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to start embedded signup:', error);

    const status = error?.status ?? 500;
    const message =
      error?.message || 'Failed to start embedded signup session with Meta';

    return NextResponse.json(
      {
        message,
        details: error?.data ?? null,
      },
      { status },
    );
  }
}
