import assert from "node:assert/strict";
import test from "node:test";

import { MenuService } from "./menu-service.js";
import { InMemoryMenuRepository } from "./in-memory-menu-repository.js";

test("creates menu with version 1", async () => {
  const repo = new InMemoryMenuRepository();
  const service = new MenuService(repo);

  const created = await service.createMenu({
    merchantId: "merchant-1",
    storeId: "store-1",
    name: "Lunch Menu",
    items: [
      { itemId: "item-1", name: "Burger", priceCents: 1299 },
      { itemId: "item-2", name: "Fries", priceCents: 499 },
    ],
  });

  assert.equal(created.currentVersion, 1);
  assert.equal(created.versions.length, 1);
  assert.equal(created.versions[0]?.version, 1);
});

test("updates menu and preserves version history", async () => {
  const repo = new InMemoryMenuRepository();
  const service = new MenuService(repo);

  const created = await service.createMenu({
    merchantId: "merchant-1",
    storeId: "store-1",
    name: "Lunch Menu",
    items: [{ itemId: "item-1", name: "Burger", priceCents: 1299 }],
  });

  const updated = await service.updateMenu(created.id, {
    name: "Lunch Menu v2",
    items: [
      { itemId: "item-1", name: "Burger", priceCents: 1399 },
      { itemId: "item-3", name: "Soda", priceCents: 299 },
    ],
  });

  assert.equal(updated.currentVersion, 2);
  assert.equal(updated.versions.length, 2);
  assert.equal(updated.versions[0]?.version, 1);
  assert.equal(updated.versions[1]?.version, 2);
  assert.equal(updated.versions[0]?.items[0]?.priceCents, 1299);
  assert.equal(updated.versions[1]?.items[0]?.priceCents, 1399);
});
