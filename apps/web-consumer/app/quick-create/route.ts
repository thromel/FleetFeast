import { redirect } from "next/navigation";

import { createConsumerQuickOrder } from "../../src/lib/api";

function asNonEmptyFormValue(value: FormDataEntryValue | null, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function asPositiveInteger(value: FormDataEntryValue | null, fallback: number): number {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export async function POST(request: Request): Promise<Response> {
  const formData = await request.formData();

  const consumerId = asNonEmptyFormValue(formData.get("consumerId"), "consumer-1");
  const merchantId = asNonEmptyFormValue(formData.get("merchantId"), "merchant-1");
  const itemName = asNonEmptyFormValue(formData.get("itemName"), "Chicken Rice Bowl");
  const quantity = asPositiveInteger(formData.get("quantity"), 1);
  const unitPriceCents = asPositiveInteger(formData.get("unitPriceCents"), 1250);
  const modifierName = asNonEmptyFormValue(formData.get("modifierName"), "Extra Sauce");
  const modifierPriceCents = asPositiveInteger(formData.get("modifierPriceCents"), 100);

  let order;
  try {
    order = await createConsumerQuickOrder({
      consumerId,
      merchantId,
      currency: "USD",
      item: {
        itemId: "menu-item-1",
        name: itemName,
        quantity,
        unitPriceCents,
        modifiers: [
          {
            name: modifierName,
            priceCents: modifierPriceCents,
          },
        ],
      },
    });
  } catch {
    redirect("/?error=CONSUMER_ORDER_CREATE_FAILED");
  }

  redirect(`/?orderId=${encodeURIComponent(order.id)}`);
}
