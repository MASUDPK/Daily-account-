import React, { useMemo, useState } from 'react';
import { Edit2, Plus, Search, Trash2 } from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext';
import { formatBDT, formatDateDDMMYYYY, round2 } from '../../lib/format';
import { NavSection, PAYMENT_METHODS, Payment } from '../../types/accounting';
import { AccordionItem } from '../ui/Accordion';
import { ConfirmModal } from '../ui/ConfirmModal';
import { PaymentForm } from '../forms/PaymentForm';

export const PaymentsView: React.FC<{ onNavigate: (s: NavSection) => void }> = ({
  onNavigate,
}) => {
  const { payments, shops, deletePayment, notify } = useAccounting();

  const [openAccordion, setOpenAccordion] = useState<string | null>('payment-list');
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [shopFilter, setShopFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const toggleAccordion = (id: string) => {
    setOpenAccordion((prev) => (prev === id ? null : id));
  };

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (shopFilter && p.shopId !== shopFilter) return false;
      if (methodFilter && p.method !== methodFilter) return false;
      if (dateFilter && p.date !== dateFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          p.shopName.toLowerCase().includes(q) ||
          p.referenceNumber.toLowerCase().includes(q) ||
          p.notes.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [payments, shopFilter, methodFilter, dateFilter, searchTerm]);

  const filteredTotal = useMemo(
    () => round2(filtered.reduce((sum, p) => sum + p.amount, 0)),
    [filtered]
  );

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePayment(deleteTarget);
      setDeleteTarget(null);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to delete payment.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.015em] text-[#0B1F3A]">Payment Management</h2>
          <p className="text-xs text-slate-500">
            Disburse payments to shops · Excess payment automatically records as advance receivable.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingPayment(null);
            setOpenAccordion('new-payment');
          }}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#801828] hover:bg-[#681220] text-white text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Payment</span>
        </button>
      </div>

      <div className="space-y-3">
        <AccordionItem
          id="new-payment"
          title={
            editingPayment ? `Edit Payment: ${editingPayment.shopName}` : 'Record Supplier Payment'
          }
          subtitle="Updates shop ledger and deducts from Cash, Bank, or Mobile Banking balance"
          isOpen={openAccordion === 'new-payment'}
          onToggle={toggleAccordion}
        >
          <PaymentForm
            key={editingPayment?.id || 'new'}
            existingPayment={editingPayment || undefined}
            onSuccess={() => {
              setEditingPayment(null);
              setOpenAccordion('payment-list');
            }}
            onCancel={
              editingPayment
                ? () => {
                    setEditingPayment(null);
                    setOpenAccordion('payment-list');
                  }
                : undefined
            }
            onNavigateToShops={() => onNavigate('shops')}
          />
        </AccordionItem>

        <AccordionItem
          id="payment-list"
          title="Payment History"
          subtitle="Newest payment at top · Filter by shop, method, or date"
          rightSummary={`${filtered.length} entries · ${formatBDT(filteredTotal)}`}
          isOpen={openAccordion === 'payment-list'}
          onToggle={toggleAccordion}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search shop or reference..."
                className="w-full min-h-[42px] pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
              />
            </div>

            <select
              value={shopFilter}
              onChange={(e) => setShopFilter(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
            >
              <option value="">All Shops</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shopName}
                </option>
              ))}
            </select>

            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
            >
              <option value="">All Methods</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
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
              {(searchTerm || shopFilter || methodFilter || dateFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setShopFilter('');
                    setMethodFilter('');
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
              No payment records match your current filter.
            </div>
          ) : (
            <>
              <div className="md:hidden divide-y divide-slate-100">
                {filtered.map((p) => (
                  <div key={p.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#0F172A] truncate">
                          {p.shopName}
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          {p.method}
                          {p.referenceNumber ? ` · Ref: ${p.referenceNumber}` : ''}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
                          {formatDateDDMMYYYY(p.date)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold tabular-nums text-emerald-700">
                          {formatBDT(p.amount)}
                        </div>
                        <div className="mt-1 flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPayment(p);
                              setOpenAccordion('new-payment');
                            }}
                            aria-label="Edit payment"
                            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-[#0B1F3A] hover:bg-slate-100"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(p)}
                            aria-label="Delete payment"
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
                      <th className="py-2.5 px-3">Shop</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3">Reference</th>
                      <th className="py-2.5 px-3">Notes</th>
                      <th className="py-2.5 px-3 text-right">Amount (BDT)</th>
                      <th className="py-2.5 pl-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filtered.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 pr-3 tabular-nums text-xs text-slate-600 whitespace-nowrap">
                          {formatDateDDMMYYYY(p.date)}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[#0F172A]">{p.shopName}</td>
                        <td className="py-2.5 px-3 text-slate-700">{p.method}</td>
                        <td className="py-2.5 px-3 tabular-nums text-xs text-slate-600">
                          {p.referenceNumber || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate">
                          {p.notes || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                          {formatBDT(p.amount)}
                        </td>
                        <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPayment(p);
                              setOpenAccordion('new-payment');
                            }}
                            aria-label="Edit payment"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#0B1F3A] hover:bg-slate-100"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(p)}
                            aria-label="Delete payment"
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
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Confirm Payment Deletion"
        message={
          deleteTarget
            ? `Delete payment of ${formatBDT(deleteTarget.amount)} to ${
                deleteTarget.shopName
              }? This will restore the shop payable balance, adjust the ${
                deleteTarget.method
              } account, and write an audit entry.`
            : ''
        }
        confirmLabel="Delete Payment"
        busy={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
