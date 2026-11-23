import React, { useEffect, useState } from 'react';
import { useAccounting } from '../../context/AccountingContext';
import { PAYMENT_METHODS, Payment, PaymentMethod } from '../../types/accounting';
import { formatBDT, generateId, getTodayDhakaISO, round2 } from '../../lib/format';

interface PaymentFormProps {
  existingPayment?: Payment;
  defaultShopId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  onNavigateToShops?: () => void;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  existingPayment,
  defaultShopId,
  onSuccess,
  onCancel,
  onNavigateToShops,
}) => {
  const { shops, shopSummaries, savePayment, notify } = useAccounting();

  const [date, setDate] = useState(existingPayment?.date || getTodayDhakaISO());
  const [shopId, setShopId] = useState(existingPayment?.shopId || defaultShopId || '');
  const [amount, setAmount] = useState(existingPayment ? String(existingPayment.amount) : '');
  const [method, setMethod] = useState<PaymentMethod>(existingPayment?.method || 'Cash');
  const [referenceNumber, setReferenceNumber] = useState(
    existingPayment?.referenceNumber || ''
  );
  const [notes, setNotes] = useState(existingPayment?.notes || '');
  const [clientRequestId, setClientRequestId] = useState(
    existingPayment?.clientRequestId || generateId()
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!shopId && shops.length > 0) {
      setShopId(defaultShopId || shops[0].id);
    }
  }, [shops, shopId, defaultShopId]);

  const selectedSummary = shopSummaries.find((s) => s.shop.id === shopId);
  const parsedAmount = round2(Number(amount) || 0);
  const baseNet = selectedSummary
    ? round2(selectedSummary.netBalance + (existingPayment && existingPayment.shopId === shopId ? existingPayment.amount : 0))
    : 0;
  const projectedNet = round2(baseNet - parsedAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedShop = shops.find((s) => s.id === shopId);
    if (!selectedShop) {
      notify('error', 'Please select a shop.');
      return;
    }
    if (parsedAmount <= 0) {
      notify('error', 'Payment amount must be greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      await savePayment(
        {
          date,
          shopId: selectedShop.id,
          shopName: selectedShop.shopName,
          amount: parsedAmount,
          method,
          referenceNumber: referenceNumber.trim(),
          notes: notes.trim(),
          clientRequestId,
        },
        existingPayment
      );
      if (!existingPayment) {
        setAmount('');
        setReferenceNumber('');
        setNotes('');
        setClientRequestId(generateId());
      }
      onSuccess?.();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to save payment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (shops.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
        <p className="text-sm font-medium text-[#0F172A]">No supplier shops registered yet</p>
        <p className="mt-1 text-xs text-slate-600">
          Add a shop or supplier before recording a payment.
        </p>
        {onNavigateToShops && (
          <button
            type="button"
            onClick={onNavigateToShops}
            className="mt-3 min-h-[44px] px-4 py-2 rounded-xl bg-[#0F294A] text-white text-sm font-medium hover:bg-[#163864] transition-colors"
          >
            Add First Shop
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Payment Date</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Shop / Supplier</label>
          <select
            required
            value={shopId}
            onChange={(e) => setShopId(e.target.value)}
            className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
          >
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.shopName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Payment Amount (BDT ৳)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Payment Method</label>
          <select
            required
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Reference / Cheque / TxID</label>
          <input
            type="text"
            maxLength={80}
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="e.g. bKash / Cheque No."
            className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Notes</label>
          <input
            type="text"
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional payment remark"
            className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
          />
        </div>
      </div>

      {selectedSummary && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-600">
            Current Shop Status:{' '}
            <span className="font-semibold text-[#0F172A] tabular-nums">
              {baseNet > 0
                ? `${formatBDT(baseNet)} Payable`
                : baseNet < 0
                ? `${formatBDT(Math.abs(baseNet))} Advance`
                : 'Settled (৳0.00)'}
            </span>
          </div>
          <div className="text-slate-600">
            After Payment:{' '}
            <span
              className={`font-semibold tabular-nums ${
                projectedNet > 0
                  ? 'text-[#801828]'
                  : projectedNet < 0
                  ? 'text-[#0F294A]'
                  : 'text-emerald-700'
              }`}
            >
              {projectedNet > 0
                ? `${formatBDT(projectedNet)} Due`
                : projectedNet < 0
                ? `${formatBDT(Math.abs(projectedNet))} Advance Receivable`
                : 'Fully Settled (৳0.00)'}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="min-h-[44px] px-5 py-2 rounded-xl bg-[#801828] hover:bg-[#681220] text-white text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {submitting
            ? 'Saving...'
            : existingPayment
            ? 'Update Payment'
            : 'Record Payment'}
        </button>
      </div>
    </form>
  );
};
