'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { Permission } from '@/lib/permissions';
import { PageLoader } from '@/components/PageLoader';
import { toast } from 'sonner';

interface PermissionGuardProps {
  children: React.ReactNode;
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean; // If true, requires all permissions. Default: false (any)
  fallbackPath?: string; // Where to redirect if no access. Default: '/dashboard'
  showToast?: boolean; // Show error toast on redirect. Default: true
}

/**
 * Component-level permission guard
 * Redirects users without required permissions
 *
 * Usage:
 * <PermissionGuard permission="canManageProducts">
 *   <ProductManagementUI />
 * </PermissionGuard>
 */
export function PermissionGuard({
  children,
  permission,
  permissions,
  requireAll = false,
  fallbackPath = '/dashboard',
  showToast = true,
}: PermissionGuardProps) {
  const router = useRouter();
  const permissionsHook = usePermissions();
  const { loading } = permissionsHook;

  // Determine if user has access
  const hasAccess = () => {
    if (permission) {
      return permissionsHook.hasPermission(permission);
    }
    if (permissions && permissions.length > 0) {
      return requireAll
        ? permissionsHook.hasAllPermissions(permissions)
        : permissionsHook.hasAnyPermission(permissions);
    }
    // No permissions specified, allow access
    return true;
  };

  useEffect(() => {
    if (!loading) {
      const access = hasAccess();
      if (!access) {
        if (showToast) {
          toast.error('You do not have permission to access this page');
        }
        router.push(fallbackPath);
      }
    }
  }, [loading, hasAccess, showToast, router, fallbackPath]);

  // Show loader while checking permissions
  if (loading) {
    return <PageLoader />;
  }

  // Don't render anything if no access (during redirect)
  if (!hasAccess()) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Higher-order component version of PermissionGuard
 *
 * Usage:
 * export default withPermissionGuard(ProductsPage, {
 *   permission: 'canViewProducts'
 * });
 */
export function withPermissionGuard<P extends object>(
  Component: React.ComponentType<P>,
  guardProps: Omit<PermissionGuardProps, 'children'>
) {
  return function GuardedComponent(props: P) {
    return (
      <PermissionGuard {...guardProps}>
        <Component {...props} />
      </PermissionGuard>
    );
  };
}
