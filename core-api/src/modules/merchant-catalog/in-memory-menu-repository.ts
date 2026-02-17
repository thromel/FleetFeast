import type { Menu } from "./types.js";

export class InMemoryMenuRepository {
  private readonly menus = new Map<string, Menu>();

  async save(menu: Menu): Promise<void> {
    this.menus.set(menu.id, this.cloneMenu(menu));
  }

  async findById(menuId: string): Promise<Menu | null> {
    const menu = this.menus.get(menuId);
    if (!menu) {
      return null;
    }

    return this.cloneMenu(menu);
  }

  async listByStoreId(storeId: string): Promise<Menu[]> {
    return [...this.menus.values()]
      .filter((menu) => menu.storeId === storeId)
      .map((menu) => this.cloneMenu(menu));
  }

  async list(): Promise<Menu[]> {
    return [...this.menus.values()].map((menu) => this.cloneMenu(menu));
  }

  private cloneMenu(menu: Menu): Menu {
    return {
      ...menu,
      versions: menu.versions.map((version) => ({
        ...version,
        items: version.items.map((item) => ({ ...item })),
      })),
    };
  }
}
