import { InMemoryMenuRepository } from "../../../modules/merchant-catalog/in-memory-menu-repository.js";
import type { Menu } from "../../../modules/merchant-catalog/types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "catalog.menus";

function cloneMenu(menu: Menu): Menu {
  return {
    ...menu,
    versions: menu.versions.map((version) => ({
      ...version,
      items: version.items.map((item) => ({ ...item })),
    })),
  };
}

export class PersistentMenuRepository extends InMemoryMenuRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async save(menu: Menu): Promise<void> {
    await this.store.put(NAMESPACE, menu.id, cloneMenu(menu));
  }

  override async findById(menuId: string): Promise<Menu | null> {
    const menu = await this.store.get<Menu>(NAMESPACE, menuId);
    return menu ? cloneMenu(menu) : null;
  }

  override async listByStoreId(storeId: string): Promise<Menu[]> {
    const menus = await this.store.list<Menu>(NAMESPACE);
    return menus
      .filter((menu) => menu.storeId === storeId)
      .map((menu) => cloneMenu(menu));
  }

  override async list(): Promise<Menu[]> {
    const menus = await this.store.list<Menu>(NAMESPACE);
    return menus.map((menu) => cloneMenu(menu));
  }
}
