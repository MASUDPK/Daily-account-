import React, { useMemo, useRef, useState } from 'react';
import { Download, FileDown, Printer, Upload } from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext';
import {
  buildCompleteTransactions,
  buildDailyCashLedger,
  buildShopLedger,
} from '../../lib/calculations';
import {
  DailyAccountBackup,
  downloadReportPDF,
  exportBackupJSON,
  exportToCSV,
  parseAndValidateBackupJSON,
} from '../../lib/exportUtils';
import {
  formatBDT,
  formatBDTAscii,
  formatDateDDMMYYYY,
  getCurrentMonthDhakaISO,
  getTodayDhakaISO,
  round2,
} from '../../lib/format';
import { AccordionItem } from '../ui/Accordion';
import { ConfirmModal } from '../ui/ConfirmModal';

type ReportType =
  | 'daily_purchase'
  | 'daily_payment'
  | 'daily_expense'
  | 'shop_ledger'
  | 'payable'
  | 'receivable'
  | 'cash_report'
  | 'monthly_summary'
  | 'datewise_transactions';

interface ReportsViewProps {
  initialAccordion?: 'report-preview' | 'backup-restore';
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  initialAccordion = 'report-preview',
}) => {
  const {
    siteSettings,
    shops,
    purchases,
    payments,
    expenses,
    cashTransactions,
    shopSummaries,
    totals,
    restoreBackup,
    notify,
  } = useAccounting();

  const [openAccordion, setOpenAccordion] = useState<string | null>(initialAccordion);
  const [reportType, setReportType] = useState<ReportType>('daily_purchase');
  const [fromDate, setFromDate] = useState(`${getCurrentMonthDhakaISO()}-01`);
  const [toDate, setToDate] = useState(getTodayDhakaISO());
  const [selectedShopId, setSelectedShopId] = useState(shops[0]?.id || '');

  // Restore backup state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingBackup, setPendingBackup] = useState<DailyAccountBackup | null>(null);
  const [restoring, setRestoring] = useState(false);

  const toggleAccordion = (id: string) => {
    setOpenAccordion((prev) => (prev === id ? null : id));
  };

  const inRange = (isoDate: string) => {
    if (!isoDate) return false;
    if (fromDate && isoDate < fromDate) return false;
    if (toDate && isoDate > toDate) return false;
    return true;
  };

  const dateRangeLabel = `${fromDate ? formatDateDDMMYYYY(fromDate) : 'Start'} to ${
    toDate ? formatDateDDMMYYYY(toDate) : 'Present'
  }`;

  const reportData = useMemo(() => {
    const activeShop = shops.find((s) => s.id === (selectedShopId || shops[0]?.id));

    switch (reportType) {
      case 'daily_purchase': {
        const list = purchases.filter((p) => inRange(p.date));
        const total = round2(list.reduce((s, p) => s + p.totalAmount, 0));
        return {
          title: 'Daily Purchase Report',
          headers: ['Date', 'Shop', 'Material', 'Category', 'Qty', 'Rate', 'Total'],
          displayRows: list.map((p) => [
            formatDateDDMMYYYY(p.date),
            p.shopName,
            p.materialName,
            p.category,
            `${p.quantity} ${p.unit}`,
            formatBDT(p.rate),
            formatBDT(p.totalAmount),
          ]),
          pdfRows: list.map((p) => [
            formatDateDDMMYYYY(p.date),
            p.shopName,
            p.materialName,
            p.category,
            `${p.quantity} ${p.unit}`,
            formatBDTAscii(p.rate),
            formatBDTAscii(p.totalAmount),
          ]),
          displayTotals: ['Total', '', '', '', `${list.length} items`, '', formatBDT(total)],
          pdfTotals: ['Total', '', '', '', `${list.length} items`, '', formatBDTAscii(total)],
          summaryPairs: [
            { label: 'Purchase Entries', value: String(list.length) },
            { label: 'Total Purchase Value', value: formatBDTAscii(total) },
          ],
        };
      }

      case 'daily_payment': {
        const list = payments.filter((p) => inRange(p.date));
        const total = round2(list.reduce((s, p) => s + p.amount, 0));
        return {
          title: 'Daily Payment Report',
          headers: ['Date', 'Shop', 'Method', 'Reference', 'Notes', 'Amount'],
          displayRows: list.map((p) => [
            formatDateDDMMYYYY(p.date),
            p.shopName,
            p.method,
            p.referenceNumber || '-',
            p.notes || '-',
            formatBDT(p.amount),
          ]),
          pdfRows: list.map((p) => [
            formatDateDDMMYYYY(p.date),
            p.shopName,
            p.method,
            p.referenceNumber || '-',
            p.notes || '-',
            formatBDTAscii(p.amount),
          ]),
          displayTotals: ['Total', '', '', '', `${list.length} payments`, formatBDT(total)],
          pdfTotals: ['Total', '', '', '', `${list.length} payments`, formatBDTAscii(total)],
          summaryPairs: [
            { label: 'Payments Count', value: String(list.length) },
            { label: 'Total Disbursed', value: formatBDTAscii(total) },
          ],
        };
      }

      case 'daily_expense': {
        const list = expenses.filter((e) => inRange(e.date));
        const total = round2(list.reduce((s, e) => s + e.amount, 0));
        return {
          title: 'Daily Expense Report',
          headers: ['Date', 'Category', 'Description', 'Method', 'Notes', 'Amount'],
          displayRows: list.map((e) => [
            formatDateDDMMYYYY(e.date),
            e.category,
            e.description,
            e.method,
            e.notes || '-',
            formatBDT(e.amount),
          ]),
          pdfRows: list.map((e) => [
            formatDateDDMMYYYY(e.date),
            e.category,
            e.description,
            e.method,
            e.notes || '-',
            formatBDTAscii(e.amount),
          ]),
          displayTotals: ['Total', '', '', '', `${list.length} expenses`, formatBDT(total)],
          pdfTotals: ['Total', '', '', '', `${list.length} expenses`, formatBDTAscii(total)],
          summaryPairs: [
            { label: 'Expense Count', value: String(list.length) },
            { label: 'Total Site Expenses', value: formatBDTAscii(total) },
          ],
        };
      }

      case 'shop_ledger': {
        if (!activeShop) {
          return {
            title: 'Shop-wise Ledger',
            headers: ['Date', 'Particulars', 'Purchase', 'Payment', 'Balance'],
            displayRows: [],
            pdfRows: [],
            displayTotals: undefined,
            pdfTotals: undefined,
            summaryPairs: [],
          };
        }
        const entries = buildShopLedger(activeShop, purchases, payments).filter(
          (e) => e.type === 'opening' || inRange(e.date)
        );
        const totalP = round2(entries.reduce((s, e) => s + e.purchaseDebit, 0));
        const totalPay = round2(entries.reduce((s, e) => s + e.paymentCredit, 0));
        const shopSum = shopSummaries.find((s) => s.shop.id === activeShop.id);
        return {
          title: `Shop Ledger — ${activeShop.shopName}`,
          headers: ['Date', 'Particulars', 'Details', 'Purchase', 'Payment', 'Balance'],
          displayRows: entries.map((e) => [
            e.type === 'opening' ? 'Opening' : formatDateDDMMYYYY(e.date),
            e.title,
            e.subtitle,
            e.purchaseDebit > 0 ? formatBDT(e.purchaseDebit) : '-',
            e.paymentCredit > 0 ? formatBDT(e.paymentCredit) : '-',
            e.runningBalance >= 0
              ? `${formatBDT(e.runningBalance)} Due`
              : `${formatBDT(Math.abs(e.runningBalance))} Adv`,
          ]),
          pdfRows: entries.map((e) => [
            e.type === 'opening' ? 'Opening' : formatDateDDMMYYYY(e.date),
            e.title,
            e.subtitle,
            e.purchaseDebit > 0 ? formatBDTAscii(e.purchaseDebit) : '-',
            e.paymentCredit > 0 ? formatBDTAscii(e.paymentCredit) : '-',
            e.runningBalance >= 0
              ? `${formatBDTAscii(e.runningBalance)} Due`
              : `${formatBDTAscii(Math.abs(e.runningBalance))} Adv`,
          ]),
          displayTotals: ['Period Totals', '', '', formatBDT(totalP), formatBDT(totalPay), ''],
          pdfTotals: ['Period Totals', '', '', formatBDTAscii(totalP), formatBDTAscii(totalPay), ''],
          summaryPairs: [
            { label: 'All-Time Due', value: formatBDTAscii(shopSum?.currentDue || 0) },
            { label: 'All-Time Advance', value: formatBDTAscii(shopSum?.advanceAmount || 0) },
          ],
        };
      }

      case 'payable': {
        const list = shopSummaries.filter((s) => s.currentDue > 0);
        const totalDue = round2(list.reduce((s, x) => s + x.currentDue, 0));
        return {
          title: 'Total Payable Report',
          headers: ['Shop Name', 'Phone', 'Total Purchase', 'Total Paid', 'Current Due'],
          displayRows: list.map((s) => [
            s.shop.shopName,
            s.shop.phone || '-',
            formatBDT(s.totalPurchase),
            formatBDT(s.totalPaid),
            formatBDT(s.currentDue),
          ]),
          pdfRows: list.map((s) => [
            s.shop.shopName,
            s.shop.phone || '-',
            formatBDTAscii(s.totalPurchase),
            formatBDTAscii(s.totalPaid),
            formatBDTAscii(s.currentDue),
          ]),
          displayTotals: ['Total Payable', `${list.length} shops`, '', '', formatBDT(totalDue)],
          pdfTotals: ['Total Payable', `${list.length} shops`, '', '', formatBDTAscii(totalDue)],
          summaryPairs: [{ label: 'Total Payable', value: formatBDTAscii(totalDue) }],
        };
      }

      case 'receivable': {
        const list = shopSummaries.filter((s) => s.advanceAmount > 0);
        const totalAdv = round2(list.reduce((s, x) => s + x.advanceAmount, 0));
        return {
          title: 'Total Receivable Report',
          headers: ['Shop Name', 'Phone', 'Total Purchase', 'Total Paid', 'Advance Receivable'],
          displayRows: list.map((s) => [
            s.shop.shopName,
            s.shop.phone || '-',
            formatBDT(s.totalPurchase),
            formatBDT(s.totalPaid),
            formatBDT(s.advanceAmount),
          ]),
          pdfRows: list.map((s) => [
            s.shop.shopName,
            s.shop.phone || '-',
            formatBDTAscii(s.totalPurchase),
            formatBDTAscii(s.totalPaid),
            formatBDTAscii(s.advanceAmount),
          ]),
          displayTotals: ['Total Receivable', `${list.length} shops`, '', '', formatBDT(totalAdv)],
          pdfTotals: ['Total Receivable', `${list.length} shops`, '', '', formatBDTAscii(totalAdv)],
          summaryPairs: [{ label: 'Total Receivable', value: formatBDTAscii(totalAdv) }],
        };
      }

      case 'cash_report': {
        const entries = buildDailyCashLedger(
          siteSettings,
          payments,
          expenses,
          cashTransactions
        ).filter((e) => e.type === 'opening' || inRange(e.date));
        const totalIn = round2(entries.reduce((s, e) => s + e.inflow, 0));
        const totalOut = round2(entries.reduce((s, e) => s + e.outflow, 0));
        return {
          title: 'Cash & Bank Report',
          headers: ['Date', 'Account', 'Description', 'Inflow', 'Outflow', 'Balance'],
          displayRows: entries.map((e) => [
            e.type === 'opening' ? 'Opening' : formatDateDDMMYYYY(e.date),
            e.accountLabel,
            e.description,
            e.inflow > 0 ? formatBDT(e.inflow) : '-',
            e.outflow > 0 ? formatBDT(e.outflow) : '-',
            formatBDT(e.runningLiquidBalance),
          ]),
          pdfRows: entries.map((e) => [
            e.type === 'opening' ? 'Opening' : formatDateDDMMYYYY(e.date),
            e.accountLabel,
            e.description,
            e.inflow > 0 ? formatBDTAscii(e.inflow) : '-',
            e.outflow > 0 ? formatBDTAscii(e.outflow) : '-',
            formatBDTAscii(e.runningLiquidBalance),
          ]),
          displayTotals: ['Period Totals', '', '', formatBDT(totalIn), formatBDT(totalOut), ''],
          pdfTotals: ['Period Totals', '', '', formatBDTAscii(totalIn), formatBDTAscii(totalOut), ''],
          summaryPairs: [
            { label: 'Cash in Hand', value: formatBDTAscii(totals.cashBalance) },
            { label: 'Bank Balance', value: formatBDTAscii(totals.bankBalance) },
            { label: 'Mobile Banking', value: formatBDTAscii(totals.mobileBalance) },
          ],
        };
      }

      case 'monthly_summary': {
        const months = new Set<string>();
        purchases.forEach((p) => months.add(p.date.slice(0, 7)));
        payments.forEach((p) => months.add(p.date.slice(0, 7)));
        expenses.forEach((e) => months.add(e.date.slice(0, 7)));
        cashTransactions.forEach((c) => months.add(c.date.slice(0, 7)));
        const sortedMonths = Array.from(months).sort().reverse();

        const rowsData = sortedMonths.map((m) => {
          const mp = round2(purchases.filter((x) => x.date.startsWith(m)).reduce((s, x) => s + x.totalAmount, 0));
          const mpay = round2(payments.filter((x) => x.date.startsWith(m)).reduce((s, x) => s + x.amount, 0));
          const mexp = round2(expenses.filter((x) => x.date.startsWith(m)).reduce((s, x) => s + x.amount, 0));
          const mcash = round2(cashTransactions.filter((x) => x.date.startsWith(m) && x.type === 'cash_in').reduce((s, x) => s + x.amount, 0));
          return { m, mp, mpay, mexp, mcash };
        });

        return {
          title: 'Monthly Financial Summary',
          headers: ['Month', 'Purchases', 'Supplier Payments', 'Site Expenses', 'Cash Inflow'],
          displayRows: rowsData.map((r) => [
            r.m,
            formatBDT(r.mp),
            formatBDT(r.mpay),
            formatBDT(r.mexp),
            formatBDT(r.mcash),
          ]),
          pdfRows: rowsData.map((r) => [
            r.m,
            formatBDTAscii(r.mp),
            formatBDTAscii(r.mpay),
            formatBDTAscii(r.mexp),
            formatBDTAscii(r.mcash),
          ]),
          displayTotals: [
            'All-Time Totals',
            formatBDT(totals.totalPurchase),
            formatBDT(totals.totalPaid),
            formatBDT(totals.totalExpenses),
            formatBDT(totals.totalCashIn),
          ],
          pdfTotals: [
            'All-Time Totals',
            formatBDTAscii(totals.totalPurchase),
            formatBDTAscii(totals.totalPaid),
            formatBDTAscii(totals.totalExpenses),
            formatBDTAscii(totals.totalCashIn),
          ],
          summaryPairs: [
            { label: 'Total Purchases', value: formatBDTAscii(totals.totalPurchase) },
            { label: 'Total Expenses', value: formatBDTAscii(totals.totalExpenses) },
            { label: 'Available Liquid', value: formatBDTAscii(totals.totalLiquidBalance) },
          ],
        };
      }

      case 'datewise_transactions':
      default: {
        const list = buildCompleteTransactions(
          siteSettings,
          purchases,
          payments,
          expenses,
          cashTransactions
        ).filter((tx) => inRange(tx.date));
        const totalDebit = round2(list.reduce((s, x) => s + x.debit, 0));
        const totalCredit = round2(list.reduce((s, x) => s + x.credit, 0));
        return {
          title: 'Date-wise Transaction Report',
          headers: ['Date', 'Type', 'Shop / Party', 'Description', 'Debit', 'Credit', 'Balance'],
          displayRows: list.map((tx) => [
            formatDateDDMMYYYY(tx.date),
            tx.sourceType,
            tx.shopOrParty,
            tx.description,
            tx.debit > 0 ? formatBDT(tx.debit) : '-',
            tx.credit > 0 ? formatBDT(tx.credit) : '-',
            formatBDT(tx.runningCashBalance || 0),
          ]),
          pdfRows: list.map((tx) => [
            formatDateDDMMYYYY(tx.date),
            tx.sourceType,
            tx.shopOrParty,
            tx.description,
            tx.debit > 0 ? formatBDTAscii(tx.debit) : '-',
            tx.credit > 0 ? formatBDTAscii(tx.credit) : '-',
            formatBDTAscii(tx.runningCashBalance || 0),
          ]),
          displayTotals: ['Totals', '', '', `${list.length} tx`, formatBDT(totalDebit), formatBDT(totalCredit), ''],
          pdfTotals: ['Totals', '', '', `${list.length} tx`, formatBDTAscii(totalDebit), formatBDTAscii(totalCredit), ''],
          summaryPairs: [
            { label: 'Transactions', value: String(list.length) },
            { label: 'Total Outflow/Debit', value: formatBDTAscii(totalDebit) },
          ],
        };
      }
    }
  }, [
    reportType,
    fromDate,
    toDate,
    selectedShopId,
    shops,
    purchases,
    payments,
    expenses,
    cashTransactions,
    shopSummaries,
    siteSettings,
    totals,
  ]);

  const handleDownloadPDF = () => {
    downloadReportPDF({
      title: reportData.title,
      siteName: siteSettings?.siteName || 'Main Construction Site',
      dateRangeLabel,
      headers: reportData.headers,
      rows: reportData.pdfRows,
      totalsRow: reportData.pdfTotals,
      summaryPairs: reportData.summaryPairs,
      fileName: `daily-account-${reportType}-${getTodayDhakaISO()}`,
    });
  };

  const handleDownloadCSV = () => {
    exportToCSV(
      reportData.headers,
      reportData.pdfTotals ? [...reportData.pdfRows, reportData.pdfTotals] : reportData.pdfRows,
      `daily-account-${reportType}-${getTodayDhakaISO()}`
    );
  };

  const handleExportBackup = () => {
    exportBackupJSON({
      siteSettings,
      shops,
      purchases,
      payments,
      expenses,
      cashTransactions,
    });
    notify('success', 'Full JSON backup exported.');
  };

  const handleBackupFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseAndValidateBackupJSON(text);
      setPendingBackup(parsed);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Invalid backup file.');
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingBackup) return;
    setRestoring(true);
    try {
      await restoreBackup(pendingBackup);
      setPendingBackup(null);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Restore failed.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="no-print">
        <h2 className="text-lg font-semibold tracking-[-0.015em] text-[#0B1F3A]">Reports, PDF Export &amp; Backup</h2>
        <p className="text-xs text-slate-500">
          Generate BDT financial reports, download PDFs, print statements, or manage JSON backups.
        </p>
      </div>

      <div className="space-y-3">
        <AccordionItem
          id="report-preview"
          title={`Report: ${reportData.title}`}
          subtitle={`Date range: ${dateRangeLabel} · Currency: BDT (৳)`}
          isOpen={openAccordion === 'report-preview'}
          onToggle={toggleAccordion}
        >
          {/* Controls */}
          <div className="no-print space-y-3 mb-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Report Type</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as ReportType)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                >
                  <option value="daily_purchase">Daily Purchase Report</option>
                  <option value="daily_payment">Daily Payment Report</option>
                  <option value="daily_expense">Daily Expense Report</option>
                  <option value="shop_ledger">Shop-wise Ledger</option>
                  <option value="payable">Total Payable Report</option>
                  <option value="receivable">Total Receivable Report</option>
                  <option value="cash_report">Cash Report</option>
                  <option value="monthly_summary">Monthly Financial Summary</option>
                  <option value="datewise_transactions">Date-wise Transaction Report</option>
                </select>
              </div>

              {reportType === 'shop_ledger' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Select Shop</label>
                  <select
                    value={selectedShopId}
                    onChange={(e) => setSelectedShopId(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                  >
                    {shops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.shopName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const t = getTodayDhakaISO();
                    setFromDate(t);
                    setToDate(t);
                  }}
                  className="min-h-[36px] px-3 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFromDate(`${getCurrentMonthDhakaISO()}-01`);
                    setToDate(getTodayDhakaISO());
                  }}
                  className="min-h-[36px] px-3 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFromDate('');
                    setToDate('');
                  }}
                  className="min-h-[36px] px-3 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  All Time
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0B1F3A] hover:bg-[#163864] text-white text-xs sm:text-sm font-medium flex items-center gap-1.5"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-medium flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCSV}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-medium flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Printable / Preview Sheet */}
          <div className="print-only-full border border-slate-200 rounded-xl overflow-hidden bg-white">
            <div className="bg-[#0B1F3A] text-white px-5 py-4 border-b-2 border-[#801828] flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-base font-bold tracking-tight">Daily Account</div>
                <div className="text-xs text-slate-300">
                  {siteSettings?.siteName || 'Main Construction Site'} · BDT (৳)
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{reportData.title}</div>
                <div className="text-xs text-slate-300">{dateRangeLabel}</div>
              </div>
            </div>

            {reportData.displayRows.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No records found for this report and date range.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-600">
                      {reportData.headers.map((h) => (
                        <th key={h} className="py-2.5 px-3 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                    {reportData.displayRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/70">
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className="py-2.5 px-3 tabular-nums text-[#0F172A] whitespace-nowrap"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  {reportData.displayTotals && (
                    <tfoot>
                      <tr className="bg-slate-100/80 border-t border-slate-300 text-xs sm:text-sm font-semibold text-[#0B1F3A]">
                        {reportData.displayTotals.map((cell, cIdx) => (
                          <td key={cIdx} className="py-2.5 px-3 tabular-nums whitespace-nowrap">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </AccordionItem>

        <AccordionItem
          id="backup-restore"
          title="JSON Backup & Restore"
          subtitle="Export complete site ledger to JSON or safely restore non-duplicate records"
          isOpen={openAccordion === 'backup-restore'}
          onToggle={toggleAccordion}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-[#0F172A]">Export Backup JSON</h3>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Downloads a complete snapshot of your site settings, shops, purchases, payments,
                  expenses, and cash transactions in BDT.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportBackup}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1F3A] hover:bg-[#163864] text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export Backup JSON</span>
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-[#0F172A]">Restore Backup JSON</h3>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Safely restores missing records from a DAILY ACCOUNT backup file into Cloud
                  Firestore without overwriting or deleting existing records.
                </p>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleBackupFileSelected}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-[#0F172A] text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  <span>Select Backup JSON File</span>
                </button>
              </div>
            </div>
          </div>
        </AccordionItem>
      </div>

      <ConfirmModal
        open={!!pendingBackup}
        title="Confirm Safe Backup Restore"
        variant="primary"
        message={
          pendingBackup
            ? `Ready to restore backup exported on ${pendingBackup.exportedAtIso.slice(
                0,
                10
              )} (${pendingBackup.shops.length} shops, ${
                pendingBackup.purchases.length
              } purchases, ${pendingBackup.payments.length} payments, ${
                pendingBackup.expenses.length
              } expenses, ${
                pendingBackup.cashTransactions.length
              } cash entries). Existing records will NOT be overwritten or deleted.`
            : ''
        }
        confirmLabel="Restore Records"
        busy={restoring}
        onConfirm={handleConfirmRestore}
        onCancel={() => setPendingBackup(null)}
      />
    </div>
  );
};
