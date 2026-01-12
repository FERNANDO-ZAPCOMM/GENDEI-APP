'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAdminAuth } from '@/lib/auth-provider';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  Calendar,
  CreditCard,
  Activity,
  HeadphonesIcon,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Clinics', href: '/dashboard/clinics', icon: Building2 },
  { name: 'Appointments', href: '/dashboard/appointments', icon: Calendar },
  { name: 'Payments', href: '/dashboard/payments', icon: CreditCard },
  { name: 'Health', href: '/dashboard/health', icon: Activity },
  { name: 'Support', href: '/dashboard/support', icon: HeadphonesIcon },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, isAdmin, signOut } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push('/login');
    }
  }, [user, loading, isAdmin, router]);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/login';
    } catch (error) {
      console.error('Error signing out:', error);
      window.location.href = '/login';
    }
  };

  if (loading || !user || !isAdmin) {
    return (
      <div className="min-h-screen bg-white">
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
        <div className="flex items-center px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 -ml-2 hover:bg-gray-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <span className="text-xl text-primary logo-font">gendei</span>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 transition-transform duration-300',
          'lg:z-0 z-40',
          'lg:translate-x-0',
          mobileMenuOpen ? 'translate-x-0' : 'lg:translate-x-0 -translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo - Desktop only */}
          <div className="p-6 hidden lg:block">
            <span className="text-2xl text-primary logo-font">gendei</span>
            <p className="text-sm text-muted-foreground mt-1">Admin Dashboard</p>
          </div>

          {/* Mobile header spacer */}
          <div className="lg:hidden p-4 pt-20 border-b border-gray-200">
            <p className="text-sm text-muted-foreground">Admin Dashboard</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                    isActive
                      ? 'bg-gray-100 text-gray-900 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-normal'
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-gray-200">
            <div className="mb-3">
              <p className="text-sm font-normal text-gray-900 truncate">{user.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-start gap-2 px-4 py-2 text-sm font-normal text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-gray-200 rounded-full transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 pt-16 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="page-transition">{children}</div>
        </div>
      </div>
    </div>
  );
}
