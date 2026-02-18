import { InMemorySupportTicketRepository } from "../../../modules/support/in-memory-support-ticket-repository.js";
import type { SupportTicket } from "../../../modules/support/types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "support.tickets";

export class PersistentSupportTicketRepository extends InMemorySupportTicketRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async save(ticket: SupportTicket): Promise<void> {
    await super.save({ ...ticket });
    await this.store.put(NAMESPACE, ticket.ticketId, { ...ticket });
  }

  override async findById(ticketId: string): Promise<SupportTicket | null> {
    const cached = await super.findById(ticketId);
    if (cached) {
      return { ...cached };
    }

    const ticket = await this.store.get<SupportTicket>(NAMESPACE, ticketId);
    if (!ticket) {
      return null;
    }

    await super.save({ ...ticket });
    return { ...ticket };
  }

  override async listByStatus(status: SupportTicket["status"]): Promise<SupportTicket[]> {
    const tickets = await this.store.list<SupportTicket>(NAMESPACE);
    return tickets
      .filter((ticket) => ticket.status === status)
      .map((ticket) => ({ ...ticket }));
  }
}
