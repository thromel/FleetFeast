import {
  exchangeMerchantSession,
  refreshMerchantSession,
  type MerchantApiOptions,
  type MerchantSessionExchangeRequest,
  type MerchantSessionExchangeResponse,
} from "./api.js";

export interface MerchantSessionRefreshInput {
  traceId: string;
  deviceId?: string;
}

export class MerchantAuthSessionManagerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MerchantAuthSessionManagerError";
  }
}

export class MerchantAuthSessionManager {
  private readonly options?: MerchantApiOptions;
  private activeSession: MerchantSessionExchangeResponse | null = null;

  constructor(options?: MerchantApiOptions) {
    this.options = options;
  }

  async signIn(
    request: MerchantSessionExchangeRequest,
  ): Promise<MerchantSessionExchangeResponse> {
    const response = await exchangeMerchantSession(request, this.options);
    this.activeSession = response;
    return response;
  }

  async refresh(
    input: MerchantSessionRefreshInput,
  ): Promise<MerchantSessionExchangeResponse> {
    const refreshToken = this.activeSession?.tokenPair.refreshToken;
    if (!refreshToken) {
      throw new MerchantAuthSessionManagerError("No active session to refresh");
    }

    const response = await refreshMerchantSession(
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

  currentSession(): MerchantSessionExchangeResponse | null {
    return this.activeSession;
  }
}

export function createMerchantAuthSessionManager(
  options?: MerchantApiOptions,
): MerchantAuthSessionManager {
  return new MerchantAuthSessionManager(options);
}
