import React, { useMemo, useState } from 'react';
import { Edit2, Plus, Search, Trash2 } from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext';
import { formatBDT, formatDateDDMMYYYY, round2 } from '../../lib/format';
import { NavSection, PURCHASE_CATEGORIES, Purchase } from '../../types/accounting';
import { AccordionItem } from '../ui/Accordion';
import { ConfirmModal } from '../ui/ConfirmModal';
import { PurchaseForm } from '../forms/PurchaseForm';

export const PurchasesView: React.FC<{ onNavigate: (s: NavSection) => void }> = ({
  onNavigate,
}) => {
  const { purchases, shops, deletePurchase, notify } = useAccounting();

  const [openAccordion, setOpenAccordion] = useState<string | null>('purchase-list');
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Purchase | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [shopFilter, setShopFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const toggleAccordion = (id: string) => {
    setOpenAccordion((prev) => (prev === id ? null : id));
  };

  const filtered = useMemo(() => {
    return purchases.filter((p) => {
      if (shopFilter && p.shopId !== shopFilter) return false;
      if (categoryFilter && p.category !== categoryFilter) return false;
      if (dateFilter && p.date !== dateFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          p.materialName.toLowerCase().includes(q) ||
          p.shopName.toLowerCase().includes(q) ||
          p.notes.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [purchases, shopFilter, categoryFilter, dateFilter, searchTerm]);

  const filteredTotal = useMemo(
    () => round2(filtered.reduce((sum, p) => sum + p.totalAmount, 0)),
    [filtered]
  );

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePurchase(deleteTarget);
      setDeleteTarget(null);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to delete purchase.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.015em] text-[#0B1F3A]">Purchase Management</h2>
          <p className="text-xs text-slate-500">
            Record material &amp; labour purchases against supplier accounts (separate from cash payments).
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingPurchase(null);
            setOpenAccordion('new-purchase');
          }}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1F3A] hover:bg-[#163864] text-white text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Purchase</span>
        </button>
      </div>

      <div className="space-y-3">
        <AccordionItem
          id="new-purchase"
          title={
            editingPurchase
              ? `Edit Purchase: ${editingPurchase.materialName}`
              : 'Record Material Purchase'
          }
          subtitle="Total Amount = Quantity × Rate · Automatically increases shop payable"
          isOpen={openAccordion === 'new-purchase'}
          onToggle={toggleAccordion}
        >
          <PurchaseForm
            key={editingPurchase?.id || 'new'}
            existingPurchase={editingPurchase || undefined}
            onSuccess={() => {
              setEditingPurchase(null);
              setOpenAccordion('purchase-list');
            }}
            onCancel={
              editingPurchase
                ? () => {
                    setEditingPurchase(null);
                    setOpenAccordion('purchase-list');
                  }
                : undefined
            }
            onNavigateToShops={() => onNavigate('shops')}
          />
        </AccordionItem>

        <AccordionItem
          id="purchase-list"
          title="Purchase Register"
          subtitle="Newest purchase at top · Search and filter by shop, category, or date"
          rightSummary={`${filtered.length} entries · ${formatBDT(filteredTotal)}`}
          isOpen={openAccordion === 'purchase-list'}
          onToggle={toggleAccordion}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search material or shop..."
                className="w-full min-h-[42px] pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
              />
            </div>

            <select
              value={shopFilter}
              onChange={(e) => setShopFilter(e.target.value)}
              aria-label="Filter by shop"
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
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
            >
              <option value="">All Categories</option>
              {PURCHASE_CATEGORIES.map((c) => (
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
              {(searchTerm || shopFilter || categoryFilter || dateFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setShopFilter('');
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
              No purchase records match your current filter.
            </div>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {filtered.map((p) => (
                  <div key={p.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#0F172A] truncate">
                          {p.materialName}
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5 truncate">
                          {p.shopName} · {p.category}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
                          {formatDateDDMMYYYY(p.date)} · {p.quantity} {p.unit} × {formatBDT(p.rate)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold tabular-nums text-[#0F294A]">
                          {formatBDT(p.totalAmount)}
                        </div>
                        <div className="mt-1 flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPurchase(p);
                              setOpenAccordion('new-purchase');
                            }}
                            aria-label="Edit purchase"
                            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-[#0B1F3A] hover:bg-slate-100"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(p)}
                            aria-label="Delete purchase"
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

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
                      <th className="py-2.5 pr-3">Date</th>
                      <th className="py-2.5 px-3">Shop</th>
                      <th className="py-2.5 px-3">Material</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Rate</th>
                      <th className="py-2.5 px-3 text-right">Total (BDT)</th>
                      <th className="py-2.5 pl-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filtered.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 pr-3 tabular-nums text-xs text-slate-600 whitespace-nowrap">
                          {formatDateDDMMYYYY(p.date)}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[#0F172A] max-w-[160px] truncate">
                          {p.shopName}
                        </td>
                        <td className="py-2.5 px-3 text-[#0F172A]">
                          {p.materialName}
                          {p.pendingSync && (
                            <span className="ml-1.5 text-[11px] text-amber-700">(Pending sync)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-600">{p.category}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                          {p.quantity} {p.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                          {formatBDT(p.rate)}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-[#0F294A] whitespace-nowrap">
                          {formatBDT(p.totalAmount)}
                        </td>
                        <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPurchase(p);
                              setOpenAccordion('new-purchase');
                            }}
                            aria-label="Edit purchase"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#0F172A] hover:bg-slate-100"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(p)}
                            aria-label="Delete purchase"
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
        title="Confirm Purchase Deletion"
        message={
          deleteTarget
            ? `Delete purchase "${deleteTarget.materialName}" (${formatBDT(
                deleteTarget.totalAmount
              )}) from ${deleteTarget.shopName}? This adjusts the shop payable balance and records an audit log.`
            : ''
        }
        confirmLabel="Delete Purchase"
        busy={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
