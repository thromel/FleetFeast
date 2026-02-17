import type { DocumentStore, DocumentStoreEntry } from "./document-store.js";

function clone<TValue>(value: TValue): TValue {
  return JSON.parse(JSON.stringify(value)) as TValue;
}

export class InMemoryDocumentStore implements DocumentStore {
  private readonly namespaces = new Map<string, Map<string, unknown>>();

  async put<TValue>(namespace: string, key: string, value: TValue): Promise<void> {
    const entries = this.namespaces.get(namespace) ?? new Map<string, unknown>();
    entries.set(key, clone(value));
    this.namespaces.set(namespace, entries);
  }

  async get<TValue>(namespace: string, key: string): Promise<TValue | null> {
    const entries = this.namespaces.get(namespace);
    if (!entries) {
      return null;
    }

    const value = entries.get(key);
    return value === undefined ? null : clone(value as TValue);
  }

  async list<TValue>(namespace: string): Promise<TValue[]> {
    const entries = this.namespaces.get(namespace);
    if (!entries) {
      return [];
    }

    return [...entries.values()].map((value) => clone(value as TValue));
  }

  async listEntries<TValue>(namespace: string): Promise<Array<DocumentStoreEntry<TValue>>> {
    const entries = this.namespaces.get(namespace);
    if (!entries) {
      return [];
    }

    return [...entries.entries()].map(([key, value]) => ({
      key,
      value: clone(value as TValue),
    }));
  }

  async delete(namespace: string, key: string): Promise<void> {
    const entries = this.namespaces.get(namespace);
    if (!entries) {
      return;
    }

    entries.delete(key);
    if (entries.size === 0) {
      this.namespaces.delete(namespace);
    }
  }
}
