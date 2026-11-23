import React, { useMemo, useState } from 'react';
import { Edit2, Search, Trash2 } from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext';
import { buildCompleteTransactions } from '../../lib/calculations';
import { formatBDT, formatDateDDMMYYYY, formatDateTimeDhaka } from '../../lib/format';
import {
  CashTransaction,
  Expense,
  Payment,
  Purchase,
  UnifiedTransaction,
} from '../../types/accounting';
import { AccordionItem } from '../ui/Accordion';
import { ConfirmModal } from '../ui/ConfirmModal';
import { PurchaseForm } from '../forms/PurchaseForm';
import { PaymentForm } from '../forms/PaymentForm';
import { ExpenseForm } from '../forms/ExpenseForm';
import { CashTxForm } from '../forms/CashTxForm';

export const TransactionsView: React.FC = () => {
  const {
    siteSettings,
    purchases,
    payments,
    expenses,
    cashTransactions,
    auditLogs,
    deletePurchase,
    deletePayment,
    deleteExpense,
    deleteCashTransaction,
    notify,
  } = useAccounting();

  const [openAccordion, setOpenAccordion] = useState<string | null>('ledger');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [editingTx, setEditingTx] = useState<UnifiedTransaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UnifiedTransaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  const toggleAccordion = (id: string) => {
    setOpenAccordion((prev) => (prev === id ? null : id));
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

  const filtered = useMemo(() => {
    return allTransactions.filter((tx) => {
      if (dateFilter && tx.date !== dateFilter) return false;
      if (typeFilter && tx.sourceType !== typeFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          tx.shopOrParty.toLowerCase().includes(q) ||
          tx.description.toLowerCase().includes(q) ||
          tx.categoryOrMethod.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allTransactions, dateFilter, typeFilter, searchTerm]);

  const txTypeLabel: Record<string, string> = {
    purchase: 'Purchase',
    payment: 'Payment',
    expense: 'Expense',
    cash_in: 'Cash In',
    cash_out: 'Cash Out',
    transfer: 'Transfer',
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.sourceType === 'purchase') {
        await deletePurchase(deleteTarget.rawRecord as Purchase);
      } else if (deleteTarget.sourceType === 'payment') {
        await deletePayment(deleteTarget.rawRecord as Payment);
      } else if (deleteTarget.sourceType === 'expense') {
        await deleteExpense(deleteTarget.rawRecord as Expense);
      } else {
        await deleteCashTransaction(deleteTarget.rawRecord as CashTransaction);
      }
      setDeleteTarget(null);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to delete transaction.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.015em] text-[#0B1F3A]">Transaction History &amp; Audit Log</h2>
        <p className="text-xs text-slate-500">
          Complete chronological history (newest at top) with confirmed edits, deletes, and audit trail.
        </p>
      </div>

      <div className="space-y-3">
        {editingTx && (
          <AccordionItem
            id="edit-tx"
            title={`Edit ${txTypeLabel[editingTx.sourceType]} Transaction`}
            subtitle="All edits are recorded in the immutable audit log"
            isOpen={openAccordion === 'edit-tx'}
            onToggle={toggleAccordion}
          >
            {editingTx.sourceType === 'purchase' && (
              <PurchaseForm
                key={editingTx.id}
                existingPurchase={editingTx.rawRecord as Purchase}
                onSuccess={() => {
                  setEditingTx(null);
                  setOpenAccordion('ledger');
                }}
                onCancel={() => {
                  setEditingTx(null);
                  setOpenAccordion('ledger');
                }}
              />
            )}
            {editingTx.sourceType === 'payment' && (
              <PaymentForm
                key={editingTx.id}
                existingPayment={editingTx.rawRecord as Payment}
                onSuccess={() => {
                  setEditingTx(null);
                  setOpenAccordion('ledger');
                }}
                onCancel={() => {
                  setEditingTx(null);
                  setOpenAccordion('ledger');
                }}
              />
            )}
            {editingTx.sourceType === 'expense' && (
              <ExpenseForm
                key={editingTx.id}
                existingExpense={editingTx.rawRecord as Expense}
                onSuccess={() => {
                  setEditingTx(null);
                  setOpenAccordion('ledger');
                }}
                onCancel={() => {
                  setEditingTx(null);
                  setOpenAccordion('ledger');
                }}
              />
            )}
            {(editingTx.sourceType === 'cash_in' ||
              editingTx.sourceType === 'cash_out' ||
              editingTx.sourceType === 'transfer') && (
              <CashTxForm
                key={editingTx.id}
                existingTx={editingTx.rawRecord as CashTransaction}
                onSuccess={() => {
                  setEditingTx(null);
                  setOpenAccordion('ledger');
                }}
                onCancel={() => {
                  setEditingTx(null);
                  setOpenAccordion('ledger');
                }}
              />
            )}
          </AccordionItem>
        )}

        <AccordionItem
          id="ledger"
          title="Complete Transaction History"
          subtitle="Search by shop name, filter by date or transaction type"
          rightSummary={`${filtered.length} records`}
          isOpen={openAccordion === 'ledger'}
          onToggle={toggleAccordion}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by shop name or description..."
                className="w-full min-h-[42px] pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
            >
              <option value="">All Transaction Types</option>
              <option value="purchase">Purchase</option>
              <option value="payment">Payment</option>
              <option value="expense">Expense</option>
              <option value="cash_in">Cash In</option>
              <option value="cash_out">Cash Out</option>
              <option value="transfer">Transfer</option>
            </select>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
              />
              {(searchTerm || typeFilter || dateFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setTypeFilter('');
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
              No transactions match your search criteria.
            </div>
          ) : (
            <>
              <div className="md:hidden divide-y divide-slate-100">
                {filtered.map((tx) => (
                  <div key={`${tx.sourceType}-${tx.id}`} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#0F172A] truncate">
                          {tx.shopOrParty}
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">{tx.description}</div>
                        <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
                          {formatDateDDMMYYYY(tx.date)} · {txTypeLabel[tx.sourceType]} ·{' '}
                          {tx.categoryOrMethod}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {tx.debit > 0 ? (
                          <div className="text-sm font-semibold tabular-nums text-[#801828]">
                            -{formatBDT(tx.debit)}
                          </div>
                        ) : (
                          <div className="text-sm font-semibold tabular-nums text-[#0F294A]">
                            +{formatBDT(tx.credit)}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          Bal: {formatBDT(tx.runningCashBalance || 0)}
                        </div>
                        <div className="mt-1 flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTx(tx);
                              setOpenAccordion('edit-tx');
                            }}
                            aria-label="Edit transaction"
                            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-[#0B1F3A] hover:bg-slate-100"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(tx)}
                            aria-label="Delete transaction"
                            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-[#801828] hover:bg-[#FDF2F4]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Shop / Supplier</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-right">Debit</th>
                      <th className="py-2.5 px-3 text-right">Credit</th>
                      <th className="py-2.5 px-3 text-right">Balance</th>
                      <th className="py-2.5 pl-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filtered.map((tx) => (
                      <tr key={`${tx.sourceType}-${tx.id}`} className="hover:bg-slate-50/70">
                        <td className="py-2.5 pr-3 tabular-nums text-xs text-slate-600 whitespace-nowrap">
                          {formatDateDDMMYYYY(tx.date)}
                        </td>
                        <td className="py-2.5 px-3 text-xs font-medium text-[#0F172A] whitespace-nowrap">
                          {txTypeLabel[tx.sourceType]}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[#0F172A] max-w-[160px] truncate">
                          {tx.shopOrParty}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-[240px] truncate">
                          {tx.description}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-[#801828] whitespace-nowrap">
                          {tx.debit > 0 ? formatBDT(tx.debit) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-[#0F294A] whitespace-nowrap">
                          {tx.credit > 0 ? formatBDT(tx.credit) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-slate-700 whitespace-nowrap">
                          {formatBDT(tx.runningCashBalance || 0)}
                        </td>
                        <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTx(tx);
                              setOpenAccordion('edit-tx');
                            }}
                            aria-label="Edit transaction"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#0B1F3A] hover:bg-slate-100"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(tx)}
                            aria-label="Delete transaction"
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
          id="audit-logs"
          title="Financial Audit History"
          subtitle="Immutable trail of creations, edits, deletions, and restores"
          rightSummary={`${auditLogs.length} events`}
          isOpen={openAccordion === 'audit-logs'}
          onToggle={toggleAccordion}
        >
          {auditLogs.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No audit log entries recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {auditLogs.slice(0, 100).map((log) => (
                <div key={log.id} className="py-2.5 flex items-start justify-between gap-4 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium text-[#0F172A]">{log.summary}</div>
                    <div className="text-slate-500 mt-0.5 capitalize">
                      {log.action} · {log.entityType}
                    </div>
                  </div>
                  <div className="text-slate-500 tabular-nums whitespace-nowrap shrink-0">
                    {formatDateTimeDhaka(log.createdAtMs)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </AccordionItem>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Confirm Financial Record Deletion"
        message={
          deleteTarget
            ? `Permanently delete this ${txTypeLabel[deleteTarget.sourceType]} record (${
                deleteTarget.shopOrParty
              } — ${deleteTarget.description})? An immutable audit log entry will be saved.`
            : ''
        }
        confirmLabel="Confirm Delete"
        busy={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
