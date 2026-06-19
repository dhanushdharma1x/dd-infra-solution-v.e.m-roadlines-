import { useState, useEffect, useMemo } from 'react';
import { 
  onAuthStateChanged, signOut 
} from 'firebase/auth';
import { 
  collection, getDocs, doc, getDoc, getDocFromServer 
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { checkAndSeedDatabase } from './data/seed';
import { 
  Machine, Operator, Client, DailyWorkEntry, Expense, SalaryRecord, ClientBill, PaymentHistory, Stats, UserProfile 
} from './types';
import { calculateBusinessStats } from './utils/calc';

// Views
import Login from './components/Login';
import Overview from './components/Overview';
import MachinesList from './components/MachinesList';
import DailyWorkEntries from './components/DailyWorkEntries';
import ExpensesList from './components/ExpensesList';
import SalariesList from './components/SalariesList';
import ClientBilling from './components/ClientBilling';

// Icons
import { 
  TrendingUp, Truck, FileSpreadsheet, Fuel, UserCheck, Receipt, HardHat, LogOut, Sun, Moon, Sparkles, Loader2, Menu, X, RefreshCw 
} from 'lucide-react';

export default function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'machines' | 'work' | 'expenses' | 'salaries' | 'billing'>('overview');
  
  // App Global State
  const [machines, setMachines] = useState<Machine[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [workEntries, setWorkEntries] = useState<DailyWorkEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [bills, setBills] = useState<ClientBill[]>([]);
  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Trigger forms directly from quick action buttons
  const [directWorkForm, setDirectWorkForm] = useState(false);
  const [directDieselForm, setDirectDieselForm] = useState(false);
  const [directExpenseForm, setDirectExpenseForm] = useState(false);
  const [directSalaryForm, setDirectSalaryForm] = useState(false);
  const [directPaymentForm, setDirectPaymentForm] = useState(false);

  // CRITICAL CONSTRAINT: Test Firestore Connection when App Boots
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'machines', 'test_conn'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration or networks.");
        }
      }
    }
    testConnection();
  }, []);

  // Sync auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const profileSnap = await getDoc(doc(db, 'users', user.uid));
          if (profileSnap.exists()) {
            setUserProfile(profileSnap.data() as UserProfile);
          } else {
            // Unsaved profile fallback
            setUserProfile({
              id: user.uid,
              name: user.displayName || user.email?.split('@')[0] || 'User',
              email: user.email || '',
              role: 'admin' // default
            });
          }
        } catch (err) {
          console.error('Failed profile loading:', err);
        }
      } else {
        setUserProfile(null);
      }
      setAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  // Fetch full dataset helper
  const loadData = async () => {
    if (!auth.currentUser) return;
    setDataLoading(true);
    try {
      // 1. Seed if empty
      await checkAndSeedDatabase();

      // 2. Fetch all collections in parallel
      const [
        machinesSnap,
        operatorsSnap,
        clientsSnap,
        workSnap,
        expensesSnap,
        salarySnap,
        billsSnap,
        paymentsSnap
      ] = await Promise.all([
        getDocs(collection(db, 'machines')),
        getDocs(collection(db, 'operators')),
        getDocs(collection(db, 'clients')),
        getDocs(collection(db, 'dailyWorkEntries')),
        getDocs(collection(db, 'expenses')),
        getDocs(collection(db, 'salaryRecords')),
        getDocs(collection(db, 'clientBills')),
        getDocs(collection(db, 'paymentHistory'))
      ]);

      setMachines(machinesSnap.docs.map(d => d.data() as Machine));
      setOperators(operatorsSnap.docs.map(d => d.data() as Operator));
      setClients(clientsSnap.docs.map(d => d.data() as Client));
      setWorkEntries(workSnap.docs.map(d => d.data() as DailyWorkEntry));
      setExpenses(expensesSnap.docs.map(d => d.data() as Expense));
      setSalaryRecords(salarySnap.docs.map(d => d.data() as SalaryRecord));
      setBills(billsSnap.docs.map(d => d.data() as ClientBill));
      setPayments(paymentsSnap.docs.map(d => d.data() as PaymentHistory));

    } catch (err) {
      console.error('Failed fetching fleet database snapshot logs:', err);
    } finally {
      setDataLoading(false);
    }
  };

  // Trigger reloading whenever logging in completes or seeder executes
  useEffect(() => {
    if (userProfile) {
      loadData();
    }
  }, [userProfile]);

  // Aggregate stats helper
  const businessStats = useMemo(() => {
    return calculateBusinessStats(workEntries, expenses, bills, payments, machines);
  }, [workEntries, expenses, bills, payments, machines]);

  // Handle logout
  const handleSignout = async () => {
    await signOut(auth);
    setUserProfile(null);
  };

  // Quick Action Switchboard routing
  const handleQuickAction = (action: 'work' | 'diesel' | 'expense' | 'salary' | 'payment') => {
    if (action === 'work') {
      setActiveTab('work');
      setDirectWorkForm(true);
    } else if (action === 'diesel') {
      setActiveTab('expenses');
      setDirectDieselForm(true);
    } else if (action === 'expense') {
      setActiveTab('expenses');
      setDirectExpenseForm(true);
    } else if (action === 'salary') {
      setActiveTab('salaries');
      setDirectSalaryForm(true);
    } else if (action === 'payment') {
      setActiveTab('billing');
      setDirectPaymentForm(true);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center gap-4 text-white">
        <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
        <p className="text-slate-400 font-bold text-sm tracking-widest uppercase">DD Infra Systems Loading...</p>
      </div>
    );
  }

  // Not logged in routing
  if (!userProfile) {
    return <Login onLoginSuccess={(profile) => setUserProfile(profile)} />;
  }

  return (
    <div className="min-h-screen font-sans bg-[#F8FAFC] text-slate-800">
      
      {/* Upper Construction Yellow Highlight bar */}
      <div className="h-1.5 w-full bg-linear-to-r from-amber-500 via-amber-400 to-amber-600"></div>

      {/* Main app grid shell */}
      <div className="flex flex-col lg:flex-row min-h-screen">
        
        {/* DESKTOP SIDEBAR NAVIGATION */}
        <aside className="hidden lg:flex flex-col justify-between w-64 bg-[#0F172A] text-white shrink-0 border-r border-slate-800 p-6">
          <div className="space-y-8">
            {/* Header / Logo */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#F59E0B] text-[#0F172A] rounded-xl shadow-md">
                <HardHat className="h-6 w-6 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="font-extrabold text-xs tracking-wider leading-none">DD INFRA</h1>
                <span className="text-[9px] text-[#F59E0B] font-extrabold block mt-0.5">V.E.M ROADLINES</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="space-y-1">
              {[
                { id: 'overview', label: 'Dashboard Overview', icon: TrendingUp },
                { id: 'machines', label: 'Performance & Fleet', icon: Truck },
                { id: 'work', label: 'Operations Work Log', icon: FileSpreadsheet },
                { id: 'expenses', label: 'Fuel & Expenses', icon: Fuel },
                { id: 'salaries', label: 'Operators Payroll', icon: UserCheck },
                { id: 'billing', label: 'Invoices & Billings', icon: Receipt }
              ].map(tab => {
                const IconComp = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center gap-3 py-2.5 px-4 rounded-lg text-xs font-semibold transition-all ${
                      isSelected 
                        ? 'bg-[#F59E0B]/15 text-[#F59E0B] border-l-2 border-[#F59E0B]' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <IconComp className="h-4 w-4 shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* User Section & Profile */}
          <div className="pt-6 border-t border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white truncate max-w-[130px]">{userProfile.name}</p>
                <span className="text-[10px] text-[#F59E0B] font-extrabold uppercase tracking-wider block">Verified Owner</span>
              </div>
              <div className="flex gap-1.5">
                <button 
                  onClick={handleSignout}
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg transition"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <button 
              onClick={loadData}
              disabled={dataLoading}
              className="w-full text-center py-2 bg-[#1E293B] hover:bg-slate-800 text-[10px] font-bold rounded-lg border border-slate-700 flex items-center justify-center gap-1.5 text-slate-300 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${dataLoading ? 'animate-spin' : ''}`} /> Sync Database Pool
            </button>

            <div className="bg-[#1E293B]/40 p-2.5 rounded-lg border border-slate-800 text-[9px] text-slate-400 space-y-1">
              <p className="font-bold text-[#F59E0B] uppercase tracking-wide text-[10px]">V.E.M Roadlines</p>
              <p className="flex items-center gap-1">📞 9900525663 / 9035625663</p>
              <p className="truncate">✉️ dhanushdharma1x@gmail.com</p>
              <p className="text-amber-500 font-semibold">📸 instagram: vem_roadlines</p>
            </div>
          </div>
        </aside>

        {/* MOBILE NAVIGATION CONTAINER HEADER */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#0F172A] text-white border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#F59E0B] text-[#0F172A] rounded-lg shadow-sm">
              <HardHat className="h-5 w-5" />
            </div>
            <span className="font-extrabold text-xs tracking-wider">DD INFRA (V.E.M ROADLINES)</span>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
              className="p-1.5 text-slate-400 hover:text-white"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {/* MOBILE SLIDE-OUT MENU DRAWER */}
        {mobileMenuOpen && (
          <nav className="lg:hidden bg-[#0F172A] text-white border-b border-slate-800 px-4 py-4 space-y-2">
            {[
              { id: 'overview', label: 'Dashboard Overview', icon: TrendingUp },
              { id: 'machines', label: 'Performance & Fleet', icon: Truck },
              { id: 'work', label: 'Operations Work Log', icon: FileSpreadsheet },
              { id: 'expenses', label: 'Fuel & Expenses', icon: Fuel },
              { id: 'salaries', label: 'Operators Payroll', icon: UserCheck },
              { id: 'billing', label: 'Invoices & Billings', icon: Receipt }
            ].map(tab => {
              const IconComp = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id as any); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 py-2.5 px-4 rounded-lg text-xs font-semibold text-left transition ${
                    isSelected 
                      ? 'bg-[#F59E0B]/15 text-[#F59E0B] border-l-2 border-[#F59E0B]' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <IconComp className="h-4 w-4 shrink-0" />
                  {tab.label}
                </button>
              );
            })}
            <div className="pt-3 border-t border-slate-850 flex items-center justify-between text-xs text-slate-400">
              <span>👤 {userProfile.name} (Owner)</span>
              <button onClick={handleSignout} className="text-rose-400 font-semibold flex items-center gap-1">
                <LogOut className="h-3.5 w-3.5" /> Out
              </button>
            </div>
          </nav>
        )}

        {/* MAIN BODY WINDOW STACE */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {dataLoading && (
            <div className="mb-4 bg-amber-500/10 border border-amber-500/20 text-white rounded-2xl p-4 flex items-center gap-3 justify-center text-xs font-bold animate-pulse">
              <Loader2 className="h-4 w-4 text-amber-500 animate-spin" /> Synchronizing Firestore Data Pool...
            </div>
          )}

          {/* VIEW SWITCHER ROUTING */}
          {activeTab === 'overview' && (
            <Overview
              workEntries={workEntries}
              expenses={expenses}
              bills={bills}
              payments={payments}
              machines={machines}
              operators={operators}
              stats={businessStats}
              role={userProfile.role}
              onQuickAction={handleQuickAction}
            />
          )}

          {activeTab === 'machines' && (
            <MachinesList
              machines={machines}
              operators={operators}
              role={userProfile.role}
              onRefresh={loadData}
            />
          )}

          {activeTab === 'work' && (
            <DailyWorkEntries
              workEntries={workEntries}
              machines={machines}
              operators={operators}
              clients={clients}
              role={userProfile.role}
              onRefresh={loadData}
              showFormDirectly={directWorkForm}
              onFormCloseDirectly={() => setDirectWorkForm(false)}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpensesList
              expenses={expenses}
              machines={machines}
              role={userProfile.role}
              onRefresh={loadData}
              showFormDirectly={directDieselForm || directExpenseForm}
              onFormCloseDirectly={() => { setDirectDieselForm(false); setDirectExpenseForm(false); }}
            />
          )}

          {activeTab === 'salaries' && (
            <SalariesList
              operators={operators}
              salaryRecords={salaryRecords}
              role={userProfile.role}
              onRefresh={loadData}
              showFormDirectly={directSalaryForm}
              onFormCloseDirectly={() => setDirectSalaryForm(false)}
            />
          )}

          {activeTab === 'billing' && (
            <ClientBilling
              clients={clients}
              bills={bills}
              payments={payments}
              workEntries={workEntries}
              role={userProfile.role}
              onRefresh={loadData}
              showPaymentFormDirectly={directPaymentForm}
              onPaymentFormCloseDirectly={() => setDirectPaymentForm(false)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
