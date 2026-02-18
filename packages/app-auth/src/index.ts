import { createHash, createSecretKey, randomBytes, randomUUID } from "node:crypto";

import {
  SignJWT,
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type KeyLike,
} from "jose";

import { createAppSession, type AppPersona, type AppRole, type AppSession } from "@fleetfeast/shared-contracts";

const DEFAULT_ACCESS_TTL_SECONDS = 900;
const DEFAULT_REFRESH_TTL_SECONDS = 60 * 60 * 24 * 14;
const DEFAULT_ISSUER = "fleetfeast.app-services";
const DEFAULT_AUDIENCE = "fleetfeast.app-clients";

const DEV_OIDC_ISSUER = "fleetfeast.dev";
const DEV_OIDC_AUDIENCE = "fleetfeast.dev.clients";

export type AppAuthErrorCode =
  | "OIDC_TOKEN_INVALID"
  | "OIDC_VERIFIER_MISCONFIGURED"
  | "APP_ACCESS_TOKEN_INVALID"
  | "APP_REFRESH_TOKEN_INVALID"
  | "APP_REFRESH_TOKEN_REPLAYED"
  | "APP_REFRESH_TOKEN_DEVICE_MISMATCH";

export class AppAuthError extends Error {
  readonly code: AppAuthErrorCode;

  constructor(code: AppAuthErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "AppAuthError";
  }
}

export interface AppAuthErrorResponse {
  statusCode: number;
  errorCode: AppAuthErrorCode;
  message: string;
}

export function mapAppAuthError(error: unknown): AppAuthErrorResponse | null {
  if (!(error instanceof AppAuthError)) {
    return null;
  }

  switch (error.code) {
    case "OIDC_TOKEN_INVALID":
      return {
        statusCode: 401,
        errorCode: error.code,
        message: "OIDC token verification failed.",
      };
    case "OIDC_VERIFIER_MISCONFIGURED":
      return {
        statusCode: 500,
        errorCode: error.code,
        message: "OIDC verifier configuration is invalid.",
      };
    case "APP_REFRESH_TOKEN_INVALID":
      return {
        statusCode: 401,
        errorCode: error.code,
        message: "Refresh token is invalid.",
      };
    case "APP_REFRESH_TOKEN_REPLAYED":
      return {
        statusCode: 401,
        errorCode: error.code,
        message: "Refresh token replay detected.",
      };
    case "APP_REFRESH_TOKEN_DEVICE_MISMATCH":
      return {
        statusCode: 401,
        errorCode: error.code,
        message: "Refresh token device binding mismatch.",
      };
    case "APP_ACCESS_TOKEN_INVALID":
      return {
        statusCode: 401,
        errorCode: error.code,
        message: "App access token is invalid.",
      };
    default:
      return null;
  }
}

export interface OidcIdentity {
  subject: string;
  email?: string;
  issuer?: string;
  audience?: string | string[];
  claims: Record<string, unknown>;
}

export interface OidcVerifier {
  verifyIdToken(idToken: string): Promise<OidcIdentity>;
}

export interface JwksOidcVerifierOptions {
  issuer: string;
  audience: string;
  jwksUri: string;
  clockToleranceSeconds?: number;
}

export function createJwksOidcVerifier(options: JwksOidcVerifierOptions): OidcVerifier {
  const jwks = createRemoteJWKSet(new URL(options.jwksUri));
  const clockTolerance = options.clockToleranceSeconds ?? 5;

  return {
    async verifyIdToken(idToken: string): Promise<OidcIdentity> {
      try {
        const verification = await jwtVerify(idToken, jwks, {
          issuer: options.issuer,
          audience: options.audience,
          clockTolerance,
        });
        return toOidcIdentity(verification.payload);
      } catch {
        throw new AppAuthError("OIDC_TOKEN_INVALID", "OIDC token verification failed");
      }
    },
  };
}

export function createDevOidcVerifier(): OidcVerifier {
  return {
    async verifyIdToken(idToken: string): Promise<OidcIdentity> {
      if (!idToken.startsWith("dev:")) {
        throw new AppAuthError("OIDC_TOKEN_INVALID", "Expected dev token format");
      }

      const raw = idToken.slice("dev:".length);
      const [subject, emailSegment = "", rolesSegment = ""] = raw.split(":", 3);

      if (!subject || subject.trim().length === 0) {
        throw new AppAuthError("OIDC_TOKEN_INVALID", "subject is required in dev token");
      }

      const roles = rolesSegment
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);

      return {
        subject,
        email: emailSegment.length > 0 ? emailSegment : undefined,
        issuer: DEV_OIDC_ISSUER,
        audience: DEV_OIDC_AUDIENCE,
        claims: {
          sub: subject,
          iss: DEV_OIDC_ISSUER,
          aud: DEV_OIDC_AUDIENCE,
          ...(emailSegment.length > 0 ? { email: emailSegment } : {}),
          ...(roles.length > 0 ? { roles } : {}),
        },
      };
    },
  };
}

export function createOidcVerifierFromEnv(env: NodeJS.ProcessEnv = process.env): OidcVerifier {
  const jwksUri = env.OIDC_JWKS_URI;
  const issuer = env.OIDC_ISSUER;
  const audience = env.OIDC_AUDIENCE;

  if (!jwksUri && !issuer && !audience) {
    return createDevOidcVerifier();
  }

  if (!jwksUri || !issuer || !audience) {
    throw new AppAuthError(
      "OIDC_VERIFIER_MISCONFIGURED",
      "OIDC_JWKS_URI, OIDC_ISSUER, and OIDC_AUDIENCE must be provided together",
    );
  }

  return createJwksOidcVerifier({
    jwksUri,
    issuer,
    audience,
    clockToleranceSeconds: 5,
  });
}

export interface AppSessionTokenPair {
  tokenType: "Bearer";
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  refreshExpiresInSeconds: number;
  refreshExpiresAt: string;
}

export interface AppSessionBundle {
  session: AppSession;
  tokenPair: AppSessionTokenPair;
}

export interface IssueAppSessionInput {
  userId: string;
  role: AppRole;
  persona: AppPersona;
  traceId: string;
  deviceId?: string;
}

export interface RefreshAppSessionInput {
  refreshToken: string;
  traceId: string;
  deviceId?: string;
}

export interface AppAccessTokenClaims {
  userId: string;
  sessionId: string;
  role: AppRole;
  persona: AppPersona;
  traceId: string;
  refreshTokenId: string;
  deviceId?: string;
}

export interface RefreshSessionRecord {
  tokenHash: string;
  familyId: string;
  sessionId: string;
  userId: string;
  role: AppRole;
  persona: AppPersona;
  traceId: string;
  refreshTokenId: string;
  deviceId?: string;
  issuedAt: string;
  expiresAt: string;
  usedAt?: string;
}

export interface RefreshSessionStore {
  put(record: RefreshSessionRecord): Promise<void>;
  get(tokenHash: string): Promise<RefreshSessionRecord | null>;
  markUsed(tokenHash: string, usedAt: string): Promise<void>;
  revokeFamily(familyId: string, revokedAt: string): Promise<void>;
}

export class InMemoryRefreshSessionStore implements RefreshSessionStore {
  private readonly byHash = new Map<string, RefreshSessionRecord>();
  private readonly hashesByFamily = new Map<string, Set<string>>();

  async put(record: RefreshSessionRecord): Promise<void> {
    this.byHash.set(record.tokenHash, { ...record });

    const familyHashes = this.hashesByFamily.get(record.familyId) ?? new Set<string>();
    familyHashes.add(record.tokenHash);
    this.hashesByFamily.set(record.familyId, familyHashes);
  }

  async get(tokenHash: string): Promise<RefreshSessionRecord | null> {
    const record = this.byHash.get(tokenHash);
    return record ? { ...record } : null;
  }

  async markUsed(tokenHash: string, usedAt: string): Promise<void> {
    const record = this.byHash.get(tokenHash);
    if (!record) {
      return;
    }

    record.usedAt = usedAt;
    this.byHash.set(tokenHash, record);
  }

  async revokeFamily(familyId: string, revokedAt: string): Promise<void> {
    const familyHashes = this.hashesByFamily.get(familyId);
    if (!familyHashes) {
      return;
    }

    for (const tokenHash of familyHashes) {
      const record = this.byHash.get(tokenHash);
      if (!record) {
        continue;
      }

      record.usedAt = revokedAt;
      this.byHash.set(tokenHash, record);
    }
  }
}

export interface AppSessionAuthOptions {
  jwtSecret: string;
  refreshSessionStore?: RefreshSessionStore;
  accessTtlSeconds?: number;
  refreshTtlSeconds?: number;
  issuer?: string;
  audience?: string;
}

interface IssueInternalInput extends IssueAppSessionInput {
  familyId: string;
}

export class AppSessionAuthService {
  private readonly secretKey: KeyLike;
  private readonly refreshSessionStore: RefreshSessionStore;
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(options: AppSessionAuthOptions) {
    if (options.jwtSecret.trim().length < 16) {
      throw new AppAuthError("OIDC_VERIFIER_MISCONFIGURED", "APP_SESSION_JWT_SECRET must be 16+ chars");
    }

    this.secretKey = createSecretKey(Buffer.from(options.jwtSecret, "utf8"));
    this.refreshSessionStore = options.refreshSessionStore ?? new InMemoryRefreshSessionStore();
    this.accessTtlSeconds = options.accessTtlSeconds ?? DEFAULT_ACCESS_TTL_SECONDS;
    this.refreshTtlSeconds = options.refreshTtlSeconds ?? DEFAULT_REFRESH_TTL_SECONDS;
    this.issuer = options.issuer ?? DEFAULT_ISSUER;
    this.audience = options.audience ?? DEFAULT_AUDIENCE;
  }

  async issueSession(input: IssueAppSessionInput): Promise<AppSessionBundle> {
    return this.issueSessionInternal({
      ...input,
      familyId: randomUUID(),
    });
  }

  async refreshSession(input: RefreshAppSessionInput): Promise<AppSessionBundle> {
    const tokenHash = hashOpaqueToken(input.refreshToken);
    const record = await this.refreshSessionStore.get(tokenHash);
    if (!record) {
      throw new AppAuthError("APP_REFRESH_TOKEN_INVALID", "Refresh token was not found");
    }

    const now = new Date();
    if (new Date(record.expiresAt).getTime() <= now.getTime()) {
      throw new AppAuthError("APP_REFRESH_TOKEN_INVALID", "Refresh token expired");
    }

    if (record.deviceId && record.deviceId !== input.deviceId) {
      throw new AppAuthError(
        "APP_REFRESH_TOKEN_DEVICE_MISMATCH",
        "Refresh token does not match bound device",
      );
    }

    if (record.usedAt) {
      await this.refreshSessionStore.revokeFamily(record.familyId, now.toISOString());
      throw new AppAuthError("APP_REFRESH_TOKEN_REPLAYED", "Refresh token replay detected");
    }

    await this.refreshSessionStore.markUsed(tokenHash, now.toISOString());

    return this.issueSessionInternal({
      userId: record.userId,
      role: record.role,
      persona: record.persona,
      traceId: input.traceId,
      deviceId: record.deviceId,
      familyId: record.familyId,
    });
  }

  async verifyAccessToken(accessToken: string): Promise<AppAccessTokenClaims> {
    try {
      const verification = await jwtVerify(accessToken, this.secretKey, {
        issuer: this.issuer,
        audience: this.audience,
      });
      return toAppAccessTokenClaims(verification.payload);
    } catch {
      throw new AppAuthError("APP_ACCESS_TOKEN_INVALID", "Access token verification failed");
    }
  }

  private async issueSessionInternal(input: IssueInternalInput): Promise<AppSessionBundle> {
    const refreshTokenId = randomUUID();
    const session = createAppSession({
      sessionId: randomUUID(),
      userId: input.userId,
      role: input.role,
      persona: input.persona,
      traceId: input.traceId,
      refreshTokenId,
      expiresInSeconds: this.accessTtlSeconds,
    });

    const refreshToken = generateOpaqueToken();
    const now = new Date();
    const refreshExpiresAt = new Date(now.getTime() + this.refreshTtlSeconds * 1000).toISOString();
    await this.refreshSessionStore.put({
      tokenHash: hashOpaqueToken(refreshToken),
      familyId: input.familyId,
      sessionId: session.sessionId,
      userId: session.userId,
      role: session.role,
      persona: session.persona,
      traceId: session.traceId,
      refreshTokenId,
      deviceId: input.deviceId,
      issuedAt: now.toISOString(),
      expiresAt: refreshExpiresAt,
    });

    const accessToken = await this.signAccessToken(session, input.deviceId);

    return {
      session,
      tokenPair: {
        tokenType: "Bearer",
        accessToken,
        refreshToken,
        expiresInSeconds: this.accessTtlSeconds,
        refreshExpiresInSeconds: this.refreshTtlSeconds,
        refreshExpiresAt,
      },
    };
  }

  private async signAccessToken(session: AppSession, deviceId?: string): Promise<string> {
    const nowSeconds = Math.floor(Date.now() / 1000);

    return new SignJWT({
      sub: session.userId,
      sid: session.sessionId,
      role: session.role,
      persona: session.persona,
      traceId: session.traceId,
      refreshTokenId: session.refreshTokenId,
      ...(deviceId ? { deviceId } : {}),
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt(nowSeconds)
      .setExpirationTime(nowSeconds + this.accessTtlSeconds)
      .sign(this.secretKey);
  }
}

export function createAppSessionAuthService(options: AppSessionAuthOptions): AppSessionAuthService {
  return new AppSessionAuthService(options);
}

export function createAppSessionAuthServiceFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  options: Omit<AppSessionAuthOptions, "jwtSecret"> = {},
): AppSessionAuthService {
  return createAppSessionAuthService({
    jwtSecret: env.APP_SESSION_JWT_SECRET ?? "fleetfeast-dev-session-secret",
    issuer: env.APP_SESSION_JWT_ISSUER ?? DEFAULT_ISSUER,
    audience: env.APP_SESSION_JWT_AUDIENCE ?? DEFAULT_AUDIENCE,
    ...options,
  });
}

function toOidcIdentity(payload: JWTPayload): OidcIdentity {
  if (typeof payload.sub !== "string" || payload.sub.trim().length === 0) {
    throw new AppAuthError("OIDC_TOKEN_INVALID", "OIDC token subject is missing");
  }

  return {
    subject: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    issuer: typeof payload.iss === "string" ? payload.iss : undefined,
    audience: typeof payload.aud === "string" || Array.isArray(payload.aud) ? payload.aud : undefined,
    claims: payload as Record<string, unknown>,
  };
}

function toAppAccessTokenClaims(payload: JWTPayload): AppAccessTokenClaims {
  const userId = payload.sub;
  const sessionId = payload.sid;
  const role = payload.role;
  const persona = payload.persona;
  const traceId = payload.traceId;
  const refreshTokenId = payload.refreshTokenId;

  if (
    typeof userId !== "string" ||
    typeof sessionId !== "string" ||
    !isAppRole(role) ||
    !isAppPersona(persona) ||
    typeof traceId !== "string" ||
    typeof refreshTokenId !== "string"
  ) {
    throw new AppAuthError("APP_ACCESS_TOKEN_INVALID", "Access token payload is invalid");
  }

  const deviceId = payload.deviceId;

  return {
    userId,
    sessionId,
    role,
    persona,
    traceId,
    refreshTokenId,
    deviceId: typeof deviceId === "string" ? deviceId : undefined,
  };
}

function isAppRole(candidate: unknown): candidate is AppRole {
  return (
    candidate === "consumer" ||
    candidate === "courier" ||
    candidate === "merchant_operator" ||
    candidate === "support_agent" ||
    candidate === "finance_ops" ||
    candidate === "system_admin"
  );
}

function isAppPersona(candidate: unknown): candidate is AppPersona {
  return (
    candidate === "consumer" ||
    candidate === "courier" ||
    candidate === "merchant" ||
    candidate === "admin"
  );
}

function generateOpaqueToken(): string {
  return randomBytes(48).toString("base64url");
}

function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function extractRolesFromClaims(claims: Record<string, unknown>): string[] {
  const claimsRoles = claims.roles ?? claims["cognito:groups"];
  if (!Array.isArray(claimsRoles)) {
    return [];
  }

  return claimsRoles
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}
