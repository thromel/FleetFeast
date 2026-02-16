import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import type {
  NotificationTemplateResolution,
  ResolveNotificationTemplateInput,
} from "./types.js";

const defaultLocale = "en-US";

const templateCatalog: Record<string, Record<string, string>> = {
  "order.created.v1:consumer": {
    "en-US": "order.created.consumer.v1",
    "es-US": "order.created.consumer.v1.es",
  },
  "dispatch.assignment.completed.v1:courier": {
    "en-US": "dispatch.assignment.completed.courier.v1",
  },
  "support.ticket_escalated.v1:support_agent": {
    "en-US": "support.ticket_escalated.support.v1",
  },
};

export class NotificationTemplateNotFoundError extends Error {
  code = "NOTIFICATION_TEMPLATE_NOT_FOUND";

  constructor() {
    super("Template not found for event and actor type.");
    this.name = "NotificationTemplateNotFoundError";
  }
}

export class NotificationTemplateService {
  constructor(private readonly eventBus: InMemoryEventBus) {}

  async resolveTemplate(
    input: ResolveNotificationTemplateInput,
  ): Promise<NotificationTemplateResolution> {
    const catalogKey = `${input.eventType}:${input.actorType}`;
    const templateSet = templateCatalog[catalogKey];

    if (!templateSet) {
      throw new NotificationTemplateNotFoundError();
    }

    const localized = templateSet[input.locale];
    const fallback = templateSet[defaultLocale];

    if (!localized && !fallback) {
      throw new NotificationTemplateNotFoundError();
    }

    const templateKey = localized ?? fallback;
    const localeUsed = localized ? input.locale : defaultLocale;
    const localizationWarning = !localized;
    const resolvedAt = new Date().toISOString();

    this.eventBus.publish({
      type: "notification.template_resolved.v1",
      occurredAt: resolvedAt,
      payload: {
        eventType: input.eventType,
        actorType: input.actorType,
        requestedLocale: input.locale,
        localeUsed,
        templateKey,
        localizationWarning,
      },
    });

    return {
      templateKey,
      localeUsed,
      localizationWarning,
    };
  }
}
