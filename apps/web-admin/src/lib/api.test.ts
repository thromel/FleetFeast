import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";

import { fetchAdminIncidents } from "./api.js";

test("fetchAdminIncidents calls ops-bff admin incidents endpoint", async () => {
  const requests: Array<{ method: string; url: string }> = [];
  const backend = createHttpServer((request, response) => {
    requests.push({
      method: request.method ?? "",
      url: request.url ?? ""
    });

    if (request.method === "GET" && request.url === "/app/v1/admin/incidents") {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ incidents: [{ id: "incident-77", severity: "HIGH" }] }));
      return;
    }

    response.statusCode = 404;
    response.end();
  });

  await new Promise<void>((resolve, reject) => {
    backend.listen(0, "127.0.0.1", (error?: Error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  try {
    const address = backend.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind admin test backend");
    }

    const incidents = await fetchAdminIncidents({
      opsBffBaseUrl: `http://127.0.0.1:${address.port}`
    });

    assert.equal(incidents.length, 1);
    assert.equal(incidents[0]?.id, "incident-77");
    assert.equal(requests[0]?.method, "GET");
    assert.equal(requests[0]?.url, "/app/v1/admin/incidents");
  } finally {
    await new Promise<void>((resolve, reject) => {
      backend.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});
