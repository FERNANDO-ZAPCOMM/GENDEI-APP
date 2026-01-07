'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { TypingDots } from '@/components/PageLoader';

interface AuthGuardProps {
  children: React.ReactNode;
}

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/signin', '/signup', '/login', '/register', '/products/upload'];

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, loading: authLoading } = useAuth();

  // Extract locale and path
  const locale = pathname.split('/')[1] || 'pt-BR';
  const currentPath = pathname.replace(`/${locale}`, '') || '/';

  // Determine if this is a public route
  const isPublicRoute = PUBLIC_ROUTES.some((route) => currentPath.startsWith(route));

  useEffect(() => {
    // Allow public routes without any checks
    if (isPublicRoute) {
      return;
    }

    // Wait for auth to initialize
    if (authLoading) {
      return;
    }

    // Not authenticated - redirect to signin
    if (!currentUser) {
      router.replace(`/${locale}/signin`);
    }
  }, [currentUser, authLoading, isPublicRoute, locale, router]);

  // Show public routes immediately
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Show loading while auth initializes
  if (authLoading) {
    return <LoadingScreen />;
  }

  // Show loading while redirecting unauthenticated users
  if (!currentUser) {
    return <LoadingScreen />;
  }

  // User is authenticated - show content
  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="bg-white rounded-full px-5 py-3 shadow-sm border border-slate-100">
        <TypingDots size="lg" />
      </div>
    </div>
  );
}
