import { randomUUID } from "node:crypto";

import type { PSPAuthorizeRequest, PSPAuthorizeResponse } from "./types.js";

export interface PSPAdapter {
  authorize(input: PSPAuthorizeRequest): Promise<PSPAuthorizeResponse>;
}

export class InMemoryPSPAdapter implements PSPAdapter {
  async authorize(input: PSPAuthorizeRequest): Promise<PSPAuthorizeResponse> {
    return {
      providerReference: `psp-${input.orderId}-${randomUUID()}`,
      authorizedAt: new Date().toISOString(),
    };
  }
}
