import {
  CashTransaction,
  Expense,
  LiquidAccount,
  Payment,
  Purchase,
  Shop,
  ShopSummary,
  SiteSettings,
  UnifiedTransaction,
} from '../types/accounting';
import { getCurrentMonthDhakaISO, getTodayDhakaISO, round2 } from './format';

export interface AccountBalances {
  cashBalance: number;
  bankBalance: number;
  mobileBalance: number;
  totalLiquidBalance: number;
  totalCashIn: number;
  totalCashOut: number;
  otherOutflows: number;
}

export interface DashboardTotals extends AccountBalances {
  totalPurchase: number;
  totalPaid: number;
  totalDue: number;
  totalReceivable: number;
  totalExpenses: number;
  todayPurchase: number;
  todayPaid: number;
  todayExpense: number;
  todayCashIn: number;
  todayCashOut: number;
  monthPurchase: number;
  monthPaid: number;
  monthExpense: number;
  monthCashIn: number;
  monthCashOut: number;
}

export interface ShopLedgerEntry {
  id: string;
  date: string;
  sortTimestamp: number;
  type: 'opening' | 'purchase' | 'payment';
  title: string;
  subtitle: string;
  purchaseDebit: number; // increases payable
  paymentCredit: number; // reduces payable / increases advance
  runningBalance: number; // + payable, - advance
  notes: string;
  pendingSync?: boolean;
}

export interface CashLedgerEntry {
  id: string;
  date: string;
  sortTimestamp: number;
  type: 'opening' | 'cash_in' | 'cash_out' | 'transfer' | 'payment' | 'expense';
  accountLabel: string;
  description: string;
  inflow: number;
  outflow: number;
  runningLiquidBalance: number;
  notes: string;
  pendingSync?: boolean;
}

export function computeShopSummaries(
  shops: Shop[],
  purchases: Purchase[],
  payments: Payment[]
): ShopSummary[] {
  return shops
    .map((shop) => {
      const shopPurchases = purchases.filter((p) => p.shopId === shop.id);
      const shopPayments = payments.filter((p) => p.shopId === shop.id);

      const openingPayable = shop.openingBalanceType === 'payable' ? round2(shop.openingBalance || 0) : 0;
      const openingReceivable = shop.openingBalanceType === 'receivable' ? round2(shop.openingBalance || 0) : 0;

      const purchaseSum = shopPurchases.reduce((acc, p) => acc + (p.totalAmount || 0), 0);
      const paymentSum = shopPayments.reduce((acc, p) => acc + (p.amount || 0), 0);

      const totalPurchase = round2(openingPayable + purchaseSum);
      const totalPaid = round2(openingReceivable + paymentSum);
      const netBalance = round2(totalPurchase - totalPaid);

      return {
        shop,
        openingPayable,
        openingReceivable,
        totalPurchase,
        totalPaid,
        netBalance,
        currentDue: netBalance > 0 ? netBalance : 0,
        advanceAmount: netBalance < 0 ? round2(Math.abs(netBalance)) : 0,
        purchaseCount: shopPurchases.length,
        paymentCount: shopPayments.length,
      };
    })
    .sort((a, b) => a.shop.shopName.localeCompare(b.shop.shopName));
}

export function computeAccountBalances(
  settings: SiteSettings | null,
  payments: Payment[],
  expenses: Expense[],
  cashTransactions: CashTransaction[]
): AccountBalances {
  const balances: Record<LiquidAccount, number> = {
    Cash: round2(settings?.openingCash || 0),
    Bank: round2(settings?.openingBank || 0),
    'Mobile Banking': round2(settings?.openingMobile || 0),
  };

  let totalCashIn = round2(
    (settings?.openingCash || 0) + (settings?.openingBank || 0) + (settings?.openingMobile || 0)
  );
  let totalCashOut = 0;
  let otherOutflows = 0;

  for (const tx of cashTransactions) {
    const amt = round2(tx.amount || 0);
    if (tx.type === 'cash_in') {
      balances[tx.account] = round2(balances[tx.account] + amt);
      totalCashIn = round2(totalCashIn + amt);
    } else if (tx.type === 'cash_out') {
      balances[tx.account] = round2(balances[tx.account] - amt);
      totalCashOut = round2(totalCashOut + amt);
    } else if (tx.type === 'transfer' && tx.toAccount) {
      balances[tx.account] = round2(balances[tx.account] - amt);
      balances[tx.toAccount] = round2(balances[tx.toAccount] + amt);
    }
  }

  for (const pay of payments) {
    const amt = round2(pay.amount || 0);
    if (pay.method === 'Cash' || pay.method === 'Bank' || pay.method === 'Mobile Banking') {
      balances[pay.method] = round2(balances[pay.method] - amt);
      totalCashOut = round2(totalCashOut + amt);
    } else {
      otherOutflows = round2(otherOutflows + amt);
    }
  }

  for (const exp of expenses) {
    const amt = round2(exp.amount || 0);
    if (exp.method === 'Cash' || exp.method === 'Bank' || exp.method === 'Mobile Banking') {
      balances[exp.method] = round2(balances[exp.method] - amt);
      totalCashOut = round2(totalCashOut + amt);
    } else {
      otherOutflows = round2(otherOutflows + amt);
    }
  }

  const totalLiquidBalance = round2(balances.Cash + balances.Bank + balances['Mobile Banking']);

  return {
    cashBalance: balances.Cash,
    bankBalance: balances.Bank,
    mobileBalance: balances['Mobile Banking'],
    totalLiquidBalance,
    totalCashIn,
    totalCashOut,
    otherOutflows,
  };
}

export function computeDashboardTotals(
  settings: SiteSettings | null,
  shops: Shop[],
  purchases: Purchase[],
  payments: Payment[],
  expenses: Expense[],
  cashTransactions: CashTransaction[]
): DashboardTotals {
  const shopSummaries = computeShopSummaries(shops, purchases, payments);
  const accountBalances = computeAccountBalances(settings, payments, expenses, cashTransactions);

  const totalPurchase = round2(purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0));
  const totalPaid = round2(payments.reduce((sum, p) => sum + (p.amount || 0), 0));
  const totalDue = round2(shopSummaries.reduce((sum, s) => sum + s.currentDue, 0));
  const totalReceivable = round2(shopSummaries.reduce((sum, s) => sum + s.advanceAmount, 0));
  const totalExpenses = round2(expenses.reduce((sum, e) => sum + (e.amount || 0), 0));

  const today = getTodayDhakaISO();
  const currentMonth = getCurrentMonthDhakaISO();

  const todayPurchase = round2(
    purchases.filter((p) => p.date === today).reduce((s, p) => s + p.totalAmount, 0)
  );
  const todayPaid = round2(
    payments.filter((p) => p.date === today).reduce((s, p) => s + p.amount, 0)
  );
  const todayExpense = round2(
    expenses.filter((e) => e.date === today).reduce((s, e) => s + e.amount, 0)
  );
  const todayCashIn = round2(
    cashTransactions
      .filter((c) => c.date === today && c.type === 'cash_in')
      .reduce((s, c) => s + c.amount, 0)
  );
  const todayCashOut = round2(
    cashTransactions
      .filter((c) => c.date === today && c.type === 'cash_out')
      .reduce((s, c) => s + c.amount, 0) +
      payments
        .filter((p) => p.date === today && p.method !== 'Other')
        .reduce((s, p) => s + p.amount, 0) +
      expenses
        .filter((e) => e.date === today && e.method !== 'Other')
        .reduce((s, e) => s + e.amount, 0)
  );

  const monthPurchase = round2(
    purchases.filter((p) => p.date.startsWith(currentMonth)).reduce((s, p) => s + p.totalAmount, 0)
  );
  const monthPaid = round2(
    payments.filter((p) => p.date.startsWith(currentMonth)).reduce((s, p) => s + p.amount, 0)
  );
  const monthExpense = round2(
    expenses.filter((e) => e.date.startsWith(currentMonth)).reduce((s, e) => s + e.amount, 0)
  );
  const monthCashIn = round2(
    cashTransactions
      .filter((c) => c.date.startsWith(currentMonth) && c.type === 'cash_in')
      .reduce((s, c) => s + c.amount, 0)
  );
  const monthCashOut = round2(
    cashTransactions
      .filter((c) => c.date.startsWith(currentMonth) && c.type === 'cash_out')
      .reduce((s, c) => s + c.amount, 0) +
      payments
        .filter((p) => p.date.startsWith(currentMonth) && p.method !== 'Other')
        .reduce((s, p) => s + p.amount, 0) +
      expenses
        .filter((e) => e.date.startsWith(currentMonth) && e.method !== 'Other')
        .reduce((s, e) => s + e.amount, 0)
  );

  return {
    ...accountBalances,
    totalPurchase,
    totalPaid,
    totalDue,
    totalReceivable,
    totalExpenses,
    todayPurchase,
    todayPaid,
    todayExpense,
    todayCashIn,
    todayCashOut,
    monthPurchase,
    monthPaid,
    monthExpense,
    monthCashIn,
    monthCashOut,
  };
}

function getTxSortTime(date: string, createdAtMs?: number): number {
  const dateMs = Date.parse(`${date}T00:00:00Z`) || 0;
  return dateMs + ((createdAtMs || 0) % 86400000);
}

export function buildShopLedger(
  shop: Shop,
  purchases: Purchase[],
  payments: Payment[]
): ShopLedgerEntry[] {
  const raw: Omit<ShopLedgerEntry, 'runningBalance'>[] = [];

  if ((shop.openingBalance || 0) > 0) {
    raw.push({
      id: `opening-${shop.id}`,
      date: '',
      sortTimestamp: 0,
      type: 'opening',
      title: 'Opening Balance',
      subtitle: shop.openingBalanceType === 'payable' ? 'Brought Forward Payable' : 'Brought Forward Advance',
      purchaseDebit: shop.openingBalanceType === 'payable' ? round2(shop.openingBalance) : 0,
      paymentCredit: shop.openingBalanceType === 'receivable' ? round2(shop.openingBalance) : 0,
      notes: shop.notes || '',
    });
  }

  for (const p of purchases.filter((x) => x.shopId === shop.id)) {
    raw.push({
      id: p.id,
      date: p.date,
      sortTimestamp: getTxSortTime(p.date, p.createdAtMs),
      type: 'purchase',
      title: p.materialName,
      subtitle: `${p.category} · ${p.quantity} ${p.unit} × ${p.rate}`,
      purchaseDebit: round2(p.totalAmount),
      paymentCredit: 0,
      notes: p.notes,
      pendingSync: p.pendingSync,
    });
  }

  for (const pay of payments.filter((x) => x.shopId === shop.id)) {
    raw.push({
      id: pay.id,
      date: pay.date,
      sortTimestamp: getTxSortTime(pay.date, pay.createdAtMs),
      type: 'payment',
      title: `Payment (${pay.method})`,
      subtitle: pay.referenceNumber ? `Ref: ${pay.referenceNumber}` : 'Supplier payment',
      purchaseDebit: 0,
      paymentCredit: round2(pay.amount),
      notes: pay.notes,
      pendingSync: pay.pendingSync,
    });
  }

  // Chronological oldest -> newest for accurate running balance
  raw.sort((a, b) => {
    if (a.type === 'opening') return -1;
    if (b.type === 'opening') return 1;
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.sortTimestamp - b.sortTimestamp;
  });

  let running = 0;
  const computed: ShopLedgerEntry[] = raw.map((item) => {
    running = round2(running + item.purchaseDebit - item.paymentCredit);
    return {
      ...item,
      runningBalance: running,
    };
  });

  // Newest at TOP
  return computed.reverse();
}

export function buildDailyCashLedger(
  settings: SiteSettings | null,
  payments: Payment[],
  expenses: Expense[],
  cashTransactions: CashTransaction[]
): CashLedgerEntry[] {
  const raw: Omit<CashLedgerEntry, 'runningLiquidBalance'>[] = [];
  const openingTotal = round2(
    (settings?.openingCash || 0) + (settings?.openingBank || 0) + (settings?.openingMobile || 0)
  );

  if (openingTotal > 0) {
    raw.push({
      id: 'opening-liquid',
      date: '',
      sortTimestamp: 0,
      type: 'opening',
      accountLabel: 'All Liquid Accounts',
      description: 'Opening Balance (Cash + Bank + Mobile)',
      inflow: openingTotal,
      outflow: 0,
      notes: settings?.siteName || '',
    });
  }

  for (const tx of cashTransactions) {
    raw.push({
      id: tx.id,
      date: tx.date,
      sortTimestamp: getTxSortTime(tx.date, tx.createdAtMs),
      type: tx.type,
      accountLabel: tx.type === 'transfer' ? `${tx.account} → ${tx.toAccount}` : tx.account,
      description: tx.description,
      inflow: tx.type === 'cash_in' ? round2(tx.amount) : 0,
      outflow: tx.type === 'cash_out' ? round2(tx.amount) : 0,
      notes: tx.referenceNumber ? `Ref: ${tx.referenceNumber}${tx.notes ? ` · ${tx.notes}` : ''}` : tx.notes,
      pendingSync: tx.pendingSync,
    });
  }

  for (const pay of payments) {
    if (pay.method === 'Other') continue;
    raw.push({
      id: `pay-${pay.id}`,
      date: pay.date,
      sortTimestamp: getTxSortTime(pay.date, pay.createdAtMs),
      type: 'payment',
      accountLabel: pay.method,
      description: `Supplier Payment: ${pay.shopName}`,
      inflow: 0,
      outflow: round2(pay.amount),
      notes: pay.referenceNumber ? `Ref: ${pay.referenceNumber}` : pay.notes,
      pendingSync: pay.pendingSync,
    });
  }

  for (const exp of expenses) {
    if (exp.method === 'Other') continue;
    raw.push({
      id: `exp-${exp.id}`,
      date: exp.date,
      sortTimestamp: getTxSortTime(exp.date, exp.createdAtMs),
      type: 'expense',
      accountLabel: exp.method,
      description: `${exp.category}: ${exp.description}`,
      inflow: 0,
      outflow: round2(exp.amount),
      notes: exp.notes,
      pendingSync: exp.pendingSync,
    });
  }

  raw.sort((a, b) => {
    if (a.type === 'opening') return -1;
    if (b.type === 'opening') return 1;
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.sortTimestamp - b.sortTimestamp;
  });

  let running = 0;
  const computed: CashLedgerEntry[] = raw.map((item) => {
    running = round2(running + item.inflow - item.outflow);
    return {
      ...item,
      runningLiquidBalance: running,
    };
  });

  return computed.reverse();
}

export function buildCompleteTransactions(
  settings: SiteSettings | null,
  purchases: Purchase[],
  payments: Payment[],
  expenses: Expense[],
  cashTransactions: CashTransaction[]
): UnifiedTransaction[] {
  const list: UnifiedTransaction[] = [];

  for (const p of purchases) {
    list.push({
      id: p.id,
      sourceType: 'purchase',
      date: p.date,
      sortTimestamp: p.createdAtMs || Date.parse(`${p.date}T12:00:00Z`) || 0,
      shopId: p.shopId,
      shopOrParty: p.shopName,
      categoryOrMethod: p.category,
      categoryLabel: p.category,
      methodLabel: 'Supplier Account',
      description: `${p.materialName} (${p.quantity} ${p.unit} × ${p.rate})`,
      debit: 0,
      credit: round2(p.totalAmount),
      notes: p.notes,
      pendingSync: p.pendingSync,
      rawRecord: p,
    });
  }

  for (const pay of payments) {
    list.push({
      id: pay.id,
      sourceType: 'payment',
      date: pay.date,
      sortTimestamp: pay.createdAtMs || Date.parse(`${pay.date}T12:00:00Z`) || 0,
      shopId: pay.shopId,
      shopOrParty: pay.shopName,
      categoryOrMethod: pay.method,
      categoryLabel: 'Supplier Payment',
      methodLabel: pay.method,
      description: pay.referenceNumber
        ? `Payment to ${pay.shopName} · Ref ${pay.referenceNumber}`
        : `Payment to ${pay.shopName}`,
      debit: round2(pay.amount),
      credit: 0,
      notes: pay.notes,
      pendingSync: pay.pendingSync,
      rawRecord: pay,
    });
  }

  for (const exp of expenses) {
    list.push({
      id: exp.id,
      sourceType: 'expense',
      date: exp.date,
      sortTimestamp: exp.createdAtMs || Date.parse(`${exp.date}T12:00:00Z`) || 0,
      shopOrParty: exp.category,
      categoryOrMethod: exp.method,
      categoryLabel: exp.category,
      methodLabel: exp.method,
      description: exp.description,
      debit: round2(exp.amount),
      credit: 0,
      notes: exp.notes,
      pendingSync: exp.pendingSync,
      rawRecord: exp,
    });
  }

  for (const tx of cashTransactions) {
    list.push({
      id: tx.id,
      sourceType: tx.type,
      date: tx.date,
      sortTimestamp: tx.createdAtMs || Date.parse(`${tx.date}T12:00:00Z`) || 0,
      shopOrParty: tx.type === 'transfer' ? `${tx.account} → ${tx.toAccount}` : tx.account,
      categoryOrMethod: tx.type === 'cash_in' ? 'Cash In' : tx.type === 'cash_out' ? 'Cash Out' : 'Transfer',
      categoryLabel: tx.type === 'cash_in' ? 'Cash In' : tx.type === 'cash_out' ? 'Cash Out' : 'Transfer',
      methodLabel: tx.type === 'transfer' ? `${tx.account} → ${tx.toAccount}` : tx.account,
      description: tx.description,
      debit: tx.type === 'cash_out' ? round2(tx.amount) : 0,
      credit: tx.type === 'cash_in' ? round2(tx.amount) : 0,
      notes: tx.notes,
      pendingSync: tx.pendingSync,
      rawRecord: tx,
    });
  }

  // Chronological oldest -> newest for running liquid balance calculation
  list.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.sortTimestamp - b.sortTimestamp;
  });

  let runningLiquid = round2(
    (settings?.openingCash || 0) + (settings?.openingBank || 0) + (settings?.openingMobile || 0)
  );

  for (const item of list) {
    if (item.sourceType === 'cash_in') {
      runningLiquid = round2(runningLiquid + item.credit);
    } else if (item.sourceType === 'cash_out') {
      runningLiquid = round2(runningLiquid - item.debit);
    } else if (item.sourceType === 'payment' || item.sourceType === 'expense') {
      if (item.categoryOrMethod !== 'Other') {
        runningLiquid = round2(runningLiquid - item.debit);
      }
    }
    item.runningCashBalance = runningLiquid;
  }

  // Newest transaction at TOP
  return list.reverse();
}

export interface MonthlyFinancialPoint {
  monthKey: string; // YYYY-MM
  label: string;    // e.g. Nov 26
  purchase: number;
  payment: number;
  expense: number;
  cashIn: number;
  cashOut: number;
  netCashFlow: number;
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function buildMonthlyFinancialSeries(
  purchases: Purchase[],
  payments: Payment[],
  expenses: Expense[],
  cashTransactions: CashTransaction[],
  monthsCount = 6
): MonthlyFinancialPoint[] {
  const currentMonthISO = getCurrentMonthDhakaISO();
  const [curYStr, curMStr] = currentMonthISO.split('-');
  const curY = Number(curYStr) || 2026;
  const curM = Number(curMStr) || 1;

  const points: MonthlyFinancialPoint[] = [];

  for (let offset = monthsCount - 1; offset >= 0; offset--) {
    const d = new Date(Date.UTC(curY, curM - 1 - offset, 1));
    const y = d.getUTCFullYear();
    const mIdx = d.getUTCMonth();
    const monthKey = `${y}-${String(mIdx + 1).padStart(2, '0')}`;
    const label = `${SHORT_MONTHS[mIdx]} ${String(y).slice(-2)}`;

    const purchase = round2(
      purchases
        .filter((p) => p.date.startsWith(monthKey))
        .reduce((sum, p) => sum + (p.totalAmount || 0), 0)
    );

    const payment = round2(
      payments
        .filter((p) => p.date.startsWith(monthKey))
        .reduce((sum, p) => sum + (p.amount || 0), 0)
    );

    const expense = round2(
      expenses
        .filter((e) => e.date.startsWith(monthKey))
        .reduce((sum, e) => sum + (e.amount || 0), 0)
    );

    // Cash Inflow excludes internal transfers to prevent double counting
    const cashIn = round2(
      cashTransactions
        .filter((c) => c.date.startsWith(monthKey) && c.type === 'cash_in')
        .reduce((sum, c) => sum + (c.amount || 0), 0)
    );

    // Cash Outflow includes cash_out + liquid supplier payments + liquid site expenses
    const cashOut = round2(
      cashTransactions
        .filter((c) => c.date.startsWith(monthKey) && c.type === 'cash_out')
        .reduce((sum, c) => sum + (c.amount || 0), 0) +
        payments
          .filter((p) => p.date.startsWith(monthKey) && p.method !== 'Other')
          .reduce((sum, p) => sum + (p.amount || 0), 0) +
        expenses
          .filter((e) => e.date.startsWith(monthKey) && e.method !== 'Other')
          .reduce((sum, e) => sum + (e.amount || 0), 0)
    );

    points.push({
      monthKey,
      label,
      purchase,
      payment,
      expense,
      cashIn,
      cashOut,
      netCashFlow: round2(cashIn - cashOut),
    });
  }

  return points;
}
