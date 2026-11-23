import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CreditCard,
  Landmark,
  Plus,
  Search,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext';
import { buildCompleteTransactions } from '../../lib/calculations';
import { formatBDT, formatDateDDMMYYYY, getTodayDhakaISO } from '../../lib/format';
import { NavSection } from '../../types/accounting';
import { AccordionItem } from '../ui/Accordion';
import { PurchaseForm } from '../forms/PurchaseForm';
import { PaymentForm } from '../forms/PaymentForm';
import { ExpenseForm } from '../forms/ExpenseForm';
import { CashTxForm } from '../forms/CashTxForm';
import { DashboardCharts } from './DashboardCharts';

interface DashboardViewProps {
  onNavigate: (section: NavSection) => void;
}

type QuickActionMode = 'purchase' | 'payment' | 'expense' | 'cash';

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const {
    siteSettings,
    purchases,
    payments,
    expenses,
    cashTransactions,
    totals,
  } = useAccounting();

  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const [quickMode, setQuickMode] = useState<QuickActionMode>('purchase');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [viewScope, setViewScope] = useState<'all' | 'today'>('all');

  const todayISO = getTodayDhakaISO();

  const openQuickAction = (mode: QuickActionMode) => {
    setQuickMode(mode);
    setQuickEntryOpen(true);
  };

  const allTransactions = useMemo(
    () =>
      buildCompleteTransactions(
        siteSettings,
        purchases,
        payments,
        expenses,
        cashTransactions
      ),
    [siteSettings, purchases, payments, expenses, cashTransactions]
  );

  const filteredTransactions = useMemo(() => {
    return allTransactions
      .filter((tx) => {
        if (viewScope === 'today' && tx.date !== todayISO) return false;
        if (dateFilter && tx.date !== dateFilter) return false;
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          return (
            tx.shopOrParty.toLowerCase().includes(q) ||
            tx.description.toLowerCase().includes(q) ||
            (tx.categoryLabel || tx.categoryOrMethod).toLowerCase().includes(q) ||
            (tx.methodLabel || '').toLowerCase().includes(q)
          );
        }
        return true;
      })
      .slice(0, 20);
  }, [allTransactions, viewScope, todayISO, dateFilter, searchTerm]);

  const todayCount = useMemo(
    () => allTransactions.filter((tx) => tx.date === todayISO).length,
    [allTransactions, todayISO]
  );

  const summaryCards = [
    {
      label: 'Total Purchase',
      value: formatBDT(totals.totalPurchase),
      sub: `Today ${formatBDT(totals.todayPurchase)}`,
      accent: 'text-[#0B1F3A]',
      onClick: () => onNavigate('purchases'),
    },
    {
      label: 'Total Paid',
      value: formatBDT(totals.totalPaid),
      sub: `Today ${formatBDT(totals.todayPaid)}`,
      accent: 'text-[#0F766E]',
      onClick: () => onNavigate('payments'),
    },
    {
      label: 'Total Due / Payable',
      value: formatBDT(totals.totalDue),
      sub: 'Supplier payable balance',
      accent: totals.totalDue > 0 ? 'text-[#801828]' : 'text-[#0F172A]',
      onClick: () => onNavigate('dues'),
    },
    {
      label: 'Total Receivable',
      value: formatBDT(totals.totalReceivable),
      sub: 'Supplier advance balance',
      accent: totals.totalReceivable > 0 ? 'text-[#0F294A]' : 'text-[#0F172A]',
      onClick: () => onNavigate('dues'),
    },
    {
      label: 'Total Expenses',
      value: formatBDT(totals.totalExpenses),
      sub: `Today ${formatBDT(totals.todayExpense)}`,
      accent: 'text-[#0F172A]',
      onClick: () => onNavigate('expenses'),
    },
    {
      label: 'Available Cash Balance',
      value: formatBDT(totals.cashBalance),
      sub: `All liquid funds ${formatBDT(totals.totalLiquidBalance)}`,
      accent: totals.cashBalance < 0 ? 'text-[#801828]' : 'text-[#0B1F3A]',
      onClick: () => onNavigate('cash'),
    },
  ];

  const liquidAccountCards = [
    {
      label: 'Cash Balance',
      subtitle: 'Site cash in hand',
      value: formatBDT(totals.cashBalance),
      negative: totals.cashBalance < 0,
      icon: Wallet,
    },
    {
      label: 'Bank Balance',
      subtitle: 'Bank account balance',
      value: formatBDT(totals.bankBalance),
      negative: totals.bankBalance < 0,
      icon: Landmark,
    },
    {
      label: 'MFS Balance',
      subtitle: 'bKash / Nagad / Rocket',
      value: formatBDT(totals.mobileBalance),
      negative: totals.mobileBalance < 0,
      icon: Smartphone,
    },
  ];

  const getTxDisplayAmount = (tx: (typeof allTransactions)[number]) => {
    if (tx.sourceType === 'transfer') {
      const raw = tx.rawRecord as { amount?: number };
      return {
        text: formatBDT(raw.amount || 0),
        className: 'text-[#0F294A]',
      };
    }
    if (tx.sourceType === 'purchase') {
      return {
        text: formatBDT(tx.credit),
        className: 'text-[#0B1F3A]',
      };
    }
    if (tx.sourceType === 'cash_in') {
      return {
        text: `+${formatBDT(tx.credit)}`,
        className: 'text-[#0F766E]',
      };
    }
    return {
      text: `-${formatBDT(tx.debit)}`,
      className: 'text-[#801828]',
    };
  };

  return (
    <div className="space-y-6">
      {/* Site Overview & 4 Quick Accounting Entry Buttons */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 tabular-nums">
            <Building2 className="w-3.5 h-3.5 text-[#801828] shrink-0" />
            <span>Single Construction Site</span>
            <span aria-hidden="true">·</span>
            <span>{formatDateDDMMYYYY(todayISO)}</span>
          </div>
          <h2 className="mt-1 text-[18px] sm:text-[20px] font-semibold tracking-[-0.015em] text-[#0B1F3A] truncate">
            {siteSettings?.siteName || 'Main Construction Site'}
          </h2>
          {siteSettings?.siteLocation && (
            <div className="text-xs text-slate-500 mt-0.5 truncate">{siteSettings.siteLocation}</div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => openQuickAction('purchase')}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1F3A] hover:bg-[#13325C] text-white text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Purchase</span>
          </button>
          <button
            type="button"
            onClick={() => openQuickAction('payment')}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#801828] hover:bg-[#661220] text-white text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>Supplier Payment</span>
          </button>
          <button
            type="button"
            onClick={() => openQuickAction('expense')}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[#0B1F3A] text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <ArrowDownLeft className="w-4 h-4 shrink-0" />
            <span>Site Expense</span>
          </button>
          <button
            type="button"
            onClick={() => openQuickAction('cash')}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[#0B1F3A] text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <ArrowUpRight className="w-4 h-4 shrink-0" />
            <span>Cash In / Out</span>
          </button>
        </div>
      </section>

      {/* Expandable Quick Accounting Entry Form */}
      <AccordionItem
        id="quick-entry"
        title="Quick Accounting Entry"
        subtitle="Record material purchase, supplier payment, site expense, or cash movement"
        rightSummary={
          quickMode === 'purchase'
            ? 'Purchase'
            : quickMode === 'payment'
            ? 'Supplier Payment'
            : quickMode === 'expense'
            ? 'Site Expense'
            : 'Cash In / Out'
        }
        isOpen={quickEntryOpen}
        onToggle={() => setQuickEntryOpen((prev) => !prev)}
      >
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl mb-5 w-full sm:w-fit">
          {(
            [
              ['purchase', 'Purchase'],
              ['payment', 'Supplier Payment'],
              ['expense', 'Site Expense'],
              ['cash', 'Cash In / Out'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setQuickMode(key)}
              className={`flex-1 sm:flex-initial min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                quickMode === key
                  ? 'bg-white text-[#0B1F3A] shadow-2xs'
                  : 'text-slate-600 hover:text-[#0B1F3A]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {quickMode === 'purchase' && <PurchaseForm onNavigateToShops={() => onNavigate('shops')} />}
        {quickMode === 'payment' && <PaymentForm onNavigateToShops={() => onNavigate('shops')} />}
        {quickMode === 'expense' && <ExpenseForm />}
        {quickMode === 'cash' && <CashTxForm />}
      </AccordionItem>

      {/* 6 Financial Summary Cards */}
      <section aria-label="Financial Summary">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
          {summaryCards.map((card) => (
            <button
              key={card.label}
              type="button"
              onClick={card.onClick}
              className="text-left bg-white border border-slate-200 hover:border-[#0B1F3A]/40 rounded-xl p-4 sm:p-5 shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F294A]"
            >
              <div className="text-xs font-medium text-slate-500 truncate">{card.label}</div>
              <div
                className={`mt-1.5 text-[20px] sm:text-[22px] font-semibold tracking-[-0.02em] leading-snug tabular-nums truncate ${card.accent}`}
              >
                {card.value}
              </div>
              <div className="mt-1.5 text-xs text-slate-500 tabular-nums truncate">{card.sub}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Cash & Bank — Separate Cash, Bank & MFS Balances */}
      <section aria-label="Cash and Bank Accounts" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-[#0B1F3A]">Cash &amp; Bank</h3>
            <p className="text-xs text-slate-500 tabular-nums">
              Total Liquid Balance: {formatBDT(totals.totalLiquidBalance)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('cash')}
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-[#0B1F3A] whitespace-nowrap transition-colors"
          >
            Manage Cash &amp; Bank
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
          {liquidAccountCards.map((acct) => {
            const Icon = acct.icon;
            return (
              <button
                key={acct.label}
                type="button"
                onClick={() => onNavigate('cash')}
                className="text-left bg-white border border-slate-200 hover:border-[#0B1F3A]/40 rounded-xl p-4 sm:p-5 shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F294A]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-500">{acct.label}</span>
                  <Icon className="w-4 h-4 text-[#0B1F3A] shrink-0" />
                </div>
                <div
                  className={`mt-1.5 text-[19px] sm:text-[21px] font-semibold tracking-[-0.02em] tabular-nums truncate ${
                    acct.negative ? 'text-[#801828]' : 'text-[#0B1F3A]'
                  }`}
                >
                  {acct.value}
                </div>
                <div className="mt-1 text-xs text-slate-500 truncate">{acct.subtitle}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Financial Charts: Monthly Purchase, Payment, Expenses & Cash Flow */}
      <DashboardCharts
        purchases={purchases}
        payments={payments}
        expenses={expenses}
        cashTransactions={cashTransactions}
      />

      {/* Recent Transactions (Newest First) */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-[#0B1F3A]">
              Recent Transactions
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              Newest entries first · {todayCount} today · {allTransactions.length} total records
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('transactions')}
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#E6C7CD] bg-[#FDF2F4] hover:bg-[#FCE7EB] text-xs font-medium text-[#801828] whitespace-nowrap transition-colors"
          >
            Open Full Transaction Ledger
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setViewScope('all')}
              className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${
                viewScope === 'all' ? 'bg-white text-[#0B1F3A] shadow-2xs' : 'text-slate-600'
              }`}
            >
              Recent All
            </button>
            <button
              type="button"
              onClick={() => setViewScope('today')}
              className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${
                viewScope === 'today' ? 'bg-white text-[#0B1F3A] shadow-2xs' : 'text-slate-600'
              }`}
            >
              Today Only ({todayCount})
            </button>
          </div>

          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search description, category, shop, or method..."
              className="w-full min-h-[42px] pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Filter recent transactions by date"
              className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-[#0F172A] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm font-medium text-[#0F172A]">No transactions recorded yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Use the Quick Accounting Entry buttons above to log your first purchase, supplier
              payment, site expense, or cash entry.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Compact Cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredTransactions.map((tx) => {
                const amt = getTxDisplayAmount(tx);
                return (
                  <div key={`${tx.sourceType}-${tx.id}`} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#0F172A] truncate">
                          {tx.description}
                        </div>
                        <div className="text-xs text-slate-600 truncate mt-0.5">
                          {tx.shopOrParty}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-1.5 tabular-nums">
                          <span>{formatDateDDMMYYYY(tx.date)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{tx.categoryLabel || tx.categoryOrMethod}</span>
                          <span aria-hidden="true">·</span>
                          <span>{tx.methodLabel || tx.categoryOrMethod}</span>
                          {tx.pendingSync && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-amber-700 font-medium">Pending sync</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className={`text-sm font-semibold tabular-nums shrink-0 ${amt.className}`}>
                        {amt.text}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table: Date, Description, Category, Amount, Payment method */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                    <th className="py-2.5 pr-3">Date</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 pl-3">Payment method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredTransactions.map((tx) => {
                    const amt = getTxDisplayAmount(tx);
                    return (
                      <tr key={`${tx.sourceType}-${tx.id}`} className="hover:bg-slate-50/70">
                        <td className="py-3 pr-3 tabular-nums text-xs text-slate-600 whitespace-nowrap">
                          {formatDateDDMMYYYY(tx.date)}
                        </td>
                        <td className="py-3 px-3 min-w-[200px] max-w-[320px]">
                          <div className="font-medium text-[#0F172A] truncate">
                            {tx.description}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {tx.shopOrParty}
                            {tx.pendingSync && (
                              <span className="ml-1.5 text-amber-700 font-medium">
                                · Pending sync
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs font-medium text-slate-700 whitespace-nowrap">
                          {tx.categoryLabel || tx.categoryOrMethod}
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-semibold tabular-nums whitespace-nowrap ${amt.className}`}
                        >
                          {amt.text}
                        </td>
                        <td className="py-3 pl-3 text-xs text-slate-600 whitespace-nowrap">
                          {tx.methodLabel || tx.categoryOrMethod}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
};
