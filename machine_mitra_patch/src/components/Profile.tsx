import { useMemo, useState } from 'react';
import { Machine, DailyWorkEntry, PaymentHistory, Expense, UserProfile } from '../types';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Truck, DollarSign, Clock, User } from 'lucide-react';

interface ProfileProps {
  userProfile: UserProfile;
  machines: Machine[];
  workEntries: DailyWorkEntry[];
  payments: PaymentHistory[];
  expenses: Expense[];
}

export default function Profile({ userProfile, machines, workEntries, payments, expenses }: ProfileProps) {
  const totalHours = useMemo(() => workEntries.reduce((sum, entry) => sum + (entry.workingHours || 0), 0), [workEntries]);
  const totalReceived = useMemo(() => payments.reduce((sum, item) => sum + (item.amountReceived || 0), 0), [payments]);
  const totalExpenses = useMemo(() => expenses.reduce((sum, exp) => sum + (exp.dieselCost + exp.repairCost + exp.sparePartsCost + exp.serviceCost + exp.miscellaneousCost), 0), [expenses]);

  const [editing, setEditing] = useState(false);
  const [companyName, setCompanyName] = useState(userProfile.companyName || '');
  const [phone, setPhone] = useState(userProfile.phone || '');
  const [otpSentCode, setOtpSentCode] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpMessage, setOtpMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const sendOtpForProfile = () => {
    setOtpMessage('');
    const normalized = (phone || '').replace(/\D/g, '');
    if (!isLocalhost) {
      setOtpMessage('OTP sending from UI is for local/dev only. Use real SMS provider in production.');
      return;
    }
    if (normalized.length < 6) {
      setOtpMessage('Enter a valid phone number first.');
      return;
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 5 * 60 * 1000;
    try { sessionStorage.setItem(`dev_otp_${normalized}`, JSON.stringify({ code, expires })); } catch (e) {}
    setOtpSentCode(code);
    setOtpMessage(`OTP sent (dev): ${code}`);
    console.info(`Dev OTP for ${normalized}: ${code}`);
  };

  const verifyProfileOtp = async () => {
    setOtpMessage('');
    const normalized = (phone || '').replace(/\D/g, '');
    const raw = sessionStorage.getItem(`dev_otp_${normalized}`);
    if (!raw) { setOtpMessage('No OTP found. Send OTP first.'); return; }
    try {
      const { code, expires } = JSON.parse(raw);
      if (Date.now() > expires) { setOtpMessage('OTP expired.'); return; }
      if (otpInput.trim() !== String(code)) { setOtpMessage('Incorrect OTP.'); return; }

      setSaving(true);
      // Save companyName and phone to Firestore users/{id}
      await setDoc(doc(db, 'users', userProfile.id), { companyName: companyName.trim(), phone: phone.trim() }, { merge: true } as any);

      // Update session dev profile if present
      try {
        const rawDev = sessionStorage.getItem('dev_user_profile');
        if (rawDev) {
          const p = JSON.parse(rawDev);
          p.companyName = companyName.trim();
          p.phone = phone.trim();
          sessionStorage.setItem('dev_user_profile', JSON.stringify(p));
        }
      } catch (e) {}

      setOtpMessage('Profile updated.');
      setEditing(false);
    } catch (e) {
      setOtpMessage('OTP verify failed.');
    } finally {
      setSaving(false);
    }
  };

  return (<>
    <div id="profile_panel" className="space-y-6 font-sans pb-24">
      <div className="rounded-3xl bg-[#0F172A] p-6 text-white shadow-lg shadow-slate-900/10">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-3xl bg-amber-500 p-3">
              <User className="h-6 w-6 text-[#0F172A]" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-amber-300">Owner Profile</p>
              <h1 className="text-3xl font-black">Hi {userProfile.name}</h1>
            </div>
          </div>
          <div className="mt-3">
            <button onClick={() => setEditing(true)} className="rounded-xl bg-white text-amber-600 px-3 py-2 font-bold">Edit Profile</button>
          </div>
          <p className="text-sm text-slate-300 max-w-2xl">This page shows your fleet at a glance: machines, hours, money received, and expenses.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
          <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">Machines</p>
          <p className="mt-3 text-3xl font-extrabold text-slate-950">{machines.length}</p>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
          <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">Total Work Hours</p>
          <p className="mt-3 text-3xl font-extrabold text-slate-950">{totalHours} hrs</p>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
          <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">Total Paid</p>
          <p className="mt-3 text-3xl font-extrabold text-slate-950">₹{totalReceived.toLocaleString('en-IN')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
          <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">Total Expenses</p>
          <p className="mt-3 text-3xl font-extrabold text-slate-950">₹{totalExpenses.toLocaleString('en-IN')}</p>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
          <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">Unpaid / Pending</p>
          <p className="mt-3 text-3xl font-extrabold text-slate-950">₹0</p>
          <p className="text-slate-500 text-xs mt-2">Pending payments are visible on Home.</p>
        </div>
      </div>
    </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 pt-16">
          <div className="w-full max-w-lg rounded-[2rem] bg-white border border-slate-200 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Edit Profile</h3>
                <p className="text-sm text-slate-500 mt-1">Add your company name and phone to your profile.</p>
              </div>
              <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {otpMessage && <div className="mb-4 rounded-3xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">{otpMessage}</div>}

            <div className="space-y-3">
              <label className="block text-xs uppercase tracking-[0.2em] text-slate-500">Owner Name</label>
              <input value={userProfile.name} disabled className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900" />

              <label className="block text-xs uppercase tracking-[0.2em] text-slate-500">Company Name</label>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Ramesh Contractors" className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />

              <label className="block text-xs uppercase tracking-[0.2em] text-slate-500">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 9876543210" className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />

              <div className="flex gap-2">
                <button onClick={sendOtpForProfile} className="flex-1 py-3 bg-amber-500 text-white font-extrabold rounded-xl text-sm">Send OTP</button>
              </div>

              {otpSentCode && (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-600">Enter OTP (dev)</div>
                  <div className="flex gap-2">
                    <input type="text" value={otpInput} onChange={(e) => setOtpInput(e.target.value)} placeholder="123456" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs" />
                    <button onClick={verifyProfileOtp} className="py-2.5 px-4 bg-emerald-600 text-white font-bold rounded-xl">Verify & Save</button>
                  </div>
                </div>
              )}

              <div className="pt-3 text-sm text-slate-500">Note: OTP sending here is for local/dev testing. In production, integrate Firebase Phone Auth or an SMS provider.</div>
            </div>
          </div>
        </div>
      )}
    </>);
}
