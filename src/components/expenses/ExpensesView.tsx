import React, { useMemo, useState } from 'react';
import { Edit2, Plus, Search, Trash2 } from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext';
import {
  formatBDT,
  formatDateDDMMYYYY,
  getCurrentMonthDhakaISO,
  getTodayDhakaISO,
  round2,
} from '../../lib/format';
import { EXPENSE_CATEGORIES, Expense } from '../../types/accounting';
import { AccordionItem } from '../ui/Accordion';
import { ConfirmModal } from '../ui/ConfirmModal';
import { ExpenseForm } from '../forms/ExpenseForm';

export const ExpensesView: React.FC = () => {
  const { expenses, deleteExpense, notify } = useAccounting();

  const [openAccordion, setOpenAccordion] = useState<string | null>('expense-list');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const toggleAccordion = (id: string) => {
    setOpenAccordion((prev) => (prev === id ? null : id));
  };

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (categoryFilter && e.category !== categoryFilter) return false;
      if (dateFilter && e.date !== dateFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          e.description.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.notes.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [expenses, categoryFilter, dateFilter, searchTerm]);

  const filteredTotal = useMemo(
    () => round2(filtered.reduce((sum, e) => sum + e.amount, 0)),
    [filtered]
  );

  const todayISO = getTodayDhakaISO();
  const monthISO = getCurrentMonthDhakaISO();

  const categoryBreakdown = useMemo(() => {
    return EXPENSE_CATEGORIES.map((cat) => {
      const todayAmt = round2(
        expenses
          .filter((e) => e.category === cat && e.date === todayISO)
          .reduce((s, e) => s + e.amount, 0)
      );
      const monthAmt = round2(
        expenses
          .filter((e) => e.category === cat && e.date.startsWith(monthISO))
          .reduce((s, e) => s + e.amount, 0)
      );
      const allAmt = round2(
        expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0)
      );
      return { category: cat, todayAmt, monthAmt, allAmt };
    });
  }, [expenses, todayISO, monthISO]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteExpense(deleteTarget);
      setDeleteTarget(null);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to delete expense.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.015em] text-[#0B1F3A]">Expense Management</h2>
          <p className="text-xs text-slate-500">
            Track daily site operational expenses separately from supplier purchases (no double-counting).
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingExpense(null);
            setOpenAccordion('new-expense');
          }}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1F3A] hover:bg-[#163864] text-white text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Expense</span>
        </button>
      </div>

      <div className="space-y-3">
        <AccordionItem
          id="new-expense"
          title={editingExpense ? `Edit Expense: ${editingExpense.description}` : 'Record Site Expense'}
          subtitle="Automatically deducts from Cash, Bank, or Mobile Banking balance"
          isOpen={openAccordion === 'new-expense'}
          onToggle={toggleAccordion}
        >
          <ExpenseForm
            key={editingExpense?.id || 'new'}
            existingExpense={editingExpense || undefined}
            onSuccess={() => {
              setEditingExpense(null);
              setOpenAccordion('expense-list');
            }}
            onCancel={
              editingExpense
                ? () => {
                    setEditingExpense(null);
                    setOpenAccordion('expense-list');
                  }
                : undefined
            }
          />
        </AccordionItem>

        <AccordionItem
          id="expense-list"
          title="Expense Register"
          subtitle="Newest expense at top · Search and filter by category or date"
          rightSummary={`${filtered.length} entries · ${formatBDT(filteredTotal)}`}
          isOpen={openAccordion === 'expense-list'}
          onToggle={toggleAccordion}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search description or notes..."
                className="w-full min-h-[42px] pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
            >
              <option value="">All Categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
              />
              {(searchTerm || categoryFilter || dateFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setCategoryFilter('');
                    setDateFilter('');
                  }}
                  className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 shrink-0"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No expense records match your current filter.
            </div>
          ) : (
            <>
              <div className="md:hidden divide-y divide-slate-100">
                {filtered.map((e) => (
                  <div key={e.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#0F172A] truncate">
                        {e.description}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {e.category} · {e.method}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
                        {formatDateDDMMYYYY(e.date)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold tabular-nums text-[#801828]">
                        {formatBDT(e.amount)}
                      </div>
                      <div className="mt-1 flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingExpense(e);
                            setOpenAccordion('new-expense');
                          }}
                          aria-label="Edit expense"
                          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-[#0B1F3A] hover:bg-slate-100"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(e)}
                          aria-label="Delete expense"
                          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-[#801828] hover:bg-[#FDF2F4]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
                      <th className="py-2.5 pr-3">Date</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3 text-right">Amount (BDT)</th>
                      <th className="py-2.5 pl-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filtered.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 pr-3 tabular-nums text-xs text-slate-600 whitespace-nowrap">
                          {formatDateDDMMYYYY(e.date)}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[#0F172A]">{e.category}</td>
                        <td className="py-2.5 px-3 text-slate-700">{e.description}</td>
                        <td className="py-2.5 px-3 text-slate-600">{e.method}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-[#801828] whitespace-nowrap">
                          {formatBDT(e.amount)}
                        </td>
                        <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingExpense(e);
                              setOpenAccordion('new-expense');
                            }}
                            aria-label="Edit expense"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#0B1F3A] hover:bg-slate-100"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(e)}
                            aria-label="Delete expense"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#801828] hover:bg-[#FDF2F4] ml-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </AccordionItem>

        <AccordionItem
          id="expense-summary"
          title="Daily & Monthly Expense Report by Category"
          subtitle="Category breakdown for today, current month, and all-time"
          isOpen={openAccordion === 'expense-summary'}
          onToggle={toggleAccordion}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
                  <th className="py-2.5 pr-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Today</th>
                  <th className="py-2.5 px-3 text-right">This Month</th>
                  <th className="py-2.5 pl-3 text-right">All Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {categoryBreakdown.map((row) => (
                  <tr key={row.category}>
                    <td className="py-2.5 pr-3 font-medium text-[#0F172A]">{row.category}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {formatBDT(row.todayAmt)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {formatBDT(row.monthAmt)}
                    </td>
                    <td className="py-2.5 pl-3 text-right tabular-nums font-semibold text-[#0B1F3A]">
                      {formatBDT(row.allAmt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AccordionItem>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Confirm Expense Deletion"
        message={
          deleteTarget
            ? `Delete expense "${deleteTarget.description}" (${formatBDT(
                deleteTarget.amount
              )})? This will update your ${deleteTarget.method} balance and record an audit log.`
            : ''
        }
        confirmLabel="Delete Expense"
        busy={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
