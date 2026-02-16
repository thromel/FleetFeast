export interface MenuItemInput {
  itemId: string;
  name: string;
  priceCents: number;
}

export interface MenuItem {
  itemId: string;
  name: string;
  priceCents: number;
}

export interface MenuVersion {
  version: number;
  name: string;
  items: MenuItem[];
  createdAt: string;
}

export interface Menu {
  id: string;
  merchantId: string;
  storeId: string;
  currentVersion: number;
  versions: MenuVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateMenuInput {
  merchantId: string;
  storeId: string;
  name: string;
  items: MenuItemInput[];
}

export interface UpdateMenuInput {
  name: string;
  items: MenuItemInput[];
}
