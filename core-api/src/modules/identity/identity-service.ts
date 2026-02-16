import { randomUUID } from "node:crypto";

import { InMemoryEventBus } from "./in-memory-event-bus.js";
import { InMemoryIdentityRepository } from "./in-memory-identity-repository.js";
import type { IdentityUser, RegisterIdentityInput } from "./types.js";

export type DuplicateIdentityErrorCode =
  | "IDENTITY_EMAIL_EXISTS"
  | "IDENTITY_PHONE_EXISTS";

export class DuplicateIdentityError extends Error {
  code: DuplicateIdentityErrorCode;

  constructor(code: DuplicateIdentityErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "DuplicateIdentityError";
  }
}

export class IdentityService {
  constructor(
    private readonly repository: InMemoryIdentityRepository,
    private readonly eventBus: InMemoryEventBus,
  ) {}

  async register(input: RegisterIdentityInput): Promise<IdentityUser> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedPhone = input.phone.trim();

    const existingEmail = await this.repository.findByEmail(normalizedEmail);
    if (existingEmail) {
      throw new DuplicateIdentityError(
        "IDENTITY_EMAIL_EXISTS",
        "A user with this email already exists.",
      );
    }

    const existingPhone = await this.repository.findByPhone(normalizedPhone);
    if (existingPhone) {
      throw new DuplicateIdentityError(
        "IDENTITY_PHONE_EXISTS",
        "A user with this phone already exists.",
      );
    }

    const user: IdentityUser = {
      id: randomUUID(),
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash: input.passwordHash,
      role: input.role,
      createdAt: new Date().toISOString(),
    };

    await this.repository.save(user);

    this.eventBus.publish({
      type: "identity.user_registered.v1",
      occurredAt: new Date().toISOString(),
      payload: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });

    return user;
  }
}
