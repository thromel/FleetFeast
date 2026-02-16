import type { Menu } from "./types.js";

export class InMemoryMenuRepository {
  private readonly menus = new Map<string, Menu>();

  async save(menu: Menu): Promise<void> {
    this.menus.set(menu.id, menu);
  }

  async findById(menuId: string): Promise<Menu | null> {
    return this.menus.get(menuId) ?? null;
  }

  async listByStoreId(storeId: string): Promise<Menu[]> {
    return [...this.menus.values()].filter((menu) => menu.storeId === storeId);
  }
}
