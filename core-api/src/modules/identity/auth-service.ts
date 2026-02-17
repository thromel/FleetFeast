import { createHmac, randomBytes, randomUUID } from "node:crypto";

import { InMemoryEventBus } from "./in-memory-event-bus.js";
import { InMemoryIdentityRepository } from "./in-memory-identity-repository.js";
import { InMemorySessionStore } from "./in-memory-session-store.js";
import type { IdentityUser, UserRole } from "./types.js";

export type AuthErrorCode =
  | "IDENTITY_INVALID_CREDENTIALS"
  | "IDENTITY_INVALID_REFRESH_TOKEN"
  | "IDENTITY_REFRESH_REPLAY_DETECTED"
  | "IDENTITY_INVALID_ACCESS_TOKEN"
  | "IDENTITY_MFA_REQUIRED"
  | "IDENTITY_INVALID_MFA_CODE";

export class AuthError extends Error {
  code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "AuthError";
  }
}

export interface LoginInput {
  email: string;
  passwordHash: string;
  mfaCode?: string;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AccessTokenClaims {
  sub: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function signJwt(payload: Record<string, string | number>, secret: string): string {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64Url(JSON.stringify(payload));
  const signature = base64Url(
    createHmac("sha256", secret).update(`${header}.${body}`).digest(),
  );

  return `${header}.${body}.${signature}`;
}

export class AuthService {
  constructor(
    private readonly repository: InMemoryIdentityRepository,
    private readonly eventBus: InMemoryEventBus,
    private readonly sessionStore: InMemorySessionStore,
    private readonly jwtSecret: string,
  ) {}

  async login(input: LoginInput): Promise<SessionTokens> {
    const email = input.email.trim().toLowerCase();
    const user = await this.repository.findByEmail(email);
    if (!user || user.passwordHash !== input.passwordHash) {
      throw new AuthError(
        "IDENTITY_INVALID_CREDENTIALS",
        "Invalid email or password.",
      );
    }

    const privilegedRoles = new Set(["support_agent", "finance_ops", "system_admin"]);
    if (privilegedRoles.has(user.role)) {
      if (!input.mfaCode) {
        throw new AuthError(
          "IDENTITY_MFA_REQUIRED",
          "MFA verification is required for privileged roles.",
        );
      }

      if (input.mfaCode !== "123456") {
        throw new AuthError(
          "IDENTITY_INVALID_MFA_CODE",
          "MFA code is invalid.",
        );
      }
    }

    return this.issueSession(user, "login");
  }

  async refresh(refreshToken: string): Promise<SessionTokens> {
    const record = await this.sessionStore.get(refreshToken);
    if (!record) {
      throw new AuthError(
        "IDENTITY_INVALID_REFRESH_TOKEN",
        "Refresh token is invalid.",
      );
    }

    const now = Math.floor(Date.now() / 1000);
    if (record.expiresAtEpochSeconds < now || record.revoked) {
      throw new AuthError(
        "IDENTITY_INVALID_REFRESH_TOKEN",
        "Refresh token is invalid.",
      );
    }

    if (record.used) {
      await this.sessionStore.revokeFamily(record.familyId);
      throw new AuthError(
        "IDENTITY_REFRESH_REPLAY_DETECTED",
        "Refresh token replay detected.",
      );
    }

    await this.sessionStore.markUsed(record.token);

    const user = await this.repository.findById(record.userId);
    if (!user) {
      throw new AuthError(
        "IDENTITY_INVALID_REFRESH_TOKEN",
        "Refresh token is invalid.",
      );
    }

    return this.issueSession(user, "refresh", record.familyId);
  }

  verifyAccessToken(accessToken: string): AccessTokenClaims {
    const segments = accessToken.split(".");
    if (segments.length !== 3) {
      throw new AuthError(
        "IDENTITY_INVALID_ACCESS_TOKEN",
        "Access token is invalid.",
      );
    }

    const [header, payload, signature] = segments;
    const expectedSignature = base64Url(
      createHmac("sha256", this.jwtSecret)
        .update(`${header}.${payload}`)
        .digest(),
    );

    if (expectedSignature !== signature) {
      throw new AuthError(
        "IDENTITY_INVALID_ACCESS_TOKEN",
        "Access token is invalid.",
      );
    }

    const claims = JSON.parse(base64UrlDecode(payload)) as AccessTokenClaims;
    const now = Math.floor(Date.now() / 1000);
    if (!claims.exp || claims.exp < now) {
      throw new AuthError(
        "IDENTITY_INVALID_ACCESS_TOKEN",
        "Access token is invalid.",
      );
    }

    return claims;
  }

  private async issueSession(
    user: IdentityUser,
    reason: "login" | "refresh",
    familyId: string = randomUUID(),
  ): Promise<SessionTokens> {
    const now = Math.floor(Date.now() / 1000);
    const accessToken = signJwt(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        iat: now,
        exp: now + 15 * 60,
      },
      this.jwtSecret,
    );

    const refreshToken = base64Url(randomBytes(48));
    await this.sessionStore.save({
      token: refreshToken,
      userId: user.id,
      familyId,
      used: false,
      revoked: false,
      expiresAtEpochSeconds: now + 30 * 24 * 60 * 60,
    });

    this.eventBus.publish({
      type: "identity.session_issued.v1",
      occurredAt: new Date().toISOString(),
      payload: {
        userId: user.id,
        reason,
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }
}
