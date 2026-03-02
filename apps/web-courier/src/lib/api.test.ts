import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";

import {
  acceptCourierJob,
  dropoffCourierJob,
  listAvailableCourierJobs,
  pickupCourierJob,
} from "./api";

test("listAvailableCourierJobs calls courier-bff available jobs endpoint", async () => {
  const requests: Array<{ method: string; url: string }> = [];
  const backend = createHttpServer((request, response) => {
    requests.push({
      method: request.method ?? "",
      url: request.url ?? "",
    });

    if (request.method === "GET" && request.url === "/app/v1/courier/jobs/available") {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          jobs: [{ jobId: "job-1", orderId: "order-1", status: "ASSIGNED", courierId: "courier-1" }],
        }),
      );
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
      throw new Error("Failed to bind courier list-jobs test backend");
    }

    const jobs = await listAvailableCourierJobs({
      courierBffBaseUrl: `http://127.0.0.1:${address.port}`,
    });

    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]?.jobId, "job-1");
    assert.equal(requests[0]?.method, "GET");
    assert.equal(requests[0]?.url, "/app/v1/courier/jobs/available");
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

test("courier job action methods post to action routes", async () => {
  const requests: Array<{ method: string; url: string; body: string }> = [];
  const backend = createHttpServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      body += chunk;
    });

    request.on("end", () => {
      requests.push({
        method: request.method ?? "",
        url: request.url ?? "",
        body,
      });

      if (request.method === "POST" && request.url === "/app/v1/courier/jobs/job-1/accept") {
        response.statusCode = 200;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ job: { jobId: "job-1", orderId: "order-1", status: "ASSIGNED", courierId: "courier-1" } }));
        return;
      }

      if (request.method === "POST" && request.url === "/app/v1/courier/jobs/job-1/pickup") {
        response.statusCode = 200;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ job: { jobId: "job-1", orderId: "order-1", status: "PICKED_UP", courierId: "courier-1" } }));
        return;
      }

      if (request.method === "POST" && request.url === "/app/v1/courier/jobs/job-1/dropoff") {
        response.statusCode = 200;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ job: { jobId: "job-1", orderId: "order-1", status: "DELIVERED", courierId: "courier-1" } }));
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

  try {
    const address = backend.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind courier job-action test backend");
    }

    const options = { courierBffBaseUrl: `http://127.0.0.1:${address.port}` };

    const accepted = await acceptCourierJob("job-1", "courier-1", options);
    const picked = await pickupCourierJob("job-1", "courier-1", options);
    const dropped = await dropoffCourierJob("job-1", "courier-1", options);

    assert.equal(accepted.status, "ASSIGNED");
    assert.equal(picked.status, "PICKED_UP");
    assert.equal(dropped.status, "DELIVERED");
    assert.equal(requests.length, 3);
    assert.equal(requests[0]?.url, "/app/v1/courier/jobs/job-1/accept");
    assert.equal(requests[1]?.url, "/app/v1/courier/jobs/job-1/pickup");
    assert.equal(requests[2]?.url, "/app/v1/courier/jobs/job-1/dropoff");
    assert.match(requests[0]?.body ?? "", /"courierId":"courier-1"/);
    assert.match(requests[1]?.body ?? "", /"courierId":"courier-1"/);
    assert.match(requests[2]?.body ?? "", /"courierId":"courier-1"/);
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
