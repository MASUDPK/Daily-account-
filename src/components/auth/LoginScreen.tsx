import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext';
import { mapFirebaseAuthError } from '../../lib/firebase';
import { DailyAccountLogo } from '../ui/DailyAccountLogo';
import { PWAInstallButton } from '../ui/PWAInstallButton';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LoginScreen: React.FC = () => {
  const { login, resetPassword, isOnline } = useAccounting();
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetSentEmail, setResetSentEmail] = useState<string | null>(null);

  const switchMode = (nextMode: 'login' | 'forgot') => {
    setMode(nextMode);
    setErrorMsg(null);
    setResetSentEmail(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMsg('Please enter your administrator email address.');
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setErrorMsg('Invalid email address format. Please enter a valid administrator email.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      await login(trimmedEmail, password);
    } catch (err: unknown) {
      setErrorMsg(mapFirebaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setResetSentEmail(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMsg('Please enter your administrator email address.');
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setErrorMsg('Invalid email address format. Please enter a valid administrator email.');
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(trimmedEmail);
      setResetSentEmail(trimmedEmail);
    } catch (err: unknown) {
      setErrorMsg(mapFirebaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between p-4 sm:p-6">
      <div className="flex items-center justify-between max-w-5xl w-full mx-auto py-1">
        <DailyAccountLogo variant="horizontal" size="md" className="border border-slate-200/80 shadow-2xs" />
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-600">
            {isOnline ? 'Connected' : 'Offline'}
          </span>
          <PWAInstallButton compact />
        </div>
      </div>

      <main className="flex-1 flex items-center justify-center py-8">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="h-1.5 bg-gradient-to-r from-[#0B1F3A] via-[#0F294A] to-[#801828]" />
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#801828]">
              <ShieldCheck className="w-4 h-4" />
              <span>Administrator Portal · BDT Ledger</span>
            </div>

            {mode === 'login' ? (
              <>
                <h1 className="mt-2 text-2xl font-bold text-[#0F172A] tracking-tight">
                  Sign in to Daily Account
                </h1>
                <p className="mt-1.5 text-sm text-slate-600">
                  Single construction site financial ledger and supplier accounting system.
                </p>

              {errorMsg && (
                <div
                  role="alert"
                  className="mt-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800"
                >
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4" noValidate>
                <div>
                  <label htmlFor="admin-email" className="block text-sm font-medium text-[#0F172A] mb-1.5">
                    Administrator Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="admin-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@site-domain.com"
                      className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F294A] focus:border-[#0F294A]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="admin-password" className="block text-sm font-medium text-[#0F172A]">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs font-medium text-[#801828] hover:text-[#661220] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#801828] rounded"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter administrator password"
                      className="w-full min-h-[44px] pl-10 pr-11 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F294A] focus:border-[#0F294A]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[46px] mt-2 rounded-xl bg-[#0B1F3A] hover:bg-[#13325C] text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center"
                >
                  {submitting ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="mt-2 text-2xl font-bold text-[#0F172A] tracking-tight">
                Reset Administrator Password
              </h1>
              <p className="mt-1.5 text-sm text-slate-600">
                Enter your registered Firebase administrator email to receive a password reset link.
              </p>

              {errorMsg && (
                <div
                  role="alert"
                  className="mt-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800"
                >
                  {errorMsg}
                </div>
              )}

              {resetSentEmail && (
                <div
                  role="status"
                  className="mt-5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-900 flex items-start gap-2.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span>
                    Password reset email sent to <strong>{resetSentEmail}</strong>. Check your inbox and spam folder.
                  </span>
                </div>
              )}

              <form onSubmit={handleForgotSubmit} className="mt-6 space-y-4" noValidate>
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-[#0F172A] mb-1.5">
                    Administrator Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@site-domain.com"
                      className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F294A] focus:border-[#0F294A]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[46px] rounded-xl bg-[#0B1F3A] hover:bg-[#13325C] text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center"
                >
                  {submitting ? 'Sending Reset Link...' : 'Send Password Reset Email'}
                </button>

                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 flex items-center justify-center gap-2 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Sign In</span>
                </button>
              </form>
            </>
          )}

          <div className="mt-6 pt-5 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
            Restricted to authorized site administrator accounts only. Public registration is disabled.
          </div>
          </div>
        </div>
      </main>

      <footer className="max-w-5xl w-full mx-auto py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>Daily Account · Construction Site Ledger</span>
        <span>Currency: BDT (৳) · Timezone: Asia/Dhaka</span>
      </footer>
    </div>
  );
};
