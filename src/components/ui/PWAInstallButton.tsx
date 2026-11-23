import React, { useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean; darkSurface?: boolean }> = ({
  compact = false,
  darkSurface = false,
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`flex items-center justify-center gap-2 rounded-xl border transition-colors font-medium whitespace-nowrap shrink-0 ${
          darkSurface
            ? 'border-white/20 bg-white/10 text-white hover:bg-white/15'
            : 'border-[#E6C7CD] bg-[#FDF2F4] text-[#801828] hover:bg-[#FCE7EB]'
        } ${
          compact ? 'min-h-[38px] px-2.5 py-1.5 text-xs' : 'w-full min-h-[44px] px-4 py-2.5 text-sm'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS || (isAndroid && !compact)) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className={`flex items-center justify-center gap-2 rounded-xl border transition-colors font-medium whitespace-nowrap shrink-0 ${
            darkSurface
              ? 'border-white/20 bg-white/10 text-white hover:bg-white/15'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          } ${
            compact ? 'min-h-[38px] px-2.5 py-1.5 text-xs' : 'w-full min-h-[44px] px-4 py-2.5 text-sm'
          }`}
        >
          <Smartphone className="w-4 h-4 shrink-0" />
          <span>{isIOS ? 'Install on iOS' : 'Install Android App'}</span>
        </button>

        {showGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
            onClick={() => setShowGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold text-[#0F172A]">Install Daily Account</h3>
              {isIOS ? (
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  1. Tap the <strong>Share</strong> icon in the Safari toolbar.<br />
                  2. Scroll down and tap <strong>Add to Home Screen</strong>.<br />
                  3. Tap <strong>Add</strong> to launch DAILY ACCOUNT full-screen.
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  1. Open this app in <strong>Google Chrome</strong> on Android.<br />
                  2. Tap the <strong>⋮</strong> menu in the top-right corner.<br />
                  3. Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>.<br />
                  4. Confirm <strong>Install</strong> to launch without the browser bar.
                </p>
              )}
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-xl bg-[#0F294A] text-white text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
