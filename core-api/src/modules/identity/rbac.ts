import type { UserRole } from "./types.js";

export type Permission =
  | "admin:read"
  | "support:intervene"
  | "orders:read"
  | "orders:write";

const rolePermissions: Record<UserRole, Set<Permission | "*">> = {
  consumer: new Set(["orders:read", "orders:write"]),
  courier: new Set(["orders:read", "orders:write"]),
  merchant_operator: new Set(["orders:read", "orders:write"]),
  support_agent: new Set(["support:intervene", "orders:read"]),
  finance_ops: new Set(["orders:read"]),
  system_admin: new Set(["*"]),
};

export function isAllowed(role: UserRole, permission: Permission): boolean {
  const permissions = rolePermissions[role];
  if (!permissions) {
    return false;
  }

  return permissions.has("*") || permissions.has(permission);
}
