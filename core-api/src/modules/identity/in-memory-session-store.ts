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

  save(record: RefreshSessionRecord): void {
    this.byToken.set(record.token, record);

    const family = this.tokenFamilies.get(record.familyId) ?? new Set<string>();
    family.add(record.token);
    this.tokenFamilies.set(record.familyId, family);
  }

  get(token: string): RefreshSessionRecord | null {
    return this.byToken.get(token) ?? null;
  }

  markUsed(token: string): void {
    const record = this.byToken.get(token);
    if (!record) {
      return;
    }

    record.used = true;
    this.byToken.set(token, record);
  }

  revokeFamily(familyId: string): void {
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
