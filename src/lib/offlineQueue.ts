export type QueuedCollection =
  | 'siteSettings'
  | 'shops'
  | 'purchases'
  | 'payments'
  | 'expenses'
  | 'cashTransactions';

export type QueuedOperation = 'create' | 'update' | 'delete';

export interface QueuedMutation {
  id: string;
  uid: string;
  collectionName: QueuedCollection;
  docId: string;
  operation: QueuedOperation;
  payload: Record<string, unknown> | null;
  fallbackCreatePayload?: Record<string, unknown> | null;
  auditLog: {
    id: string;
    action: 'create' | 'update' | 'delete' | 'restore' | 'settings';
    entityType: 'shop' | 'purchase' | 'payment' | 'expense' | 'cash' | 'settings' | 'backup';
    entityId: string;
    summary: string;
    beforeData: string;
    afterData: string;
  };
  baseUpdatedAtMs?: number;
  createdAtMs: number;
  retryCount: number;
  lastError?: string;
}

const DB_NAME = 'daily_account_offline_v1';
const DB_VERSION = 1;
const STORE_NAME = 'sync_queue';

function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this browser.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('uid', 'uid', { unique: false });
        store.createIndex('createdAtMs', 'createdAtMs', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB.'));
  });
}

export async function enqueueOfflineMutation(item: QueuedMutation): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(item);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Failed to queue offline mutation.'));
    };
  });
}

export async function getOfflineMutations(uid: string): Promise<QueuedMutation[]> {
  try {
    const db = await openOfflineDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('uid');
      const req = index.getAll(uid);
      req.onsuccess = () => {
        const items = (req.result as QueuedMutation[]) || [];
        items.sort((a, b) => a.createdAtMs - b.createdAtMs);
        db.close();
        resolve(items);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return [];
  }
}

export async function removeOfflineMutation(id: string): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Failed to remove offline mutation.'));
    };
  });
}

export async function updateOfflineMutationError(id: string, lastError: string): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result as QueuedMutation | undefined;
      if (existing) {
        existing.retryCount = (existing.retryCount || 0) + 1;
        existing.lastError = lastError;
        store.put(existing);
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
