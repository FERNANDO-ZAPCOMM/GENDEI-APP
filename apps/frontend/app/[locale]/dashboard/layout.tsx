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
  Users,
  Calendar,
  UserPlus,
  Stethoscope,
  CreditCard,
  Bot,
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';

import { useAuth } from '@/hooks/use-auth';
import { useClinic, useClinicStats } from '@/hooks/use-clinic';
import { useSidebarNotifications, SidebarNotification } from '@/hooks/use-sidebar-notifications';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TypingDots } from '@/components/PageLoader';
import { cn } from '@/lib/utils';
import { useVertical } from '@/lib/vertical-provider';

// Pulsing dot indicator component
function NotificationDot({ notification, size = 'sm' }: { notification: SidebarNotification | null; size?: 'sm' | 'md' }) {
  if (!notification) return null;

  const sizeClasses = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';

  // Color based on notification type
  const colorClasses = {
    onboarding: 'bg-orange-500', // Orange for onboarding items
    action: 'bg-blue-500',       // Blue for pending actions
    alert: 'bg-red-500',         // Red for alerts/escalations
  }[notification.type];

  return (
    <span className="relative flex">
      <span
        className={cn(
          sizeClasses,
          colorClasses,
          'rounded-full animate-pulse'
        )}
      />
      <span
        className={cn(
          sizeClasses,
          colorClasses,
          'absolute rounded-full animate-ping opacity-75'
        )}
      />
    </span>
  );
}

// Badge with count for action items
function NotificationBadge({ notification }: { notification: SidebarNotification | null }) {
  if (!notification || !notification.count) return null;

  const colorClasses = {
    onboarding: 'bg-orange-100 text-orange-700',
    action: 'bg-blue-100 text-blue-700',
    alert: 'bg-red-100 text-red-700',
  }[notification.type];

  return (
    <Badge variant="secondary" className={cn('text-xs ml-auto', colorClasses)}>
      {notification.count}
    </Badge>
  );
}

interface NavItem {
  name: string;
  href: string;
  icon: any;
  children?: NavItem[];
  badge?: number;
  notificationKey?: keyof ReturnType<typeof useSidebarNotifications>; // Key to lookup notification
  step?: number; // Onboarding step number (1-4)
}

// Gendei clinic navigation structure
// Organized by: Overview → Agenda Section → Patients Section → Professionals Section → Configuration
const navigation: NavItem[] = [
  { name: 'overview', href: '/dashboard', icon: LayoutDashboard },
  {
    name: 'agendaSection',
    href: '#',
    icon: Calendar,
    children: [
      { name: 'agenda', href: '/dashboard/appointments', icon: Calendar, notificationKey: 'appointments' },
    ],
  },
  {
    name: 'patientsSection',
    href: '#',
    icon: Users,
    children: [
      { name: 'patients', href: '/dashboard/patients', icon: Users, notificationKey: 'patients' },
      { name: 'conversations', href: '/dashboard/conversations', icon: MessageSquare, notificationKey: 'conversations' },
    ],
  },
  {
    name: 'professionalsSection',
    href: '#',
    icon: UserPlus,
    children: [
      { name: 'professionals', href: '/dashboard/professionals', icon: UserPlus, notificationKey: 'professionals' },
    ],
  },
  {
    name: 'configuration',
    href: '#',
    icon: Settings,
    children: [
      { name: 'clinic', href: '/dashboard/clinic', icon: Stethoscope, notificationKey: 'clinic', step: 1 },
      { name: 'payments', href: '/dashboard/payments', icon: CreditCard, notificationKey: 'payments', step: 2 },
      { name: 'whatsapp', href: '/dashboard/whatsapp', icon: FaWhatsapp, notificationKey: 'whatsapp', step: 3 },
      { name: 'workflow', href: '/dashboard/workflow', icon: Bot, step: 4 },
      { name: 'account', href: '/dashboard/account', icon: User },
    ],
  },
];

function NavigationItems({
  navigation,
  pathname,
  t,
  collapsed,
  todayCount,
  notifications,
}: {
  navigation: NavItem[];
  pathname: string;
  t: any;
  collapsed: boolean;
  todayCount: number;
  notifications: ReturnType<typeof useSidebarNotifications>;
}) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    agendaSection: true,
    professionalsSection: true,
    patientsSection: true,
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

    if (href === '/dashboard') {
      return pathname === fullPath;
    }

    const allHrefs = navigation.flatMap((item) =>
      item.children ? item.children.map((c) => c.href) : [item.href]
    ).filter((h) => h !== '#');

    const hasMoreSpecificMatch = allHrefs.some(
      (otherHref) =>
        otherHref !== href &&
        otherHref.startsWith(href) &&
        pathname.startsWith(`/${locale}${otherHref}`)
    );

    if (hasMoreSpecificMatch) {
      return false;
    }

    return pathname === fullPath || pathname.startsWith(`${fullPath}/`);
  };

  const renderNavItem = (item: NavItem, level: number = 0) => {
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedSections[item.name];
    const fullHref = item.href === '#' ? undefined : `/${locale}${item.href}`;
    const active = fullHref ? isActive(item.href) : false;
    const visibleChildren = item.children || [];

    // Show today count badge on agenda
    const showBadge = item.name === 'agenda' && todayCount > 0;

    // Get notification for this item
    const notification = item.notificationKey
      ? notifications[item.notificationKey] as SidebarNotification | null
      : null;

    // Check if any children have notifications (for section headers)
    const hasChildNotifications = hasChildren && visibleChildren.some((child) => {
      const childNotification = child.notificationKey
        ? notifications[child.notificationKey] as SidebarNotification | null
        : null;
      return childNotification !== null;
    });

    if (collapsed && level === 0) {
      // Collapsed view - icons only
      if (hasChildren) {
        return (
          <DropdownMenu key={item.name}>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'w-full flex items-center justify-center p-3 rounded-lg transition-colors',
                  'text-gray-600 hover:bg-gray-100'
                )}
              >
                <Icon className="w-5 h-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-48">
              <DropdownMenuLabel className="text-xs text-gray-500 uppercase">
                {t(`dashboard.${item.name}`)}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {visibleChildren.map((child) => {
                const ChildIcon = child.icon;
                return (
                  <DropdownMenuItem key={child.name} asChild>
                    <Link href={`/${locale}${child.href}`} className="flex items-center gap-2">
                      <ChildIcon className="w-4 h-4" />
                      {t(`dashboard.${child.name}`)}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }

      return (
        <Link
          key={item.name}
          href={fullHref || '#'}
          className={cn(
            'flex items-center justify-center p-3 rounded-lg transition-colors relative',
            active
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          )}
          title={t(`dashboard.${item.name}`)}
        >
          <Icon className="w-5 h-5" />
          {showBadge && (
            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {todayCount}
            </span>
          )}
        </Link>
      );
    }

    // Expanded view
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
                {/* Show dot on section header if any children have notifications */}
                {hasChildNotifications && !isExpanded && (
                  <NotificationDot notification={{ type: 'onboarding', priority: 1 }} size="sm" />
                )}
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
            {/* Step number indicator for configuration items */}
            {item.step ? (
              <div className="relative">
                {/* Check if this step is complete */}
                {(() => {
                  const isComplete = item.step < notifications.onboardingStep ||
                    (item.step === 4 && notifications.onboardingComplete);
                  const isCurrentStep = item.step === notifications.onboardingStep && !notifications.onboardingComplete;

                  return (
                    <>
                      <div
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold',
                          isComplete
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 text-gray-600'
                        )}
                      >
                        {item.step}
                      </div>
                      {/* Flashing dot on current step */}
                      {isCurrentStep && (
                        <span className="absolute -top-1 -right-1">
                          <NotificationDot notification={{ type: 'onboarding', priority: 1 }} size="sm" />
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="relative">
                <Icon className="w-4 h-4" />
                {/* Notification dot on icon */}
                {notification && (
                  <span className="absolute -top-1 -right-1">
                    <NotificationDot notification={notification} size="sm" />
                  </span>
                )}
              </div>
            )}
            <span className={cn(
              'flex-1',
              item.step && item.step < notifications.onboardingStep && 'text-green-700'
            )}>{t(`dashboard.${item.name}`)}</span>
            {/* Show count badge for action notifications */}
            {notification?.count ? (
              <NotificationBadge notification={notification} />
            ) : showBadge ? (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                {todayCount}
              </Badge>
            ) : null}
          </Link>
        )}
      </div>
    );
  };

  return <>{navigation.map((item) => renderNavItem(item))}</>;
}

// Mobile Bottom Navigation
function MobileBottomNav({
  pathname,
  locale,
  notifications,
}: {
  pathname: string;
  locale: string;
  notifications: ReturnType<typeof useSidebarNotifications>;
}) {
  const bottomNavItems = [
    { name: 'Início', href: '/dashboard', icon: LayoutDashboard, notificationKey: null },
    { name: 'Agenda', href: '/dashboard/appointments', icon: Calendar, notificationKey: 'appointments' as const },
    { name: 'Pacientes', href: '/dashboard/patients', icon: Users, notificationKey: 'patients' as const },
    { name: 'Config', href: '/dashboard/clinic', icon: Settings, notificationKey: 'clinic' as const },
  ];

  const isActive = (href: string) => {
    const fullPath = `/${locale}${href}`;
    if (href === '/dashboard') return pathname === fullPath;
    return pathname.startsWith(fullPath);
  };

  // Check if config section has any notifications (clinic, payments, whatsapp)
  const configHasNotification = notifications.clinic || notifications.payments || notifications.whatsapp;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom">
      <div className="flex items-center justify-around py-2">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          // Get notification - for Config, check all config items
          const notification = item.name === 'Config'
            ? configHasNotification
              ? { type: 'onboarding' as const, priority: 1 }
              : null
            : item.notificationKey
              ? notifications[item.notificationKey] as SidebarNotification | null
              : null;

          return (
            <Link
              key={item.name}
              href={`/${locale}${item.href}`}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px] relative',
                active ? 'text-blue-600' : 'text-gray-500'
              )}
            >
              <div className="relative">
                <Icon className={cn('w-5 h-5', active && 'text-blue-600')} />
                {notification && (
                  <span className="absolute -top-1 -right-1">
                    <NotificationDot notification={notification} size="sm" />
                  </span>
                )}
              </div>
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, signOut, loading: authLoading } = useAuth();
  const { currentClinic: clinic, isLoading: clinicLoading } = useClinic();
  const { data: stats } = useClinicStats(clinic?.id || '');
  const notifications = useSidebarNotifications();
  const vertical = useVertical();

  const locale = pathname.split('/')[1];
  const todayCount = stats?.todayAppointments || 0;

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push(`/${locale}/signin`);
    }
  }, [currentUser, authLoading, router, locale]);

  useEffect(() => {
    if (authLoading || clinicLoading || !currentUser) return;

    const clinicPath = `/${locale}/dashboard/clinic`;
    const isClinicPage = pathname === clinicPath || pathname.startsWith(`${clinicPath}/`);

    if (notifications.clinic && !isClinicPage) {
      router.replace(clinicPath);
    }
  }, [authLoading, clinicLoading, currentUser, pathname, locale, notifications.clinic, router]);

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = `/${locale}/signin`;
    } catch (error) {
      console.error('Error signing out:', error);
      window.location.href = `/${locale}/signin`;
    }
  };

  if (authLoading || clinicLoading || !currentUser) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <TypingDots size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
        <div className="flex items-center justify-center px-4 py-3">
          <span className="text-xl text-black logo-font">Gendei</span>
          {vertical.slug !== 'geral' && (
            <span className="text-xl text-gray-400 logo-font ml-1">- {vertical.slug}</span>
          )}
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex-col z-40">
        {/* Logo */}
        <div className="p-6">
          <span className="text-2xl text-black logo-font">Gendei</span>
          {vertical.slug !== 'geral' && (
            <span className="text-2xl text-gray-400 logo-font ml-1">- {vertical.slug}</span>
          )}
          <p className="text-sm text-muted-foreground mt-1 truncate">{clinic?.name || 'Painel da Clínica'}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <NavigationItems
            navigation={navigation}
            pathname={pathname}
            t={t}
            collapsed={false}
            todayCount={todayCount}
            notifications={notifications}
          />
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-gray-200">
          <div className="mb-3">
            <p className="text-sm font-normal text-gray-900 truncate">{currentUser.email}</p>
            <p className="text-xs text-gray-500">{clinic?.name}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-start gap-2 px-4 py-2 text-sm font-normal text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-gray-200 rounded-full transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t('auth.signout')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="md:pl-64 pt-16 md:pt-0 pb-20 md:pb-0">
        <div className="p-4 sm:p-6 md:p-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav pathname={pathname} locale={locale} notifications={notifications} />
    </div>
  );
}
