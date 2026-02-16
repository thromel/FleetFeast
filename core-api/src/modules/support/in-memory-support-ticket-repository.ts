import type { SupportTicket } from "./types.js";

export class InMemorySupportTicketRepository {
  private readonly tickets = new Map<string, SupportTicket>();

  async save(ticket: SupportTicket): Promise<void> {
    this.tickets.set(ticket.ticketId, ticket);
  }

  async findById(ticketId: string): Promise<SupportTicket | null> {
    return this.tickets.get(ticketId) ?? null;
  }
}
