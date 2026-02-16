import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { NotificationTemplateService } from "./notification-template-service.js";

test("resolves template by event type, actor type, and locale", async () => {
  const eventBus = new InMemoryEventBus();
  const service = new NotificationTemplateService(eventBus);

  const result = await service.resolveTemplate({
    eventType: "order.created.v1",
    actorType: "consumer",
    locale: "en-US",
  });

  assert.equal(result.templateKey, "order.created.consumer.v1");
  assert.equal(result.localeUsed, "en-US");
  assert.equal(result.localizationWarning, false);
});

test("falls back to default locale when requested locale is missing", async () => {
  const eventBus = new InMemoryEventBus();
  const service = new NotificationTemplateService(eventBus);

  const result = await service.resolveTemplate({
    eventType: "dispatch.assignment.completed.v1",
    actorType: "courier",
    locale: "fr-FR",
  });

  assert.equal(result.templateKey, "dispatch.assignment.completed.courier.v1");
  assert.equal(result.localeUsed, "en-US");
  assert.equal(result.localizationWarning, true);
  const resolvedEvent = eventBus.events.find(
    (event) => event.type === "notification.template_resolved.v1",
  );
  assert.ok(resolvedEvent);
});
