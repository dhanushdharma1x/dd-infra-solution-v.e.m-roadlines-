import React, { useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Hammer, HardHat, Lock, Mail, ShieldAlert, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { UserProfile } from '../types';

interface LoginProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // OTP dev-mode states
  // Enable when VITE_DEV_LOGIN is explicitly set, or automatically in Vite dev mode for easier local testing
  const DEV_OTP_ENABLED = (
    import.meta.env.VITE_DEV_LOGIN === 'true' ||
    import.meta.env.VITE_DEV_LOGIN === '1' ||
    Boolean((import.meta.env as any).DEV)
  );
  // Also enable for local development on localhost for convenience
  const IS_LOCALHOST = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const ALLOW_DEV_OTP = DEV_OTP_ENABLED || IS_LOCALHOST;
  // OTP / phone-first only
  const mode: 'otp' = 'otp';
  const [phone, setPhone] = useState('');
  const [otpSentCode, setOtpSentCode] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpMessage, setOtpMessage] = useState('');

  // Fetch existing user profile or create a minimal profile in Firestore
  const fetchOrCreateProfile = async (uid: string, userEmail: string): Promise<UserProfile> => {
    const normalized = (userEmail || '').trim().toLowerCase();
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    } else {
      const profile: UserProfile = {
        id: uid,
        email: normalized,
        name: normalized || `User ${uid.slice(0,6)}`,
        role: 'user'
      };
      await setDoc(docRef, profile);
      return profile;
    }
  };

  // email login removed — OTP-first flow only

  // --- Dev OTP Flow (safe for local testing only) ---
  const sendDevOtp = () => {
    setError('');
    setOtpMessage('');
    if (!ALLOW_DEV_OTP) {
      setOtpMessage('Dev OTP disabled. Enable VITE_DEV_LOGIN in .env to use OTP.');
      return;
    }
    const normalized = phone.replace(/\D/g, '');
    if (normalized.length < 6) {
      setOtpMessage('Enter a valid phone number for dev OTP.');
      return;
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 5 * 60 * 1000; // 5 minutes
    try {
      sessionStorage.setItem(`dev_otp_${normalized}`, JSON.stringify({ code, expires }));
    } catch (e) {
      // ignore storage errors
    }
    setOtpSentCode(code);
    setOtpMessage(`OTP sent (dev): ${code} — expires in 5 minutes. Shown here for local testing.`);
    // Also log to console for convenience
    console.info(`Dev OTP for ${normalized}: ${code}`);
  };

  const verifyDevOtp = async () => {
    setError('');
    setOtpMessage('');
    if (!ALLOW_DEV_OTP) {
      setOtpMessage('Dev OTP disabled.');
      return;
    }
    const normalized = phone.replace(/\D/g, '');
    if (!normalized) {
      setOtpMessage('Enter phone first.');
      return;
    }
    const raw = sessionStorage.getItem(`dev_otp_${normalized}`);
    if (!raw) {
      setOtpMessage('No OTP found for this number. Please send OTP first.');
      return;
    }
    try {
      const { code, expires } = JSON.parse(raw);
      if (Date.now() > expires) {
        setOtpMessage('OTP expired. Please resend.');
        return;
      }
      if (otpInput.trim() !== String(code)) {
        setOtpMessage('Incorrect OTP.');
        return;
      }
      // OTP verified — sign in to Firebase anonymously so security rules allow writes,
      // then fetch-or-create a Firestore profile and continue.
      try {
        const cred = await signInAnonymously(auth);
        const { user } = cred;
        const profile = await fetchOrCreateProfile(user.uid, '');
        try { sessionStorage.setItem('dev_user_profile', JSON.stringify(profile)); } catch (e) {}
        onLoginSuccess(profile);
      } catch (e) {
        // Fallback to session-only dev profile if anonymous sign-in fails
        const profile: UserProfile = {
          id: `dev_${normalized}`,
          name: `Dev ${normalized.slice(-4)}`,
          email: '',
          role: 'admin'
        };
        try { sessionStorage.setItem('dev_user_profile', JSON.stringify(profile)); } catch (e) {}
        onLoginSuccess(profile);
      }
    } catch (e) {
      setOtpMessage('OTP verification failed.');
    }
  };

  return (
    <div id="login_screen" className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Decorative construction backlighting */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 blur-3xl rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-600/5 blur-3xl rounded-full pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center justify-center p-3 bg-[#F59E0B] text-slate-950 rounded-xl shadow-md mb-4"
        >
          <Hammer className="h-8 w-8 stroke-[2.5]" />
        </motion.div>
        
        <h2 className="text-2xl font-black tracking-tight text-[#0F172A] sm:text-3xl">
          MachineMitra
        </h2>
        <p className="mt-1 text-xs text-amber-600 font-extrabold uppercase tracking-widest">
          Track machines. Track money.
        </p>
        <p className="mt-0.5 text-[10px] text-slate-500 font-semibold tracking-wide">
          Simple equipment management for busy owners
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white border border-slate-200 py-8 px-6 shadow-xs rounded-2xl sm:px-10"
        >
          {error && (
            <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2.5 text-rose-800 text-xs font-semibold">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <div className="text-slate-500 font-semibold">Sign in with Phone</div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Phone Number (dev)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter your mobile number"
                  className="block w-full pl-3 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-semibold shadow-sm"
                />
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={sendDevOtp} className="flex-1 py-3 bg-amber-500 text-white font-extrabold rounded-xl text-sm">CONTINUE</button>
              </div>

              {otpMessage && (
                <div className="text-[12px] mt-2 text-amber-600 font-medium">{otpMessage}</div>
              )}

              {otpSentCode && (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-600">Enter OTP (dev)</div>
                  <div className="flex gap-2">
                    <input type="text" value={otpInput} onChange={(e) => setOtpInput(e.target.value)} placeholder="123456" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs" />
                    <button type="button" onClick={verifyDevOtp} className="py-2.5 px-4 bg-emerald-600 text-white font-bold rounded-xl">Verify</button>
                  </div>
                  {otpMessage && <div className="text-[11px] text-amber-600 font-medium">{otpMessage}</div>}
                </div>
              )}
            </div>
          </div>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-450">
                <span className="bg-white px-3 text-slate-400">Sign in options</span>
                </div>
            </div>
            
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col items-center text-center space-y-1.5 text-[10px] text-slate-400 font-medium">
            <p className="font-bold text-slate-700 uppercase tracking-wide">MachineMitra Support</p>
            <p>For help, contact support@machinemitra.example</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
