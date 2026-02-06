const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Vertical slug sent as X-Vertical header on every API call
let _verticalSlug = 'geral';

export function setApiVerticalSlug(slug: string) {
  _verticalSlug = slug;
}

type ApiClientOptions = RequestInit & {
  token?: string;
  suppressErrorLog?: boolean;
};

export async function apiClient<T>(
  endpoint: string,
  options?: ApiClientOptions
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const { token, suppressErrorLog, ...fetchOptions } = options || {};
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Vertical': _verticalSlug,
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(fetchOptions.headers || {}),
  };

  const response = await fetch(url, { ...fetchOptions, headers });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({
      message: 'Request failed',
    }));

    const is404 = response.status === 404;
    const isSuppressed = suppressErrorLog || is404;

    // Only log non-404 errors that aren't explicitly suppressed
    if (!isSuppressed) {
      console.error('API Error:', {
        url,
        status: response.status,
        errorBody,
      });
    }

    // Extract detailed error message from various backend error formats
    let errorMessage = errorBody.message || `Request failed with status ${response.status}`;

    // Handle NestJS validation errors
    if (errorBody.message && Array.isArray(errorBody.message)) {
      errorMessage = errorBody.message.join(', ');
    }

    // Handle detailed validation errors
    if (errorBody.errors && Array.isArray(errorBody.errors)) {
      errorMessage = errorBody.errors.map((e: any) => e.message || e).join(', ');
    }

    const error = new Error(errorMessage) as Error & { status?: number; data?: unknown };
    error.status = response.status;
    error.data = errorBody;
    throw error;
  }

  // Handle 204 No Content (common for DELETE requests)
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}
