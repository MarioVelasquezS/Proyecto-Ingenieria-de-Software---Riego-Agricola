export const USER_ROLES = ["ADMIN", "OPERADOR"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrador",
  OPERADOR: "Operador",
};

export function isValidRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

