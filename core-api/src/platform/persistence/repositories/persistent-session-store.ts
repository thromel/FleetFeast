import {
  InMemorySessionStore,
  type RefreshSessionRecord,
} from "../../../modules/identity/in-memory-session-store.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "identity.refresh_sessions";

export class PersistentSessionStore extends InMemorySessionStore {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async save(record: RefreshSessionRecord): Promise<void> {
    await this.store.put(NAMESPACE, record.token, record);
  }

  override async get(token: string): Promise<RefreshSessionRecord | null> {
    return this.store.get<RefreshSessionRecord>(NAMESPACE, token);
  }

  override async markUsed(token: string): Promise<void> {
    const record = await this.get(token);
    if (!record) {
      return;
    }

    await this.save({
      ...record,
      used: true,
    });
  }

  override async revokeFamily(familyId: string): Promise<void> {
    const records = await this.store.listEntries<RefreshSessionRecord>(NAMESPACE);

    await Promise.all(
      records
        .filter((record) => record.value.familyId === familyId)
        .map((record) =>
          this.store.put(NAMESPACE, record.key, {
            ...record.value,
            revoked: true,
          }),
        ),
    );
  }
}
