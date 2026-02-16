export interface BasketItemInput {
  itemId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  modifiers: string[];
  note?: string;
}

export interface BasketItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  modifiers: string[];
  note: string | null;
}

export interface Basket {
  id: string;
  consumerId: string;
  merchantId: string;
  currency: string;
  items: BasketItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateBasketInput {
  consumerId: string;
  merchantId: string;
  currency: string;
}

export interface UpdateBasketInput {
  items: BasketItemInput[];
}
