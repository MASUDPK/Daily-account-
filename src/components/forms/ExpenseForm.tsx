import React, { useState } from 'react';
import { useAccounting } from '../../context/AccountingContext';
import {
  EXPENSE_CATEGORIES,
  Expense,
  ExpenseCategory,
  PAYMENT_METHODS,
  PaymentMethod,
} from '../../types/accounting';
import { generateId, getTodayDhakaISO, round2 } from '../../lib/format';

interface ExpenseFormProps {
  existingExpense?: Expense;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  existingExpense,
  onSuccess,
  onCancel,
}) => {
  const { saveExpense, notify } = useAccounting();

  const [date, setDate] = useState(existingExpense?.date || getTodayDhakaISO());
  const [category, setCategory] = useState<ExpenseCategory>(
    existingExpense?.category || 'Labour'
  );
  const [description, setDescription] = useState(existingExpense?.description || '');
  const [amount, setAmount] = useState(existingExpense ? String(existingExpense.amount) : '');
  const [method, setMethod] = useState<PaymentMethod>(existingExpense?.method || 'Cash');
  const [notes, setNotes] = useState(existingExpense?.notes || '');
  const [clientRequestId, setClientRequestId] = useState(
    existingExpense?.clientRequestId || generateId()
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmt = round2(Number(amount) || 0);
    if (!description.trim()) {
      notify('error', 'Expense description is required.');
      return;
    }
    if (parsedAmt <= 0) {
      notify('error', 'Expense amount must be greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      await saveExpense(
        {
          date,
          category,
          description: description.trim(),
          amount: parsedAmt,
          method,
          notes: notes.trim(),
          clientRequestId,
        },
        existingExpense
      );
      if (!existingExpense) {
        setDescription('');
        setAmount('');
        setNotes('');
        setClientRequestId(generateId());
      }
      onSuccess?.();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to save expense.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Expense Date</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Expense Category</label>
          <select
            required
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
          >
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

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

        <div className="sm:col-span-2 lg:col-span-1">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Description</label>
          <input
            type="text"
            required
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Daily mason wages / Truck fare"
            className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
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
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Notes</label>
          <input
            type="text"
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional voucher or site remark"
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
            : existingExpense
            ? 'Update Expense'
            : 'Record Expense'}
        </button>
      </div>
    </form>
  );
};
