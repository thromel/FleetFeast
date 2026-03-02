import { redirect } from "next/navigation";

import { acceptMerchantOrder } from "../../../../src/lib/api";

function asNonEmptyFormValue(value: FormDataEntryValue | null, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export async function POST(
  request: Request,
  context: { params: { orderId: string } },
): Promise<Response> {
  const formData = await request.formData();
  const appSessionToken = asNonEmptyFormValue(formData.get("appSessionToken"), "");

  if (!appSessionToken) {
    redirect("/?error=APP_SESSION_REQUIRED");
  }

  const merchantId = asNonEmptyFormValue(formData.get("merchantId"), "merchant-1");

  let order;
  try {
    order = await acceptMerchantOrder(context.params.orderId, {
      appSessionToken,
    });
  } catch {
    redirect(`/?merchantId=${encodeURIComponent(merchantId)}&error=MERCHANT_ACCEPT_FAILED`);
  }

  redirect(
    `/?merchantId=${encodeURIComponent(merchantId)}&action=accept&orderId=${encodeURIComponent(order.id)}&status=${encodeURIComponent(order.status)}`,
  );
}
