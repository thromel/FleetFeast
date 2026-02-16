import type { IdentityUser } from "./types.js";

export class InMemoryIdentityRepository {
  private readonly usersById = new Map<string, IdentityUser>();
  private readonly userIdByEmail = new Map<string, string>();
  private readonly userIdByPhone = new Map<string, string>();

  async findById(id: string): Promise<IdentityUser | null> {
    return this.usersById.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<IdentityUser | null> {
    const id = this.userIdByEmail.get(email.toLowerCase());
    if (!id) {
      return null;
    }

    return this.usersById.get(id) ?? null;
  }

  async findByPhone(phone: string): Promise<IdentityUser | null> {
    const id = this.userIdByPhone.get(phone);
    if (!id) {
      return null;
    }

    return this.usersById.get(id) ?? null;
  }

  async save(user: IdentityUser): Promise<void> {
    this.usersById.set(user.id, user);
    this.userIdByEmail.set(user.email.toLowerCase(), user.id);
    this.userIdByPhone.set(user.phone, user.id);
  }
}
