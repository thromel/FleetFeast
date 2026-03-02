import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";

import { createAppSessionAuthService, createDevOidcVerifier } from "@fleetfeast/app-auth";

import { createCourierBffServer, createCourierCoreApiDependencies } from "./server.js";

test("courier-bff exposes accept pickup and dropoff action routes", async () => {
  const app = createCourierBffServer({
    listAvailableJobs: async () => [],
    getFeatureFlagSnapshot: async () => ({
      flags: { "courier.offlineReplay": true },
      ttlSeconds: 30,
      generatedAtEpochMillis: 1,
    }),
    acceptJob: async (jobId: string, courierId: string) => ({
      jobId,
      orderId: jobId,
      status: "ACCEPTED",
      courierId,
    }),
    pickupJob: async (jobId: string, courierId: string) => ({
      jobId,
      orderId: jobId,
      status: "PICKED_UP",
      courierId,
    }),
    dropoffJob: async (jobId: string, courierId: string) => ({
      jobId,
      orderId: jobId,
      status: "DROPPED_OFF",
      courierId,
    }),
    oidcVerifier: createDevOidcVerifier(),
    sessionAuth: createAppSessionAuthService({
      jwtSecret: "fleetfeast-courier-bff-job-actions-test-secret",
    }),
  });

  await app.listen({ port: 0, host: "127.0.0.1" });

  try {
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind courier-bff job actions listener");
    }

    const accept = await fetch(`http://127.0.0.1:${address.port}/app/v1/courier/jobs/job-1/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courierId: "courier-1" }),
    });
    assert.equal(accept.status, 200);
    const acceptPayload = (await accept.json()) as { job: { status: string } };
    assert.equal(acceptPayload.job.status, "ACCEPTED");

    const pickup = await fetch(`http://127.0.0.1:${address.port}/app/v1/courier/jobs/job-1/pickup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courierId: "courier-1" }),
    });
    assert.equal(pickup.status, 200);
    const pickupPayload = (await pickup.json()) as { job: { status: string } };
    assert.equal(pickupPayload.job.status, "PICKED_UP");

    const dropoff = await fetch(`http://127.0.0.1:${address.port}/app/v1/courier/jobs/job-1/dropoff`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courierId: "courier-1" }),
    });
    assert.equal(dropoff.status, 200);
    const dropoffPayload = (await dropoff.json()) as { job: { status: string } };
    assert.equal(dropoffPayload.job.status, "DROPPED_OFF");
  } finally {
    await app.close();
  }
});

test("courier core-api dependencies call job action endpoints", async () => {
  const requests: Array<{ method: string; url: string; body: string }> = [];
  const backend = createHttpServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      requests.push({
        method: request.method ?? "",
        url: request.url ?? "",
        body,
      });

      if (request.method === "GET" && request.url === "/api/v1/courier/jobs/available") {
        response.statusCode = 200;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ jobs: [] }));
        return;
      }

      if (request.method === "POST" && request.url === "/api/v1/courier/jobs/job-1/accept") {
        response.statusCode = 200;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ jobId: "job-1", orderId: "job-1", status: "ACCEPTED" }));
        return;
      }

      if (request.method === "POST" && request.url === "/api/v1/courier/jobs/job-1/pickup") {
        response.statusCode = 200;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ jobId: "job-1", orderId: "job-1", status: "PICKED_UP" }));
        return;
      }

      if (request.method === "POST" && request.url === "/api/v1/courier/jobs/job-1/dropoff") {
        response.statusCode = 200;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ jobId: "job-1", orderId: "job-1", status: "DROPPED_OFF" }));
        return;
      }

      response.statusCode = 404;
      response.end();
    });
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

  const backendAddress = backend.address();
  if (!backendAddress || typeof backendAddress === "string") {
    throw new Error("Failed to bind courier core-api backend stub");
  }

  try {
    const dependencies = createCourierCoreApiDependencies({
      coreApiBaseUrl: `http://127.0.0.1:${backendAddress.port}`,
    });

    const accepted = await dependencies.acceptJob("job-1", "courier-1");
    const pickedUp = await dependencies.pickupJob("job-1", "courier-1");
    const droppedOff = await dependencies.dropoffJob("job-1", "courier-1");

    assert.equal(accepted.status, "ACCEPTED");
    assert.equal(pickedUp.status, "PICKED_UP");
    assert.equal(droppedOff.status, "DROPPED_OFF");
    assert.deepEqual(
      requests.map((request) => `${request.method} ${request.url}`),
      [
        "POST /api/v1/courier/jobs/job-1/accept",
        "POST /api/v1/courier/jobs/job-1/pickup",
        "POST /api/v1/courier/jobs/job-1/dropoff",
      ],
    );
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
