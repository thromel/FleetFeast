import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryMenuRepository } from "./in-memory-menu-repository.js";
import { MenuService } from "./menu-service.js";
import { PrepTimeService } from "./prep-time-service.js";

test("returns fallback prep time when no menu exists", async () => {
  const menuRepo = new InMemoryMenuRepository();
  const prepService = new PrepTimeService(menuRepo);

  const result = await prepService.getEstimate("store-unknown");

  assert.equal(result.estimatedMinutes, 20);
  assert.equal(result.source, "DEFAULT_FALLBACK");
});

test("returns catalog-derived prep time when menu exists", async () => {
  const menuRepo = new InMemoryMenuRepository();
  const menuService = new MenuService(menuRepo);
  const prepService = new PrepTimeService(menuRepo);

  await menuService.createMenu({
    merchantId: "merchant-1",
    storeId: "store-1",
    name: "Prep Menu",
    items: [
      { itemId: "item-1", name: "Burger", priceCents: 1299 },
      { itemId: "item-2", name: "Fries", priceCents: 499 },
      { itemId: "item-3", name: "Shake", priceCents: 699 },
    ],
  });

  const result = await prepService.getEstimate("store-1");

  assert.equal(result.source, "CATALOG_HEURISTIC");
  assert.equal(result.estimatedMinutes, 16);
});
