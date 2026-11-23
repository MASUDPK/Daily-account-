import React, { useState } from 'react';
import { useAccounting } from '../../context/AccountingContext';
import {
  CashTransaction,
  CashTxType,
  LIQUID_ACCOUNTS,
  LiquidAccount,
} from '../../types/accounting';
import { generateId, getTodayDhakaISO, round2 } from '../../lib/format';

interface CashTxFormProps {
  existingTx?: CashTransaction;
  defaultType?: CashTxType;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const CashTxForm: React.FC<CashTxFormProps> = ({
  existingTx,
  defaultType = 'cash_in',
  onSuccess,
  onCancel,
}) => {
  const { saveCashTransaction, notify } = useAccounting();

  const [date, setDate] = useState(existingTx?.date || getTodayDhakaISO());
  const [type, setType] = useState<CashTxType>(existingTx?.type || defaultType);
  const [account, setAccount] = useState<LiquidAccount>(existingTx?.account || 'Cash');
  const [toAccount, setToAccount] = useState<LiquidAccount>(
    (existingTx?.toAccount as LiquidAccount) || 'Bank'
  );
  const [amount, setAmount] = useState(existingTx ? String(existingTx.amount) : '');
  const [description, setDescription] = useState(existingTx?.description || '');
  const [referenceNumber, setReferenceNumber] = useState(existingTx?.referenceNumber || '');
  const [notes, setNotes] = useState(existingTx?.notes || '');
  const [clientRequestId, setClientRequestId] = useState(
    existingTx?.clientRequestId || generateId()
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmt = round2(Number(amount) || 0);
    if (parsedAmt <= 0) {
      notify('error', 'Amount must be greater than zero.');
      return;
    }
    if (!description.trim()) {
      notify('error', 'Description is required.');
      return;
    }
    if (type === 'transfer' && account === toAccount) {
      notify('error', 'Source and destination accounts must be different.');
      return;
    }

    setSubmitting(true);
    try {
      await saveCashTransaction(
        {
          date,
          type,
          account,
          toAccount: type === 'transfer' ? toAccount : '',
          amount: parsedAmt,
          description: description.trim(),
          referenceNumber: referenceNumber.trim(),
          notes: notes.trim(),
          clientRequestId,
        },
        existingTx
      );
      if (!existingTx) {
        setAmount('');
        setDescription('');
        setReferenceNumber('');
        setNotes('');
        setClientRequestId(generateId());
      }
      onSuccess?.();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to save cash entry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Date</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Entry Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as CashTxType)}
            className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
          >
            <option value="cash_in">Cash In (Deposit / Fund Received)</option>
            <option value="cash_out">Cash Out (Withdrawal / Refund)</option>
            <option value="transfer">Internal Account Transfer</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            {type === 'transfer' ? 'From Account' : 'Account'}
          </label>
          <select
            value={account}
            onChange={(e) => setAccount(e.target.value as LiquidAccount)}
            className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
          >
            {LIQUID_ACCOUNTS.map((acc) => (
              <option key={acc} value={acc}>
                {acc}
              </option>
            ))}
          </select>
        </div>

        {type === 'transfer' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">To Account</label>
            <select
              value={toAccount}
              onChange={(e) => setToAccount(e.target.value as LiquidAccount)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
            >
              {LIQUID_ACCOUNTS.map((acc) => (
                <option key={acc} value={acc}>
                  {acc}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Amount (BDT ৳)</label>
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
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Description</label>
          <input
            type="text"
            required
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Owner capital deposit / Bank withdrawal"
            className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Reference Number</label>
          <input
            type="text"
            maxLength={80}
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="Optional slip or TxID"
            className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
          />
        </div>

        <div className={type === 'transfer' ? 'sm:col-span-2' : 'sm:col-span-2 lg:col-span-1'}>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Notes</label>
          <input
            type="text"
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional remarks"
            className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
          />
        </div>
      </div>

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
          className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0B1F3A] hover:bg-[#163864] text-white text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {submitting
            ? 'Saving...'
            : existingTx
            ? 'Update Entry'
            : 'Save Cash Entry'}
        </button>
      </div>
    </form>
  );
};
