export type UserRole =
  | "consumer"
  | "courier"
  | "merchant_operator"
  | "support_agent"
  | "finance_ops"
  | "system_admin";

export interface RegisterIdentityInput {
  email: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
}

export interface IdentityUser {
  id: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
}

export interface DomainEvent<TPayload = Record<string, unknown>> {
  type: string;
  occurredAt: string;
  payload: TPayload;
}
