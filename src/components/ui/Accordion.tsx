import React from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionItemProps {
  id: string;
  title: string;
  subtitle?: string;
  rightSummary?: string;
  isOpen: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}

export const AccordionItem: React.FC<AccordionItemProps> = ({
  id,
  title,
  subtitle,
  rightSummary,
  isOpen,
  onToggle,
  children,
}) => {
  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs transition-colors">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={`accordion-panel-${id}`}
        onClick={() => onToggle(id)}
        className="w-full min-h-[56px] px-4 sm:px-5 py-3.5 flex items-center justify-between gap-4 text-left hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F294A] focus-visible:ring-inset transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold tracking-[-0.01em] text-[#0F172A] truncate">{title}</div>
          {subtitle && (
            <div className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</div>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {rightSummary && (
            <span className="text-xs sm:text-[13px] font-medium text-slate-600 tabular-nums whitespace-nowrap">
              {rightSummary}
            </span>
          )}
          <ChevronDown
            className={`w-5 h-5 text-slate-500 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[#801828]' : ''
            }`}
          />
        </div>
      </button>
      {isOpen && (
        <div
          id={`accordion-panel-${id}`}
          className="border-t border-slate-200 px-4 sm:px-5 py-4 sm:py-5 bg-white"
        >
          {children}
        </div>
      )}
    </section>
  );
};
