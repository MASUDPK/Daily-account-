import React, { useMemo, useState } from 'react';
import { Edit2, FileDown, Plus, Search, Trash2 } from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext';
import { buildShopLedger } from '../../lib/calculations';
import { downloadReportPDF, exportToCSV } from '../../lib/exportUtils';
import { formatBDT, formatBDTAscii, formatDateDDMMYYYY, round2 } from '../../lib/format';
import { Shop } from '../../types/accounting';
import { AccordionItem } from '../ui/Accordion';
import { ConfirmModal } from '../ui/ConfirmModal';
import { PurchaseForm } from '../forms/PurchaseForm';
import { PaymentForm } from '../forms/PaymentForm';

export const ShopsView: React.FC = () => {
  const {
    siteSettings,
    shops,
    purchases,
    payments,
    shopSummaries,
    saveShop,
    deleteShop,
    notify,
  } = useAccounting();

  const [openAccordion, setOpenAccordion] = useState<string | null>('shop-directory');
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [quickLedgerEntry, setQuickLedgerEntry] = useState<'none' | 'purchase' | 'payment'>('none');

  // Form fields
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [openingBalanceType, setOpeningBalanceType] = useState<'payable' | 'receivable'>('payable');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Shop | null>(null);
  const [deleting, setDeleting] = useState(false);

  const toggleAccordion = (id: string) => {
    setOpenAccordion((prev) => (prev === id ? null : id));
  };

  const resetForm = () => {
    setEditingShop(null);
    setShopName('');
    setOwnerName('');
    setPhone('');
    setAddress('');
    setOpeningBalance('');
    setOpeningBalanceType('payable');
    setNotes('');
  };

  const startEditShop = (shop: Shop) => {
    setEditingShop(shop);
    setShopName(shop.shopName);
    setOwnerName(shop.ownerName);
    setPhone(shop.phone);
    setAddress(shop.address);
    setOpeningBalance(shop.openingBalance ? String(shop.openingBalance) : '');
    setOpeningBalanceType(shop.openingBalanceType);
    setNotes(shop.notes);
    setOpenAccordion('add-shop');
  };

  const openShopLedger = (shopId: string) => {
    setSelectedShopId(shopId);
    setQuickLedgerEntry('none');
    setOpenAccordion('shop-ledger');
  };

  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) {
      notify('error', 'Shop Name is required.');
      return;
    }
    const ob = round2(Number(openingBalance) || 0);
    if (ob < 0) {
      notify('error', 'Opening balance cannot be negative.');
      return;
    }

    setSubmitting(true);
    try {
      const id = await saveShop(
        {
          shopName: shopName.trim(),
          ownerName: ownerName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          openingBalance: ob,
          openingBalanceType,
          notes: notes.trim(),
          isActive: true,
        },
        editingShop || undefined
      );
      resetForm();
      setSelectedShopId(id);
      setOpenAccordion('shop-directory');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to save shop.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteShop(deleteTarget);
      if (selectedShopId === deleteTarget.id) {
        setSelectedShopId(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to delete shop.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredSummaries = useMemo(() => {
    if (!searchTerm.trim()) return shopSummaries;
    const q = searchTerm.toLowerCase();
    return shopSummaries.filter(
      (s) =>
        s.shop.shopName.toLowerCase().includes(q) ||
        s.shop.ownerName.toLowerCase().includes(q) ||
        s.shop.phone.toLowerCase().includes(q)
    );
  }, [shopSummaries, searchTerm]);

  const activeShopSummary = useMemo(
    () => shopSummaries.find((s) => s.shop.id === selectedShopId) || null,
    [shopSummaries, selectedShopId]
  );

  const activeLedger = useMemo(() => {
    if (!activeShopSummary) return [];
    return buildShopLedger(activeShopSummary.shop, purchases, payments);
  }, [activeShopSummary, purchases, payments]);

  const handleExportShopPDF = () => {
    if (!activeShopSummary) return;
    downloadReportPDF({
      title: `Shop Ledger: ${activeShopSummary.shop.shopName}`,
      siteName: siteSettings?.siteName || 'Main Construction Site',
      dateRangeLabel: 'All Recorded Dates',
      summaryPairs: [
        { label: 'Total Purchase', value: formatBDTAscii(activeShopSummary.totalPurchase) },
        { label: 'Total Paid', value: formatBDTAscii(activeShopSummary.totalPaid) },
        { label: 'Current Due', value: formatBDTAscii(activeShopSummary.currentDue) },
        { label: 'Advance / Receivable', value: formatBDTAscii(activeShopSummary.advanceAmount) },
      ],
      headers: ['Date', 'Particulars', 'Details', 'Purchase (BDT)', 'Payment (BDT)', 'Balance (BDT)'],
      rows: activeLedger.map((e) => [
        e.type === 'opening' ? 'Opening' : formatDateDDMMYYYY(e.date),
        e.title,
        e.subtitle,
        e.purchaseDebit > 0 ? formatBDTAscii(e.purchaseDebit) : '-',
        e.paymentCredit > 0 ? formatBDTAscii(e.paymentCredit) : '-',
        e.runningBalance >= 0
          ? `${formatBDTAscii(e.runningBalance)} Due`
          : `${formatBDTAscii(Math.abs(e.runningBalance))} Adv`,
      ]),
      fileName: `shop-ledger-${activeShopSummary.shop.shopName.toLowerCase().replace(/\s+/g, '-')}`,
    });
  };

  const handleExportShopCSV = () => {
    if (!activeShopSummary) return;
    exportToCSV(
      ['Date', 'Particulars', 'Details', 'Purchase (BDT)', 'Payment (BDT)', 'Running Balance (BDT)', 'Notes'],
      activeLedger.map((e) => [
        e.type === 'opening' ? 'Opening' : formatDateDDMMYYYY(e.date),
        e.title,
        e.subtitle,
        e.purchaseDebit.toFixed(2),
        e.paymentCredit.toFixed(2),
        e.runningBalance.toFixed(2),
        e.notes,
      ]),
      `shop-ledger-${activeShopSummary.shop.shopName.toLowerCase().replace(/\s+/g, '-')}`
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.015em] text-[#0B1F3A]">Shops &amp; Supplier Accounts</h2>
          <p className="text-xs text-slate-500">
            Manage supplier profiles, opening balances, and individual shop ledgers.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setOpenAccordion('add-shop');
          }}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1F3A] hover:bg-[#163864] text-white text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Shop</span>
        </button>
      </div>

      <div className="space-y-3">
        <AccordionItem
          id="add-shop"
          title={editingShop ? `Edit Shop: ${editingShop.shopName}` : 'Add New Shop / Supplier'}
          subtitle="Register supplier contact info and optional opening balance"
          isOpen={openAccordion === 'add-shop'}
          onToggle={toggleAccordion}
        >
          <form onSubmit={handleSaveShop} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Shop Name *</label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="e.g. Bismillah Hardware & Cement"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Owner / Contact Name</label>
                <input
                  type="text"
                  maxLength={100}
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Proprietor name"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  inputMode="tel"
                  maxLength={32}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Address</label>
                <input
                  type="text"
                  maxLength={240}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Market or street address"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Opening Balance (BDT ৳)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Opening Balance Type</label>
                <select
                  value={openingBalanceType}
                  onChange={(e) =>
                    setOpeningBalanceType(e.target.value as 'payable' | 'receivable')
                  }
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
                >
                  <option value="payable">Due / Payable (We owe shop)</option>
                  <option value="receivable">Advance / Receivable (Shop owes us)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Notes</label>
              <input
                type="text"
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Payment terms, bank account details, or remarks"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              {editingShop && (
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setOpenAccordion('shop-directory');
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0B1F3A] hover:bg-[#163864] text-white text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {submitting ? 'Saving...' : editingShop ? 'Update Shop' : 'Save Shop'}
              </button>
            </div>
          </form>
        </AccordionItem>

        <AccordionItem
          id="shop-directory"
          title="Shops Directory & Balances"
          subtitle="Click any shop to open its individual accounting ledger"
          rightSummary={`${shops.length} shop${shops.length === 1 ? '' : 's'}`}
          isOpen={openAccordion === 'shop-directory'}
          onToggle={toggleAccordion}
        >
          <div className="mb-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search shop name, owner, or phone..."
              className="w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
            />
          </div>

          {filteredSummaries.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
              <p className="text-sm font-medium text-[#0F172A]">No shops found</p>
              <p className="mt-1 text-xs text-slate-500">
                Add your construction material suppliers to start tracking purchases and dues.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredSummaries.map((s) => (
                <div
                  key={s.shop.id}
                  className="border border-slate-200 rounded-xl p-4 hover:border-[#0F294A]/40 transition-colors bg-white flex flex-col justify-between gap-3"
                >
                  <button
                    type="button"
                    onClick={() => openShopLedger(s.shop.id)}
                    className="text-left w-full focus-visible:outline-none"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-[#0F172A] truncate">
                          {s.shop.shopName}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                          {s.shop.ownerName || 'No owner listed'}
                          {s.shop.phone ? ` · ${s.shop.phone}` : ''}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {s.currentDue > 0 ? (
                          <>
                            <div className="text-[11px] font-medium text-[#801828]">Due Payable</div>
                            <div className="text-sm font-semibold tabular-nums text-[#801828]">
                              {formatBDT(s.currentDue)}
                            </div>
                          </>
                        ) : s.advanceAmount > 0 ? (
                          <>
                            <div className="text-[11px] font-medium text-[#0F294A]">Advance Receivable</div>
                            <div className="text-sm font-semibold tabular-nums text-[#0F294A]">
                              {formatBDT(s.advanceAmount)}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-[11px] font-medium text-emerald-700">Settled</div>
                            <div className="text-sm font-semibold tabular-nums text-emerald-700">
                              ৳0.00
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500">Total Purchase:</span>
                        <div className="tabular-nums font-semibold text-[#0F172A]">
                          {formatBDT(s.totalPurchase)}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500">Total Paid:</span>
                        <div className="tabular-nums font-semibold text-[#0F172A]">
                          {formatBDT(s.totalPaid)}
                        </div>
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => openShopLedger(s.shop.id)}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg bg-[#0F294A]/10 text-[#0F294A] hover:bg-[#0F294A]/15 text-xs font-medium transition-colors"
                    >
                      Open Ledger ({s.purchaseCount + s.paymentCount})
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEditShop(s.shop)}
                        aria-label={`Edit ${s.shop.shopName}`}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-[#0B1F3A] hover:bg-slate-100"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(s.shop)}
                        aria-label={`Delete ${s.shop.shopName}`}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-[#801828] hover:bg-[#FDF2F4]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AccordionItem>

        <AccordionItem
          id="shop-ledger"
          title={
            activeShopSummary
              ? `Shop Ledger: ${activeShopSummary.shop.shopName}`
              : 'Individual Shop Ledger'
          }
          subtitle={
            activeShopSummary
              ? `${activeShopSummary.shop.ownerName || 'Supplier'}${
                  activeShopSummary.shop.address ? ` · ${activeShopSummary.shop.address}` : ''
                }`
              : 'Select a shop from the directory above to inspect its ledger'
          }
          rightSummary={
            activeShopSummary
              ? activeShopSummary.currentDue > 0
                ? `Due ${formatBDT(activeShopSummary.currentDue)}`
                : activeShopSummary.advanceAmount > 0
                ? `Adv ${formatBDT(activeShopSummary.advanceAmount)}`
                : 'Settled'
              : undefined
          }
          isOpen={openAccordion === 'shop-ledger'}
          onToggle={toggleAccordion}
        >
          {!activeShopSummary ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-600">
              Choose a shop in <strong>Shops Directory & Balances</strong> to view its full ledger.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Shop Balance Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[11px] text-slate-500">Total Purchase</div>
                  <div className="mt-1 text-sm font-semibold tabular-nums text-[#0F172A]">
                    {formatBDT(activeShopSummary.totalPurchase)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[11px] text-slate-500">Total Payment</div>
                  <div className="mt-1 text-sm font-semibold tabular-nums text-[#0F172A]">
                    {formatBDT(activeShopSummary.totalPaid)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[11px] text-slate-500">Current Due</div>
                  <div className="mt-1 text-sm font-semibold tabular-nums text-[#801828]">
                    {formatBDT(activeShopSummary.currentDue)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[11px] text-slate-500">Advance Payment</div>
                  <div className="mt-1 text-sm font-semibold tabular-nums text-[#0F294A]">
                    {formatBDT(activeShopSummary.advanceAmount)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 col-span-2 sm:col-span-1">
                  <div className="text-[11px] text-slate-500">Total Receivable</div>
                  <div className="mt-1 text-sm font-semibold tabular-nums text-[#0F294A]">
                    {formatBDT(activeShopSummary.advanceAmount)}
                  </div>
                </div>
              </div>

              {/* Quick Actions inside Shop Ledger */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setQuickLedgerEntry((p) => (p === 'purchase' ? 'none' : 'purchase'))
                    }
                    className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#0B1F3A] text-white text-xs font-medium hover:bg-[#163864] transition-colors"
                  >
                    {quickLedgerEntry === 'purchase' ? 'Hide Purchase Form' : '+ Purchase from Shop'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setQuickLedgerEntry((p) => (p === 'payment' ? 'none' : 'payment'))
                    }
                    className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#801828] text-white text-xs font-medium hover:bg-[#681220] transition-colors"
                  >
                    {quickLedgerEntry === 'payment' ? 'Hide Payment Form' : '+ Pay This Shop'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportShopPDF}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportShopCSV}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    CSV
                  </button>
                </div>
              </div>

              {quickLedgerEntry === 'purchase' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <PurchaseForm
                    defaultShopId={activeShopSummary.shop.id}
                    onSuccess={() => setQuickLedgerEntry('none')}
                    onCancel={() => setQuickLedgerEntry('none')}
                  />
                </div>
              )}

              {quickLedgerEntry === 'payment' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <PaymentForm
                    defaultShopId={activeShopSummary.shop.id}
                    onSuccess={() => setQuickLedgerEntry('none')}
                    onCancel={() => setQuickLedgerEntry('none')}
                  />
                </div>
              )}

              {activeLedger.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  No purchases or payments recorded for this shop yet.
                </div>
              ) : (
                <>
                  {/* Mobile Ledger Cards */}
                  <div className="md:hidden divide-y divide-slate-100">
                    {activeLedger.map((entry) => (
                      <div key={entry.id} className="py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-[#0F172A]">
                              {entry.title}
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5">{entry.subtitle}</div>
                            <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
                              {entry.type === 'opening' ? 'Opening' : formatDateDDMMYYYY(entry.date)}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {entry.purchaseDebit > 0 && (
                              <div className="text-sm font-semibold tabular-nums text-[#0F294A]">
                                +{formatBDT(entry.purchaseDebit)}
                              </div>
                            )}
                            {entry.paymentCredit > 0 && (
                              <div className="text-sm font-semibold tabular-nums text-emerald-700">
                                -{formatBDT(entry.paymentCredit)}
                              </div>
                            )}
                            <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                              Bal: {formatBDT(Math.abs(entry.runningBalance))}{' '}
                              {entry.runningBalance >= 0 ? 'Due' : 'Adv'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Ledger Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
                          <th className="py-2.5 pr-3">Date</th>
                          <th className="py-2.5 px-3">Particulars</th>
                          <th className="py-2.5 px-3">Details</th>
                          <th className="py-2.5 px-3 text-right">Purchase (+)</th>
                          <th className="py-2.5 px-3 text-right">Payment (-)</th>
                          <th className="py-2.5 pl-3 text-right">Running Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {activeLedger.map((entry) => (
                          <tr key={entry.id} className="hover:bg-slate-50/70">
                            <td className="py-2.5 pr-3 tabular-nums text-xs text-slate-600 whitespace-nowrap">
                              {entry.type === 'opening'
                                ? 'Opening'
                                : formatDateDDMMYYYY(entry.date)}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-[#0F172A]">
                              {entry.title}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">{entry.subtitle}</td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-[#0F294A]">
                              {entry.purchaseDebit > 0 ? formatBDT(entry.purchaseDebit) : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700">
                              {entry.paymentCredit > 0 ? formatBDT(entry.paymentCredit) : '—'}
                            </td>
                            <td
                              className={`py-2.5 pl-3 text-right tabular-nums font-semibold whitespace-nowrap ${
                                entry.runningBalance > 0
                                  ? 'text-[#801828]'
                                  : entry.runningBalance < 0
                                  ? 'text-[#0F294A]'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {formatBDT(Math.abs(entry.runningBalance))}{' '}
                              <span className="text-[11px] font-normal">
                                {entry.runningBalance > 0
                                  ? 'Due'
                                  : entry.runningBalance < 0
                                  ? 'Adv'
                                  : 'Settled'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </AccordionItem>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Shop Account"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.shopName}"? Shops with existing purchases or payments cannot be deleted.`
            : ''
        }
        confirmLabel="Delete Shop"
        busy={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
