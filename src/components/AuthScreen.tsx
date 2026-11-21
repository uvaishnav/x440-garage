import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../lib/firebase';

interface AuthScreenProps {
  onContinueLocal: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onContinueLocal }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    if (!auth) return;
    setBusy(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError(err?.message || 'Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#F5F5F7] flex flex-col justify-between px-7 py-12 safe-top safe-bottom">
      <div />

      <div className="flex flex-col items-center text-center">
        <div className="w-28 h-28 rounded-[28px] overflow-hidden border border-white/10 shadow-[0_20px_60px_rgba(255,102,0,0.18)] mb-7">
          <img
            src="/assets/icon-512.png"
            alt="X440 Garage"
            className="w-full h-full object-cover"
          />
        </div>

        <p className="text-[11px] uppercase tracking-[0.28em] text-[#FF6600] font-semibold mb-2">
          Harley-Davidson X440
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-[#F5F5F7]">
          X440 Garage
        </h1>
        <p className="text-sm text-[#8E8E93] mt-2.5 max-w-[270px] leading-relaxed">
          Precision fuel analytics, manual-tuned care intervals, and highway trip intelligence.
        </p>
      </div>

      <div className="space-y-3 max-w-sm w-full mx-auto">
        {isFirebaseConfigured ? (
          <button
            onClick={handleGoogleSignIn}
            disabled={busy}
            className="w-full h-14 rounded-2xl bg-[#F5F5F7] text-[#0A0A0B] font-semibold text-[15px] flex items-center justify-center gap-3 active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.87Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.88-3c-1.07.72-2.44 1.15-4.05 1.15-3.12 0-5.76-2.1-6.7-4.93H1.3v3.09A12 12 0 0 0 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.3 14.31A7.18 7.18 0 0 1 4.92 12c0-.8.14-1.58.38-2.31V6.6H1.3A12 12 0 0 0 0 12c0 1.94.46 3.77 1.3 5.4l4-3.09Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.3 6.6l4 3.09C6.24 6.87 8.88 4.77 12 4.77Z"
              />
            </svg>
            {busy ? 'Signing in...' : 'Continue with Google'}
          </button>
        ) : (
          <div className="rounded-2xl bg-[#141518] border border-white/10 p-4 text-left space-y-2">
            <p className="text-xs font-medium text-[#FF6600]">Firebase Keys Not Detected</p>
            <p className="text-xs text-[#8E8E93] leading-relaxed">
              Add your keys to <code className="text-[#F5F5F7]">.env.local</code> to enable cloud sync, or preview locally right now.
            </p>
            <button
              onClick={onContinueLocal}
              className="w-full h-11 mt-2 rounded-xl bg-[#FF6600] text-white font-semibold text-sm active:scale-[0.98] transition-transform"
            >
              Open Local Preview
            </button>
          </div>
        )}

        {error && (
          <p className="text-xs text-[#FF453A] text-center pt-1">{error}</p>
        )}

        <p className="text-[11px] text-[#636366] text-center pt-1">
          Matte Denim Black Edition · Private Cloud Sync
        </p>
      </div>
    </div>
  );
};
