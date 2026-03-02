import { redirect } from "next/navigation";

import { requestMerchantDispatch } from "../../../../src/lib/api";

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
    order = await requestMerchantDispatch(
      context.params.orderId,
      {
        candidates: [
          {
            courierId: "courier-1",
            distanceMeters: 300,
            available: true,
            activeOrders: 0,
            withinRestWindow: true,
          },
          {
            courierId: "courier-2",
            distanceMeters: 700,
            available: true,
            activeOrders: 1,
            withinRestWindow: true,
          },
        ],
        slaPressure: 0.45,
        merchantSelfDeliveryEnabled: false,
      },
      {
        appSessionToken,
      },
    );
  } catch {
    redirect(`/?merchantId=${encodeURIComponent(merchantId)}&error=MERCHANT_DISPATCH_REQUEST_FAILED`);
  }

  redirect(
    `/?merchantId=${encodeURIComponent(merchantId)}&action=request-dispatch&orderId=${encodeURIComponent(order.id)}&status=${encodeURIComponent(order.status)}`,
  );
}
