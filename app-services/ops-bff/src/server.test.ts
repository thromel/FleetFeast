import assert from "node:assert/strict";
import test from "node:test";

import { createOpsBffServer } from "./server.js";

test("ops-bff serves merchant orders and admin incidents", async () => {
  const app = createOpsBffServer({
    listMerchantOrders: async () => [{ id: "order-1", status: "MERCHANT_ACCEPTED" }],
    listAdminIncidents: async () => [{ id: "incident-1", severity: "HIGH" }],
  });
  await app.listen({ port: 0, host: "127.0.0.1" });

  try {
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind ops-bff test listener");
    }

    const merchantResponse = await fetch(
      `http://127.0.0.1:${address.port}/app/v1/merchant/orders?merchantId=merchant-1`,
    );
    assert.equal(merchantResponse.status, 200);
    const merchantPayload = (await merchantResponse.json()) as {
      orders: Array<{ id: string }>;
    };
    assert.equal(merchantPayload.orders[0]?.id, "order-1");

    const adminResponse = await fetch(`http://127.0.0.1:${address.port}/app/v1/admin/incidents`);
    assert.equal(adminResponse.status, 200);
    const adminPayload = (await adminResponse.json()) as {
      incidents: Array<{ id: string }>;
    };
    assert.equal(adminPayload.incidents[0]?.id, "incident-1");
  } finally {
    await app.close();
  }
});
