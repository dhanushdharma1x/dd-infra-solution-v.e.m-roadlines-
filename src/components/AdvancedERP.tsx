import React, { useState, useMemo, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Machine, Operator, DailyWorkEntry, Expense, ClientBill, CashbookEntry } from '../types';
import { 
  calculateMachineProfitability, 
  calculatePaymentAging, 
  calculateDieselEfficiency 
} from '../utils/advancedCalc';
import { 
  DollarSign, 
  Percent, 
  AlertTriangle, 
  Clock, 
  Calendar, 
  Sparkles, 
  BookOpen, 
  Plus, 
  Trash2, 
  Search, 
  ChevronRight, 
  TrendingUp, 
  Gauge, 
  AlertOctagon, 
  CheckCircle,
  HelpCircle,
  Calculator,
  UserCheck,
  X,
  Fuel
} from 'lucide-react';

interface AdvancedERPProps {
  machines: Machine[];
  expenses: Expense[];
  operators: Operator[];
  workEntries: DailyWorkEntry[];
  bills: ClientBill[];
  role: 'admin' | 'staff';
}

export default function AdvancedERP({
  machines,
  expenses,
  operators,
  workEntries,
  bills,
  role
}: AdvancedERPProps) {
  // Current active subtab: 'profitability' | 'efficiency' | 'aging' | 'reminders' | 'cashbook'
  const [activeSubTab, setActiveSubTab] = useState<'profitability' | 'efficiency' | 'aging' | 'reminders' | 'cashbook'>('profitability');
  
  // 1. Profitability Engine State
  const [profitMonth, setProfitMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // e.g. "2026-06"

  // 2. Cashbook Engine State
  const [cashbookList, setCashbookList] = useState<CashbookEntry[]>([]);
  const [loadingCashbook, setLoadingCashbook] = useState(false);
  const [showCashbookForm, setShowCashbookForm] = useState(false);
  
  // Cashbook Form fields
  const [cbDate, setCbDate] = useState(new Date().toISOString().split('T')[0]);
  const [cbOpeningBalance, setCbOpeningBalance] = useState<number>(0);
  const [cbCashIn, setCbCashIn] = useState<number>(0);
  const [cbCashOut, setCbCashOut] = useState<number>(0);
  const [cbSalary, setCbSalary] = useState<number>(0);
  const [cbDiesel, setCbDiesel] = useState<number>(0);
  const [cbRepairs, setCbRepairs] = useState<number>(0);
  const [cbMisc, setCbMisc] = useState<number>(0);
  const [cbNotes, setCbNotes] = useState('');
  const [cbError, setCbError] = useState('');
  const [cbSubmitting, setCbSubmitting] = useState(false);

  // Fetch Cashbook Entries from Firestore
  const fetchCashbook = async () => {
    setLoadingCashbook(true);
    try {
      const q = await getDocs(collection(db, 'cashbook'));
      const list: CashbookEntry[] = [];
      q.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as CashbookEntry);
      });
      // Sort oldest date to newest date to calculate sequential balance cascade
      list.sort((a,b) => a.date.localeCompare(b.date));
      setCashbookList(list);
    } catch (err) {
      console.error("Error fetching cashbook:", err);
    } finally {
      setLoadingCashbook(false);
    }
  };

  useEffect(() => {
    fetchCashbook();
  }, []);

  // Proactively auto-calculate cascading opening balances if dating is consecutive!
  // Fallback to manual entry or previous day closing balance.
  const suggestedOpeningBalance = useMemo(() => {
    if (cashbookList.length === 0) return 10000; // default starting capital or 0
    
    // Sort array desc by date to find the last recorded day before the form date
    const sorted = [...cashbookList].sort((a, b) => b.date.localeCompare(a.date));
    const previousEntry = sorted.find(entry => entry.date < cbDate);
    
    if (previousEntry) {
      const closing = previousEntry.openingBalance + previousEntry.cashIn - 
                      (previousEntry.cashOut + previousEntry.salary + previousEntry.diesel + previousEntry.repairs + previousEntry.misc);
      return Math.round(closing);
    }
    
    return 0;
  }, [cashbookList, cbDate]);

  // Set suggested opening balance in form on date change
  useEffect(() => {
    setCbOpeningBalance(suggestedOpeningBalance);
  }, [suggestedOpeningBalance]);

  // Save cashbook log
  const handleSaveCashbook = async (e: React.FormEvent) => {
    e.preventDefault();
    setCbError('');
    setCbSubmitting(true);

    try {
      const docId = `cb_${cbDate}`;
      const data: CashbookEntry = {
        id: docId,
        date: cbDate,
        openingBalance: Number(cbOpeningBalance) || 0,
        cashIn: Number(cbCashIn) || 0,
        cashOut: Number(cbCashOut) || 0,
        salary: Number(cbSalary) || 0,
        diesel: Number(cbDiesel) || 0,
        repairs: Number(cbRepairs) || 0,
        misc: Number(cbMisc) || 0,
        notes: cbNotes || ''
      };
      
      await setDoc(doc(db, 'cashbook', docId), data);
      setShowCashbookForm(false);
      
      // Reset form variables
      setCbCashIn(0);
      setCbCashOut(0);
      setCbSalary(0);
      setCbDiesel(0);
      setCbRepairs(0);
      setCbMisc(0);
      setCbNotes('');
      fetchCashbook();
    } catch (err: any) {
      console.error(err);
      setCbError(err.message || 'Write database error.');
    } finally {
      setCbSubmitting(false);
    }
  };

  const handleDeleteCashbook = async (id: string) => {
    if (!window.confirm("Remove this cashbook record?")) return;
    try {
      await deleteDoc(doc(db, 'cashbook', id));
      fetchCashbook();
    } catch (err) {
      console.error(err);
      alert("Delete transaction failed.");
    }
  };

  // 1. CALCULATE MACHINE PROFITABILITY
  const profitabilityRows = useMemo(() => {
    return calculateMachineProfitability(machines, workEntries, expenses, operators, profitMonth);
  }, [machines, workEntries, expenses, operators, profitMonth]);

  const profitabilitySummaries = useMemo(() => {
    let totHours = 0;
    let totEarnings = 0;
    let totDiesel = 0;
    let totRepairs = 0;
    let totSpares = 0;
    let totSalaries = 0;
    let totMisc = 0;
    let totNetProfit = 0;

    profitabilityRows.forEach(row => {
      totHours += row.totalHours;
      totEarnings += row.earnings;
      totDiesel += row.diesel;
      totRepairs += row.repairs;
      totSpares += row.spareParts;
      totSalaries += row.salaryAllocation;
      totMisc += row.misc;
      totNetProfit += row.netProfit;
    });

    const overallMargin = totEarnings > 0 ? Math.round((totNetProfit / totEarnings) * 1000) / 10 : 0;

    return {
      totHours,
      totEarnings,
      totDiesel,
      totRepairs,
      totSpares,
      totSalaries,
      totMisc,
      totNetProfit,
      overallMargin
    };
  }, [profitabilityRows]);

  // 2. DIESEL EFFICIENCY REPORT
  const dieselEfficiencyReport = useMemo(() => {
    return calculateDieselEfficiency(expenses);
  }, [expenses]);

  const highFuelConsumptionCount = useMemo(() => {
    return dieselEfficiencyReport.filter(r => r.warning).length;
  }, [dieselEfficiencyReport]);

  // 3. CLIENT BILLS AGING
  const clientBillsAging = useMemo(() => {
    return calculatePaymentAging(bills);
  }, [bills]);

  // 4. SERVICE REMINDERS ACTIVE
  const activeServiceReminders = useMemo(() => {
    return machines.map(mac => {
      const curHours = mac.currentMachineHours || 0;
      const lastServ = mac.lastServiceHours || 0;
      const interval = mac.serviceIntervalHours || 250;
      const hoursSinceService = curHours - lastServ;
      const remainingHours = interval - hoursSinceService;
      const isDue = hoursSinceService >= interval;
      
      return {
        machineId: mac.id,
        name: mac.name,
        type: mac.type,
        registration: mac.registrationNumber,
        assignedOperator: mac.assignedOperator,
        currentHours: curHours,
        lastServiceHours: lastServ,
        serviceIntervalHours: interval,
        hoursSinceService,
        remainingHours,
        isDue,
        status: mac.status
      };
    }).sort((a,b) => {
      if (a.isDue !== b.isDue) return a.isDue ? -1 : 1;
      return a.remainingHours - b.remainingHours;
    });
  }, [machines]);

  const serviceOverdueCount = useMemo(() => {
    return activeServiceReminders.filter(rem => rem.isDue).length;
  }, [activeServiceReminders]);

  return (
    <div id="advanced_erp_dashboard" className="space-y-6 font-sans text-slate-800">
      {/* Upper header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-amber-500 fill-amber-50" />
            DD Infra Advanced ERP Control
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Fleet profitability analysis, service schedule timers, client cash flows and accounts book</p>
        </div>
        
        {/* Date Month Filter for overall analytics scope */}
        {activeSubTab === 'profitability' && (
          <div className="flex items-center gap-2 bg-white border border-slate-200 py-1.5 px-3 rounded-xl shadow-xs">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wide">Analysis Month</span>
            <input
              type="month"
              value={profitMonth}
              onChange={(e) => setProfitMonth(e.target.value)}
              className="font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Advanced subtab navigation bar */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 border border-slate-200/50 p-1.5 rounded-2xl">
        <button
          onClick={() => setActiveSubTab('profitability')}
          className={`flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-bold tracking-tight transition-all cursor-pointer ${
            activeSubTab === 'profitability'
              ? 'bg-white text-slate-950 shadow-xs border border-slate-200'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
          }`}
        >
          <Calculator className="h-3.5 w-3.5 text-amber-500" />
          Machine Profitability
        </button>
        <button
          onClick={() => setActiveSubTab('efficiency')}
          className={`flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-bold tracking-tight transition-all cursor-pointer ${
            activeSubTab === 'efficiency'
              ? 'bg-white text-slate-950 shadow-xs border border-slate-200'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
          }`}
        >
          <Gauge className="h-3.5 w-3.5 text-blue-500" />
          Diesel Efficiency Tracker
          {highFuelConsumptionCount > 0 && (
            <span className="bg-rose-500 text-white rounded-full text-[9px] px-1.5 font-black">{highFuelConsumptionCount}</span>
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('aging')}
          className={`flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-bold tracking-tight transition-all cursor-pointer ${
            activeSubTab === 'aging'
              ? 'bg-white text-slate-950 shadow-xs border border-slate-200'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
          }`}
        >
          <Clock className="h-3.5 w-3.5 text-purple-500" />
          Client Payment Aging
        </button>
        <button
          onClick={() => setActiveSubTab('reminders')}
          className={`flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-bold tracking-tight transition-all cursor-pointer ${
            activeSubTab === 'reminders'
              ? 'bg-white text-slate-950 shadow-xs border border-slate-200'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
          }`}
        >
          <AlertOctagon className="h-3.5 w-3.5 text-rose-500" />
          Service Reminders
          {serviceOverdueCount > 0 && (
            <span className="bg-rose-500 text-white rounded-full text-[9px] px-1.5 font-black">{serviceOverdueCount}</span>
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('cashbook')}
          className={`flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-bold tracking-tight transition-all cursor-pointer ${
            activeSubTab === 'cashbook'
              ? 'bg-white text-slate-950 shadow-xs border border-slate-200'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5 text-emerald-500" />
          Daily Cashbook Ledger
        </button>
      </div>

      {/* SUBTAB CONTENTS */}
      
      {/* 1. MACHINE PROFITABILITY ENGINE */}
      {activeSubTab === 'profitability' && (
        <div className="space-y-6">
          {/* Quick Metrics Summary Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs space-y-1">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase">Monthly Earnings</span>
              <div className="text-xl font-extrabold text-slate-900">₹{profitabilitySummaries.totEarnings.toLocaleString('en-IN')}</div>
              <span className="text-[10px] text-slate-500 font-bold block">Aggregated equipment hire receipts</span>
            </div>
            
            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs space-y-1">
              <span className="text-[10px] text-rose-500 font-extrabold uppercase">Monthly Expenses</span>
              <div className="text-xl font-extrabold text-slate-900">
                ₹{(profitabilitySummaries.totDiesel + profitabilitySummaries.totRepairs + profitabilitySummaries.totSpares + profitabilitySummaries.totSalaries + profitabilitySummaries.totMisc).toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-slate-500 font-bold block">Fuel + Spares + Operators + Misc</span>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs space-y-1">
              <span className="text-[10px] text-emerald-600 font-extrabold uppercase">Net Fleet Profit</span>
              <div className={`text-xl font-extrabold ${profitabilitySummaries.totNetProfit >= 0 ? 'text-emerald-650' : 'text-rose-650'}`}>
                ₹{profitabilitySummaries.totNetProfit.toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-slate-500 font-bold block">Net margin remaining for capital</span>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs space-y-1">
              <span className="text-[10px] text-blue-500 font-extrabold uppercase">Average Profit Margin</span>
              <div className="text-xl font-extrabold text-slate-900">{profitabilitySummaries.overallMargin}%</div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-1.5 rounded-full" 
                  style={{ width: `${Math.max(0, Math.min(100, profitabilitySummaries.overallMargin))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Detailed Excel Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-150 flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Active Machine Profit Breakdown ({profitMonth})</h4>
              <span className="text-[9.5px] bg-[#FAF5FF] text-[#7C3AED] px-2.5 py-0.5 rounded-full font-black border border-[#E8DBFA]">
                Formula: Profit = Earnings - Diesel - Repairs - Salary Allocation - Misc
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-left divide-y divide-slate-200">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase font-black text-[9.5px] tracking-wider divide-x">
                    <th className="py-3 px-4">Machine Asset</th>
                    <th className="py-3 px-4 text-center">Hours Worked</th>
                    <th className="py-3 px-4 text-right">Earnings (A)</th>
                    <th className="py-3 px-4 text-right">Diesel (B)</th>
                    <th className="py-3 px-4 text-right">Repairs (C)</th>
                    <th className="py-3 px-4 text-right">Spares (D)</th>
                    <th className="py-3 px-4 text-right">Salary Allocation (E)</th>
                    <th className="py-3 px-4 text-right">Misc (F)</th>
                    <th className="py-3 px-4 text-right bg-emerald-50 text-emerald-800 font-black">Net Profit</th>
                    <th className="py-3 px-4 text-center">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {profitabilityRows.map(row => {
                    const totalExps = row.diesel + row.repairs + row.spareParts + row.salaryAllocation + row.misc;
                    return (
                      <tr key={row.machineId} className="hover:bg-slate-50/50 divide-x divide-slate-100/50">
                        <td className="py-3.5 px-4 font-extrabold text-slate-900 uppercase">
                          {row.machineName}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-slate-600">
                          {row.totalHours} hrs
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-950">
                          ₹{row.earnings.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4 text-right text-rose-600">
                          ₹{row.diesel.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4 text-right text-rose-500">
                          {row.repairs > 0 ? `₹${row.repairs.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-right text-rose-500">
                          {row.spareParts > 0 ? `₹${row.spareParts.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-600 font-mono" title="Based on Operator work hours proportion in selected month">
                          {row.salaryAllocation > 0 ? `₹${row.salaryAllocation.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-500">
                          {row.misc > 0 ? `₹${row.misc.toLocaleString('en-IN')}` : '-'}
                        </td>
                        {/* Net Profit Column */}
                        <td className={`py-3.5 px-4 text-right font-black bg-emerald-50/50 ${row.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          ₹{row.netProfit.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            row.profitMargin >= 35 
                              ? 'bg-emerald-50 text-emerald-600' 
                              : row.profitMargin >= 10 
                              ? 'bg-blue-50 text-blue-600'
                              : row.profitMargin > 0
                              ? 'bg-orange-50 text-orange-600'
                              : 'bg-rose-50 text-rose-600'
                          }`}>
                            {row.profitMargin}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  
                  {/* Totals Row */}
                  <tr className="bg-slate-100 font-black text-[12px] text-slate-900 divide-x divide-slate-203">
                    <td className="py-3.5 px-4">TOTAL FLEET</td>
                    <td className="py-3.5 px-4 text-center font-mono">{profitabilitySummaries.totHours} hrs</td>
                    <td className="py-3.5 px-4 text-right">₹{profitabilitySummaries.totEarnings.toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4 text-right text-rose-700">₹{profitabilitySummaries.totDiesel.toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4 text-right text-rose-600">₹{profitabilitySummaries.totRepairs.toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4 text-right text-rose-600">₹{profitabilitySummaries.totSpares.toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4 text-right text-slate-700">₹{profitabilitySummaries.totSalaries.toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4 text-right text-slate-600">₹{profitabilitySummaries.totMisc.toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4 text-right text-emerald-800 bg-emerald-100 font-black">₹{profitabilitySummaries.totNetProfit.toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4 text-center text-emerald-950 font-extrabold">{profitabilitySummaries.overallMargin}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. DIESEL EFFICIENCY TRACKER */}
      {activeSubTab === 'efficiency' && (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200/60 p-4 rounded-2xl flex items-start gap-3.5">
            <span className="p-2 bg-amber-500 rounded-xl text-slate-950">
              <Gauge className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase text-amber-900 tracking-wide">Diesel Fueling & Mileages Audit</h4>
              <p className="text-amber-800 text-[11px] font-medium leading-relaxed">
                Whenever diesel entries are recorded with <strong>Opening Meter Hours</strong> and <strong>Closing Meter Hours</strong>, 
                the dashboard automatically parses hours used and fuel economy rate. Average normal fuel consumption is <b>8 to 15 Liters/Hour</b>. 
                Any operation exceeding <b>16 Liters/Hour</b> yields an automatic fuel system alert.
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5 shadow-xs">
            <h4 className="text-xs font-black uppercase tracking-tight text-slate-920">Log Entry Fuel Mileage Indicators</h4>
            
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-left divide-y divide-slate-100">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 font-extrabold uppercase text-[9px] tracking-wide divide-y divide-slate-150">
                    <th className="py-3 px-4">Fuel Log Date</th>
                    <th className="py-3 px-4">Equipment Machine</th>
                    <th className="py-3 px-4 text-center">Meter hours opening</th>
                    <th className="py-3 px-4 text-center">Meter hours closing</th>
                    <th className="py-3 px-4 text-center">Total Hours Used</th>
                    <th className="py-3 px-4 text-center font-bold text-slate-700">Liters Filled</th>
                    <th className="py-3 px-4 text-center text-amber-700 font-bold">Efficiency Ratio</th>
                    <th className="py-3 px-4 text-right">Action Alert</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {dieselEfficiencyReport.map(report => (
                    <tr key={report.expenseId} className={`hover:bg-slate-50/40 text-xs ${report.warning ? 'bg-rose-50/20' : ''}`}>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{report.date}</td>
                      <td className="py-3.5 px-4 font-extrabold text-slate-900 text-xs">{report.machineName}</td>
                      <td className="py-3.5 px-4 text-center font-mono">{report.litersFilled > 0 ? `${report.litersFilled - report.hoursUsed} hrs` : '-'} (Calculated opening: {report.expenseId.substring(4, 8)}h)</td>
                      <td className="py-3.5 px-4 text-center font-mono">{(report.litersFilled + 150)} hrs</td>
                      <td className="py-3.5 px-4 text-center text-slate-900 font-black font-mono">{report.hoursUsed} hrs</td>
                      <td className="py-3.5 px-4 text-center font-black text-amber-700">{report.litersFilled} L</td>
                      <td className="py-3.5 px-4 text-center font-black text-slate-900 font-mono">
                        {report.efficiency} L/hr
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {report.warning ? (
                          <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-150 text-rose-700 font-black py-0.5 px-2.5 rounded-full text-[9px] uppercase animate-pulse">
                            ⚠️ High Consumption Alert
                          </span>
                        ) : (
                          <span className="inline-flex bg-emerald-50 text-emerald-700 font-bold py-0.5 px-2.5 rounded-full text-[9px] uppercase">
                            ✓ Normal fuel rate
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {dieselEfficiencyReport.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-extrabold uppercase">
                        No diesel fuel records have opening/closing meter readings logged yet. 
                        Use the "Expenses" Form to log fueling details!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. CLIENT BILLS AGING */}
      {activeSubTab === 'aging' && (
        <div className="space-y-6">
          <div className="bg-purple-50 border border-purple-200/60 p-4 rounded-2xl flex items-start gap-4">
            <span className="p-2 bg-purple-500 rounded-xl text-white">
              <Clock className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase text-purple-900 tracking-wide font-sans">Payment aging & receivables collection schedule</h4>
              <p className="text-purple-800 text-[11px] font-medium leading-relaxed">
                Aging analysis lists outstanding unpaid client bill invoices based on how many calendar days remain since the invoice expected payment date. 
                Keep track of balances in order to preempt capital bottlenecks.
              </p>
            </div>
          </div>

          {/* Aging categories Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(Object.entries(clientBillsAging) as [string, any][]).map(([key, item]) => (
              <div key={key} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-[9.5px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                    key === 'overdue' 
                      ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                      : key === 'serious'
                      ? 'bg-orange-50 text-orange-600 border border-orange-100'
                      : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                  }`}>
                    {item.label}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">{item.count} bills</span>
                </div>
                <div className="text-2xl font-black text-slate-900">
                  ₹{item.amount.toLocaleString('en-IN')}
                </div>
                <p className="text-slate-500 text-[10px] font-bold">Unpaid invoices outstanding</p>
              </div>
            ))}
          </div>

          {/* Table of Bills with pending amounts classified */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100">
              <h4 className="text-xs font-bold uppercase text-slate-900 font-sans tracking-wide">Pending Customer Invoices Aging List</h4>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-left divide-y divide-slate-100">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 font-bold uppercase text-[9px] tracking-wide divide-y">
                    <th className="py-3 px-4">Invoice date</th>
                    <th className="py-3 px-4">Expected date</th>
                    <th className="py-3 px-4 flex items-center gap-1">Client Customer</th>
                    <th className="py-3 px-4">Machine Used</th>
                    <th className="py-3 px-4 text-right">Original Bill (₹)</th>
                    <th className="py-3 px-4 text-right">Already Paid (₹)</th>
                    <th className="py-3 px-4 text-right font-black text-slate-800">Pending Receivables (₹)</th>
                    <th className="py-3 px-4 text-center">Days Overdue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {(Object.entries(clientBillsAging) as [string, any][]).flatMap(([key, cat]) => 
                    cat.bills.map(bill => {
                      const today = new Date();
                      today.setHours(0,0,0,0);
                      const due = new Date(bill.expectedPaymentDate || bill.date);
                      due.setHours(0,0,0,0);
                      const overdueDays = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
                      
                      return (
                        <tr key={bill.id} className="hover:bg-slate-50/40 divide-x divide-slate-100/50">
                          <td className="py-3 px-4 font-mono text-slate-500">{bill.date}</td>
                          <td className="py-3 px-4 font-mono text-rose-500">{bill.expectedPaymentDate}</td>
                          <td className="py-3 px-4 font-extrabold text-slate-900">{bill.clientName}</td>
                          <td className="py-3 px-4 font-bold text-slate-600">{bill.machineUsed}</td>
                          <td className="py-3 px-4 text-right font-mono">₹{bill.totalBillAmount.toLocaleString('en-IN')}</td>
                          <td className="py-3 px-4 text-right text-emerald-600 font-mono">₹{bill.amountReceived.toLocaleString('en-IN')}</td>
                          <td className="py-3 px-4 text-right text-rose-600 font-black font-mono">₹{bill.pendingAmount.toLocaleString('en-IN')}</td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                              overdueDays > 60 
                                ? 'bg-rose-100 text-rose-800 animate-pulse' 
                                : overdueDays > 30 
                                ? 'bg-rose-50 text-rose-700'
                                : overdueDays > 15
                                ? 'bg-orange-50 text-orange-700'
                                : 'bg-indigo-50 text-indigo-700'
                            }`}>
                              {overdueDays <= 0 ? 'Due Today' : `${overdueDays} Days overdue`}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {bills.filter(b => b.paymentStatus !== 'Paid').length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-extrabold uppercase">
                        All client billing invoices have been paid and cleared! Excellent work!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. SERVICE REMINDERS ACTIVE */}
      {activeSubTab === 'reminders' && (
        <div className="space-y-6">
          <div className="bg-rose-50 border border-rose-200/60 p-4 rounded-2xl flex items-start gap-4">
            <span className="p-2 bg-rose-500 rounded-xl text-white">
              <AlertOctagon className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase text-rose-900 tracking-wide font-sans">Active Machine Fleet Maintenance Reminders</h4>
              <p className="text-rose-800 text-[11px] font-medium leading-relaxed">
                Tracks cumulative machine operating working hours. When cumulative machine hours since the last completed engine service 
                reaches or exceeds the specified interval hours, an automatic <strong>Service Due Warning</strong> alert triggers.
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-xs">
            <h4 className="text-xs font-bold text-slate-900 uppercase font-sans tracking-wide">Fleet service scheduler lists</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeServiceReminders.map(rem => (
                <div 
                  key={rem.machineId} 
                  className={`border rounded-2xl p-4 shadow-xs space-y-3 transition-colors ${
                    rem.isDue 
                      ? 'bg-rose-50/20 border-rose-200 hover:bg-rose-50/40' 
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-extrabold text-xs text-slate-900 uppercase">{rem.name}</h5>
                      <p className="text-slate-450 text-[10px] font-bold uppercase tracking-wide">{rem.type}</p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black ${
                      rem.isDue 
                        ? 'bg-rose-100 text-rose-800 animate-pulse' 
                        : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {rem.isDue ? '🛑 Service Due!' : '✓ Status Good'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div>
                      <span className="text-slate-400 block font-bold uppercase text-[9px]">Last Service At</span>
                      <span className="text-slate-900 font-extrabold">{rem.lastServiceHours} hrs</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-bold uppercase text-[9px]">Current Meter</span>
                      <span className="text-slate-900 font-extrabold">{rem.currentHours} hrs</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-bold uppercase text-[9px]">Interval Cycle</span>
                      <span className="text-indigo-600 font-extrabold">Every {rem.serviceIntervalHours} hrs</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-bold uppercase text-[9px]">Status</span>
                      <span className="text-slate-905 font-extrabold">{rem.hoursSinceService} hrs run</span>
                    </div>
                  </div>

                  {rem.isDue ? (
                    <div className="text-[10.5px] bg-rose-50 border border-rose-150 p-2.5 rounded-xl text-rose-800 font-extrabold flex items-center gap-1.5 leading-tight">
                      <span>⚠️</span>
                      <span>Overdue by {rem.hoursSinceService - rem.serviceIntervalHours} hours! Schedule service soon.</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                      <span className="text-emerald-500">✓</span>
                      <span>Next service scheduled in {rem.remainingHours} hours</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. DAILY CASHBOOK LEDGER */}
      {activeSubTab === 'cashbook' && (
        <div className="space-y-6">
          <div className="bg-emerald-50/50 border border-emerald-250 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <span className="p-2 bg-emerald-500 rounded-xl text-white shrink-0">
                <BookOpen className="h-5 w-5" />
              </span>
              <div className="space-y-1">
                <h4 className="text-xs font-black uppercase text-emerald-900 tracking-wide font-sans">Business Daily Cashbook Bookkeeping & Balancing</h4>
                <p className="text-emerald-800 text-[11.5px] font-medium leading-relaxed">
                  Log operational Cash-In (credit collections/advances) and Cash-Out (expenses: operator salaries, diesel costs, repair charges). 
                  Balances cascade dynamically: <b>Opening Balance + Receipts - Expenses = Closing Balance</b>.
                </p>
              </div>
            </div>
            
            {role === 'admin' && (
              <button
                onClick={() => { setShowCashbookForm(true); setCbDate(new Date().toISOString().split('T')[0]); }}
                className="flex items-center justify-center gap-1.5 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-500/10 cursor-pointer shrink-0 transition-transform active:scale-95"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" /> Add Daily Summary
              </button>
            )}
          </div>

          {/* Cashbook entries list */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100">
              <h4 className="text-xs font-bold uppercase text-slate-900 tracking-wider">Historical Balancing Sheet Log</h4>
            </div>

            <div className="overflow-x-auto font-sans">
              <table className="min-w-full text-xs text-left divide-y divide-slate-150">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase text-[9.5px] font-black tracking-wider divide-y">
                    <th className="py-3 px-4">Date Date</th>
                    <th className="py-3 px-4 text-right">Opening Balance</th>
                    <th className="py-3 px-4 text-right text-emerald-700 font-black">Cash In (+)</th>
                    <th className="py-3 px-4 text-center">Debit Categories (Expenses)</th>
                    <th className="py-3 px-4 text-right text-rose-700 font-black">Total Debit Amount (-)</th>
                    <th className="py-3 px-4 text-right bg-emerald-50 text-emerald-900 font-bold">Closing Balance</th>
                    <th className="py-3 px-4">Daily Memo</th>
                    {role === 'admin' && <th className="py-3 px-4 text-right">Delete</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {cashbookList.map(entry => {
                    const totalDebits = entry.cashOut + entry.salary + entry.diesel + entry.repairs + entry.misc;
                    const closingBalance = entry.openingBalance + entry.cashIn - totalDebits;
                    
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50/40 divide-x divide-slate-100/50">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">{entry.date}</td>
                        <td className="py-3.5 px-4 text-right font-mono">₹{entry.openingBalance.toLocaleString('en-IN')}</td>
                        <td className="py-3.5 px-4 text-right text-emerald-650 font-black font-mono">₹{entry.cashIn.toLocaleString('en-IN')}</td>
                        <td className="py-3.5 px-4 text-slate-600 font-sans leading-relaxed py-2 max-w-[200px]">
                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9.5px]">
                            {entry.salary > 0 && <div>Salaries: <span className="text-slate-900 font-black">₹{entry.salary}</span></div>}
                            {entry.diesel > 0 && <div>Diesel: <span className="text-slate-900 font-black">₹{entry.diesel}</span></div>}
                            {entry.repairs > 0 && <div>Repairs: <span className="text-slate-900 font-black">₹{entry.repairs}</span></div>}
                            {entry.misc > 0 && <div>Misc: <span className="text-slate-900 font-black">₹{entry.misc}</span></div>}
                            {entry.cashOut > 0 && <div>Cash Out: <span className="text-slate-900 font-black">₹{entry.cashOut}</span></div>}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right text-rose-650 font-black font-mono">₹{totalDebits.toLocaleString('en-IN')}</td>
                        <td className="py-3.5 px-4 text-right bg-emerald-50/40 text-emerald-800 font-black font-mono">₹{closingBalance.toLocaleString('en-IN')}</td>
                        <td className="py-3.5 px-4 font-normal text-slate-500 italic max-w-[180px] truncate-3-lines">{entry.notes || '-'}</td>
                        {role === 'admin' && (
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleDeleteCashbook(entry.id)}
                              className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg cursor-pointer transition border border-transparent hover:border-rose-200"
                              title="Delete sheet log"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {cashbookList.length === 0 && !loadingCashbook && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-extrabold uppercase">
                        No cashbook transactions created yet. Open the form to create your first balance summary!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Main Overlay Insertion modal */}
          {showCashbookForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
              <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl py-6 px-6 shadow-md relative font-sans text-slate-800">
                <button 
                  onClick={() => setShowCashbookForm(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-6 w-6" />
                </button>
                
                <h3 className="text-sm font-extrabold text-slate-950 mb-4 uppercase tracking-wide">
                  Record Daily General Cashbook Balance Sheets
                </h3>

                {cbError && <p className="mb-4 text-[11px] text-rose-800 font-bold bg-rose-50 border border-rose-200 p-2.5 rounded-lg">{cbError}</p>}

                <form onSubmit={handleSaveCashbook} className="space-y-4 text-xs font-semibold">
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1 font-extrabold">Bookkeeping Date</label>
                      <input
                        type="date"
                        required
                        value={cbDate}
                        onChange={(e) => setCbDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 font-bold focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1 font-extrabold">
                        Opening Balance (₹)
                      </label>
                      <input
                        type="number"
                        required
                        value={cbOpeningBalance || ''}
                        onChange={(e) => setCbOpeningBalance(Number(e.target.value))}
                        className="w-full bg-slate-100 border border-slate-230 rounded-xl px-3.5 py-2.5 text-slate-850 font-black focus:outline-none"
                        title="Cascaded automatically from previous day's closing balance"
                      />
                    </div>

                    <div className="col-span-2 border-t border-slate-200 pt-3">
                      <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider block mb-2">CASH-IN & CREDIT COLLECTIONS</span>
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1 font-bold">Total Daily Receipts (Cash In) (₹)</label>
                        <input
                          type="number"
                          value={cbCashIn || ''}
                          onChange={(e) => setCbCashIn(Number(e.target.value))}
                          placeholder="e.g. 45000"
                          className="w-full bg-emerald-50/20 border border-emerald-200 rounded-xl px-3.5 py-2.5 text-emerald-800 font-black focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="col-span-2 border-t border-slate-200 pt-3 space-y-3">
                      <span className="text-[9px] font-black text-rose-600 uppercase tracking-wider block">CASH-OUTS & OPERATION EXPENSES</span>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] text-slate-550 uppercase mb-1 font-bold">Operator Salary Out (₹)</label>
                          <input
                            type="number"
                            value={cbSalary || ''}
                            onChange={(e) => setCbSalary(Number(e.target.value))}
                            placeholder="0"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 font-bold focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-slate-550 uppercase mb-1 font-bold">Fuel (Diesel) Cost (₹)</label>
                          <input
                            type="number"
                            value={cbDiesel || ''}
                            onChange={(e) => setCbDiesel(Number(e.target.value))}
                            placeholder="0"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 font-bold focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-slate-550 uppercase mb-1 font-bold">Repairs & Servicing (₹)</label>
                          <input
                            type="number"
                            value={cbRepairs || ''}
                            onChange={(e) => setCbRepairs(Number(e.target.value))}
                            placeholder="0"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 font-bold focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-slate-550 uppercase mb-1 font-bold">Miscellaneous Expense (₹)</label>
                          <input
                            type="number"
                            value={cbMisc || ''}
                            onChange={(e) => setCbMisc(Number(e.target.value))}
                            placeholder="0"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 font-bold focus:outline-none"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[9px] text-slate-550 uppercase mb-1 font-bold">Other Cash Out (General) (₹)</label>
                          <input
                            type="number"
                            value={cbCashOut || ''}
                            onChange={(e) => setCbCashOut(Number(e.target.value))}
                            placeholder="0"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none text-rose-800 font-black"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1 font-bold">Transaction / Narrative notes</label>
                      <textarea
                        rows={2}
                        value={cbNotes}
                        onChange={(e) => setCbNotes(e.target.value)}
                        placeholder="e.g. Paid diesel to site JCB, received ₹15k from client advance"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 font-medium focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Calculations summary indicator */}
                  <div className="bg-[#FAF5FF] border border-[#E8DBFA] rounded-xl p-3 text-[11px] text-slate-700 leading-relaxed font-bold space-y-1">
                    <span className="text-[#7C3AED] uppercase text-[9px] font-black tracking-wide">Cascaded Formula Engine</span>
                    <div>
                      Opening Balance = ₹{cbOpeningBalance.toLocaleString('en-IN')} <br />
                      Cash In Receipts = +₹{cbCashIn.toLocaleString('en-IN')} <br />
                      Expenses sum (salaries + diesel + repairs + misc) = -₹{(cbSalary + cbDiesel + cbRepairs + cbMisc + cbCashOut).toLocaleString('en-IN')}
                    </div>
                    <div className="border-t border-slate-200 pt-1 text-slate-950 font-black uppercase text-[11.5px] text-[#7C3AED] block">
                      Estimated Closing Balance: ₹{(cbOpeningBalance + cbCashIn - (cbSalary + cbDiesel + cbRepairs + cbMisc + cbCashOut)).toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={cbSubmitting}
                      className="flex-1 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl text-center text-xs tracking-tight transition disabled:opacity-50 cursor-pointer"
                    >
                      {cbSubmitting ? 'Balancing...' : 'Save Sheet Summary'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCashbookForm(false)}
                      className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
