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

export interface SettlementReconciliationRecord {
  entityId: string;
  amount: number;
}

export interface ReconcileSettlementInput {
  expectedRecords: SettlementReconciliationRecord[];
  actualRecords: SettlementReconciliationRecord[];
  toleranceCents: number;
}

export type SettlementReconciliationExceptionReason =
  | "AMOUNT_MISMATCH"
  | "MISSING_EXPECTED_RECORD"
  | "MISSING_ACTUAL_RECORD";

export interface SettlementReconciliationExceptionCase {
  entityId: string;
  expectedAmount: number;
  actualAmount: number;
  variance: number;
  reason: SettlementReconciliationExceptionReason;
}

export interface SettlementReconciliationResult {
  reconciliationId: string;
  reconciledAt: string;
  toleranceCents: number;
  totalExpectedAmount: number;
  totalActualAmount: number;
  exceptionCases: SettlementReconciliationExceptionCase[];
}

export interface RunSettlementReconciliationImportInput {
  scheduleId: string;
  runAt: string;
  sourceFileName: string;
  reconciliationInput: ReconcileSettlementInput;
  ingestedRecords: number;
}

export interface SettlementReconciliationImportRun {
  importRunId: string;
  scheduleId: string;
  runAt: string;
  sourceFileName: string;
  ingestedRecords: number;
  createdAt: string;
  result: SettlementReconciliationResult;
}

export interface PayoutStatementLineItem {
  label: string;
  amount: number;
}

export interface PublishPayoutStatementInput {
  payoutBatchId: string;
  entityType: PayoutEntityType;
  entityId: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  totalAmount: number;
  lineItems: PayoutStatementLineItem[];
}

export type PayoutStatementFormat = "PDF" | "PLAINTEXT";

export interface PayoutStatement {
  statementId: string;
  payoutBatchId: string;
  entityType: PayoutEntityType;
  entityId: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  totalAmount: number;
  lineItems: PayoutStatementLineItem[];
  format: PayoutStatementFormat;
  renderedContent: string;
  createdAt: string;
}
