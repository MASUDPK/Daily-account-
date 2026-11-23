import React, { useMemo, useState } from 'react';
import { useAccounting } from '../../context/AccountingContext';
import { formatBDT } from '../../lib/format';
import { AccordionItem } from '../ui/Accordion';
import { PaymentForm } from '../forms/PaymentForm';

export const DuesReceivableView: React.FC = () => {
  const { shopSummaries, totals } = useAccounting();
  const [openAccordion, setOpenAccordion] = useState<string | null>('payables');
  const [payShopId, setPayShopId] = useState<string | null>(null);

  const toggleAccordion = (id: string) => {
    setOpenAccordion((prev) => (prev === id ? null : id));
  };

  const payables = useMemo(
    () =>
      shopSummaries
        .filter((s) => s.currentDue > 0)
        .sort((a, b) => b.currentDue - a.currentDue),
    [shopSummaries]
  );

  const receivables = useMemo(
    () =>
      shopSummaries
        .filter((s) => s.advanceAmount > 0)
        .sort((a, b) => b.advanceAmount - a.advanceAmount),
    [shopSummaries]
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.015em] text-[#0B1F3A]">Due &amp; Receivable Management</h2>
        <p className="text-xs text-slate-500">
          Live payable obligations owed to suppliers and recoverable advance balances.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs font-medium text-slate-500">Total Payable (Owed to Suppliers)</div>
          <div
            className={`mt-1.5 text-xl font-semibold tracking-[-0.02em] tabular-nums ${
              totals.totalDue > 0 ? 'text-[#801828]' : 'text-[#0B1F3A]'
            }`}
          >
            {formatBDT(totals.totalDue)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Across {payables.length} supplier{payables.length === 1 ? '' : 's'}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs font-medium text-slate-500">Total Receivable (Advance Paid)</div>
          <div className="mt-1.5 text-xl font-semibold tracking-[-0.02em] tabular-nums text-[#0F294A]">
            {formatBDT(totals.totalReceivable)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Across {receivables.length} supplier{receivables.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <AccordionItem
          id="payables"
          title="A. Payable — Money Owed to Shops & Suppliers"
          subtitle="Automatically calculated from purchases + opening payable minus payments"
          rightSummary={formatBDT(totals.totalDue)}
          isOpen={openAccordion === 'payables'}
          onToggle={toggleAccordion}
        >
          {payables.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Zero outstanding supplier dues. All payable balances are settled.
            </div>
          ) : (
            <>
              <div className="md:hidden divide-y divide-slate-100">
                {payables.map((s) => (
                  <div key={s.shop.id} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-[#0F172A]">{s.shop.shopName}</div>
                        <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                          Purchased {formatBDT(s.totalPurchase)} · Paid {formatBDT(s.totalPaid)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold tabular-nums text-[#801828]">
                          {formatBDT(s.currentDue)}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPayShopId(s.shop.id);
                            setOpenAccordion('quick-settle');
                          }}
                          className="mt-1.5 min-h-[38px] px-3 py-1 rounded-lg bg-[#FDF2F4] text-[#801828] hover:bg-[#FCE4E8] text-xs font-medium transition-colors"
                        >
                          Pay Now
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
                      <th className="py-2.5 pr-3">Shop Name</th>
                      <th className="py-2.5 px-3 text-right">Total Purchase</th>
                      <th className="py-2.5 px-3 text-right">Total Paid</th>
                      <th className="py-2.5 px-3 text-right">Current Due</th>
                      <th className="py-2.5 pl-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {payables.map((s) => (
                      <tr key={s.shop.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 pr-3 font-medium text-[#0F172A]">{s.shop.shopName}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          {formatBDT(s.totalPurchase)}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700">
                          {formatBDT(s.totalPaid)}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-[#801828]">
                          {formatBDT(s.currentDue)}
                        </td>
                        <td className="py-2.5 pl-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setPayShopId(s.shop.id);
                              setOpenAccordion('quick-settle');
                            }}
                            className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#FDF2F4] text-[#801828] hover:bg-[#FCE4E8] text-xs font-medium transition-colors"
                          >
                            Record Payment
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
          id="receivables"
          title="B. Receivable — Advance Money Paid to Shops"
          subtitle="Recoverable advances where total payment exceeds total purchase"
          rightSummary={formatBDT(totals.totalReceivable)}
          isOpen={openAccordion === 'receivables'}
          onToggle={toggleAccordion}
        >
          {receivables.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No supplier advance receivables at this time.
            </div>
          ) : (
            <>
              <div className="md:hidden divide-y divide-slate-100">
                {receivables.map((s) => (
                  <div key={s.shop.id} className="py-3 flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-[#0F172A]">{s.shop.shopName}</div>
                      <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                        Purchased {formatBDT(s.totalPurchase)} · Paid {formatBDT(s.totalPaid)}
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-[#0F294A] shrink-0">
                      {formatBDT(s.advanceAmount)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
                      <th className="py-2.5 pr-3">Shop Name</th>
                      <th className="py-2.5 px-3 text-right">Total Purchase</th>
                      <th className="py-2.5 px-3 text-right">Total Paid</th>
                      <th className="py-2.5 pl-3 text-right">Advance Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {receivables.map((s) => (
                      <tr key={s.shop.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 pr-3 font-medium text-[#0F172A]">{s.shop.shopName}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          {formatBDT(s.totalPurchase)}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700">
                          {formatBDT(s.totalPaid)}
                        </td>
                        <td className="py-2.5 pl-3 text-right tabular-nums font-semibold text-[#0F294A]">
                          {formatBDT(s.advanceAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </AccordionItem>

        {payShopId && (
          <AccordionItem
            id="quick-settle"
            title="Settle Supplier Payable"
            subtitle="Record payment for selected shop"
            isOpen={openAccordion === 'quick-settle'}
            onToggle={toggleAccordion}
          >
            <PaymentForm
              key={payShopId}
              defaultShopId={payShopId}
              onSuccess={() => {
                setPayShopId(null);
                setOpenAccordion('payables');
              }}
              onCancel={() => {
                setPayShopId(null);
                setOpenAccordion('payables');
              }}
            />
          </AccordionItem>
        )}
      </div>
    </div>
  );
};
