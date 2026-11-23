export const PURCHASE_CATEGORIES = [
  'Cement',
  'Rod / Steel',
  'Sand',
  'Stone / Brick Chips',
  'Brick',
  'Electrical',
  'Plumbing',
  'Tiles',
  'Paint',
  'Hardware',
  'Labour',
  'Other',
] as const;

export type PurchaseCategory = (typeof PURCHASE_CATEGORIES)[number];

export const EXPENSE_CATEGORIES = [
  'Labour',
  'Transport',
  'Food',
  'Electricity',
  'Water',
  'Equipment',
  'Maintenance',
  'Office',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const PAYMENT_METHODS = ['Cash', 'Bank', 'Mobile Banking', 'Other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const LIQUID_ACCOUNTS = ['Cash', 'Bank', 'Mobile Banking'] as const;
export type LiquidAccount = (typeof LIQUID_ACCOUNTS)[number];

export const COMMON_UNITS = ['Bag', 'Ton', 'Kg', 'CFT', 'Pcs', 'Sqft', 'Drum', 'Day', 'Lot', 'Ltr', 'Coil'] as const;

export interface SiteSettings {
  uid: string;
  siteName: string;
  siteLocation: string;
  openingCash: number;
  openingBank: number;
  openingMobile: number;
  createdAtMs?: number;
  updatedAtMs?: number;
}

export interface Shop {
  id: string;
  uid: string;
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
  openingBalance: number;
  openingBalanceType: 'payable' | 'receivable';
  notes: string;
  isActive: boolean;
  createdAtMs?: number;
  updatedAtMs?: number;
  pendingSync?: boolean;
}

export interface Purchase {
  id: string;
  uid: string;
  date: string; // YYYY-MM-DD
  shopId: string;
  shopName: string;
  materialName: string;
  category: PurchaseCategory;
  quantity: number;
  unit: string;
  rate: number;
  totalAmount: number;
  notes: string;
  clientRequestId: string;
  createdAtMs?: number;
  updatedAtMs?: number;
  pendingSync?: boolean;
}

export interface Payment {
  id: string;
  uid: string;
  date: string; // YYYY-MM-DD
  shopId: string;
  shopName: string;
  amount: number;
  method: PaymentMethod;
  referenceNumber: string;
  notes: string;
  clientRequestId: string;
  createdAtMs?: number;
  updatedAtMs?: number;
  pendingSync?: boolean;
}

export interface Expense {
  id: string;
  uid: string;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  description: string;
  amount: number;
  method: PaymentMethod;
  notes: string;
  clientRequestId: string;
  createdAtMs?: number;
  updatedAtMs?: number;
  pendingSync?: boolean;
}

export type CashTxType = 'cash_in' | 'cash_out' | 'transfer';

export interface CashTransaction {
  id: string;
  uid: string;
  date: string; // YYYY-MM-DD
  type: CashTxType;
  account: LiquidAccount;
  toAccount: LiquidAccount | '';
  amount: number;
  description: string;
  referenceNumber: string;
  notes: string;
  clientRequestId: string;
  createdAtMs?: number;
  updatedAtMs?: number;
  pendingSync?: boolean;
}

export interface AuditLog {
  id: string;
  uid: string;
  action: 'create' | 'update' | 'delete' | 'restore' | 'settings';
  entityType: 'shop' | 'purchase' | 'payment' | 'expense' | 'cash' | 'settings' | 'backup';
  entityId: string;
  summary: string;
  beforeData: string;
  afterData: string;
  createdAtMs?: number;
}

export interface ShopSummary {
  shop: Shop;
  openingPayable: number;
  openingReceivable: number;
  totalPurchase: number;
  totalPaid: number;
  netBalance: number; // + payable, - advance/receivable
  currentDue: number;
  advanceAmount: number;
  purchaseCount: number;
  paymentCount: number;
}

export interface UnifiedTransaction {
  id: string;
  sourceType: 'purchase' | 'payment' | 'expense' | 'cash_in' | 'cash_out' | 'transfer';
  date: string;
  sortTimestamp: number;
  shopId?: string;
  shopOrParty: string;
  categoryOrMethod: string;
  categoryLabel?: string;
  methodLabel?: string;
  description: string;
  debit: number;  // Outflow / Expense / Payment / Cash Out
  credit: number; // Inflow / Purchase Obligation / Cash In
  runningCashBalance?: number;
  notes: string;
  pendingSync?: boolean;
  rawRecord: Purchase | Payment | Expense | CashTransaction;
}

export type NavSection =
  | 'dashboard'
  | 'shops'
  | 'purchases'
  | 'payments'
  | 'dues'
  | 'expenses'
  | 'cash'
  | 'transactions'
  | 'reports'
  | 'backup';
