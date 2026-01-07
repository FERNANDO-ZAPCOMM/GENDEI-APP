import { NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

// Protected routes that require authentication
const PROTECTED_PATHS = [
  '/dashboard',
  '/settings',
  '/products',
  '/orders',
  '/conversations',
  '/connections',
  '/payments',
  '/sales',
];

// Public routes that don't require authentication
const PUBLIC_PATHS = [
  '/signin',
  '/signup',
  '/not-found',
  '/meta/callback',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for API routes (they don't need locale handling)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip middleware for /meta/callback (OAuth callback - must not have locale prefix)
  if (pathname === '/meta/callback' || pathname.startsWith('/meta/callback?')) {
    return NextResponse.next();
  }

  // Extract locale from path (supports pt-BR and en)
  const localeMatch = pathname.match(/^\/(pt-BR|en)/);
  const currentLocale = localeMatch ? localeMatch[1] : 'pt-BR';
  const pathnameWithoutLocale = pathname.replace(/^\/(pt-BR|en)/, '');

  // Check if the path is protected
  const isProtectedPath = PROTECTED_PATHS.some((path) =>
    pathnameWithoutLocale.startsWith(path)
  );

  const isPublicPath = PUBLIC_PATHS.some((path) =>
    pathnameWithoutLocale.startsWith(path)
  );

  // Only check auth for protected routes
  if (isProtectedPath && !isPublicPath) {
    // Check for Firebase auth cookie or session
    const authCookie = request.cookies.get('__session')?.value;

    // If no auth cookie, redirect to signin (preserving current locale)
    if (!authCookie) {
      const url = request.nextUrl.clone();
      url.pathname = `/${currentLocale}/signin`;
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
  }

  // If user is authenticated and trying to access signin/signup, redirect to dashboard
  // BUT allow access when there's an explicit redirect param (avoids redirect loops when a stale cookie exists)
  if (isPublicPath && (pathnameWithoutLocale === '/signin' || pathnameWithoutLocale === '/signup')) {
    const authCookie = request.cookies.get('__session')?.value;
    const hasRedirectParam = request.nextUrl.searchParams.has('redirect');

    if (authCookie && !hasRedirectParam) {
      const url = request.nextUrl.clone();
      url.pathname = `/${currentLocale}/dashboard`;
      return NextResponse.redirect(url);
    }
  }

  // Apply internationalization middleware
  // Type assertion to handle Next.js type conflicts in monorepo setup
  return intlMiddleware(request as any);
}

export const config = {
  matcher: [
    '/',
    '/pt-BR/:path*',
    '/en/:path*',
    // Skip Next.js internals, static files, and OAuth callback
    '/((?!_next|_vercel|api|meta/callback|.*\\..*).*)',
  ],
};
