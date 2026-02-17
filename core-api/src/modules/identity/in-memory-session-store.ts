export interface RefreshSessionRecord {
  token: string;
  userId: string;
  familyId: string;
  used: boolean;
  revoked: boolean;
  expiresAtEpochSeconds: number;
}

export class InMemorySessionStore {
  private readonly byToken = new Map<string, RefreshSessionRecord>();
  private readonly tokenFamilies = new Map<string, Set<string>>();

  async save(record: RefreshSessionRecord): Promise<void> {
    this.byToken.set(record.token, record);

    const family = this.tokenFamilies.get(record.familyId) ?? new Set<string>();
    family.add(record.token);
    this.tokenFamilies.set(record.familyId, family);
  }

  async get(token: string): Promise<RefreshSessionRecord | null> {
    return this.byToken.get(token) ?? null;
  }

  async markUsed(token: string): Promise<void> {
    const record = this.byToken.get(token);
    if (!record) {
      return;
    }

    record.used = true;
    this.byToken.set(token, record);
  }

  async revokeFamily(familyId: string): Promise<void> {
    const tokens = this.tokenFamilies.get(familyId);
    if (!tokens) {
      return;
    }

    for (const token of tokens) {
      const record = this.byToken.get(token);
      if (!record) {
        continue;
      }

      record.revoked = true;
      this.byToken.set(token, record);
    }
  }
}
