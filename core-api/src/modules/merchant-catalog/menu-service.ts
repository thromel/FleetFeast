import { randomUUID } from "node:crypto";

import { InMemoryMenuRepository } from "./in-memory-menu-repository.js";
import type {
  CreateMenuInput,
  Menu,
  MenuItem,
  MenuItemInput,
  MenuVersion,
  UpdateMenuInput,
} from "./types.js";

export class MenuNotFoundError extends Error {
  code = "CATALOG_MENU_NOT_FOUND";

  constructor(menuId: string) {
    super(`Menu '${menuId}' was not found.`);
    this.name = "MenuNotFoundError";
  }
}

function normalizeItems(items: MenuItemInput[]): MenuItem[] {
  return items.map((item) => ({
    itemId: item.itemId,
    name: item.name.trim(),
    priceCents: item.priceCents,
  }));
}

function buildVersion(version: number, name: string, items: MenuItemInput[]): MenuVersion {
  return {
    version,
    name: name.trim(),
    items: normalizeItems(items),
    createdAt: new Date().toISOString(),
  };
}

export class MenuService {
  constructor(private readonly repository: InMemoryMenuRepository) {}

  async createMenu(input: CreateMenuInput): Promise<Menu> {
    const createdAt = new Date().toISOString();
    const firstVersion = buildVersion(1, input.name, input.items);

    const menu: Menu = {
      id: randomUUID(),
      merchantId: input.merchantId,
      storeId: input.storeId,
      currentVersion: 1,
      versions: [firstVersion],
      createdAt,
      updatedAt: createdAt,
    };

    await this.repository.save(menu);
    return menu;
  }

  async updateMenu(menuId: string, input: UpdateMenuInput): Promise<Menu> {
    const menu = await this.repository.findById(menuId);
    if (!menu) {
      throw new MenuNotFoundError(menuId);
    }

    const nextVersion = menu.currentVersion + 1;
    const version = buildVersion(nextVersion, input.name, input.items);

    const updated: Menu = {
      ...menu,
      currentVersion: nextVersion,
      versions: [...menu.versions, version],
      updatedAt: new Date().toISOString(),
    };

    await this.repository.save(updated);
    return updated;
  }

  async getMenu(menuId: string): Promise<Menu> {
    const menu = await this.repository.findById(menuId);
    if (!menu) {
      throw new MenuNotFoundError(menuId);
    }

    return menu;
  }

  async getMenuVersions(menuId: string): Promise<MenuVersion[]> {
    const menu = await this.getMenu(menuId);
    return menu.versions;
  }
}
