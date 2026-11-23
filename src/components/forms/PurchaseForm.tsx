import React, { useEffect, useState } from 'react';
import { useAccounting } from '../../context/AccountingContext';
import {
  COMMON_UNITS,
  PURCHASE_CATEGORIES,
  Purchase,
  PurchaseCategory,
} from '../../types/accounting';
import { formatBDT, generateId, getTodayDhakaISO, round2 } from '../../lib/format';

interface PurchaseFormProps {
  existingPurchase?: Purchase;
  defaultShopId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  onNavigateToShops?: () => void;
}

export const PurchaseForm: React.FC<PurchaseFormProps> = ({
  existingPurchase,
  defaultShopId,
  onSuccess,
  onCancel,
  onNavigateToShops,
}) => {
  const { shops, savePurchase, notify } = useAccounting();

  const [date, setDate] = useState(existingPurchase?.date || getTodayDhakaISO());
  const [shopId, setShopId] = useState(existingPurchase?.shopId || defaultShopId || '');
  const [materialName, setMaterialName] = useState(existingPurchase?.materialName || '');
  const [category, setCategory] = useState<PurchaseCategory>(
    existingPurchase?.category || 'Cement'
  );
  const [quantity, setQuantity] = useState(existingPurchase ? String(existingPurchase.quantity) : '');
  const [unit, setUnit] = useState(existingPurchase?.unit || 'Bag');
  const [rate, setRate] = useState(existingPurchase ? String(existingPurchase.rate) : '');
  const [notes, setNotes] = useState(existingPurchase?.notes || '');
  const [clientRequestId, setClientRequestId] = useState(
    existingPurchase?.clientRequestId || generateId()
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!shopId && shops.length > 0) {
      setShopId(defaultShopId || shops[0].id);
    }
  }, [shops, shopId, defaultShopId]);

  const parsedQty = Number(quantity) || 0;
  const parsedRate = Number(rate) || 0;
  const totalAmount = round2(parsedQty * parsedRate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedShop = shops.find((s) => s.id === shopId);
    if (!selectedShop) {
      notify('error', 'Please select a valid shop or supplier.');
      return;
    }
    if (!materialName.trim()) {
      notify('error', 'Material name is required.');
      return;
    }
    if (round2(parsedQty) <= 0) {
      notify('error', 'Quantity must be greater than zero (at least 0.01).');
      return;
    }
    if (parsedRate < 0) {
      notify('error', 'Rate cannot be negative.');
      return;
    }
    if (!unit.trim()) {
      notify('error', 'Unit is required.');
      return;
    }

    setSubmitting(true);
    try {
      await savePurchase(
        {
          date,
          shopId: selectedShop.id,
          shopName: selectedShop.shopName,
          materialName: materialName.trim(),
          category,
          quantity: round2(parsedQty),
          unit: unit.trim(),
          rate: round2(parsedRate),
          totalAmount,
          notes: notes.trim(),
          clientRequestId,
        },
        existingPurchase
      );

      if (!existingPurchase) {
        setMaterialName('');
        setQuantity('');
        setRate('');
        setNotes('');
        setClientRequestId(generateId());
      }
      onSuccess?.();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to save purchase.');
    } finally {
      setSubmitting(false);
    }
  };

  if (shops.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
        <p className="text-sm font-medium text-[#0F172A]">No supplier shops registered yet</p>
        <p className="mt-1 text-xs text-slate-600">
          Add at least one shop or supplier before recording a material purchase.
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
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Purchase Date</label>
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
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Category</label>
          <select
            required
            value={category}
            onChange={(e) => setCategory(e.target.value as PurchaseCategory)}
            className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
          >
            {PURCHASE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2 lg:col-span-1">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Material / Item Name</label>
          <input
            type="text"
            required
            maxLength={120}
            value={materialName}
            onChange={(e) => setMaterialName(e.target.value)}
            placeholder="e.g. Shah Cement Special"
            className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Quantity</label>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0.01"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Unit</label>
            <input
              type="text"
              list="purchase-unit-options"
              required
              maxLength={32}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Bag"
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
            />
            <datalist id="purchase-unit-options">
              {COMMON_UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Rate (BDT ৳)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="0.00"
            className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
        <div className="lg:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Notes / Challan No.</label>
          <input
            type="text"
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional delivery memo or vehicle note"
            className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-700">Total Amount</span>
          <span className="text-lg font-semibold tracking-[-0.015em] text-[#0B1F3A] tabular-nums">
            {formatBDT(totalAmount)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
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
            : existingPurchase
            ? 'Update Purchase'
            : 'Record Purchase'}
        </button>
      </div>
    </form>
  );
};
