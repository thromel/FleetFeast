import { InMemoryItemAvailabilityRepository } from "./in-memory-item-availability-repository.js";
import { InMemoryMenuRepository } from "./in-memory-menu-repository.js";

export interface StoreMenuViewItem {
  itemId: string;
  name: string;
  priceCents: number;
  available: boolean;
  unavailableReason: string | null;
}

export interface StoreMenuView {
  storeId: string;
  menuId: string;
  menuName: string;
  version: number;
  items: StoreMenuViewItem[];
}

export class StoreMenuNotFoundError extends Error {
  code = "CATALOG_STORE_MENU_NOT_FOUND";

  constructor(storeId: string) {
    super(`Store '${storeId}' does not have an active menu.`);
    this.name = "StoreMenuNotFoundError";
  }
}

export class StoreMenuService {
  constructor(
    private readonly menuRepository: InMemoryMenuRepository,
    private readonly itemAvailabilityRepository: InMemoryItemAvailabilityRepository,
  ) {}

  async getStoreMenu(
    storeId: string,
    options?: { availableOnly?: boolean },
  ): Promise<StoreMenuView> {
    const menus = await this.menuRepository.listByStoreId(storeId);
    if (menus.length === 0) {
      throw new StoreMenuNotFoundError(storeId);
    }

    const menu = menus
      .slice()
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    if (!menu) {
      throw new StoreMenuNotFoundError(storeId);
    }

    const version =
      menu.versions.find((candidate) => candidate.version === menu.currentVersion) ??
      menu.versions[menu.versions.length - 1];
    if (!version) {
      throw new StoreMenuNotFoundError(storeId);
    }

    const items = await Promise.all(
      version.items.map(async (item) => {
        const availability = await this.itemAvailabilityRepository.findByItemId(item.itemId);
        return {
          itemId: item.itemId,
          name: item.name,
          priceCents: item.priceCents,
          available: availability?.available ?? true,
          unavailableReason: availability?.reason ?? null,
        };
      }),
    );

    const filteredItems = options?.availableOnly ? items.filter((item) => item.available) : items;

    return {
      storeId,
      menuId: menu.id,
      menuName: version.name,
      version: version.version,
      items: filteredItems,
    };
  }
}
