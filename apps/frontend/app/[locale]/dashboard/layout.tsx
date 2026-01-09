'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LogOut,
  LayoutDashboard,
  MessageSquare,
  Settings,
  ChevronDown,
  ChevronRight,
  User,
  Menu,
  X,
  Users,
  Calendar,
  UserPlus,
  Stethoscope,
  ClipboardList,
  Clock,
  CreditCard,
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';

import { useAuth } from '@/hooks/use-auth';
import { useClinic } from '@/hooks/use-clinic';
import { Button } from '@/components/ui/button';
import { TypingDots } from '@/components/PageLoader';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  children?: NavItem[];
}

// Gendei clinic navigation structure
const navigation: NavItem[] = [
  { name: 'overview', href: '/dashboard', icon: LayoutDashboard },
  {
    name: 'agenda',
    href: '#',
    icon: Calendar,
    children: [
      { name: 'appointments', href: '/dashboard/appointments', icon: Calendar },
      { name: 'professionals', href: '/dashboard/professionals', icon: UserPlus },
      { name: 'services', href: '/dashboard/services', icon: ClipboardList },
      { name: 'schedule', href: '/dashboard/schedule', icon: Clock },
    ],
  },
  {
    name: 'patients',
    href: '#',
    icon: Users,
    children: [
      { name: 'patientList', href: '/dashboard/patients', icon: Users },
      { name: 'conversations', href: '/dashboard/conversations', icon: MessageSquare },
    ],
  },
  {
    name: 'configuration',
    href: '#',
    icon: Settings,
    children: [
      { name: 'clinic', href: '/dashboard/clinic', icon: Stethoscope },
      { name: 'payments', href: '/dashboard/payments', icon: CreditCard },
      { name: 'whatsapp', href: '/dashboard/whatsapp', icon: FaWhatsapp },
      { name: 'account', href: '/dashboard/account', icon: User },
    ],
  },
];

function NavigationItems({
  navigation,
  pathname,
  t,
  userRole,
}: {
  navigation: NavItem[];
  pathname: string;
  t: any;
  userRole: any;
}) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    agenda: true,
    patients: true,
    configuration: true,
  });

  const locale = pathname.split('/')[1];

  const toggleSection = (name: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const isActive = (href: string) => {
    const fullPath = `/${locale}${href}`;

    // Exact match for overview/dashboard
    if (href === '/dashboard') {
      return pathname === fullPath;
    }

    // For nested routes, check if this is the most specific match
    // to avoid highlighting both parent and child items
    const allHrefs = navigation.flatMap((item) =>
      item.children ? item.children.map((c) => c.href) : [item.href]
    ).filter((h) => h !== '#');

    // Check if there's a more specific route that matches
    const hasMoreSpecificMatch = allHrefs.some(
      (otherHref) =>
        otherHref !== href &&
        otherHref.startsWith(href) &&
        pathname.startsWith(`/${locale}${otherHref}`)
    );

    if (hasMoreSpecificMatch) {
      return false;
    }

    // Check for exact match first, then prefix match
    return pathname === fullPath || pathname.startsWith(`${fullPath}/`);
  };

  const renderNavItem = (item: NavItem, level: number = 0) => {
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedSections[item.name];
    const fullHref = item.href === '#' ? undefined : `/${locale}${item.href}`;
    const active = fullHref ? isActive(item.href) : false;

    // For Gendei, show all navigation items (no role-based filtering)
    const visibleChildren = item.children || [];

    return (
      <div key={item.name}>
        {hasChildren ? (
          <>
            <button
              onClick={() => toggleSection(item.name)}
              className={cn(
                'w-full flex items-center justify-between px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                level === 0
                  ? 'text-gray-500 uppercase text-xs tracking-wider mt-4'
                  : 'text-gray-700 hover:bg-gray-100',
                level > 0 && active && 'bg-gray-100'
              )}
              style={{ paddingLeft: `${level * 12 + 16}px` }}
            >
              <div className="flex items-center gap-3">
                {level > 0 && <Icon className="w-4 h-4" />}
                {t(`dashboard.${item.name}`)}
              </div>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            {isExpanded && visibleChildren.length > 0 && (
              <div className="mt-1 space-y-1">
                {visibleChildren.map((child) => renderNavItem(child, level + 1))}
              </div>
            )}
          </>
        ) : (
          <Link
            href={fullHref || '#'}
            className={cn(
              'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              active
                ? 'bg-gray-100 text-gray-900 font-semibold'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
            style={{ paddingLeft: `${level * 12 + 16}px` }}
          >
            <Icon className="w-4 h-4" />
            {t(`dashboard.${item.name}`)}
          </Link>
        )}
      </div>
    );
  };

  return <>{navigation.map((item) => renderNavItem(item))}</>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, signOut, loading: authLoading } = useAuth();
  const { currentClinic: clinic, isLoading: clinicLoading } = useClinic();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      const locale = pathname.split('/')[1];
      router.push(`/${locale}/signin`);
    }
  }, [currentUser, authLoading, router, pathname]);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    try {
      await signOut();
      const locale = pathname.split('/')[1];
      // Force navigation to signin page using window.location for full page reload
      window.location.href = `/${locale}/signin`;
    } catch (error) {
      console.error('Error signing out:', error);
      // Still redirect even if there's an error
      const locale = pathname.split('/')[1];
      window.location.href = `/${locale}/signin`;
    }
  };

  if (authLoading || clinicLoading || !currentUser) {
    return (
      <div className="min-h-screen bg-white">
        <div className="min-h-screen flex items-center justify-center">
          <div className="bg-white rounded-full px-5 py-3 shadow-sm border border-slate-100">
            <TypingDots size="lg" />
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
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <span className="text-xl text-black logo-font">Gendei</span>
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
          {/* Logo/Brand - Always visible on desktop, hidden on mobile (shown in header instead) */}
          <div className="p-6 hidden lg:block">
            <span className="text-2xl text-black logo-font">Gendei</span>
            {clinic && <p className="text-sm text-muted-foreground mt-1">{clinic.name}</p>}
          </div>

          {/* Mobile clinic name */}
          <div className="lg:hidden p-4 pt-20 border-b border-gray-200">
            {clinic && <p className="text-sm text-muted-foreground">{clinic.name}</p>}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <NavigationItems navigation={navigation} pathname={pathname} t={t} userRole={null} />
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-gray-200">
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-900 truncate">{currentUser.email}</p>
            </div>
            <Button variant="outline" className="w-full justify-start" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              {t('auth.signout')}
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 pt-16 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
