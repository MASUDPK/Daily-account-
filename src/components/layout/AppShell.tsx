import React, { useState } from 'react';
import {
  Archive,
  ArrowLeftRight,
  Calendar,
  CreditCard,
  FileBarChart2,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  RefreshCw,
  Scale,
  ShoppingCart,
  Store,
  UserCheck,
  Wallet,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext';
import { formatDateDDMMYYYY, getTodayDhakaISO } from '../../lib/format';
import { NavSection } from '../../types/accounting';
import { DailyAccountLogo } from '../ui/DailyAccountLogo';
import { PWAInstallButton } from '../ui/PWAInstallButton';

interface AppShellProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  children: React.ReactNode;
}

interface NavItem {
  id: NavSection;
  label: string;
  shortLabel: string;
  group: 'overview' | 'operations' | 'system';
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Home', group: 'overview', icon: LayoutDashboard },
  { id: 'shops', label: 'Shops & Ledgers', shortLabel: 'Shops', group: 'overview', icon: Store },
  { id: 'cash', label: 'Cash & Bank', shortLabel: 'Cash', group: 'overview', icon: Wallet },
  { id: 'purchases', label: 'Purchases', shortLabel: 'Purchases', group: 'operations', icon: ShoppingCart },
  { id: 'payments', label: 'Payments', shortLabel: 'Payments', group: 'operations', icon: CreditCard },
  { id: 'dues', label: 'Due & Receivable', shortLabel: 'Dues', group: 'operations', icon: Scale },
  { id: 'expenses', label: 'Expenses', shortLabel: 'Expenses', group: 'operations', icon: Receipt },
  { id: 'transactions', label: 'Transactions', shortLabel: 'Ledger', group: 'system', icon: ArrowLeftRight },
  { id: 'reports', label: 'Reports', shortLabel: 'Reports', group: 'system', icon: FileBarChart2 },
  { id: 'backup', label: 'Backup', shortLabel: 'Backup', group: 'system', icon: Archive },
];

const NAV_GROUPS: Array<{ key: NavItem['group']; title: string }> = [
  { key: 'overview', title: 'Overview & Accounts' },
  { key: 'operations', title: 'Site Operations' },
  { key: 'system', title: 'Ledger & System' },
];

export const AppShell: React.FC<AppShellProps> = ({
  activeSection,
  onSelectSection,
  children,
}) => {
  const {
    user,
    isOnline,
    isSyncing,
    pendingMutations,
    firestoreError,
    toasts,
    dismissToast,
    syncNow,
    retryConnection,
    logout,
  } = useAccounting();

  const [retrying, setRetrying] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const parsedFirestoreError = React.useMemo(() => {
    if (!firestoreError) return null;
    try {
      const obj = JSON.parse(firestoreError) as {
        error?: string;
        operationType?: string;
        path?: string | null;
      };
      const rawMsg = obj.error || firestoreError;
      const isPermission =
        rawMsg.toLowerCase().includes('permission') ||
        rawMsg.toLowerCase().includes('insufficient');
      return {
        rawMsg,
        isPermission,
        path: obj.path || '',
        operationType: obj.operationType || '',
      };
    } catch {
      const isPermission =
        firestoreError.toLowerCase().includes('permission') ||
        firestoreError.toLowerCase().includes('insufficient');
      return {
        rawMsg: firestoreError,
        isPermission,
        path: '',
        operationType: '',
      };
    }
  }, [firestoreError]);

  const currentNav = NAV_ITEMS.find((n) => n.id === activeSection) || NAV_ITEMS[0];
  const todayFormatted = formatDateDDMMYYYY(getTodayDhakaISO());

  const handleNav = (id: NavSection) => {
    onSelectSection(id);
    setDrawerOpen(false);
  };

  const renderNavGroups = (onItemSelect: (id: NavSection) => void) => (
    <div className="space-y-5">
      {NAV_GROUPS.map((group) => {
        const items = NAV_ITEMS.filter((item) => item.group === group.key);
        return (
          <div key={group.key}>
            <div className="px-3 mb-2 text-[11px] font-medium tracking-[0.02em] text-slate-400">
              {group.title}
            </div>
            <div className="space-y-1.5">
              {items.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onItemSelect(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`w-full min-h-[42px] px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#801828] text-white shadow-xs'
                        : 'text-slate-200 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex overflow-x-clip">
      {/* Desktop Permanent Navigation Drawer — Deep Navy Blue Structure with Separate Approved Logo */}
      <aside className="no-print hidden lg:flex w-[272px] shrink-0 flex-col bg-[#0B1F3A] text-white border-r border-[#08172C] sticky top-0 h-screen">
        <div className="p-4 border-b border-white/10 shrink-0">
          <div className="rounded-xl bg-[#FAFBFD] px-3 py-2.5 flex items-center justify-center shadow-2xs">
            <DailyAccountLogo variant="horizontal" size="sm" className="p-0! bg-transparent!" />
          </div>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3.5 py-5" aria-label="Main navigation">
          {renderNavGroups(handleNav)}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3 shrink-0 bg-[#091A31]">
          <PWAInstallButton darkSurface />
          <div className="px-2 py-1">
            <div className="text-[11px] text-slate-300">Administrator</div>
            <div className="text-xs font-medium text-white truncate">
              {user?.email || 'Admin'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-white/20 bg-white/5 text-xs font-medium text-white hover:bg-white/15 flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Banking Header */}
        <header className="no-print sticky top-0 z-30 pt-safe bg-white/95 backdrop-blur-md border-b border-slate-200 px-3.5 sm:px-5 lg:px-6 flex items-center justify-between gap-3 min-h-[60px]">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden min-w-[44px] min-h-[44px] -ml-1.5 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0B1F3A] hover:bg-slate-50 transition-colors shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="lg:hidden shrink-0">
              <DailyAccountLogo
                variant="mark"
                size="sm"
                className="border border-slate-200/80 rounded-lg"
              />
            </div>

            <div className="min-w-0">
              <h1 className="text-[15px] sm:text-[17px] font-semibold tracking-[-0.015em] text-[#0B1F3A] truncate">
                {currentNav.label}
              </h1>
              <div className="lg:hidden text-[11px] text-slate-500 tabular-nums truncate">
                Daily Account · {todayFormatted}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Online / Offline Status */}
            {isOnline ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium whitespace-nowrap">
                <Wifi className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Online</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-medium whitespace-nowrap">
                <WifiOff className="w-3.5 h-3.5 shrink-0" />
                <span>Offline</span>
              </span>
            )}

            {/* Pending Sync Action */}
            {pendingMutations.length > 0 && (
              <button
                type="button"
                onClick={() => syncNow()}
                disabled={!isOnline || isSyncing}
                className="min-h-[36px] px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs font-medium flex items-center gap-1.5 hover:bg-amber-100 disabled:opacity-60 whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : `${pendingMutations.length} pending`}</span>
              </button>
            )}

            {/* Current Date (Desktop / Tablet) */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-600 tabular-nums whitespace-nowrap pl-2 border-l border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-[#0F294A] shrink-0" />
              <span>{todayFormatted}</span>
            </div>

            {/* Administrator Profile */}
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-700 pl-2 border-l border-slate-200 max-w-[200px]">
              <UserCheck className="w-3.5 h-3.5 text-[#0B1F3A] shrink-0" />
              <span className="truncate font-medium">{user?.email || 'Administrator'}</span>
            </div>

            {/* Mobile PWA Install Action */}
            <div className="lg:hidden">
              <PWAInstallButton compact />
            </div>

            {/* Header Sign Out */}
            <button
              type="button"
              onClick={() => logout()}
              aria-label="Sign Out"
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#E6C7CD] bg-[#FDF2F4] hover:bg-[#FCE7EB] text-[#801828] text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Firestore Diagnostics Notice */}
        {parsedFirestoreError && (
          <div className="no-print mx-4 lg:mx-6 mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold">
                {parsedFirestoreError.isPermission
                  ? 'Cloud Firestore Permission Notice'
                  : 'Cloud Firestore Connection Notice'}
              </div>
              <button
                type="button"
                disabled={retrying}
                onClick={async () => {
                  setRetrying(true);
                  try {
                    await retryConnection();
                  } finally {
                    setRetrying(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-amber-950 font-medium hover:bg-amber-100 transition-colors disabled:opacity-60"
              >
                {retrying ? 'Retrying...' : 'Retry Connection'}
              </button>
            </div>
            <p className="mt-1.5 leading-relaxed">
              {parsedFirestoreError.isPermission ? (
                <>
                  Cloud Firestore rejected access
                  {parsedFirestoreError.path ? ` (${parsedFirestoreError.path})` : ''}. Please ensure
                  the security rules from <code>firestore.rules</code> are pasted and{' '}
                  <strong>Published</strong> in Firebase Console → Firestore Database → Rules for
                  project <strong>daily-account-8ea61</strong>, then click{' '}
                  <strong>Retry Connection</strong>.
                </>
              ) : (
                <>
                  Unable to reach Cloud Firestore ({parsedFirestoreError.rawMsg}). Your entries stay
                  safely queued in IndexedDB and will sync automatically once connected.
                </>
              )}
            </p>
          </div>
        )}

        {/* Viewport Container */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 lg:px-6 py-5 pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Compact Bottom Tab Navigation */}
      <nav
        aria-label="Mobile quick navigation"
        className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-40 min-h-[60px] pb-safe bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 items-center"
      >
        {(
          [
            { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
            { id: 'shops', label: 'Shops', icon: Store },
            { id: 'purchases', label: 'Purchases', icon: ShoppingCart },
            { id: 'cash', label: 'Cash', icon: Wallet },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleNav(tab.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'text-[#801828]' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium tracking-tight">{tab.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
            ['payments', 'dues', 'expenses', 'transactions', 'reports', 'backup'].includes(
              activeSection
            )
              ? 'text-[#801828]'
              : 'text-slate-500'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight">Menu</span>
        </button>
      </nav>

      {/* Modern Responsive Slide-Out Hamburger Navigation Drawer */}
      {drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation drawer"
          className="no-print lg:hidden fixed inset-0 z-50 flex bg-slate-950/50 backdrop-blur-[1px]"
          onClick={() => setDrawerOpen(false)}
        >
          <aside
            className="w-[288px] max-w-[85vw] h-full bg-[#0B1F3A] text-white flex flex-col shadow-2xl border-r border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between gap-2.5 shrink-0">
              <div className="flex-1 rounded-xl bg-[#FAFBFD] px-3 py-2 flex items-center justify-center">
                <DailyAccountLogo variant="horizontal" size="sm" className="p-0! bg-transparent!" />
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation drawer"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-200 hover:bg-white/10 hover:text-white transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3.5 py-5" aria-label="Mobile drawer navigation">
              {renderNavGroups(handleNav)}
            </nav>

            <div className="p-4 border-t border-white/10 space-y-3 shrink-0 bg-[#091A31]">
              <PWAInstallButton darkSurface />
              <div className="px-2 py-0.5">
                <div className="text-[11px] text-slate-300">Administrator</div>
                <div className="text-xs font-medium text-white truncate">
                  {user?.email || 'Admin'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => logout()}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-white/20 bg-white/10 text-sm font-medium text-white hover:bg-white/20 flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="no-print fixed top-16 right-4 lg:top-auto lg:bottom-5 lg:right-5 z-50 flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-auto">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className={`rounded-xl border px-4 py-3 text-xs sm:text-sm font-medium shadow-md flex items-center justify-between gap-3 ${
                t.type === 'error'
                  ? 'bg-[#FDF2F4] border-[#E6C7CD] text-[#801828]'
                  : t.type === 'info'
                  ? 'bg-slate-50 border-slate-200 text-[#0F294A]'
                  : 'bg-white border-slate-200 text-[#0F172A]'
              }`}
            >
              <span>{t.text}</span>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="text-slate-400 hover:text-slate-600 shrink-0"
                aria-label="Dismiss message"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
