'use client';

import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { Permission, TeamRole } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Lock, Eye } from 'lucide-react';
import { ReadOnlyBadge } from '@/components/ui/read-only-badge';

interface PermissionWrapperProps {
  children: ReactNode;
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean;
  roles?: TeamRole[];
  fallback?: ReactNode;
  hideIfNoAccess?: boolean; // If true, completely hide the element
}

/**
 * Wrapper component that conditionally renders children based on permissions
 * Use this to show/hide entire sections of UI
 */
export function PermissionWrapper({
  children,
  permission,
  permissions,
  requireAll = false,
  roles,
  fallback = null,
  hideIfNoAccess = false,
}: PermissionWrapperProps) {
  const permissionsHook = usePermissions();

  // While loading, show children to avoid flicker
  const hasAccess = (() => {
    if (permissionsHook.loading) return true;
    if (roles && roles.length > 0) {
      return permissionsHook.hasRole(roles);
    }
    if (permission) {
      return permissionsHook.hasPermission(permission);
    }
    if (permissions && permissions.length > 0) {
      return requireAll
        ? permissionsHook.hasAllPermissions(permissions)
        : permissionsHook.hasAnyPermission(permissions);
    }
    return true;
  })();

  if (!hasAccess) {
    return hideIfNoAccess ? null : <>{fallback}</>;
  }

  return <>{children}</>;
}

interface RestrictedButtonProps extends React.ComponentProps<typeof Button> {
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean;
  roles?: TeamRole[];
  disabledMessage?: string;
}

/**
 * Button that is automatically disabled if user lacks permissions
 * Shows a tooltip with the reason when hovered
 */
export function RestrictedButton({
  permission,
  permissions,
  requireAll = false,
  roles,
  disabledMessage = 'You do not have permission to perform this action',
  children,
  disabled,
  ...props
}: RestrictedButtonProps) {
  const permissionsHook = usePermissions();

  // While loading, assume user has access to avoid double-click issues
  const hasAccess = (() => {
    if (permissionsHook.loading) return true;
    if (roles && roles.length > 0) {
      return permissionsHook.hasRole(roles);
    }
    if (permission) {
      return permissionsHook.hasPermission(permission);
    }
    if (permissions && permissions.length > 0) {
      return requireAll
        ? permissionsHook.hasAllPermissions(permissions)
        : permissionsHook.hasAnyPermission(permissions);
    }
    return true;
  })();

  const isDisabled = disabled || !hasAccess;

  return (
    <Button
      {...props}
      disabled={isDisabled}
      title={!hasAccess ? disabledMessage : undefined}
    >
      {!hasAccess && <Lock className="w-3 h-3 mr-2" />}
      {children}
    </Button>
  );
}

interface RestrictedSectionProps {
  children: ReactNode;
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean;
  roles?: TeamRole[];
  showReadOnly?: boolean; // If true, shows content in read-only mode instead of hiding
  className?: string;
}

/**
 * Section wrapper that handles both hiding and read-only modes
 * Perfect for form sections or card content
 */
export function RestrictedSection({
  children,
  permission,
  permissions,
  requireAll = false,
  roles,
  showReadOnly = false,
  className,
}: RestrictedSectionProps) {
  const permissionsHook = usePermissions();

  // While loading, show content to avoid flicker
  const hasAccess = (() => {
    if (permissionsHook.loading) return true;
    if (roles && roles.length > 0) {
      return permissionsHook.hasRole(roles);
    }
    if (permission) {
      return permissionsHook.hasPermission(permission);
    }
    if (permissions && permissions.length > 0) {
      return requireAll
        ? permissionsHook.hasAllPermissions(permissions)
        : permissionsHook.hasAnyPermission(permissions);
    }
    return true;
  })();

  if (!hasAccess && !showReadOnly) {
    return null;
  }

  if (!hasAccess && showReadOnly) {
    return (
      <div className={cn('relative', className)}>
        <div className="pointer-events-none opacity-60">{children}</div>
        <div className="absolute top-2 right-2">
          <ReadOnlyBadge />
        </div>
      </div>
    );
  }

  return <div className={className}>{children}</div>;
}

interface ReadOnlyWrapperProps {
  children: ReactNode;
  isReadOnly: boolean;
  message?: string;
  className?: string;
}

/**
 * Wrapper that makes content read-only with visual indicator
 * Use this for read-only views of data
 */
export function ReadOnlyWrapper({
  children,
  isReadOnly,
  message = 'Read-only access',
  className,
}: ReadOnlyWrapperProps) {
  if (!isReadOnly) {
    return <>{children}</>;
  }

  return (
    <div className={cn('relative', className)}>
      <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
        <Eye className="w-4 h-4" />
        <span>{message}</span>
      </div>
      <div className="pointer-events-none opacity-75">{children}</div>
    </div>
  );
}

/**
 * Hook to check if current view should be read-only based on permissions
 */
export function useReadOnlyMode(
  viewPermission: Permission,
  managePermission: Permission
): boolean {
  const permissionsHook = usePermissions();
  const canView = permissionsHook.hasPermission(viewPermission);
  const canManage = permissionsHook.hasPermission(managePermission);

  // Read-only if can view but cannot manage
  return canView && !canManage;
}
