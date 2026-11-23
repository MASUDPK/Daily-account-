import React, { useMemo, useState } from 'react';
import { buildMonthlyFinancialSeries } from '../../lib/calculations';
import { formatBDT } from '../../lib/format';
import { CashTransaction, Expense, Payment, Purchase } from '../../types/accounting';

interface DashboardChartsProps {
  purchases: Purchase[];
  payments: Payment[];
  expenses: Expense[];
  cashTransactions: CashTransaction[];
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  purchases,
  payments,
  expenses,
  cashTransactions,
}) => {
  const series = useMemo(
    () => buildMonthlyFinancialSeries(purchases, payments, expenses, cashTransactions, 6),
    [purchases, payments, expenses, cashTransactions]
  );

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('');

  const activePoint = useMemo(() => {
    if (series.length === 0) return null;
    return series.find((p) => p.monthKey === selectedMonthKey) || series[series.length - 1];
  }, [series, selectedMonthKey]);

  const opsMax = useMemo(() => {
    let max = 0;
    for (const p of series) {
      if (p.purchase > max) max = p.purchase;
      if (p.payment > max) max = p.payment;
      if (p.expense > max) max = p.expense;
    }
    return max;
  }, [series]);

  const cashFlowMax = useMemo(() => {
    let max = 0;
    for (const p of series) {
      if (p.cashIn > max) max = p.cashIn;
      if (p.cashOut > max) max = p.cashOut;
    }
    return max;
  }, [series]);

  const getBarPercent = (value: number, max: number) => {
    if (max <= 0 || value <= 0) return 0;
    return Math.max(4, Math.min(100, Math.round((value / max) * 100)));
  };

  return (
    <section aria-label="Financial Charts" className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Chart 1: Monthly Purchase, Payment & Expenses */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-[#0B1F3A]">
              Monthly Purchase, Payment &amp; Expenses
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              6-month operating comparison · Select a month to inspect BDT totals
            </p>
          </div>
          {activePoint && (
            <div className="text-xs font-medium text-[#0B1F3A] bg-slate-100 px-2.5 py-1 rounded-lg tabular-nums">
              {activePoint.label}
            </div>
          )}
        </div>

        {/* Selected Month Numeric Summary */}
        {activePoint && (
          <div className="mt-4 grid grid-cols-3 gap-2.5 pb-4 border-b border-slate-100">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#0B1F3A] shrink-0" />
                <span className="truncate">Monthly Purchase</span>
              </div>
              <div className="mt-1 text-xs sm:text-sm font-semibold text-[#0B1F3A] tabular-nums truncate">
                {formatBDT(activePoint.purchase)}
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#0F766E] shrink-0" />
                <span className="truncate">Monthly Payment</span>
              </div>
              <div className="mt-1 text-xs sm:text-sm font-semibold text-[#0F766E] tabular-nums truncate">
                {formatBDT(activePoint.payment)}
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#801828] shrink-0" />
                <span className="truncate">Monthly Expenses</span>
              </div>
              <div className="mt-1 text-xs sm:text-sm font-semibold text-[#801828] tabular-nums truncate">
                {formatBDT(activePoint.expense)}
              </div>
            </div>
          </div>
        )}

        {/* Grouped Column Visualization */}
        {opsMax === 0 ? (
          <div className="flex-1 min-h-[180px] flex flex-col items-center justify-center text-center py-6">
            <div className="text-sm font-medium text-[#0F172A]">No monthly activity yet</div>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Monthly purchase, supplier payment, and expense bars will render automatically once
              records are added.
            </p>
          </div>
        ) : (
          <div className="mt-4 flex-1 flex flex-col justify-end">
            <div className="relative h-44 flex items-end gap-2 sm:gap-3 pt-4 border-b border-slate-200">
              {/* Hairline horizontal guides */}
              <div className="pointer-events-none absolute inset-x-0 bottom-1/3 border-t border-dashed border-slate-100" />
              <div className="pointer-events-none absolute inset-x-0 bottom-2/3 border-t border-dashed border-slate-100" />
              <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-slate-100" />

              {series.map((point) => {
                const isSelected = activePoint?.monthKey === point.monthKey;
                return (
                  <button
                    key={point.monthKey}
                    type="button"
                    onClick={() => setSelectedMonthKey(point.monthKey)}
                    className={`group flex-1 h-full flex flex-col justify-end items-center px-1 rounded-t-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F294A] ${
                      isSelected ? 'bg-slate-50' : 'hover:bg-slate-50/70'
                    }`}
                    title={`${point.label}: Purchase ${formatBDT(point.purchase)} | Payment ${formatBDT(point.payment)} | Expense ${formatBDT(point.expense)}`}
                  >
                    <div className="w-full h-36 flex items-end justify-center gap-1 sm:gap-1.5">
                      <div
                        className="w-2.5 sm:w-3.5 rounded-t-sm bg-[#0B1F3A] transition-all duration-200"
                        style={{ height: `${getBarPercent(point.purchase, opsMax)}%` }}
                      />
                      <div
                        className="w-2.5 sm:w-3.5 rounded-t-sm bg-[#0F766E] transition-all duration-200"
                        style={{ height: `${getBarPercent(point.payment, opsMax)}%` }}
                      />
                      <div
                        className="w-2.5 sm:w-3.5 rounded-t-sm bg-[#801828] transition-all duration-200"
                        style={{ height: `${getBarPercent(point.expense, opsMax)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-6 gap-2 pt-2">
              {series.map((point) => {
                const isSelected = activePoint?.monthKey === point.monthKey;
                return (
                  <button
                    key={point.monthKey}
                    type="button"
                    onClick={() => setSelectedMonthKey(point.monthKey)}
                    className={`text-[11px] tabular-nums text-center truncate py-0.5 rounded ${
                      isSelected ? 'font-semibold text-[#0B1F3A]' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {point.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Chart 2: Cash Flow (Inflow vs Outflow & Net Flow) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-[#0B1F3A]">Cash Flow</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Monthly liquid cash, bank &amp; MFS inflow vs. outflow (transfers excluded)
            </p>
          </div>
          {activePoint && (
            <div className="text-xs font-medium text-[#0B1F3A] bg-slate-100 px-2.5 py-1 rounded-lg tabular-nums">
              {activePoint.label}
            </div>
          )}
        </div>

        {/* Selected Month Cash Flow Summary */}
        {activePoint && (
          <div className="mt-4 grid grid-cols-3 gap-2.5 pb-4 border-b border-slate-100">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#0F766E] shrink-0" />
                <span className="truncate">Cash Inflow</span>
              </div>
              <div className="mt-1 text-xs sm:text-sm font-semibold text-[#0F766E] tabular-nums truncate">
                {formatBDT(activePoint.cashIn)}
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#801828] shrink-0" />
                <span className="truncate">Cash Outflow</span>
              </div>
              <div className="mt-1 text-xs sm:text-sm font-semibold text-[#801828] tabular-nums truncate">
                {formatBDT(activePoint.cashOut)}
              </div>
            </div>

            <div className="min-w-0">
              <div className="text-[11px] font-medium text-slate-500 truncate">Net Cash Flow</div>
              <div
                className={`mt-1 text-xs sm:text-sm font-semibold tabular-nums truncate ${
                  activePoint.netCashFlow > 0
                    ? 'text-emerald-700'
                    : activePoint.netCashFlow < 0
                    ? 'text-[#801828]'
                    : 'text-[#0F172A]'
                }`}
              >
                {activePoint.netCashFlow > 0 ? '+' : ''}
                {formatBDT(activePoint.netCashFlow)}
              </div>
            </div>
          </div>
        )}

        {/* Cash Flow Column Visualization */}
        {cashFlowMax === 0 ? (
          <div className="flex-1 min-h-[180px] flex flex-col items-center justify-center text-center py-6">
            <div className="text-sm font-medium text-[#0F172A]">No cash flow recorded yet</div>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Cash inflows, supplier payments, and site expense outflows will appear here with zero
              double counting.
            </p>
          </div>
        ) : (
          <div className="mt-4 flex-1 flex flex-col justify-end">
            <div className="relative h-44 flex items-end gap-2 sm:gap-3 pt-4 border-b border-slate-200">
              <div className="pointer-events-none absolute inset-x-0 bottom-1/3 border-t border-dashed border-slate-100" />
              <div className="pointer-events-none absolute inset-x-0 bottom-2/3 border-t border-dashed border-slate-100" />
              <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-slate-100" />

              {series.map((point) => {
                const isSelected = activePoint?.monthKey === point.monthKey;
                return (
                  <button
                    key={point.monthKey}
                    type="button"
                    onClick={() => setSelectedMonthKey(point.monthKey)}
                    className={`group flex-1 h-full flex flex-col justify-end items-center px-1 rounded-t-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F294A] ${
                      isSelected ? 'bg-slate-50' : 'hover:bg-slate-50/70'
                    }`}
                    title={`${point.label}: Inflow ${formatBDT(point.cashIn)} | Outflow ${formatBDT(point.cashOut)} | Net ${formatBDT(point.netCashFlow)}`}
                  >
                    <div className="w-full h-36 flex items-end justify-center gap-1.5 sm:gap-2">
                      <div
                        className="w-3 sm:w-4.5 rounded-t-sm bg-[#0F766E] transition-all duration-200"
                        style={{ height: `${getBarPercent(point.cashIn, cashFlowMax)}%` }}
                      />
                      <div
                        className="w-3 sm:w-4.5 rounded-t-sm bg-[#801828] transition-all duration-200"
                        style={{ height: `${getBarPercent(point.cashOut, cashFlowMax)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-6 gap-2 pt-2">
              {series.map((point) => {
                const isSelected = activePoint?.monthKey === point.monthKey;
                return (
                  <button
                    key={point.monthKey}
                    type="button"
                    onClick={() => setSelectedMonthKey(point.monthKey)}
                    className={`text-[11px] tabular-nums text-center truncate py-0.5 rounded ${
                      isSelected ? 'font-semibold text-[#0B1F3A]' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {point.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
