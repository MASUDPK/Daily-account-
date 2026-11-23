import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  User,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from '../lib/firebase';
import {
  enqueueOfflineMutation,
  getOfflineMutations,
  QueuedCollection,
  QueuedMutation,
  removeOfflineMutation,
  updateOfflineMutationError,
} from '../lib/offlineQueue';
import {
  computeDashboardTotals,
  computeShopSummaries,
  DashboardTotals,
} from '../lib/calculations';
import { generateId, round2 } from '../lib/format';
import { DailyAccountBackup } from '../lib/exportUtils';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  AuditLog,
  CashTransaction,
  EXPENSE_CATEGORIES,
  Expense,
  LIQUID_ACCOUNTS,
  PAYMENT_METHODS,
  PURCHASE_CATEGORIES,
  Payment,
  Purchase,
  Shop,
  ShopSummary,
  SiteSettings,
} from '../types/accounting';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface AccountingContextValue {
  user: User | null;
  authLoading: boolean;
  dataLoading: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  pendingMutations: QueuedMutation[];
  firestoreError: string | null;
  siteSettings: SiteSettings | null;
  shops: Shop[];
  purchases: Purchase[];
  payments: Payment[];
  expenses: Expense[];
  cashTransactions: CashTransaction[];
  auditLogs: AuditLog[];
  shopSummaries: ShopSummary[];
  totals: DashboardTotals;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  notify: (type: 'success' | 'error' | 'info', text: string) => void;
  login: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  syncNow: () => Promise<void>;
  retryConnection: () => Promise<void>;
  saveSiteSettings: (input: {
    siteName: string;
    siteLocation: string;
    openingCash: number;
    openingBank: number;
    openingMobile: number;
  }) => Promise<void>;
  saveShop: (
    input: Omit<Shop, 'id' | 'uid' | 'createdAtMs' | 'updatedAtMs'>,
    existingShop?: Shop
  ) => Promise<string>;
  deleteShop: (shop: Shop) => Promise<void>;
  savePurchase: (
    input: Omit<Purchase, 'id' | 'uid' | 'createdAtMs' | 'updatedAtMs'>,
    existingPurchase?: Purchase
  ) => Promise<void>;
  deletePurchase: (purchase: Purchase) => Promise<void>;
  savePayment: (
    input: Omit<Payment, 'id' | 'uid' | 'createdAtMs' | 'updatedAtMs'>,
    existingPayment?: Payment
  ) => Promise<void>;
  deletePayment: (payment: Payment) => Promise<void>;
  saveExpense: (
    input: Omit<Expense, 'id' | 'uid' | 'createdAtMs' | 'updatedAtMs'>,
    existingExpense?: Expense
  ) => Promise<void>;
  deleteExpense: (expense: Expense) => Promise<void>;
  saveCashTransaction: (
    input: Omit<CashTransaction, 'id' | 'uid' | 'createdAtMs' | 'updatedAtMs'>,
    existingTx?: CashTransaction
  ) => Promise<void>;
  deleteCashTransaction: (tx: CashTransaction) => Promise<void>;
  restoreBackup: (backup: DailyAccountBackup) => Promise<{ restoredCount: number }>;
}

const AccountingContext = createContext<AccountingContextValue | null>(null);

function tsToMs(val: unknown): number {
  if (!val) return Date.now();
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val !== null && 'toMillis' in val) {
    return (val as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

function truncateJson(obj: unknown): string {
  try {
    const str = JSON.stringify(obj ?? {});
    return str.length > 1900 ? `${str.slice(0, 1895)}...` : str;
  } catch {
    return '{}';
  }
}

const FIRESTORE_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidFirestoreId(val: unknown): val is string {
  return typeof val === 'string' && FIRESTORE_ID_REGEX.test(val);
}

function isValidIsoDate(val: unknown): val is string {
  return typeof val === 'string' && ISO_DATE_REGEX.test(val);
}

function isNotFoundFirestoreError(err: unknown): boolean {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = String((err as { code?: unknown }).code || '');
    if (code === 'not-found' || code === 'firestore/not-found') return true;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('no document to update') || msg.includes('not-found');
  }
  return false;
}

function isNetworkFailure(err: unknown): boolean {
  if (!navigator.onLine) return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('unavailable') ||
      msg.includes('network') ||
      msg.includes('offline') ||
      msg.includes('failed to fetch')
    );
  }
  return false;
}

function applyOfflineOverlay<T extends { id: string; pendingSync?: boolean }>(
  serverItems: T[],
  queue: QueuedMutation[],
  collectionName: QueuedCollection
): T[] {
  const relevant = queue.filter((q) => q.collectionName === collectionName);
  if (relevant.length === 0) return serverItems;

  const map = new Map<string, T>();
  for (const item of serverItems) {
    map.set(item.id, item);
  }

  for (const q of relevant) {
    if (q.operation === 'delete') {
      map.delete(q.docId);
    } else if (q.payload) {
      const existing = map.get(q.docId);
      map.set(q.docId, {
        ...(existing || {}),
        ...(q.payload as unknown as T),
        id: q.docId,
        createdAtMs: (existing as { createdAtMs?: number } | undefined)?.createdAtMs || q.createdAtMs,
        updatedAtMs: q.createdAtMs,
        pendingSync: true,
      });
    }
  }

  return Array.from(map.values());
}

export const AccountingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isOnline = useOnlineStatus();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [listenerVersion, setListenerVersion] = useState(0);

  const [rawSettings, setRawSettings] = useState<SiteSettings | null>(null);
  const [rawShops, setRawShops] = useState<Shop[]>([]);
  const [rawPurchases, setRawPurchases] = useState<Purchase[]>([]);
  const [rawPayments, setRawPayments] = useState<Payment[]>([]);
  const [rawExpenses, setRawExpenses] = useState<Expense[]>([]);
  const [rawCashTxs, setRawCashTxs] = useState<CashTransaction[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [pendingMutations, setPendingMutations] = useState<QueuedMutation[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    const id = generateId();
    setToasts((prev) => [...prev.slice(-3), { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  // Startup connection check
  useEffect(() => {
    testFirestoreConnection().catch(() => {});
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (!currentUser) {
        setRawSettings(null);
        setRawShops([]);
        setRawPurchases([]);
        setRawPayments([]);
        setRawExpenses([]);
        setRawCashTxs([]);
        setAuditLogs([]);
        setPendingMutations([]);
        setFirestoreError(null);
      }
    });
    return () => unsub();
  }, []);

  const refreshQueue = useCallback(async (uid: string) => {
    const list = await getOfflineMutations(uid);
    setPendingMutations(list);
    return list;
  }, []);

  // Firestore real-time listeners (only when authenticated and ID token is ready)
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const unsubs: Array<() => void> = [];

    setDataLoading(true);
    setFirestoreError(null);
    refreshQueue(user.uid);

    const recordSnapError = (err: unknown, op: OperationType, path: string) => {
      try {
        handleFirestoreError(err, op, path);
      } catch (wrapped) {
        const msg = wrapped instanceof Error ? wrapped.message : String(wrapped);
        setFirestoreError(msg);
      }
    };

    const startListeners = async () => {
      try {
        await user.getIdToken();
      } catch {
        // Proceed with cached auth state if offline
      }
      if (cancelled) return;

      unsubs.push(
        onSnapshot(
          doc(db, 'siteSettings', user.uid),
          (snap) => {
            setFirestoreError(null);
            if (snap.exists()) {
              const d = snap.data();
              setRawSettings({
                uid: d.uid,
                siteName: d.siteName || 'Main Construction Site',
                siteLocation: d.siteLocation || '',
                openingCash: Number(d.openingCash || 0),
                openingBank: Number(d.openingBank || 0),
                openingMobile: Number(d.openingMobile || 0),
                createdAtMs: tsToMs(d.createdAt),
                updatedAtMs: tsToMs(d.updatedAt),
              });
            } else {
              setRawSettings({
                uid: user.uid,
                siteName: 'Main Construction Site',
                siteLocation: 'Dhaka, Bangladesh',
                openingCash: 0,
                openingBank: 0,
                openingMobile: 0,
              });
            }
            setDataLoading(false);
          },
          (err) => {
            recordSnapError(err, OperationType.GET, `siteSettings/${user.uid}`);
            setDataLoading(false);
          }
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'shops'), where('uid', '==', user.uid)),
          (snap) => {
            setFirestoreError(null);
              const items: Shop[] = snap.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  uid: String(data.uid || user.uid),
                  shopName: String(data.shopName || ''),
                  ownerName: String(data.ownerName || ''),
                  phone: String(data.phone || ''),
                  address: String(data.address || ''),
                  openingBalance: Number(data.openingBalance || 0),
                  openingBalanceType:
                    data.openingBalanceType === 'receivable' ? 'receivable' : 'payable',
                  notes: String(data.notes || ''),
                  isActive: data.isActive !== false,
                  createdAtMs: tsToMs(data.createdAt),
                  updatedAtMs: tsToMs(data.updatedAt),
                };
              });
              setRawShops(items);
            },
            (err) => recordSnapError(err, OperationType.LIST, 'shops')
          )
        );

        unsubs.push(
          onSnapshot(
            query(collection(db, 'purchases'), where('uid', '==', user.uid)),
            (snap) => {
              setFirestoreError(null);
              const items: Purchase[] = snap.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  uid: String(data.uid || user.uid),
                  date: String(data.date || ''),
                  shopId: String(data.shopId || ''),
                  shopName: String(data.shopName || ''),
                  materialName: String(data.materialName || ''),
                  category: PURCHASE_CATEGORIES.includes(data.category) ? data.category : 'Other',
                  quantity: Number(data.quantity || 0),
                  unit: String(data.unit || ''),
                  rate: Number(data.rate || 0),
                  totalAmount: Number(data.totalAmount || 0),
                  notes: String(data.notes || ''),
                  clientRequestId: String(data.clientRequestId || d.id),
                  createdAtMs: tsToMs(data.createdAt),
                  updatedAtMs: tsToMs(data.updatedAt),
                };
              });
              setRawPurchases(items);
            },
            (err) => recordSnapError(err, OperationType.LIST, 'purchases')
          )
        );

        unsubs.push(
          onSnapshot(
            query(collection(db, 'payments'), where('uid', '==', user.uid)),
            (snap) => {
              setFirestoreError(null);
              const items: Payment[] = snap.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  uid: String(data.uid || user.uid),
                  date: String(data.date || ''),
                  shopId: String(data.shopId || ''),
                  shopName: String(data.shopName || ''),
                  amount: Number(data.amount || 0),
                  method: PAYMENT_METHODS.includes(data.method) ? data.method : 'Other',
                  referenceNumber: String(data.referenceNumber || ''),
                  notes: String(data.notes || ''),
                  clientRequestId: String(data.clientRequestId || d.id),
                  createdAtMs: tsToMs(data.createdAt),
                  updatedAtMs: tsToMs(data.updatedAt),
                };
              });
              setRawPayments(items);
            },
            (err) => recordSnapError(err, OperationType.LIST, 'payments')
          )
        );

        unsubs.push(
          onSnapshot(
            query(collection(db, 'expenses'), where('uid', '==', user.uid)),
            (snap) => {
              setFirestoreError(null);
              const items: Expense[] = snap.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  uid: String(data.uid || user.uid),
                  date: String(data.date || ''),
                  category: EXPENSE_CATEGORIES.includes(data.category) ? data.category : 'Other',
                  description: String(data.description || ''),
                  amount: Number(data.amount || 0),
                  method: PAYMENT_METHODS.includes(data.method) ? data.method : 'Other',
                  notes: String(data.notes || ''),
                  clientRequestId: String(data.clientRequestId || d.id),
                  createdAtMs: tsToMs(data.createdAt),
                  updatedAtMs: tsToMs(data.updatedAt),
                };
              });
              setRawExpenses(items);
            },
            (err) => recordSnapError(err, OperationType.LIST, 'expenses')
          )
        );

        unsubs.push(
          onSnapshot(
            query(collection(db, 'cashTransactions'), where('uid', '==', user.uid)),
            (snap) => {
              setFirestoreError(null);
              const items: CashTransaction[] = snap.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  uid: String(data.uid || user.uid),
                  date: String(data.date || ''),
                  type: data.type,
                  account: LIQUID_ACCOUNTS.includes(data.account) ? data.account : 'Cash',
                  toAccount: LIQUID_ACCOUNTS.includes(data.toAccount) ? data.toAccount : '',
                  amount: Number(data.amount || 0),
                  description: String(data.description || ''),
                  referenceNumber: String(data.referenceNumber || ''),
                  notes: String(data.notes || ''),
                  clientRequestId: String(data.clientRequestId || d.id),
                  createdAtMs: tsToMs(data.createdAt),
                  updatedAtMs: tsToMs(data.updatedAt),
                };
              });
              setRawCashTxs(items);
            },
            (err) => recordSnapError(err, OperationType.LIST, 'cashTransactions')
          )
        );

        unsubs.push(
          onSnapshot(
            query(collection(db, 'auditLogs'), where('uid', '==', user.uid)),
            (snap) => {
              setFirestoreError(null);
              const items: AuditLog[] = snap.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  uid: String(data.uid || user.uid),
                  action: data.action,
                  entityType: data.entityType,
                  entityId: String(data.entityId || ''),
                  summary: String(data.summary || ''),
                  beforeData: String(data.beforeData || '{}'),
                  afterData: String(data.afterData || '{}'),
                  createdAtMs: tsToMs(data.createdAt),
                };
              });
              items.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
              setAuditLogs(items);
          },
          (err) => recordSnapError(err, OperationType.LIST, 'auditLogs')
        )
      );
    };

    startListeners();

    return () => {
      cancelled = true;
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, [user, listenerVersion, refreshQueue]);

  const executeBatchMutation = useCallback(async (mutation: QueuedMutation) => {
    const targetRef = doc(db, mutation.collectionName, mutation.docId);
    const auditRef = doc(db, 'auditLogs', mutation.auditLog.id);
    const auditData = {
      id: mutation.auditLog.id,
      uid: mutation.uid,
      action: mutation.auditLog.action,
      entityType: mutation.auditLog.entityType,
      entityId: String(mutation.auditLog.entityId || mutation.docId).slice(0, 128),
      summary: String(mutation.auditLog.summary || 'Accounting update').slice(0, 300),
      beforeData: String(mutation.auditLog.beforeData || '{}').slice(0, 2000),
      afterData: String(mutation.auditLog.afterData || '{}').slice(0, 2000),
      createdAt: serverTimestamp(),
    };

    const batch = writeBatch(db);
    if (mutation.operation === 'create' && mutation.payload) {
      batch.set(targetRef, {
        ...mutation.payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (mutation.operation === 'update' && mutation.payload) {
      batch.update(targetRef, {
        ...mutation.payload,
        updatedAt: serverTimestamp(),
      });
    } else if (mutation.operation === 'delete') {
      batch.delete(targetRef);
    }
    batch.set(auditRef, auditData);

    try {
      await batch.commit();
    } catch (err) {
      if (
        mutation.operation === 'update' &&
        mutation.fallbackCreatePayload &&
        isNotFoundFirestoreError(err)
      ) {
        const fallbackBatch = writeBatch(db);
        fallbackBatch.set(targetRef, {
          ...mutation.fallbackCreatePayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        fallbackBatch.set(auditRef, auditData);
        await fallbackBatch.commit();
        return;
      }
      throw err;
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!user || !navigator.onLine || isSyncing) return;
    const queue = await getOfflineMutations(user.uid);
    if (queue.length === 0) return;

    setIsSyncing(true);
    let syncedCount = 0;
    try {
      for (const item of queue) {
        try {
          await executeBatchMutation(item);
          await removeOfflineMutation(item.id);
          syncedCount++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await updateOfflineMutationError(item.id, msg);
          if (isNetworkFailure(err)) {
            break;
          }
        }
      }
      await refreshQueue(user.uid);
      if (syncedCount > 0) {
        notify('success', `Synchronized ${syncedCount} offline record${syncedCount > 1 ? 's' : ''} to Cloud Firestore.`);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [user, isSyncing, executeBatchMutation, refreshQueue, notify]);

  // Automatically flush offline sync queue when returning online
  useEffect(() => {
    if (isOnline && user && pendingMutations.length > 0) {
      syncNow();
    }
  }, [isOnline, user, pendingMutations.length, syncNow]);

  const commitOrQueue = useCallback(
    async (
      collectionName: QueuedCollection,
      docId: string,
      operation: 'create' | 'update' | 'delete',
      payload: Record<string, unknown> | null,
      audit: QueuedMutation['auditLog'],
      baseUpdatedAtMs?: number,
      fallbackCreatePayload?: Record<string, unknown> | null
    ) => {
      if (!user) throw new Error('Authentication required.');

      const mutation: QueuedMutation = {
        id: generateId(),
        uid: user.uid,
        collectionName,
        docId,
        operation,
        payload,
        fallbackCreatePayload: fallbackCreatePayload || null,
        auditLog: audit,
        baseUpdatedAtMs,
        createdAtMs: Date.now(),
        retryCount: 0,
      };

      if (!navigator.onLine) {
        await enqueueOfflineMutation(mutation);
        await refreshQueue(user.uid);
        notify('info', 'Saved offline in IndexedDB queue. Will sync automatically when online.');
        return;
      }

      try {
        await executeBatchMutation(mutation);
      } catch (err) {
        if (isNetworkFailure(err)) {
          await enqueueOfflineMutation(mutation);
          await refreshQueue(user.uid);
          notify('info', 'Network unavailable. Saved to offline sync queue.');
          return;
        }
        const opType =
          operation === 'create'
            ? OperationType.CREATE
            : operation === 'update'
            ? OperationType.UPDATE
            : OperationType.DELETE;
        handleFirestoreError(err, opType, `${collectionName}/${docId}`);
      }
    },
    [user, executeBatchMutation, refreshQueue, notify]
  );

  // Merge pending offline mutations over server state
  const siteSettings = useMemo(() => {
    const q = pendingMutations.filter((m) => m.collectionName === 'siteSettings');
    if (q.length === 0) return rawSettings;
    const last = q[q.length - 1];
    if (!last.payload) return rawSettings;
    return {
      ...(rawSettings || { uid: user?.uid || '' }),
      ...(last.payload as unknown as SiteSettings),
    };
  }, [rawSettings, pendingMutations, user]);

  const shops = useMemo(() => {
    return applyOfflineOverlay(rawShops, pendingMutations, 'shops').sort((a, b) =>
      a.shopName.localeCompare(b.shopName)
    );
  }, [rawShops, pendingMutations]);

  const purchases = useMemo(() => {
    return applyOfflineOverlay(rawPurchases, pendingMutations, 'purchases').sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.createdAtMs || 0) - (a.createdAtMs || 0);
    });
  }, [rawPurchases, pendingMutations]);

  const payments = useMemo(() => {
    return applyOfflineOverlay(rawPayments, pendingMutations, 'payments').sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.createdAtMs || 0) - (a.createdAtMs || 0);
    });
  }, [rawPayments, pendingMutations]);

  const expenses = useMemo(() => {
    return applyOfflineOverlay(rawExpenses, pendingMutations, 'expenses').sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.createdAtMs || 0) - (a.createdAtMs || 0);
    });
  }, [rawExpenses, pendingMutations]);

  const cashTransactions = useMemo(() => {
    return applyOfflineOverlay(rawCashTxs, pendingMutations, 'cashTransactions').sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.createdAtMs || 0) - (a.createdAtMs || 0);
    });
  }, [rawCashTxs, pendingMutations]);

  const shopSummaries = useMemo(
    () => computeShopSummaries(shops, purchases, payments),
    [shops, purchases, payments]
  );

  const totals = useMemo(
    () => computeDashboardTotals(siteSettings, shops, purchases, payments, expenses, cashTransactions),
    [siteSettings, shops, purchases, payments, expenses, cashTransactions]
  );

  const login = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const retryConnection = useCallback(async () => {
    if (user && navigator.onLine) {
      try {
        await user.getIdToken(true);
      } catch {
        // Ignore token refresh errors offline
      }
    }
    setFirestoreError(null);
    setListenerVersion((v) => v + 1);
  }, [user]);

  const saveSiteSettings = useCallback(
    async (input: {
      siteName: string;
      siteLocation: string;
      openingCash: number;
      openingBank: number;
      openingMobile: number;
    }) => {
      if (!user) throw new Error('Authentication required.');
      const hasPendingCreate = pendingMutations.some(
        (m) => m.collectionName === 'siteSettings' && m.operation === 'create'
      );
      const isCreate = !rawSettings?.createdAtMs && !hasPendingCreate;
      const payload = {
        uid: user.uid,
        siteName: input.siteName.trim().slice(0, 120) || 'Main Construction Site',
        siteLocation: input.siteLocation.trim().slice(0, 200),
        openingCash: Math.max(0, round2(input.openingCash)),
        openingBank: Math.max(0, round2(input.openingBank)),
        openingMobile: Math.max(0, round2(input.openingMobile)),
      };
      const updatePayload = {
        siteName: payload.siteName,
        siteLocation: payload.siteLocation,
        openingCash: payload.openingCash,
        openingBank: payload.openingBank,
        openingMobile: payload.openingMobile,
      };
      await commitOrQueue(
        'siteSettings',
        user.uid,
        isCreate ? 'create' : 'update',
        isCreate ? payload : updatePayload,
        {
          id: generateId(),
          action: 'settings',
          entityType: 'settings',
          entityId: user.uid,
          summary: `Updated site opening balances & profile (${payload.siteName})`.slice(0, 300),
          beforeData: truncateJson(rawSettings),
          afterData: truncateJson(payload),
        },
        rawSettings?.updatedAtMs,
        isCreate ? null : payload
      );
      notify('success', 'Site & opening balances saved.');
    },
    [user, rawSettings, pendingMutations, commitOrQueue, notify]
  );

  const saveShop = useCallback(
    async (
      input: Omit<Shop, 'id' | 'uid' | 'createdAtMs' | 'updatedAtMs'>,
      existingShop?: Shop
    ): Promise<string> => {
      if (!user) throw new Error('Authentication required.');
      const id = existingShop?.id || generateId();
      if (!isValidFirestoreId(id)) throw new Error('Invalid shop identifier.');
      const cleanName = input.shopName.trim().slice(0, 120);
      if (!cleanName) throw new Error('Shop name is required.');
      const balanceType = input.openingBalanceType === 'receivable' ? 'receivable' : 'payable';
      const openingBalance = Math.max(0, round2(input.openingBalance));

      const fullPayload = {
        id,
        uid: user.uid,
        shopName: cleanName,
        ownerName: input.ownerName.trim().slice(0, 100),
        phone: input.phone.trim().slice(0, 32),
        address: input.address.trim().slice(0, 240),
        openingBalance,
        openingBalanceType: balanceType,
        notes: input.notes.trim().slice(0, 500),
        isActive: existingShop ? Boolean(input.isActive) : true,
      };

      if (existingShop) {
        const updatePayload = {
          shopName: fullPayload.shopName,
          ownerName: fullPayload.ownerName,
          phone: fullPayload.phone,
          address: fullPayload.address,
          openingBalance: fullPayload.openingBalance,
          openingBalanceType: fullPayload.openingBalanceType,
          notes: fullPayload.notes,
          isActive: fullPayload.isActive,
        };
        await commitOrQueue(
          'shops',
          id,
          'update',
          updatePayload,
          {
            id: generateId(),
            action: 'update',
            entityType: 'shop',
            entityId: id,
            summary: `Updated shop: ${cleanName}`.slice(0, 300),
            beforeData: truncateJson(existingShop),
            afterData: truncateJson(updatePayload),
          },
          existingShop.updatedAtMs,
          fullPayload
        );
        notify('success', `Shop "${cleanName}" updated.`);
      } else {
        await commitOrQueue('shops', id, 'create', fullPayload, {
          id: generateId(),
          action: 'create',
          entityType: 'shop',
          entityId: id,
          summary: `Created shop: ${cleanName}`.slice(0, 300),
          beforeData: '{}',
          afterData: truncateJson(fullPayload),
        });
        notify('success', `Shop "${cleanName}" added.`);
      }
      return id;
    },
    [user, commitOrQueue, notify]
  );

  const deleteShop = useCallback(
    async (shop: Shop) => {
      const hasPurchases = purchases.some((p) => p.shopId === shop.id);
      const hasPayments = payments.some((p) => p.shopId === shop.id);
      if (hasPurchases || hasPayments) {
        throw new Error('Cannot delete a shop that has existing purchases or payments.');
      }
      await commitOrQueue('shops', shop.id, 'delete', null, {
        id: generateId(),
        action: 'delete',
        entityType: 'shop',
        entityId: shop.id,
        summary: `Deleted shop: ${shop.shopName}`.slice(0, 300),
        beforeData: truncateJson(shop),
        afterData: '{}',
      });
      notify('success', `Shop "${shop.shopName}" deleted.`);
    },
    [purchases, payments, commitOrQueue, notify]
  );

  const savePurchase = useCallback(
    async (
      input: Omit<Purchase, 'id' | 'uid' | 'createdAtMs' | 'updatedAtMs'>,
      existingPurchase?: Purchase
    ) => {
      if (!user) throw new Error('Authentication required.');
      if (!existingPurchase && purchases.some((p) => p.clientRequestId === input.clientRequestId)) {
        throw new Error('Duplicate submission blocked. This purchase was already recorded.');
      }
      const id = existingPurchase?.id || generateId();
      const clientRequestId = isValidFirestoreId(existingPurchase?.clientRequestId)
        ? existingPurchase.clientRequestId
        : isValidFirestoreId(input.clientRequestId)
        ? input.clientRequestId
        : id;
      if (!isValidFirestoreId(id) || !isValidFirestoreId(input.shopId)) {
        throw new Error('Invalid purchase or shop identifier.');
      }
      if (!isValidIsoDate(input.date)) {
        throw new Error('Invalid purchase date. Expected YYYY-MM-DD.');
      }
      const cleanShopName = input.shopName.trim().slice(0, 120);
      const cleanMaterialName = input.materialName.trim().slice(0, 120);
      const cleanUnit = input.unit.trim().slice(0, 32);
      if (!cleanShopName) throw new Error('Shop name is required.');
      if (!cleanMaterialName) throw new Error('Material name is required.');
      if (!cleanUnit) throw new Error('Unit is required.');
      if (!PURCHASE_CATEGORIES.includes(input.category)) {
        throw new Error('Invalid purchase category.');
      }

      const quantity = round2(input.quantity);
      const rate = round2(input.rate);
      const totalAmount = round2(quantity * rate);
      if (quantity <= 0) throw new Error('Quantity must be greater than zero.');
      if (rate < 0) throw new Error('Rate cannot be negative.');

      const fullPayload = {
        id,
        uid: user.uid,
        date: input.date,
        shopId: input.shopId,
        shopName: cleanShopName,
        materialName: cleanMaterialName,
        category: input.category,
        quantity,
        unit: cleanUnit,
        rate,
        totalAmount,
        notes: input.notes.trim().slice(0, 500),
        clientRequestId,
      };

      if (existingPurchase) {
        const updatePayload = {
          date: fullPayload.date,
          shopId: fullPayload.shopId,
          shopName: fullPayload.shopName,
          materialName: fullPayload.materialName,
          category: fullPayload.category,
          quantity: fullPayload.quantity,
          unit: fullPayload.unit,
          rate: fullPayload.rate,
          totalAmount: fullPayload.totalAmount,
          notes: fullPayload.notes,
        };
        await commitOrQueue(
          'purchases',
          id,
          'update',
          updatePayload,
          {
            id: generateId(),
            action: 'update',
            entityType: 'purchase',
            entityId: id,
            summary: `Updated purchase: ${updatePayload.materialName} (${updatePayload.shopName})`.slice(0, 300),
            beforeData: truncateJson(existingPurchase),
            afterData: truncateJson(updatePayload),
          },
          existingPurchase.updatedAtMs,
          fullPayload
        );
        notify('success', 'Purchase updated.');
      } else {
        await commitOrQueue('purchases', id, 'create', fullPayload, {
          id: generateId(),
          action: 'create',
          entityType: 'purchase',
          entityId: id,
          summary: `Recorded purchase: ${fullPayload.materialName} from ${fullPayload.shopName} (BDT ${totalAmount})`.slice(0, 300),
          beforeData: '{}',
          afterData: truncateJson(fullPayload),
        });
        notify('success', 'Purchase recorded.');
      }
    },
    [user, purchases, commitOrQueue, notify]
  );

  const deletePurchase = useCallback(
    async (purchase: Purchase) => {
      await commitOrQueue('purchases', purchase.id, 'delete', null, {
        id: generateId(),
        action: 'delete',
        entityType: 'purchase',
        entityId: purchase.id,
        summary: `Deleted purchase: ${purchase.materialName} (${purchase.shopName})`.slice(0, 300),
        beforeData: truncateJson(purchase),
        afterData: '{}',
      });
      notify('success', 'Purchase deleted and logged in audit history.');
    },
    [commitOrQueue, notify]
  );

  const savePayment = useCallback(
    async (
      input: Omit<Payment, 'id' | 'uid' | 'createdAtMs' | 'updatedAtMs'>,
      existingPayment?: Payment
    ) => {
      if (!user) throw new Error('Authentication required.');
      if (!existingPayment && payments.some((p) => p.clientRequestId === input.clientRequestId)) {
        throw new Error('Duplicate submission blocked. This payment was already recorded.');
      }
      const id = existingPayment?.id || generateId();
      const clientRequestId = isValidFirestoreId(existingPayment?.clientRequestId)
        ? existingPayment.clientRequestId
        : isValidFirestoreId(input.clientRequestId)
        ? input.clientRequestId
        : id;
      if (!isValidFirestoreId(id) || !isValidFirestoreId(input.shopId)) {
        throw new Error('Invalid payment or shop identifier.');
      }
      if (!isValidIsoDate(input.date)) {
        throw new Error('Invalid payment date. Expected YYYY-MM-DD.');
      }
      const cleanShopName = input.shopName.trim().slice(0, 120);
      if (!cleanShopName) throw new Error('Shop name is required.');
      if (!PAYMENT_METHODS.includes(input.method)) {
        throw new Error('Invalid payment method.');
      }
      const amount = round2(input.amount);
      if (amount <= 0) throw new Error('Payment amount must be greater than zero.');

      const fullPayload = {
        id,
        uid: user.uid,
        date: input.date,
        shopId: input.shopId,
        shopName: cleanShopName,
        amount,
        method: input.method,
        referenceNumber: input.referenceNumber.trim().slice(0, 80),
        notes: input.notes.trim().slice(0, 500),
        clientRequestId,
      };

      if (existingPayment) {
        const updatePayload = {
          date: fullPayload.date,
          shopId: fullPayload.shopId,
          shopName: fullPayload.shopName,
          amount: fullPayload.amount,
          method: fullPayload.method,
          referenceNumber: fullPayload.referenceNumber,
          notes: fullPayload.notes,
        };
        await commitOrQueue(
          'payments',
          id,
          'update',
          updatePayload,
          {
            id: generateId(),
            action: 'update',
            entityType: 'payment',
            entityId: id,
            summary: `Updated payment to ${updatePayload.shopName} (BDT ${amount})`.slice(0, 300),
            beforeData: truncateJson(existingPayment),
            afterData: truncateJson(updatePayload),
          },
          existingPayment.updatedAtMs,
          fullPayload
        );
        notify('success', 'Payment updated.');
      } else {
        await commitOrQueue('payments', id, 'create', fullPayload, {
          id: generateId(),
          action: 'create',
          entityType: 'payment',
          entityId: id,
          summary: `Paid ${fullPayload.shopName} BDT ${amount} via ${fullPayload.method}`.slice(0, 300),
          beforeData: '{}',
          afterData: truncateJson(fullPayload),
        });
        notify('success', 'Payment recorded.');
      }
    },
    [user, payments, commitOrQueue, notify]
  );

  const deletePayment = useCallback(
    async (payment: Payment) => {
      await commitOrQueue('payments', payment.id, 'delete', null, {
        id: generateId(),
        action: 'delete',
        entityType: 'payment',
        entityId: payment.id,
        summary: `Deleted payment to ${payment.shopName} (BDT ${payment.amount})`.slice(0, 300),
        beforeData: truncateJson(payment),
        afterData: '{}',
      });
      notify('success', 'Payment deleted and logged in audit history.');
    },
    [commitOrQueue, notify]
  );

  const saveExpense = useCallback(
    async (
      input: Omit<Expense, 'id' | 'uid' | 'createdAtMs' | 'updatedAtMs'>,
      existingExpense?: Expense
    ) => {
      if (!user) throw new Error('Authentication required.');
      if (!existingExpense && expenses.some((e) => e.clientRequestId === input.clientRequestId)) {
        throw new Error('Duplicate submission blocked. This expense was already recorded.');
      }
      const id = existingExpense?.id || generateId();
      const clientRequestId = isValidFirestoreId(existingExpense?.clientRequestId)
        ? existingExpense.clientRequestId
        : isValidFirestoreId(input.clientRequestId)
        ? input.clientRequestId
        : id;
      if (!isValidFirestoreId(id)) {
        throw new Error('Invalid expense identifier.');
      }
      if (!isValidIsoDate(input.date)) {
        throw new Error('Invalid expense date. Expected YYYY-MM-DD.');
      }
      const cleanDescription = input.description.trim().slice(0, 200);
      if (!cleanDescription) throw new Error('Expense description is required.');
      if (!EXPENSE_CATEGORIES.includes(input.category)) {
        throw new Error('Invalid expense category.');
      }
      if (!PAYMENT_METHODS.includes(input.method)) {
        throw new Error('Invalid payment method.');
      }
      const amount = round2(input.amount);
      if (amount <= 0) throw new Error('Expense amount must be greater than zero.');

      const fullPayload = {
        id,
        uid: user.uid,
        date: input.date,
        category: input.category,
        description: cleanDescription,
        amount,
        method: input.method,
        notes: input.notes.trim().slice(0, 500),
        clientRequestId,
      };

      if (existingExpense) {
        const updatePayload = {
          date: fullPayload.date,
          category: fullPayload.category,
          description: fullPayload.description,
          amount: fullPayload.amount,
          method: fullPayload.method,
          notes: fullPayload.notes,
        };
        await commitOrQueue(
          'expenses',
          id,
          'update',
          updatePayload,
          {
            id: generateId(),
            action: 'update',
            entityType: 'expense',
            entityId: id,
            summary: `Updated expense: ${updatePayload.category} - ${updatePayload.description}`.slice(0, 300),
            beforeData: truncateJson(existingExpense),
            afterData: truncateJson(updatePayload),
          },
          existingExpense.updatedAtMs,
          fullPayload
        );
        notify('success', 'Expense updated.');
      } else {
        await commitOrQueue('expenses', id, 'create', fullPayload, {
          id: generateId(),
          action: 'create',
          entityType: 'expense',
          entityId: id,
          summary: `Recorded expense: ${fullPayload.category} (BDT ${amount})`.slice(0, 300),
          beforeData: '{}',
          afterData: truncateJson(fullPayload),
        });
        notify('success', 'Expense recorded.');
      }
    },
    [user, expenses, commitOrQueue, notify]
  );

  const deleteExpense = useCallback(
    async (expense: Expense) => {
      await commitOrQueue('expenses', expense.id, 'delete', null, {
        id: generateId(),
        action: 'delete',
        entityType: 'expense',
        entityId: expense.id,
        summary: `Deleted expense: ${expense.category} - ${expense.description}`.slice(0, 300),
        beforeData: truncateJson(expense),
        afterData: '{}',
      });
      notify('success', 'Expense deleted and logged in audit history.');
    },
    [commitOrQueue, notify]
  );

  const saveCashTransaction = useCallback(
    async (
      input: Omit<CashTransaction, 'id' | 'uid' | 'createdAtMs' | 'updatedAtMs'>,
      existingTx?: CashTransaction
    ) => {
      if (!user) throw new Error('Authentication required.');
      if (!existingTx && cashTransactions.some((c) => c.clientRequestId === input.clientRequestId)) {
        throw new Error('Duplicate submission blocked. This cash entry was already recorded.');
      }
      const id = existingTx?.id || generateId();
      const clientRequestId = isValidFirestoreId(existingTx?.clientRequestId)
        ? existingTx.clientRequestId
        : isValidFirestoreId(input.clientRequestId)
        ? input.clientRequestId
        : id;
      if (!isValidFirestoreId(id)) {
        throw new Error('Invalid cash transaction identifier.');
      }
      if (!isValidIsoDate(input.date)) {
        throw new Error('Invalid cash transaction date. Expected YYYY-MM-DD.');
      }
      if (input.type !== 'cash_in' && input.type !== 'cash_out' && input.type !== 'transfer') {
        throw new Error('Invalid cash transaction type.');
      }
      if (!LIQUID_ACCOUNTS.includes(input.account)) {
        throw new Error('Invalid liquid account.');
      }
      const cleanDescription = input.description.trim().slice(0, 200);
      if (!cleanDescription) throw new Error('Description is required.');
      const amount = round2(input.amount);
      if (amount <= 0) throw new Error('Amount must be greater than zero.');
      if (
        input.type === 'transfer' &&
        (!LIQUID_ACCOUNTS.includes(input.toAccount as (typeof LIQUID_ACCOUNTS)[number]) ||
          input.toAccount === input.account)
      ) {
        throw new Error('Transfer source and destination accounts must be different.');
      }

      const fullPayload = {
        id,
        uid: user.uid,
        date: input.date,
        type: input.type,
        account: input.account,
        toAccount: input.type === 'transfer' ? input.toAccount : '',
        amount,
        description: cleanDescription,
        referenceNumber: input.referenceNumber.trim().slice(0, 80),
        notes: input.notes.trim().slice(0, 500),
        clientRequestId,
      };

      if (existingTx) {
        const updatePayload = {
          date: fullPayload.date,
          type: fullPayload.type,
          account: fullPayload.account,
          toAccount: fullPayload.toAccount,
          amount: fullPayload.amount,
          description: fullPayload.description,
          referenceNumber: fullPayload.referenceNumber,
          notes: fullPayload.notes,
        };
        await commitOrQueue(
          'cashTransactions',
          id,
          'update',
          updatePayload,
          {
            id: generateId(),
            action: 'update',
            entityType: 'cash',
            entityId: id,
            summary: `Updated cash entry: ${updatePayload.type} (BDT ${amount})`.slice(0, 300),
            beforeData: truncateJson(existingTx),
            afterData: truncateJson(updatePayload),
          },
          existingTx.updatedAtMs,
          fullPayload
        );
        notify('success', 'Cash entry updated.');
      } else {
        await commitOrQueue('cashTransactions', id, 'create', fullPayload, {
          id: generateId(),
          action: 'create',
          entityType: 'cash',
          entityId: id,
          summary: `Recorded ${fullPayload.type}: ${fullPayload.description} (BDT ${amount})`.slice(0, 300),
          beforeData: '{}',
          afterData: truncateJson(fullPayload),
        });
        notify('success', 'Cash transaction recorded.');
      }
    },
    [user, cashTransactions, commitOrQueue, notify]
  );

  const deleteCashTransaction = useCallback(
    async (tx: CashTransaction) => {
      await commitOrQueue('cashTransactions', tx.id, 'delete', null, {
        id: generateId(),
        action: 'delete',
        entityType: 'cash',
        entityId: tx.id,
        summary: `Deleted cash entry: ${tx.description} (BDT ${tx.amount})`.slice(0, 300),
        beforeData: truncateJson(tx),
        afterData: '{}',
      });
      notify('success', 'Cash entry deleted and logged in audit history.');
    },
    [commitOrQueue, notify]
  );

  const restoreBackup = useCallback(
    async (backup: DailyAccountBackup): Promise<{ restoredCount: number }> => {
      if (!user) throw new Error('Authentication required.');
      if (!navigator.onLine) {
        throw new Error('Internet connection is required to restore a backup to Cloud Firestore.');
      }

      // Never delete existing records; safely upsert missing/restored records in chunks of 200
      const ops: Array<{ col: string; id: string; data: Record<string, unknown> }> = [];

      if (backup.siteSettings && !rawSettings?.createdAtMs) {
        ops.push({
          col: 'siteSettings',
          id: user.uid,
          data: {
            uid: user.uid,
            siteName:
              String(backup.siteSettings.siteName || 'Main Construction Site').trim().slice(0, 120) ||
              'Main Construction Site',
            siteLocation: String(backup.siteSettings.siteLocation || '').trim().slice(0, 200),
            openingCash: Math.max(0, round2(Number(backup.siteSettings.openingCash || 0))),
            openingBank: Math.max(0, round2(Number(backup.siteSettings.openingBank || 0))),
            openingMobile: Math.max(0, round2(Number(backup.siteSettings.openingMobile || 0))),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        });
      }

      const knownShopIds = new Set(shops.map((s) => s.id));
      for (const s of backup.shops) {
        if (!isValidFirestoreId(s.id) || knownShopIds.has(s.id)) continue;
        const cleanShopName = String(s.shopName || '').trim().slice(0, 120);
        if (!cleanShopName) continue;
        knownShopIds.add(s.id);
        ops.push({
          col: 'shops',
          id: s.id,
          data: {
            id: s.id,
            uid: user.uid,
            shopName: cleanShopName,
            ownerName: String(s.ownerName || '').trim().slice(0, 100),
            phone: String(s.phone || '').trim().slice(0, 32),
            address: String(s.address || '').trim().slice(0, 240),
            openingBalance: Math.max(0, round2(Number(s.openingBalance || 0))),
            openingBalanceType: s.openingBalanceType === 'receivable' ? 'receivable' : 'payable',
            notes: String(s.notes || '').trim().slice(0, 500),
            isActive: s.isActive !== false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        });
      }

      const existingPurchaseIds = new Set(purchases.map((p) => p.id));
      for (const p of backup.purchases) {
        if (
          !isValidFirestoreId(p.id) ||
          existingPurchaseIds.has(p.id) ||
          !isValidFirestoreId(p.shopId) ||
          !knownShopIds.has(p.shopId) ||
          !isValidIsoDate(p.date)
        ) {
          continue;
        }
        const cleanShopName = String(p.shopName || '').trim().slice(0, 120);
        const cleanMaterialName = String(p.materialName || '').trim().slice(0, 120);
        const cleanUnit = String(p.unit || 'Pcs').trim().slice(0, 32);
        const qty = round2(Number(p.quantity || 0));
        const rate = Math.max(0, round2(Number(p.rate || 0)));
        const totalAmount = Math.max(0, round2(Number(p.totalAmount ?? qty * rate)));
        const reqId = isValidFirestoreId(p.clientRequestId) ? p.clientRequestId : p.id;
        if (!cleanShopName || !cleanMaterialName || !cleanUnit || qty <= 0) continue;

        ops.push({
          col: 'purchases',
          id: p.id,
          data: {
            id: p.id,
            uid: user.uid,
            date: p.date,
            shopId: p.shopId,
            shopName: cleanShopName,
            materialName: cleanMaterialName,
            category: PURCHASE_CATEGORIES.includes(p.category) ? p.category : 'Other',
            quantity: qty,
            unit: cleanUnit,
            rate,
            totalAmount,
            notes: String(p.notes || '').trim().slice(0, 500),
            clientRequestId: reqId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        });
      }

      const existingPaymentIds = new Set(payments.map((p) => p.id));
      for (const p of backup.payments) {
        if (
          !isValidFirestoreId(p.id) ||
          existingPaymentIds.has(p.id) ||
          !isValidFirestoreId(p.shopId) ||
          !knownShopIds.has(p.shopId) ||
          !isValidIsoDate(p.date)
        ) {
          continue;
        }
        const cleanShopName = String(p.shopName || '').trim().slice(0, 120);
        const amount = round2(Number(p.amount || 0));
        const reqId = isValidFirestoreId(p.clientRequestId) ? p.clientRequestId : p.id;
        if (!cleanShopName || amount <= 0) continue;

        ops.push({
          col: 'payments',
          id: p.id,
          data: {
            id: p.id,
            uid: user.uid,
            date: p.date,
            shopId: p.shopId,
            shopName: cleanShopName,
            amount,
            method: PAYMENT_METHODS.includes(p.method) ? p.method : 'Other',
            referenceNumber: String(p.referenceNumber || '').trim().slice(0, 80),
            notes: String(p.notes || '').trim().slice(0, 500),
            clientRequestId: reqId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        });
      }

      const existingExpenseIds = new Set(expenses.map((e) => e.id));
      for (const e of backup.expenses) {
        if (!isValidFirestoreId(e.id) || existingExpenseIds.has(e.id) || !isValidIsoDate(e.date)) {
          continue;
        }
        const cleanDescription = String(e.description || '').trim().slice(0, 200);
        const amount = round2(Number(e.amount || 0));
        const reqId = isValidFirestoreId(e.clientRequestId) ? e.clientRequestId : e.id;
        if (!cleanDescription || amount <= 0) continue;

        ops.push({
          col: 'expenses',
          id: e.id,
          data: {
            id: e.id,
            uid: user.uid,
            date: e.date,
            category: EXPENSE_CATEGORIES.includes(e.category) ? e.category : 'Other',
            description: cleanDescription,
            amount,
            method: PAYMENT_METHODS.includes(e.method) ? e.method : 'Other',
            notes: String(e.notes || '').trim().slice(0, 500),
            clientRequestId: reqId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        });
      }

      const existingCashIds = new Set(cashTransactions.map((c) => c.id));
      for (const c of backup.cashTransactions) {
        if (!isValidFirestoreId(c.id) || existingCashIds.has(c.id) || !isValidIsoDate(c.date)) {
          continue;
        }
        if (c.type !== 'cash_in' && c.type !== 'cash_out' && c.type !== 'transfer') continue;
        if (!LIQUID_ACCOUNTS.includes(c.account)) continue;
        if (
          c.type === 'transfer' &&
          (!LIQUID_ACCOUNTS.includes(c.toAccount as (typeof LIQUID_ACCOUNTS)[number]) ||
            c.toAccount === c.account)
        ) {
          continue;
        }
        const cleanDescription = String(c.description || '').trim().slice(0, 200);
        const amount = round2(Number(c.amount || 0));
        const reqId = isValidFirestoreId(c.clientRequestId) ? c.clientRequestId : c.id;
        if (!cleanDescription || amount <= 0) continue;

        ops.push({
          col: 'cashTransactions',
          id: c.id,
          data: {
            id: c.id,
            uid: user.uid,
            date: c.date,
            type: c.type,
            account: c.account,
            toAccount: c.type === 'transfer' ? c.toAccount : '',
            amount,
            description: cleanDescription,
            referenceNumber: String(c.referenceNumber || '').trim().slice(0, 80),
            notes: String(c.notes || '').trim().slice(0, 500),
            clientRequestId: reqId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        });
      }

      for (let i = 0; i < ops.length; i += 200) {
        const chunk = ops.slice(i, i + 200);
        const batch = writeBatch(db);
        for (const op of chunk) {
          batch.set(doc(db, op.col, op.id), op.data);
        }
        if (i + 200 >= ops.length) {
          const auditId = generateId();
          batch.set(doc(db, 'auditLogs', auditId), {
            id: auditId,
            uid: user.uid,
            action: 'restore',
            entityType: 'backup',
            entityId: 'json-restore',
            summary: `Restored ${ops.length} non-duplicate records from JSON backup`,
            beforeData: '{}',
            afterData: truncateJson({ restoredCount: ops.length }),
            createdAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }

      notify('success', `Backup restored safely (${ops.length} new record${ops.length === 1 ? '' : 's'} added).`);
      return { restoredCount: ops.length };
    },
    [user, rawSettings, shops, purchases, payments, expenses, cashTransactions, notify]
  );

  const value: AccountingContextValue = {
    user,
    authLoading,
    dataLoading,
    isOnline,
    isSyncing,
    pendingMutations,
    firestoreError,
    siteSettings,
    shops,
    purchases,
    payments,
    expenses,
    cashTransactions,
    auditLogs,
    shopSummaries,
    totals,
    toasts,
    dismissToast,
    notify,
    login,
    resetPassword,
    logout,
    syncNow,
    retryConnection,
    saveSiteSettings,
    saveShop,
    deleteShop,
    savePurchase,
    deletePurchase,
    savePayment,
    deletePayment,
    saveExpense,
    deleteExpense,
    saveCashTransaction,
    deleteCashTransaction,
    restoreBackup,
  };

  return <AccountingContext.Provider value={value}>{children}</AccountingContext.Provider>;
};

export function useAccounting(): AccountingContextValue {
  const ctx = useContext(AccountingContext);
  if (!ctx) throw new Error('useAccounting must be used within AccountingProvider');
  return ctx;
}
