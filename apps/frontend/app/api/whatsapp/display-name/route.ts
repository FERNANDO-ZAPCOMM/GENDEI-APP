import { NextRequest, NextResponse } from 'next/server';

import { apiClient } from '@/lib/api';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { message: 'Authorization token is required' },
        { status: 401 },
      );
    }

    const token = authHeader.slice('Bearer '.length);
    const { searchParams } = new URL(request.url);
    const phoneNumberId = searchParams.get('phoneNumberId');

    if (!phoneNumberId) {
      return NextResponse.json(
        { message: 'phoneNumberId is required' },
        { status: 400 },
      );
    }

    const data = await apiClient(
      `/whatsapp/display-name?phoneNumberId=${encodeURIComponent(phoneNumberId)}`,
      {
        token,
      },
    );

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to fetch display name status:', error);

    const status = error?.status ?? 500;
    const message = error?.message || 'Failed to fetch display name status';

    return NextResponse.json(
      { message, details: error?.data ?? null },
      { status },
    );
  }
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
    const body = await request.json().catch(() => ({}));

    if (!body?.phoneNumberId || !body?.newDisplayName) {
      return NextResponse.json(
        { message: 'phoneNumberId and newDisplayName are required' },
        { status: 400 },
      );
    }

    const data = await apiClient('/whatsapp/display-name', {
      method: 'POST',
      body: JSON.stringify(body),
      token,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to update display name:', error);

    const status = error?.status ?? 500;
    const message = error?.message || 'Failed to update display name';

    return NextResponse.json(
      { message, details: error?.data ?? null },
      { status },
    );
  }
}
