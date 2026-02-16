import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryEventBus } from "../identity/in-memory-event-bus.js";
import { InMemorySettlementLedgerRepository } from "./in-memory-settlement-ledger-repository.js";
import {
  SettlementLedgerService,
  UnbalancedJournalError,
} from "./settlement-ledger-service.js";

test("posts balanced double-entry journal and emits settlement event", async () => {
  const eventBus = new InMemoryEventBus();
  const service = new SettlementLedgerService(new InMemorySettlementLedgerRepository(), eventBus);

  const journal = await service.postJournalEntry({
    sourceType: "PAYMENT_CAPTURE",
    sourceId: "payment-intent-1",
    lines: [
      { account: "cash.clearing", side: "DEBIT", amount: 1912 },
      { account: "liability.merchant_payable", side: "CREDIT", amount: 1912 },
    ],
  });

  assert.equal(journal.lines.length, 2);
  const postedEvent = eventBus.events.find(
    (event) => event.type === "settlement.ledger_entry_posted.v1",
  );
  assert.ok(postedEvent);
});

test("rejects unbalanced journal entries", async () => {
  const eventBus = new InMemoryEventBus();
  const service = new SettlementLedgerService(new InMemorySettlementLedgerRepository(), eventBus);

  await assert.rejects(
    () =>
      service.postJournalEntry({
        sourceType: "REFUND",
        sourceId: "refund-1",
        lines: [
          { account: "liability.merchant_payable", side: "DEBIT", amount: 500 },
          { account: "cash.clearing", side: "CREDIT", amount: 450 },
        ],
      }),
    (error: unknown) =>
      error instanceof UnbalancedJournalError &&
      error.code === "SETTLEMENT_UNBALANCED_JOURNAL",
  );
});
