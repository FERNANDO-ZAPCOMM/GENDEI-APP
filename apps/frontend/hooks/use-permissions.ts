'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import {
  TeamRole,
  Permission,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasRole,
  canAccessPath,
} from '@/lib/permissions';
import { teamApi } from '@/lib/team-api';

export interface UsePermissionsReturn {
  role: TeamRole | null;
  loading: boolean;
  error: Error | null;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  hasRole: (roles: TeamRole[]) => boolean;
  canAccessPath: (path: string) => boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isSupport: boolean;
  isMarketing: boolean;
  // Team & Account
  canManageTeam: boolean;
  canManageBilling: boolean;
  canDeleteAccount: boolean;
  // Products
  canViewProducts: boolean;
  canManageProducts: boolean;
  // Orders
  canViewOrders: boolean;
  canManageOrders: boolean;
  // Payments
  canViewPayments: boolean;
  canManagePayments: boolean;
  // Conversations
  canViewConversations: boolean;
  canManageConversations: boolean;
  // Analytics
  canViewAnalytics: boolean;
  // Settings
  canManageSettings: boolean;
  refetch: () => Promise<void>;
}

// Global cache to prevent duplicate API calls across component instances
let roleCache: { role: TeamRole | null; userId: string } | null = null;
let roleCachePromise: Promise<{ role: TeamRole | null }> | null = null;

/**
 * Hook to get user role and check permissions
 * Best practices:
 * - Use this hook at the component level to show/hide UI elements
 * - Backend still enforces permissions - this is just for UX
 * - Components should handle loading and error states
 * - Uses global caching to prevent duplicate API calls
 */
export function usePermissions(): UsePermissionsReturn {
  const { currentUser } = useAuth();
  const [role, setRole] = useState<TeamRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);

  const fetchRole = async () => {
    if (!currentUser) {
      setRole(null);
      setLoading(false);
      return;
    }

    // Check if we have a cached role for this user
    if (roleCache && roleCache.userId === currentUser.uid) {
      setRole(roleCache.role);
      setLoading(false);
      return;
    }

    // If there's already a pending request, wait for it instead of making a new one
    if (roleCachePromise) {
      try {
        const response = await roleCachePromise;
        if (isMountedRef.current) {
          setRole(response.role);
          setLoading(false);
        }
      } catch (err) {
        if (isMountedRef.current) {
          console.error('Error fetching user role:', err);
          setError(err instanceof Error ? err : new Error('Failed to fetch role'));
          setRole(null);
          setLoading(false);
        }
      }
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create a promise and store it to prevent duplicate requests
      roleCachePromise = (async () => {
        const token = await currentUser.getIdToken();
        const response = await teamApi.getMyRole(token);
        return response;
      })();

      const response = await roleCachePromise;

      // Cache the result
      roleCache = {
        role: response.role,
        userId: currentUser.uid,
      };

      if (isMountedRef.current) {
        setRole(response.role);
      }
    } catch (err) {
      console.error('Error fetching user role:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to fetch role'));
        setRole(null);
      }
    } finally {
      roleCachePromise = null;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchRole();

    return () => {
      isMountedRef.current = false;
    };
  }, [currentUser?.uid]); // Only re-fetch if user ID changes, not the entire user object

  const refetchRole = async () => {
    // Clear cache to force a fresh fetch
    roleCache = null;
    roleCachePromise = null;
    await fetchRole();
  };

  return {
    role,
    loading,
    error,
    hasPermission: (permission: Permission) => hasPermission(role, permission),
    hasAnyPermission: (permissions: Permission[]) =>
      hasAnyPermission(role, permissions),
    hasAllPermissions: (permissions: Permission[]) =>
      hasAllPermissions(role, permissions),
    hasRole: (roles: TeamRole[]) => hasRole(role, roles),
    canAccessPath: (path: string) => canAccessPath(role, path),
    isOwner: role === TeamRole.OWNER,
    isAdmin: role === TeamRole.ADMIN,
    isSupport: role === TeamRole.SUPPORT,
    isMarketing: role === TeamRole.MARKETING,
    // Team & Account
    canManageTeam: hasPermission(role, 'canManageTeam'),
    canManageBilling: hasPermission(role, 'canManageBilling'),
    canDeleteAccount: hasPermission(role, 'canDeleteAccount'),
    // Products
    canViewProducts: hasPermission(role, 'canViewProducts'),
    canManageProducts: hasPermission(role, 'canManageProducts'),
    // Orders
    canViewOrders: hasPermission(role, 'canViewOrders'),
    canManageOrders: hasPermission(role, 'canManageOrders'),
    // Payments
    canViewPayments: hasPermission(role, 'canViewPayments'),
    canManagePayments: hasPermission(role, 'canManagePayments'),
    // Conversations
    canViewConversations: hasPermission(role, 'canViewConversations'),
    canManageConversations: hasPermission(role, 'canManageConversations'),
    // Analytics
    canViewAnalytics: hasPermission(role, 'canViewAnalytics'),
    // Settings
    canManageSettings: hasPermission(role, 'canManageSettings'),
    refetch: refetchRole,
  };
}
