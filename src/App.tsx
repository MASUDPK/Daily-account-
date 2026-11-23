import React, { useState } from 'react';
import { AccountingProvider, useAccounting } from './context/AccountingContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { LoginScreen } from './components/auth/LoginScreen';
import { AppShell } from './components/layout/AppShell';
import { DashboardView } from './components/dashboard/DashboardView';
import { ShopsView } from './components/shops/ShopsView';
import { PurchasesView } from './components/purchases/PurchasesView';
import { PaymentsView } from './components/payments/PaymentsView';
import { DuesReceivableView } from './components/dues/DuesReceivableView';
import { ExpensesView } from './components/expenses/ExpensesView';
import { CashBankView } from './components/cash/CashBankView';
import { TransactionsView } from './components/transactions/TransactionsView';
import { ReportsView } from './components/reports/ReportsView';
import { NavSection } from './types/accounting';

const AuthenticatedApp: React.FC = () => {
  const { user, authLoading, dataLoading } = useAccounting();
  const [section, setSection] = useState<NavSection>('dashboard');

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl px-6 py-5 shadow-2xs text-sm text-slate-600">
          Verifying administrator session...
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <AppShell activeSection={section} onSelectSection={setSection}>
      {dataLoading ? (
        <div className="space-y-4">
          <div className="h-24 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {section === 'dashboard' && <DashboardView onNavigate={setSection} />}
          {section === 'shops' && <ShopsView />}
          {section === 'purchases' && <PurchasesView onNavigate={setSection} />}
          {section === 'payments' && <PaymentsView onNavigate={setSection} />}
          {section === 'dues' && <DuesReceivableView />}
          {section === 'expenses' && <ExpensesView />}
          {section === 'cash' && <CashBankView />}
          {section === 'transactions' && <TransactionsView />}
          {section === 'reports' && <ReportsView key="reports" initialAccordion="report-preview" />}
          {section === 'backup' && <ReportsView key="backup" initialAccordion="backup-restore" />}
        </>
      )}
    </AppShell>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AccountingProvider>
        <AuthenticatedApp />
      </AccountingProvider>
    </ErrorBoundary>
  );
}
