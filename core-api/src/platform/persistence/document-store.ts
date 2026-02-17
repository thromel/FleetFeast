export interface DocumentStoreEntry<TValue = unknown> {
  key: string;
  value: TValue;
}

export interface DocumentStore {
  put<TValue>(namespace: string, key: string, value: TValue): Promise<void>;
  get<TValue>(namespace: string, key: string): Promise<TValue | null>;
  list<TValue>(namespace: string): Promise<TValue[]>;
  listEntries<TValue>(namespace: string): Promise<Array<DocumentStoreEntry<TValue>>>;
  delete(namespace: string, key: string): Promise<void>;
}
