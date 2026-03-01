import {
  exchangeAdminSession,
  refreshAdminSession,
  type AdminApiOptions,
  type AdminSessionExchangeRequest,
  type AdminSessionExchangeResponse,
} from "./api.js";

export interface AdminSessionRefreshInput {
  traceId: string;
  deviceId?: string;
}

export class AdminAuthSessionManagerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminAuthSessionManagerError";
  }
}

export class AdminAuthSessionManager {
  private readonly options?: AdminApiOptions;
  private activeSession: AdminSessionExchangeResponse | null = null;

  constructor(options?: AdminApiOptions) {
    this.options = options;
  }

  async signIn(request: AdminSessionExchangeRequest): Promise<AdminSessionExchangeResponse> {
    const response = await exchangeAdminSession(request, this.options);
    this.activeSession = response;
    return response;
  }

  async refresh(input: AdminSessionRefreshInput): Promise<AdminSessionExchangeResponse> {
    const refreshToken = this.activeSession?.tokenPair.refreshToken;
    if (!refreshToken) {
      throw new AdminAuthSessionManagerError("No active session to refresh");
    }

    const response = await refreshAdminSession(
      {
        refreshToken,
        traceId: input.traceId,
        deviceId: input.deviceId,
      },
      this.options,
    );
    this.activeSession = response;
    return response;
  }

  currentSession(): AdminSessionExchangeResponse | null {
    return this.activeSession;
  }
}

export function createAdminAuthSessionManager(
  options?: AdminApiOptions,
): AdminAuthSessionManager {
  return new AdminAuthSessionManager(options);
}
