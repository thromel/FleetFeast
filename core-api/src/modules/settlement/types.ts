export type LedgerSide = "DEBIT" | "CREDIT";

export interface SettlementJournalLine {
  account: string;
  side: LedgerSide;
  amount: number;
}

export interface SettlementJournalEntry {
  ledgerEntryId: string;
  sourceType: string;
  sourceId: string;
  lines: SettlementJournalLine[];
  createdAt: string;
}

export interface PostSettlementJournalInput {
  sourceType: string;
  sourceId: string;
  lines: SettlementJournalLine[];
}

export type PayoutEntityType = "MERCHANT" | "COURIER";

export interface PayoutCandidateInput {
  entityType: PayoutEntityType;
  entityId: string;
  amount: number;
  hasException: boolean;
  holdReason?: string;
}

export interface GeneratePayoutBatchInput {
  scheduleId: string;
  runAt: string;
  candidates: PayoutCandidateInput[];
}

export interface PayoutRecord {
  entityType: PayoutEntityType;
  entityId: string;
  amount: number;
}

export interface PayoutHold {
  entityType: PayoutEntityType;
  entityId: string;
  reason: string;
}

export interface PayoutBatch {
  payoutBatchId: string;
  scheduleId: string;
  runAt: string;
  payouts: PayoutRecord[];
  holds: PayoutHold[];
  status: "GENERATED";
  createdAt: string;
}
