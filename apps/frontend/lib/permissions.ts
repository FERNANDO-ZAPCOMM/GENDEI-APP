export enum TeamRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  SUPPORT = 'support',
  MARKETING = 'marketing',
}

// Permission types - Organized by resource (MUST MATCH BACKEND EXACTLY)
export type Permission =
  // Team & Account Management
  | 'canManageTeam'
  | 'canManageBilling'
  | 'canDeleteAccount'
  // Products
  | 'canViewProducts'
  | 'canManageProducts'
  // Orders
  | 'canViewOrders'
  | 'canManageOrders'
  // Payments
  | 'canViewPayments'
  | 'canManagePayments'
  // Conversations
  | 'canViewConversations'
  | 'canManageConversations'
  // Analytics
  | 'canViewAnalytics'
  // Settings
  | 'canManageSettings';

// Role permissions matrix - MUST MATCH backend exactly
// Backend source: apps/backend/src/entities/team-member.entity.ts
// This is duplicated for frontend use but MUST stay in sync with backend
export const ROLE_PERMISSIONS: Record<TeamRole, Record<Permission, boolean>> = {
  [TeamRole.OWNER]: {
    // Team & Account
    canManageTeam: true,
    canManageBilling: true,
    canDeleteAccount: true,
    // Products
    canViewProducts: true,
    canManageProducts: true,
    // Orders
    canViewOrders: true,
    canManageOrders: true,
    // Payments
    canViewPayments: true,
    canManagePayments: true,
    // Conversations
    canViewConversations: true,
    canManageConversations: true,
    // Analytics
    canViewAnalytics: true,
    // Settings
    canManageSettings: true,
  },
  [TeamRole.ADMIN]: {
    // Team & Account - Can manage Support and Marketing only
    canManageTeam: true,
    canManageBilling: false,
    canDeleteAccount: false,
    // Products
    canViewProducts: true,
    canManageProducts: true,
    // Orders
    canViewOrders: true,
    canManageOrders: true,
    // Payments
    canViewPayments: true,
    canManagePayments: true,
    // Conversations
    canViewConversations: true,
    canManageConversations: true,
    // Analytics
    canViewAnalytics: true,
    // Settings
    canManageSettings: true,
  },
  [TeamRole.SUPPORT]: {
    // Team & Account
    canManageTeam: false,
    canManageBilling: false,
    canDeleteAccount: false,
    // Products - Read only
    canViewProducts: true,
    canManageProducts: false,
    // Orders - Can update order status
    canViewOrders: true,
    canManageOrders: true,
    // Payments - Read only
    canViewPayments: true,
    canManagePayments: false,
    // Conversations
    canViewConversations: true,
    canManageConversations: true,
    // Analytics
    canViewAnalytics: false,
    // Settings
    canManageSettings: false,
  },
  [TeamRole.MARKETING]: {
    // Team & Account
    canManageTeam: false,
    canManageBilling: false,
    canDeleteAccount: false,
    // Products
    canViewProducts: true,
    canManageProducts: true,
    // Orders - Read only for analytics
    canViewOrders: true,
    canManageOrders: false,
    // Payments - No access
    canViewPayments: false,
    canManagePayments: false,
    // Conversations - No access
    canViewConversations: false,
    canManageConversations: false,
    // Analytics
    canViewAnalytics: true,
    // Settings
    canManageSettings: false,
  },
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
  role: TeamRole | null | undefined,
  permission: Permission,
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.[permission] || false;
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(
  role: TeamRole | null | undefined,
  permissions: Permission[],
): boolean {
  if (!role) return false;
  return permissions.some((permission) => hasPermission(role, permission));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(
  role: TeamRole | null | undefined,
  permissions: Permission[],
): boolean {
  if (!role) return false;
  return permissions.every((permission) => hasPermission(role, permission));
}

/**
 * Check if user has one of the specified roles
 */
export function hasRole(
  userRole: TeamRole | null | undefined,
  allowedRoles: TeamRole[],
): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}

/**
 * Navigation items that require specific permissions
 */
export interface NavPermissions {
  path: string;
  permission?: Permission;
  roles?: TeamRole[];
  requireAll?: boolean; // If true, requires all permissions/roles
}

export const NAV_PERMISSIONS: NavPermissions[] = [
  // Overview - All roles
  { path: '/dashboard', permission: undefined },

  // Conversations - Owner, Admin, Support
  {
    path: '/dashboard/conversations',
    permission: 'canViewConversations',
  },

  // Sales - Requires orders or analytics permission
  { path: '/dashboard/sales', permission: 'canViewAnalytics' },

  // Products - Owner, Admin, Marketing, Support (read-only)
  { path: '/dashboard/products', permission: 'canViewProducts' },

  // Configuration section
  { path: '/dashboard/connections', permission: 'canManageSettings' },
  { path: '/dashboard/account', permission: undefined }, // All roles
  { path: '/dashboard/team', permission: undefined }, // All can view, manage needs permission
  { path: '/dashboard/whatsapp', permission: 'canManageSettings' },
];

/**
 * Check if user can access a navigation path
 */
export function canAccessPath(
  role: TeamRole | null | undefined,
  path: string,
): boolean {
  const navPerm = NAV_PERMISSIONS.find((np) => np.path === path);

  if (!navPerm) {
    // If path is not in permissions list, allow by default
    return true;
  }

  if (navPerm.roles) {
    return hasRole(role, navPerm.roles);
  }

  if (navPerm.permission) {
    return hasPermission(role, navPerm.permission);
  }

  // No restrictions
  return true;
}
