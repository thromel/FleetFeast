import { InMemoryIdentityRepository } from "../../../modules/identity/in-memory-identity-repository.js";
import type { IdentityUser } from "../../../modules/identity/types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "identity.users";

export class PersistentIdentityRepository extends InMemoryIdentityRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async findById(id: string): Promise<IdentityUser | null> {
    return this.store.get<IdentityUser>(NAMESPACE, id);
  }

  override async findByEmail(email: string): Promise<IdentityUser | null> {
    const normalizedEmail = email.toLowerCase();
    const users = await this.store.list<IdentityUser>(NAMESPACE);
    return users.find((user) => user.email.toLowerCase() === normalizedEmail) ?? null;
  }

  override async findByPhone(phone: string): Promise<IdentityUser | null> {
    const users = await this.store.list<IdentityUser>(NAMESPACE);
    return users.find((user) => user.phone === phone) ?? null;
  }

  override async save(user: IdentityUser): Promise<void> {
    await this.store.put(NAMESPACE, user.id, user);
  }
}
