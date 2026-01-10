'use client';

import { useEffect, useState, useMemo } from 'react';
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
  ChevronLeft,
  User,
  Menu,
  X,
  Users,
  Calendar,
  UserPlus,
  Stethoscope,
  ClipboardList,
  CreditCard,
  Search,
  Bell,
  Plus,
  CalendarPlus,
  UserPlus2,
  Clock,
  PanelLeftClose,
  PanelLeft,
  Building2,
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';

import { useAuth } from '@/hooks/use-auth';
import { useClinic, useClinicStats } from '@/hooks/use-clinic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { TypingDots } from '@/components/PageLoader';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  children?: NavItem[];
  badge?: number;
}

// Gendei clinic navigation structure
// Organized by: Operational (daily use) → Patient Management → Team → Configuration (setup)
const navigation: NavItem[] = [
  { name: 'overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'agenda', href: '/dashboard/appointments', icon: Calendar },
  {
    name: 'patientsSection',
    href: '#',
    icon: Users,
    children: [
      { name: 'patients', href: '/dashboard/patients', icon: Users },
      { name: 'conversations', href: '/dashboard/conversations', icon: MessageSquare },
    ],
  },
  {
    name: 'teamSection',
    href: '#',
    icon: Building2,
    children: [
      { name: 'professionals', href: '/dashboard/professionals', icon: UserPlus },
      { name: 'services', href: '/dashboard/services', icon: ClipboardList },
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
  collapsed,
  todayCount,
}: {
  navigation: NavItem[];
  pathname: string;
  t: any;
  collapsed: boolean;
  todayCount: number;
}) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    patientsSection: true,
    teamSection: true,
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
            <span className="flex-1">{t(`dashboard.${item.name}`)}</span>
            {showBadge && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                {todayCount}
              </Badge>
            )}
          </Link>
        )}
      </div>
    );
  };

  return <>{navigation.map((item) => renderNavItem(item))}</>;
}

// Quick Add Dialog
function QuickAddDialog({ locale }: { locale: string }) {
  const [open, setOpen] = useState(false);

  const quickActions = [
    { name: 'Nova Consulta', href: `/dashboard/appointments`, icon: CalendarPlus, description: 'Agendar consulta' },
    { name: 'Novo Paciente', href: `/dashboard/patients/new`, icon: UserPlus2, description: 'Cadastrar paciente' },
    { name: 'Bloquear Horário', href: `/dashboard/appointments`, icon: Clock, description: 'Bloquear agenda' },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Novo</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ação Rápida</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.name}
                href={`/${locale}${action.href}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-4 p-4 rounded-lg border hover:bg-gray-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium">{action.name}</p>
                  <p className="text-sm text-gray-500">{action.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Mobile Bottom Navigation
function MobileBottomNav({ pathname, locale }: { pathname: string; locale: string }) {
  const bottomNavItems = [
    { name: 'Início', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Agenda', href: '/dashboard/appointments', icon: Calendar },
    { name: 'Pacientes', href: '/dashboard/patients', icon: Users },
    { name: 'Config', href: '/dashboard/clinic', icon: Settings },
  ];

  const isActive = (href: string) => {
    const fullPath = `/${locale}${href}`;
    if (href === '/dashboard') return pathname === fullPath;
    return pathname.startsWith(fullPath);
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom">
      <div className="flex items-center justify-around py-2">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.name}
              href={`/${locale}${item.href}`}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]',
                active ? 'text-blue-600' : 'text-gray-500'
              )}
            >
              <Icon className={cn('w-5 h-5', active && 'text-blue-600')} />
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const locale = pathname.split('/')[1];
  const todayCount = stats?.todayAppointments || 0;

  // Mock notifications (replace with real data)
  const notifications = [
    { id: 1, title: 'Nova consulta agendada', time: '5 min atrás' },
    { id: 2, title: 'Paciente confirmou presença', time: '15 min atrás' },
  ];

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push(`/${locale}/signin`);
    }
  }, [currentUser, authLoading, router, locale]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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
      {/* Desktop Header */}
      <header className={cn(
        'hidden md:flex fixed top-0 right-0 z-30 h-16 bg-white border-b border-gray-200 items-center justify-between px-6 transition-all',
        sidebarCollapsed ? 'left-16' : 'left-64'
      )}>
        {/* Search Bar */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Buscar pacientes, consultas..."
              className="pl-10 bg-gray-50 border-gray-200 focus:bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <QuickAddDialog locale={locale} />

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-10 w-10">
                <Bell className="w-6 h-6" />
                {notifications.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notificações</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  Nenhuma notificação
                </div>
              ) : (
                notifications.map((notif) => (
                  <DropdownMenuItem key={notif.id} className="flex flex-col items-start gap-1 py-3">
                    <span className="font-medium">{notif.title}</span>
                    <span className="text-xs text-gray-500">{notif.time}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xl text-black logo-font">Gendei</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setSearchOpen(!searchOpen)}>
              <Search className="w-5 h-5" />
            </Button>
            <QuickAddDialog locale={locale} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-5 h-5" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                      {notifications.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Notificações</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.map((notif) => (
                  <DropdownMenuItem key={notif.id} className="flex flex-col items-start gap-1 py-3">
                    <span className="font-medium text-sm">{notif.title}</span>
                    <span className="text-xs text-gray-500">{notif.time}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {/* Mobile Search Bar */}
        {searchOpen && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="search"
                placeholder="Buscar..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
          </div>
        )}
      </div>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:flex fixed inset-y-0 left-0 bg-white border-r border-gray-200 flex-col transition-all duration-300 z-40',
          sidebarCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className={cn(
          'h-16 flex items-center border-b border-gray-200',
          sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'
        )}>
          {!sidebarCollapsed && (
            <div>
              <span className="text-xl text-black logo-font">Gendei</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="h-8 w-8"
          >
            {sidebarCollapsed ? (
              <PanelLeft className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className={cn(
          'flex-1 overflow-y-auto',
          sidebarCollapsed ? 'p-2 space-y-2' : 'p-4 space-y-1'
        )}>
          <NavigationItems
            navigation={navigation}
            pathname={pathname}
            t={t}
            collapsed={sidebarCollapsed}
            todayCount={todayCount}
          />
        </nav>

        {/* User section - only show when expanded */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t border-gray-200">
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-900 truncate">{currentUser.email}</p>
              <p className="text-xs text-gray-500">{clinic?.name}</p>
            </div>
            <Button variant="outline" className="w-full justify-start" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              {t('auth.signout')}
            </Button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className={cn(
        'transition-all duration-300 pt-16 pb-20 md:pb-0',
        sidebarCollapsed ? 'md:pl-16' : 'md:pl-64'
      )}>
        <div className="p-4 sm:p-6 md:p-6">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav pathname={pathname} locale={locale} />
    </div>
  );
}
