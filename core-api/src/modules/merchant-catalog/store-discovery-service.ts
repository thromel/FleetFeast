import { InMemoryMenuRepository } from "./in-memory-menu-repository.js";
import { StoreStatusService } from "./store-status-service.js";
import type { Menu } from "./types.js";

export interface ListDiscoverableStoresInput {
  orderable?: boolean;
  at?: Date;
}

export interface DiscoverableStore {
  storeId: string;
  merchantId: string;
  menuId: string;
  menuVersion: number;
  orderable: boolean;
  reason: string;
  evaluatedAt: string;
}

export class StoreDiscoveryService {
  constructor(
    private readonly menuRepository: InMemoryMenuRepository,
    private readonly storeStatusService: StoreStatusService,
  ) {}

  async listStores(input: ListDiscoverableStoresInput = {}): Promise<DiscoverableStore[]> {
    const menus = await this.menuRepository.list();
    const latestByStore = this.selectLatestMenuByStore(menus);
    const at = input.at ?? new Date();

    const stores: DiscoverableStore[] = [];
    for (const menu of latestByStore.values()) {
      const orderability = await this.storeStatusService.evaluateOrderability(menu.storeId, at);
      const entry: DiscoverableStore = {
        storeId: menu.storeId,
        merchantId: menu.merchantId,
        menuId: menu.id,
        menuVersion: menu.currentVersion,
        orderable: orderability.orderable,
        reason: orderability.reason,
        evaluatedAt: orderability.evaluatedAt,
      };

      if (input.orderable !== undefined && entry.orderable !== input.orderable) {
        continue;
      }

      stores.push(entry);
    }

    stores.sort((left, right) => left.storeId.localeCompare(right.storeId));
    return stores;
  }

  private selectLatestMenuByStore(menus: Menu[]): Map<string, Menu> {
    const latest = new Map<string, Menu>();

    for (const menu of menus) {
      const existing = latest.get(menu.storeId);
      if (!existing) {
        latest.set(menu.storeId, menu);
        continue;
      }

      if (new Date(menu.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
        latest.set(menu.storeId, menu);
      }
    }

    return latest;
  }
}
