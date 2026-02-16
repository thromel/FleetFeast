import type { SettlementJournalEntry } from "./types.js";

export class InMemorySettlementLedgerRepository {
  private readonly entries = new Map<string, SettlementJournalEntry>();

  async save(entry: SettlementJournalEntry): Promise<void> {
    this.entries.set(entry.ledgerEntryId, entry);
  }
}
