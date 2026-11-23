import React, { useEffect, useMemo, useState } from 'react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext';
import { buildDailyCashLedger } from '../../lib/calculations';
import { formatBDT, formatDateDDMMYYYY, round2 } from '../../lib/format';
import { CashTransaction } from '../../types/accounting';
import { AccordionItem } from '../ui/Accordion';
import { ConfirmModal } from '../ui/ConfirmModal';
import { CashTxForm } from '../forms/CashTxForm';

export const CashBankView: React.FC = () => {
  const {
    siteSettings,
    payments,
    expenses,
    cashTransactions,
    totals,
    saveSiteSettings,
    deleteCashTransaction,
    notify,
  } = useAccounting();

  const [openAccordion, setOpenAccordion] = useState<string | null>('cash-ledger');
  const [editingTx, setEditingTx] = useState<CashTransaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CashTransaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Opening balances & site form
  const [siteName, setSiteName] = useState(siteSettings?.siteName || 'Main Construction Site');
  const [siteLocation, setSiteLocation] = useState(siteSettings?.siteLocation || '');
  const [openingCash, setOpeningCash] = useState(
    siteSettings ? String(siteSettings.openingCash) : '0'
  );
  const [openingBank, setOpeningBank] = useState(
    siteSettings ? String(siteSettings.openingBank) : '0'
  );
  const [openingMobile, setOpeningMobile] = useState(
    siteSettings ? String(siteSettings.openingMobile) : '0'
  );
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (siteSettings) {
      setSiteName(siteSettings.siteName);
      setSiteLocation(siteSettings.siteLocation);
      setOpeningCash(String(siteSettings.openingCash));
      setOpeningBank(String(siteSettings.openingBank));
      setOpeningMobile(String(siteSettings.openingMobile));
    }
  }, [siteSettings]);

  const toggleAccordion = (id: string) => {
    setOpenAccordion((prev) => (prev === id ? null : id));
  };

  const cashLedger = useMemo(
    () => buildDailyCashLedger(siteSettings, payments, expenses, cashTransactions),
    [siteSettings, payments, expenses, cashTransactions]
  );

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await saveSiteSettings({
        siteName,
        siteLocation,
        openingCash: Math.max(0, round2(Number(openingCash) || 0)),
        openingBank: Math.max(0, round2(Number(openingBank) || 0)),
        openingMobile: Math.max(0, round2(Number(openingMobile) || 0)),
      });
      setOpenAccordion('cash-ledger');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to save opening balances.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCashTransaction(deleteTarget);
      setDeleteTarget(null);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to delete cash entry.');
    } finally {
      setDeleting(false);
    }
  };

  const txMap = useMemo(() => {
    const m = new Map<string, CashTransaction>();
    for (const c of cashTransactions) m.set(c.id, c);
    return m;
  }, [cashTransactions]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.015em] text-[#0B1F3A]">Cash &amp; Bank Management</h2>
          <p className="text-xs text-slate-500">
            Track Cash in Hand, Bank, Mobile Banking balances, transfers, and daily cash flow.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingTx(null);
            setOpenAccordion('cash-entry');
          }}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1F3A] hover:bg-[#163864] text-white text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Cash In / Out / Transfer</span>
        </button>
      </div>

      {/* Liquid Balance Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Cash in Hand</div>
          <div
            className={`mt-1.5 text-lg sm:text-[21px] font-semibold tracking-[-0.02em] leading-snug tabular-nums ${
              totals.cashBalance < 0 ? 'text-[#801828]' : 'text-[#0B1F3A]'
            }`}
          >
            {formatBDT(totals.cashBalance)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Bank Balance</div>
          <div
            className={`mt-1.5 text-lg sm:text-[21px] font-semibold tracking-[-0.02em] leading-snug tabular-nums ${
              totals.bankBalance < 0 ? 'text-[#801828]' : 'text-[#0B1F3A]'
            }`}
          >
            {formatBDT(totals.bankBalance)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Mobile Banking (MFS)</div>
          <div
            className={`mt-1.5 text-lg sm:text-[21px] font-semibold tracking-[-0.02em] leading-snug tabular-nums ${
              totals.mobileBalance < 0 ? 'text-[#801828]' : 'text-[#0B1F3A]'
            }`}
          >
            {formatBDT(totals.mobileBalance)}
          </div>
        </div>
        <div className="bg-[#0B1F3A] border border-[#0B1F3A] rounded-xl p-4 shadow-2xs">
          <div className="text-xs text-slate-300 font-medium">Total Available Balance</div>
          <div
            className={`mt-1.5 text-lg sm:text-[21px] font-semibold tracking-[-0.02em] leading-snug tabular-nums ${
              totals.totalLiquidBalance < 0 ? 'text-[#FCA5A5]' : 'text-white'
            }`}
          >
            {formatBDT(totals.totalLiquidBalance)}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <AccordionItem
          id="opening-balances"
          title="Opening Cash, Bank & Site Profile"
          subtitle="Configure your single construction site name and initial opening balances"
          rightSummary={`Opening: ${formatBDT(
            (siteSettings?.openingCash || 0) +
              (siteSettings?.openingBank || 0) +
              (siteSettings?.openingMobile || 0)
          )}`}
          isOpen={openAccordion === 'opening-balances'}
          onToggle={toggleAccordion}
        >
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Construction Site Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Site Location
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={siteLocation}
                  onChange={(e) => setSiteLocation(e.target.value)}
                  placeholder="e.g. Uttara Sector 12, Dhaka"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Opening Cash (BDT ৳)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Opening Bank (BDT ৳)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={openingBank}
                  onChange={(e) => setOpeningBank(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Opening Mobile Banking (BDT ৳)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={openingMobile}
                  onChange={(e) => setOpeningMobile(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0B1F3A] hover:bg-[#163864] text-white text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {savingSettings ? 'Saving...' : 'Save Site & Opening Balances'}
              </button>
            </div>
          </form>
        </AccordionItem>

        <AccordionItem
          id="cash-entry"
          title={editingTx ? `Edit Entry: ${editingTx.description}` : 'Cash In, Cash Out & Transfer'}
          subtitle="Record funds received, withdrawals, or transfers between Cash, Bank & Mobile Banking"
          isOpen={openAccordion === 'cash-entry'}
          onToggle={toggleAccordion}
        >
          <CashTxForm
            key={editingTx?.id || 'new'}
            existingTx={editingTx || undefined}
            onSuccess={() => {
              setEditingTx(null);
              setOpenAccordion('cash-ledger');
            }}
            onCancel={
              editingTx
                ? () => {
                    setEditingTx(null);
                    setOpenAccordion('cash-ledger');
                  }
                : undefined
            }
          />
        </AccordionItem>

        <AccordionItem
          id="cash-ledger"
          title="Daily Cash Ledger"
          subtitle="Unified cash flow across deposits, supplier payments, site expenses, and transfers"
          rightSummary={`Available: ${formatBDT(totals.totalLiquidBalance)}`}
          isOpen={openAccordion === 'cash-ledger'}
          onToggle={toggleAccordion}
        >
          <div className="mb-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <span className="text-slate-500">Total Cash &amp; Opening In</span>
              <div className="mt-1 text-sm font-semibold tabular-nums text-emerald-700">
                {formatBDT(totals.totalCashIn)}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <span className="text-slate-500">Total Liquid Outflow</span>
              <div className="mt-1 text-sm font-semibold tabular-nums text-[#801828]">
                {formatBDT(totals.totalCashOut)}
              </div>
            </div>
            {totals.otherOutflows > 0 && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 col-span-2 sm:col-span-1">
                <span className="text-slate-500">Paid via Method &quot;Other&quot;</span>
                <div className="mt-1 text-sm font-semibold tabular-nums text-slate-700">
                  {formatBDT(totals.otherOutflows)}
                </div>
              </div>
            )}
          </div>

          {cashLedger.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No cash transactions recorded yet.
            </div>
          ) : (
            <>
              <div className="md:hidden divide-y divide-slate-100">
                {cashLedger.map((entry) => {
                  const rawCash = txMap.get(entry.id);
                  return (
                    <div key={entry.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#0F172A] truncate">
                          {entry.description}
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">{entry.accountLabel}</div>
                        <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
                          {entry.type === 'opening' ? 'Opening' : formatDateDDMMYYYY(entry.date)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {entry.inflow > 0 && (
                          <div className="text-sm font-semibold tabular-nums text-emerald-700">
                            +{formatBDT(entry.inflow)}
                          </div>
                        )}
                        {entry.outflow > 0 && (
                          <div className="text-sm font-semibold tabular-nums text-[#801828]">
                            -{formatBDT(entry.outflow)}
                          </div>
                        )}
                        {entry.type === 'transfer' && (
                          <div className="text-xs font-medium text-[#0F294A]">Internal Transfer</div>
                        )}
                        <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                          Bal: {formatBDT(entry.runningLiquidBalance)}
                        </div>
                        {rawCash && (
                          <div className="mt-1 flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTx(rawCash);
                                setOpenAccordion('cash-entry');
                              }}
                              aria-label="Edit cash entry"
                              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-[#0B1F3A] hover:bg-slate-100"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(rawCash)}
                              aria-label="Delete cash entry"
                              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-[#801828] hover:bg-[#FDF2F4]"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
                      <th className="py-2.5 pr-3">Date</th>
                      <th className="py-2.5 px-3">Account</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-right">Cash In (+)</th>
                      <th className="py-2.5 px-3 text-right">Cash Out (-)</th>
                      <th className="py-2.5 px-3 text-right">Liquid Balance</th>
                      <th className="py-2.5 pl-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {cashLedger.map((entry) => {
                      const rawCash = txMap.get(entry.id);
                      return (
                        <tr key={entry.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 pr-3 tabular-nums text-xs text-slate-600 whitespace-nowrap">
                            {entry.type === 'opening'
                              ? 'Opening'
                              : formatDateDDMMYYYY(entry.date)}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-[#0F172A] whitespace-nowrap">
                            {entry.accountLabel}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{entry.description}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700 whitespace-nowrap">
                            {entry.inflow > 0 ? formatBDT(entry.inflow) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-[#801828] whitespace-nowrap">
                            {entry.outflow > 0 ? formatBDT(entry.outflow) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-[#0F172A] whitespace-nowrap">
                            {formatBDT(entry.runningLiquidBalance)}
                          </td>
                          <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                            {rawCash ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingTx(rawCash);
                                    setOpenAccordion('cash-entry');
                                  }}
                                  aria-label="Edit cash entry"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-[#0B1F3A] hover:bg-slate-100"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(rawCash)}
                                  aria-label="Delete cash entry"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-[#801828] hover:bg-[#FDF2F4] ml-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-slate-400">Linked</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </AccordionItem>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Confirm Cash Entry Deletion"
        message={
          deleteTarget
            ? `Delete cash entry "${deleteTarget.description}" (${formatBDT(
                deleteTarget.amount
              )})? Your cash/bank balances will recalculate automatically.`
            : ''
        }
        confirmLabel="Delete Entry"
        busy={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
