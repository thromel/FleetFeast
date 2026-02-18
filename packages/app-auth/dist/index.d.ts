import { type AppPersona, type AppRole, type AppSession } from "@fleetfeast/shared-contracts";
export type AppAuthErrorCode = "OIDC_TOKEN_INVALID" | "OIDC_VERIFIER_MISCONFIGURED" | "APP_ACCESS_TOKEN_INVALID" | "APP_REFRESH_TOKEN_INVALID" | "APP_REFRESH_TOKEN_REPLAYED" | "APP_REFRESH_TOKEN_DEVICE_MISMATCH";
export declare class AppAuthError extends Error {
    readonly code: AppAuthErrorCode;
    constructor(code: AppAuthErrorCode, message: string);
}
export interface AppAuthErrorResponse {
    statusCode: number;
    errorCode: AppAuthErrorCode;
    message: string;
}
export declare function mapAppAuthError(error: unknown): AppAuthErrorResponse | null;
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
export declare function createJwksOidcVerifier(options: JwksOidcVerifierOptions): OidcVerifier;
export declare function createDevOidcVerifier(): OidcVerifier;
export declare function createOidcVerifierFromEnv(env?: NodeJS.ProcessEnv): OidcVerifier;
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
export declare class InMemoryRefreshSessionStore implements RefreshSessionStore {
    private readonly byHash;
    private readonly hashesByFamily;
    put(record: RefreshSessionRecord): Promise<void>;
    get(tokenHash: string): Promise<RefreshSessionRecord | null>;
    markUsed(tokenHash: string, usedAt: string): Promise<void>;
    revokeFamily(familyId: string, revokedAt: string): Promise<void>;
}
export interface AppSessionAuthOptions {
    jwtSecret: string;
    refreshSessionStore?: RefreshSessionStore;
    accessTtlSeconds?: number;
    refreshTtlSeconds?: number;
    issuer?: string;
    audience?: string;
}
export declare class AppSessionAuthService {
    private readonly secretKey;
    private readonly refreshSessionStore;
    private readonly accessTtlSeconds;
    private readonly refreshTtlSeconds;
    private readonly issuer;
    private readonly audience;
    constructor(options: AppSessionAuthOptions);
    issueSession(input: IssueAppSessionInput): Promise<AppSessionBundle>;
    refreshSession(input: RefreshAppSessionInput): Promise<AppSessionBundle>;
    verifyAccessToken(accessToken: string): Promise<AppAccessTokenClaims>;
    private issueSessionInternal;
    private signAccessToken;
}
export declare function createAppSessionAuthService(options: AppSessionAuthOptions): AppSessionAuthService;
export declare function createAppSessionAuthServiceFromEnv(env?: NodeJS.ProcessEnv, options?: Omit<AppSessionAuthOptions, "jwtSecret">): AppSessionAuthService;
export declare function extractRolesFromClaims(claims: Record<string, unknown>): string[];
