import { InMemoryMenuRepository } from "./in-memory-menu-repository.js";

export interface PrepTimeEstimate {
  estimatedMinutes: number;
  source: "DEFAULT_FALLBACK" | "CATALOG_HEURISTIC";
}

export class PrepTimeService {
  constructor(private readonly menuRepository: InMemoryMenuRepository) {}

  async getEstimate(storeId: string): Promise<PrepTimeEstimate> {
    const menus = await this.menuRepository.listByStoreId(storeId);
    if (menus.length === 0) {
      return {
        estimatedMinutes: 20,
        source: "DEFAULT_FALLBACK",
      };
    }

    const sorted = [...menus].sort((a, b) => b.currentVersion - a.currentVersion);
    const latest = sorted[0];
    const latestVersion = latest?.versions[latest.versions.length - 1];
    const itemCount = latestVersion?.items.length ?? 0;

    return {
      estimatedMinutes: 10 + itemCount * 2,
      source: "CATALOG_HEURISTIC",
    };
  }
}
