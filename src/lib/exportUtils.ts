import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CashTransaction,
  Expense,
  Payment,
  Purchase,
  Shop,
  SiteSettings,
} from '../types/accounting';
import { formatDateTimeDhaka, getTodayDhakaISO } from './format';

export interface PdfReportOptions {
  title: string;
  siteName: string;
  dateRangeLabel: string;
  headers: string[];
  rows: (string | number)[][];
  totalsRow?: (string | number)[];
  summaryPairs?: { label: string; value: string }[];
  fileName: string;
}

export function downloadReportPDF(opts: PdfReportOptions): void {
  const doc = new jsPDF({
    orientation: opts.headers.length > 6 ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Banking Header Bar (Navy + controlled Maroon accent rule)
  doc.setFillColor(11, 31, 58); // Deep navy #0B1F3A
  doc.rect(0, 0, pageWidth, 72, 'F');
  doc.setFillColor(128, 24, 40); // Maroon #801828
  doc.rect(0, 72, pageWidth, 2.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Daily Account', 40, 32);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Construction Site Accounting · ${opts.siteName || 'Main Construction Site'}`, 40, 49);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(opts.title, pageWidth - 40, 32, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`Period: ${opts.dateRangeLabel}  |  Currency: BDT`, pageWidth - 40, 49, { align: 'right' });

  let cursorY = 94;

  // Optional KPI Summary Strip
  if (opts.summaryPairs && opts.summaryPairs.length > 0) {
    const colW = (pageWidth - 80) / opts.summaryPairs.length;
    opts.summaryPairs.forEach((pair, idx) => {
      const x = 40 + idx * colW;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, cursorY, colW - 8, 42, 4, 4, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(pair.label, x + 10, cursorY + 15);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(pair.value, x + 10, cursorY + 32);
    });
    cursorY += 58;
  }

  const bodyRows = [...opts.rows];
  if (opts.totalsRow) {
    bodyRows.push(opts.totalsRow);
  }

  autoTable(doc, {
    startY: cursorY,
    head: [opts.headers],
    body: bodyRows,
    margin: { left: 40, right: 40, bottom: 48 },
    theme: 'grid',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5,
      lineColor: [203, 213, 225],
      lineWidth: 0.5,
      cellPadding: 6,
    },
    bodyStyles: {
      textColor: [30, 41, 59],
      fontSize: 8.5,
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
      cellPadding: 5,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    didParseCell: (data) => {
      if (opts.totalsRow && data.section === 'body' && data.row.index === bodyRows.length - 1) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.textColor = [11, 31, 58];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages();
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Generated on ${formatDateTimeDhaka(Date.now())} (Asia/Dhaka) · DAILY ACCOUNT`,
        40,
        pageHeight - 24
      );
      doc.text(`Page ${doc.getCurrentPageInfo().pageNumber} of ${pageCount}`, pageWidth - 40, pageHeight - 24, {
        align: 'right',
      });
    },
  });

  doc.save(opts.fileName.endsWith('.pdf') ? opts.fileName : `${opts.fileName}.pdf`);
}

function escapeCSVCell(cell: string | number): string {
  const str = String(cell ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCSV(headers: string[], rows: (string | number)[][], fileName: string): void {
  const csvLines = [
    headers.map(escapeCSVCell).join(','),
    ...rows.map((row) => row.map(escapeCSVCell).join(',')),
  ];
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface DailyAccountBackup {
  app: 'DAILY ACCOUNT';
  version: number;
  exportedAtIso: string;
  currency: 'BDT';
  siteSettings: SiteSettings | null;
  shops: Shop[];
  purchases: Purchase[];
  payments: Payment[];
  expenses: Expense[];
  cashTransactions: CashTransaction[];
}

export function exportBackupJSON(backup: Omit<DailyAccountBackup, 'app' | 'version' | 'exportedAtIso' | 'currency'>): void {
  const payload: DailyAccountBackup = {
    app: 'DAILY ACCOUNT',
    version: 1,
    exportedAtIso: new Date().toISOString(),
    currency: 'BDT',
    ...backup,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `daily-account-backup-${getTodayDhakaISO()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseAndValidateBackupJSON(rawText: string): DailyAccountBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('Invalid JSON file. Please select a valid DAILY ACCOUNT backup JSON file.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Backup file must contain a JSON object.');
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.app !== 'DAILY ACCOUNT') {
    throw new Error('Unrecognized backup format. Missing DAILY ACCOUNT signature.');
  }
  if (
    !Array.isArray(obj.shops) ||
    !Array.isArray(obj.purchases) ||
    !Array.isArray(obj.payments) ||
    !Array.isArray(obj.expenses) ||
    !Array.isArray(obj.cashTransactions)
  ) {
    throw new Error('Backup JSON is missing required ledger arrays (shops, purchases, payments, expenses, cashTransactions).');
  }

  return obj as unknown as DailyAccountBackup;
}
