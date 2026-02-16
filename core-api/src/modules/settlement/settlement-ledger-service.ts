import { randomUUID } from "node:crypto";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemorySettlementLedgerRepository } from "./in-memory-settlement-ledger-repository.js";
import type { PostSettlementJournalInput, SettlementJournalEntry } from "./types.js";

export class UnbalancedJournalError extends Error {
  code = "SETTLEMENT_UNBALANCED_JOURNAL";

  constructor() {
    super("Journal entry is unbalanced.");
    this.name = "UnbalancedJournalError";
  }
}

export class SettlementLedgerService {
  constructor(
    private readonly ledgerRepository: InMemorySettlementLedgerRepository,
    private readonly eventBus: InMemoryEventBus,
  ) {}

  async postJournalEntry(input: PostSettlementJournalInput): Promise<SettlementJournalEntry> {
    const debitTotal = input.lines
      .filter((line) => line.side === "DEBIT")
      .reduce((sum, line) => sum + line.amount, 0);
    const creditTotal = input.lines
      .filter((line) => line.side === "CREDIT")
      .reduce((sum, line) => sum + line.amount, 0);

    if (debitTotal !== creditTotal) {
      throw new UnbalancedJournalError();
    }

    const createdAt = new Date().toISOString();
    const entry: SettlementJournalEntry = {
      ledgerEntryId: randomUUID(),
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      lines: input.lines,
      createdAt,
    };

    await this.ledgerRepository.save(entry);
    this.eventBus.publish({
      type: "settlement.ledger_entry_posted.v1",
      occurredAt: createdAt,
      payload: {
        ledgerEntryId: entry.ledgerEntryId,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
      },
    });

    return entry;
  }
}
