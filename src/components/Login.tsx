import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Hammer, HardHat, Lock, Mail, ShieldAlert, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { UserProfile } from '../types';

interface LoginProps {
  onLoginSuccess: (user: UserProfile) => void;
}

const OWNER_EMAILS = [
  'dhanushdharma11@gmail.com',
  'dhanushdharma1x@gmail.com',
  'dhanushdharma12x@gmail.com',
  'admin@ddinfra.com'
];

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const checkOwnerAndFetchProfile = async (uid: string, userEmail: string): Promise<UserProfile> => {
    const normalized = userEmail.trim().toLowerCase();
    if (!OWNER_EMAILS.includes(normalized)) {
      await auth.signOut();
      throw new Error(`Access Denied: Only V.E.M Roadlines authorized Owner emails can access this platform. If you are the owner, please sign in with ${OWNER_EMAILS[1]}.`);
    }

    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as UserProfile;
      // Always upgrade database profile key to admin to ensure full dashboard operations
      if (data.role !== 'admin') {
        data.role = 'admin';
        await setDoc(docRef, data);
      }
      return data;
    } else {
      const profile: UserProfile = {
        id: uid,
        email: normalized,
        name: normalized === 'admin@ddinfra.com' ? 'V.E.M Roadlines Admin' : 'Dhanush Dharma (Owner)',
        role: 'admin'
      };
      await setDoc(docRef, profile);
      return profile;
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Direct owner login
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const { user } = userCredential;

      const profile = await checkOwnerAndFetchProfile(user.uid, user.email || email);
      onLoginSuccess(profile);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Firebase Email/Password provider is currently disabled. Please enable it in Firebase console or login instantly with Google Sign-In below.');
      } else {
        setError(err.message || 'Authentication failed. Please check credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = async () => {
    setError('');
    setLoading(true);
    const demoEmail = 'admin@ddinfra.com';
    const demoPassword = 'ddinfra_secure_pass_123';

    try {
      let user;
      try {
        const userCredential = await signInWithEmailAndPassword(auth, demoEmail, demoPassword);
        user = userCredential.user;
      } catch (err) {
        // Build demo owner account in firebase auth if not exists yet
        const userCredential = await createUserWithEmailAndPassword(auth, demoEmail, demoPassword);
        user = userCredential.user;
      }

      const profile = await checkOwnerAndFetchProfile(user.uid, demoEmail);
      onLoginSuccess(profile);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Demo login relies on Email/Password Auth. Please enable it in Firebase console, or use Google login.');
      } else {
        setError('Demo Sign in failed: ' + (err.message || 'Error occurred'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const { user } = userCredential;

      const profile = await checkOwnerAndFetchProfile(user.uid, user.email || '');
      onLoginSuccess(profile);
    } catch (err: any) {
      console.error(err);
      setError('Google Sign-In failed: ' + (err.message || 'Error occurred'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login_screen" className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Decorative construction backlighting */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 blur-3xl rounded-full"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-600/5 blur-3xl rounded-full"></div>

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
          DD INFRA SOLUTIONS
        </h2>
        <p className="mt-1 text-xs text-amber-600 font-extrabold uppercase tracking-widest">
          V.E.M ROADLINES CO.
        </p>
        <p className="mt-0.5 text-[10px] text-slate-500 font-semibold tracking-wide">
          Construction Fleet & Earthmovers Management Hub
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

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                Owner Email Address
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. dhanushdharma1x@gmail.com"
                  className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-xs font-medium transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                Owner Secure Password
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-xs font-medium transition"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-amber-500/10 active:scale-95 transition cursor-pointer"
              >
                {loading ? 'Verifying Credentials...' : 'Sign In as Owner'}
              </button>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs active:scale-95 transition cursor-pointer"
              >
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                Google Account login
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-450">
                <span className="bg-white px-3 text-slate-400">Owner Live Demo Sandbox</span>
              </div>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={handleDemoSignIn}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-amber-400 rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-slate-900/10 cursor-pointer"
              >
                Sign In as Verified Owner (Demo Account)
                <ArrowRight className="h-3.5 w-3.5 text-amber-500" />
              </button>
            </div>
          </div>

          {/* V.E.M Roadlines contact credentials banner */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col items-center text-center space-y-1.5 text-[10px] text-slate-400 font-medium">
            <p className="font-bold text-slate-700 uppercase tracking-wide">V.E.M Roadlines Support desk</p>
            <p>🤙 9900525663 / 9035625663</p>
            <p>✉️ dhanushdharma1x@gmail.com</p>
            <p className="text-[#F59E0B] font-semibold">📸 Instagram: @vem_roadlines</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
