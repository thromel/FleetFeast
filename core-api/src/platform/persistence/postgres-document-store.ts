import { Pool } from "pg";

import type { DocumentStore, DocumentStoreEntry } from "./document-store.js";

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS app_documents (
  namespace TEXT NOT NULL,
  document_key TEXT NOT NULL,
  document_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (namespace, document_key)
);
CREATE INDEX IF NOT EXISTS idx_app_documents_namespace_updated_at
  ON app_documents(namespace, updated_at DESC);
`;

export class PostgresDocumentStore implements DocumentStore {
  private readonly pool: Pool;
  private initializationPromise: Promise<void> | null = null;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async put<TValue>(namespace: string, key: string, value: TValue): Promise<void> {
    await this.ensureInitialized();
    await this.pool.query(
      `
      INSERT INTO app_documents(namespace, document_key, document_value, updated_at)
      VALUES ($1, $2, $3::jsonb, NOW())
      ON CONFLICT (namespace, document_key)
      DO UPDATE SET document_value = EXCLUDED.document_value, updated_at = NOW()
      `,
      [namespace, key, JSON.stringify(value)],
    );
  }

  async get<TValue>(namespace: string, key: string): Promise<TValue | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<{ document_value: TValue }>(
      `
      SELECT document_value
      FROM app_documents
      WHERE namespace = $1 AND document_key = $2
      LIMIT 1
      `,
      [namespace, key],
    );

    return result.rows[0]?.document_value ?? null;
  }

  async list<TValue>(namespace: string): Promise<TValue[]> {
    await this.ensureInitialized();
    const result = await this.pool.query<{ document_value: TValue }>(
      `
      SELECT document_value
      FROM app_documents
      WHERE namespace = $1
      ORDER BY updated_at ASC
      `,
      [namespace],
    );

    return result.rows.map((row) => row.document_value);
  }

  async listEntries<TValue>(namespace: string): Promise<Array<DocumentStoreEntry<TValue>>> {
    await this.ensureInitialized();
    const result = await this.pool.query<{ document_key: string; document_value: TValue }>(
      `
      SELECT document_key, document_value
      FROM app_documents
      WHERE namespace = $1
      ORDER BY updated_at ASC
      `,
      [namespace],
    );

    return result.rows.map((row) => ({
      key: row.document_key,
      value: row.document_value,
    }));
  }

  async delete(namespace: string, key: string): Promise<void> {
    await this.ensureInitialized();
    await this.pool.query(
      `
      DELETE FROM app_documents
      WHERE namespace = $1 AND document_key = $2
      `,
      [namespace, key],
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = this.pool.query(INIT_SQL).then(() => undefined);
    }

    await this.initializationPromise;
  }
}
