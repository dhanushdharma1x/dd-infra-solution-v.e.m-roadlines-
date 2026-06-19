import { useState, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Fuel, HardHat, Calendar,
  AlertTriangle, ShieldAlert, Zap, Plus, PhoneCall, CreditCard, Clock, Activity, Settings
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from 'recharts';
import { 
  DailyWorkEntry, Expense, ClientBill, PaymentHistory, Machine, Operator, Stats 
} from '../types';
import { calculateBusinessStats, calculateMachinePerformance, calculateSitePerformance } from '../utils/calc';

interface OverviewProps {
  workEntries: DailyWorkEntry[];
  expenses: Expense[];
  bills: ClientBill[];
  payments: PaymentHistory[];
  machines: Machine[];
  operators: Operator[];
  stats: Stats;
  role: 'admin' | 'staff';
  onQuickAction: (action: 'work' | 'diesel' | 'expense' | 'salary' | 'payment') => void;
}

export default function Overview({
  workEntries,
  expenses,
  bills,
  payments,
  machines,
  operators,
  stats,
  role,
  onQuickAction
}: OverviewProps) {
  
  // 1. Calculate Active Alerts
  const alerts = useMemo(() => {
    const list: { id: string; type: 'danger' | 'warning'; message: string; sub: string }[] = [];
    
    // Alert 1: Client payment overdue by 15+ days
    const today = new Date();
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(today.getDate() - 15);
    
    const overdueBills = bills.filter(b => {
      if (b.paymentStatus === 'Paid') return false;
      const expectedDate = new Date(b.expectedPaymentDate);
      return expectedDate < fifteenDaysAgo;
    });
    
    if (overdueBills.length > 0) {
      list.push({
        id: 'overdue_bill',
        type: 'danger',
        message: `${overdueBills.length} Client Payments Overdue by 15+ Days`,
        sub: `Outstanding: ₹${overdueBills.reduce((sum, b) => sum + b.pendingAmount, 0).toLocaleString('en-IN')}`
      });
    }

    // Alert 2: Pending payment above limit
    const totalPendingPayments = bills.reduce((sum, b) => sum + b.pendingAmount, 0);
    if (totalPendingPayments > 50000) {
      list.push({
        id: 'high_pending',
        type: 'warning',
        message: 'High Outstanding Client Receivables',
        sub: `Total outstanding ₹${totalPendingPayments.toLocaleString('en-IN')}, exceeding recommendation of ₹50,000.`
      });
    }

    // Alert 3: High diesel credit amount
    const totalDieselCredit = expenses
      .filter(e => e.dieselPaymentType === 'Credit' && e.dieselPaidStatus === 'Pending')
      .reduce((sum, e) => sum + e.dieselCost, 0);
    
    if (totalDieselCredit > 15000) {
      list.push({
        id: 'high_diesel_credit',
        type: 'danger',
        message: 'High Diesel Credit Balance',
        sub: `₹${totalDieselCredit.toLocaleString('en-IN')} pending fuel pump payoff. Immediate clearance advised.`
      });
    }

    // Alert 4: Machine inactive for more than 3 days
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(today.getDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

    machines.forEach(mac => {
      if (mac.status === 'Working') {
        const macLogs = workEntries.filter(e => e.machineId === mac.id && e.date >= threeDaysAgoStr);
        if (macLogs.length === 0) {
          list.push({
            id: `inactive_${mac.id}`,
            type: 'warning',
            message: `Machine Inactive: ${mac.name}`,
            sub: `No work entries logged in the last 3 days. Standard status is set to Working.`
          });
        }
      }
    });

    // Alert 5: Machine under repair
    const underRepairMacs = machines.filter(mac => mac.status === 'Repair');
    if (underRepairMacs.length > 0) {
      list.push({
        id: 'under_repair_alert',
        type: 'warning',
        message: `${underRepairMacs.length} Equipment Under Repair`,
        sub: `Under Repair: ${underRepairMacs.map(m => m.name).join(', ')}`
      });
    }

    return list;
  }, [workEntries, expenses, bills, machines]);

  // 2. Prepare Chart Data
  // Proportional monthly profits & diesel cost charts
  const monthlyFinancials = useMemo(() => {
    // Collect last 6 months
    const data: Record<string, { monthName: string; revenue: number; expenses: number; profit: number }> = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Seed with current and previous months
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7); // "YYYY-MM"
      data[key] = {
        monthName: `${months[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`,
        revenue: 0,
        expenses: 0,
        profit: 0
      };
    }

    // Accumulate revenue
    workEntries.forEach(entry => {
      const key = entry.date.slice(0, 7);
      if (data[key]) {
        data[key].revenue += entry.earnings;
      }
    });

    // Accumulate expenses
    expenses.forEach(exp => {
      const key = exp.date.slice(0, 7);
      if (data[key]) {
        data[key].expenses += (exp.dieselCost + exp.repairCost + exp.sparePartsCost + exp.serviceCost + exp.miscellaneousCost);
      }
    });

    // Compute earnings
    return Object.keys(data).sort().map(k => {
      const rev = data[k].revenue;
      const exp = data[k].expenses;
      return {
        month: data[k].monthName,
        Revenue: rev,
        Expenses: exp,
        Profit: rev - exp
      };
    });
  }, [workEntries, expenses]);

  // Repair, Diesel and Salary Distribution
  const expenseBreakdown = useMemo(() => {
    let dieselTotal = 0;
    let repairTotal = 0;
    let spareTotal = 0;
    let serviceTotal = 0;
    let miscTotal = 0;
    let salaryTotal = 0;

    expenses.forEach(exp => {
      dieselTotal += exp.dieselCost;
      repairTotal += exp.repairCost;
      spareTotal += exp.sparePartsCost;
      serviceTotal += exp.serviceCost;
      miscTotal += exp.miscellaneousCost;
    });

    operators.forEach(op => {
      salaryTotal += op.monthlySalary;
    });

    return [
      { name: 'Fuel (Diesel)', Amount: dieselTotal },
      { name: 'Spare Parts', Amount: spareTotal },
      { name: 'Repairs Work', Amount: repairTotal },
      { name: 'Servicing', Amount: serviceTotal },
      { name: 'Salaries', Amount: salaryTotal },
      { name: 'Misc', Amount: miscTotal }
    ];
  }, [expenses, operators]);

  // Machine Profit Breakdown
  const machinePerformance = useMemo(() => {
    return calculateMachinePerformance(machines, workEntries, expenses);
  }, [machines, workEntries, expenses]);

  // Site Profit Breakdown
  const sitePerformance = useMemo(() => {
    return calculateSitePerformance(workEntries, expenses);
  }, [workEntries, expenses]);

  return (
    <div id="overview_panel" className="space-y-8 pb-12 font-sans">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            V.E.M Roadlines Owner Portal <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full uppercase border border-amber-200 font-bold">Owner Mode</span>
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            Construction Equipment Fleet & Project Performance Real-time System
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <button 
            id="btn_quick_work"
            onClick={() => onQuickAction('work')} 
            className="flex items-center gap-1.5 py-2 px-3 md:py-2.5 md:px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg transition-all font-bold active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Log Work
          </button>
          <button 
            id="btn_quick_fuel"
            onClick={() => onQuickAction('diesel')} 
            className="flex items-center gap-1.5 py-2 px-3 md:py-2.5 md:px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-all font-bold border border-slate-200 active:scale-95 cursor-pointer"
          >
            <Fuel className="h-4 w-4" /> Diesel Credit
          </button>
          {role === 'admin' && (
            <button 
              id="btn_quick_payment"
              onClick={() => onQuickAction('payment')} 
              className="flex items-center gap-1.5 py-2 px-3 md:py-2.5 md:px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all font-bold active:scale-95 cursor-pointer"
            >
              <DollarSign className="h-4 w-4" /> Pay Input
            </button>
          )}
        </div>
      </div>

      {/* Grid of KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        
        {/* KPI: Monthly Revenue */}
        <div className="bg-white border border-slate-200 p-4 md:p-6 rounded-2xl relative overflow-hidden group hover:shadow-xs transition duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] md:text-xs text-slate-500 font-bold tracking-wider uppercase">Monthly Revenue</p>
              <h3 className="text-lg md:text-2xl font-black text-slate-800 mt-2">
                ₹{stats.monthlyRevenue.toLocaleString('en-IN')}
              </h3>
            </div>
            <span className="p-2 md:p-3 bg-amber-50 text-amber-500 rounded-xl">
              <TrendingUp className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4 flex items-center text-[10px] text-amber-600 gap-1 font-semibold">
            <Zap className="h-3.5 w-3.5 fill-amber-500/10" />
            <span>Active Month Revenue Pool</span>
          </div>
        </div>

        {/* KPI: Monthly Expenses */}
        <div className="bg-white border border-slate-200 p-4 md:p-6 rounded-2xl relative overflow-hidden group hover:shadow-xs transition duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] md:text-xs text-slate-500 font-bold tracking-wider uppercase">Monthly Expenses</p>
              <h3 className="text-lg md:text-2xl font-black text-slate-800 mt-2">
                ₹{stats.monthlyExpenses.toLocaleString('en-IN')}
              </h3>
            </div>
            <span className="p-2 md:p-3 bg-rose-50 text-rose-500 rounded-xl">
              <TrendingDown className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4 flex items-center text-[10px] text-rose-600 gap-1 font-semibold">
            <Fuel className="h-3.5 w-3.5" />
            <span>Fuel, Spares & Allocations</span>
          </div>
        </div>

        {/* KPI: Net Profit */}
        <div className="bg-white border border-slate-200 p-4 md:p-6 rounded-2xl relative overflow-hidden group hover:shadow-xs transition duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] md:text-xs text-slate-500 font-bold tracking-wider uppercase">Net Profit</p>
              <h3 className={`text-lg md:text-2xl font-black mt-2 ${stats.netProfit >= 0 ? "text-emerald-650" : "text-rose-650"}`}>
                {stats.netProfit < 0 ? '-' : ''}₹{Math.abs(stats.netProfit).toLocaleString('en-IN')}
              </h3>
            </div>
            <span className={`p-2 md:p-3 rounded-xl ${stats.netProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              <DollarSign className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4 flex items-center text-[10px] text-emerald-600 gap-1 font-semibold">
            <Activity className="h-3.5 w-3.5" />
            <span>Margin: {stats.monthlyRevenue > 0 ? `${Math.round((stats.netProfit / stats.monthlyRevenue) * 100)}%` : '0%'}</span>
          </div>
        </div>

        {/* KPI: Outstanding Receivables */}
        <div className="bg-white border border-slate-200 p-4 md:p-6 rounded-2xl relative overflow-hidden group hover:shadow-xs transition duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] md:text-xs text-slate-500 font-bold tracking-wider uppercase">Client Pending</p>
              <h3 className="text-lg md:text-2xl font-black text-slate-800 mt-2">
                ₹{stats.pendingClientPayments.toLocaleString('en-IN')}
              </h3>
            </div>
            <span className="p-2 md:p-3 bg-amber-50 text-amber-600 rounded-xl">
              <CreditCard className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4 flex items-center text-[10px] text-slate-500 gap-1 font-semibold">
            <Clock className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
            <span>Overdue Limit ₹50k</span>
          </div>
        </div>
      </div>

      {/* Secondary Quick Stats - Today/Status Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3">
          <div className="h-10 w-10 bg-amber-50 rounded-lg flex items-center justify-center text-amber-500 shrink-0">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <p className="text-slate-550 text-[10px] font-bold uppercase tracking-wider">Today's Revenue</p>
            <p className="text-xs font-black text-slate-900">₹{stats.todayRevenue.toLocaleString('en-IN')}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3">
          <div className="h-10 w-10 bg-rose-50 rounded-lg flex items-center justify-center text-rose-500 shrink-0">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <p className="text-slate-550 text-[10px] font-bold uppercase tracking-wider">Today's Expenses</p>
            <p className="text-xs font-black text-slate-900">₹{stats.todayExpenses.toLocaleString('en-IN')}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3">
          <div className="h-10 w-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <p className="text-slate-550 text-[10px] font-bold uppercase tracking-wider">Total Received</p>
            <p className="text-xs font-black text-slate-900">₹{stats.cashReceived.toLocaleString('en-IN')}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3">
          <div className="h-10 w-10 bg-amber-50 rounded-lg flex items-center justify-center text-amber-500 shrink-0">
            <Fuel className="h-5 w-5" />
          </div>
          <div>
            <p className="text-slate-550 text-[10px] font-bold uppercase tracking-wider">Diesel Credit Due</p>
            <p className="text-xs font-black text-rose-600">₹{stats.dieselCreditPending.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Active Alerts Grid */}
      {alerts.length > 0 && (
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Fleet Alerts & Operational Risks
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alerts.map(al => (
              <div 
                key={al.id} 
                className={`p-4 rounded-xl border flex gap-3 ${
                  al.type === 'danger' 
                    ? 'bg-rose-50/50 border-rose-200 text-rose-900' 
                    : 'bg-amber-50/50 border-amber-200 text-amber-900'
                }`}
              >
                <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${al.type === 'danger' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900">{al.message}</h4>
                  <p className="text-slate-500 text-[11px] mt-1 leading-relaxed font-medium">{al.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Charts & Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: Revenue vs Expense Trends */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Financial Growth Trends</h3>
          <div className="w-full h-80 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyFinancials} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.05}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={10} fontStyle="bold" />
                <YAxis stroke="#64748b" fontSize={10} tickFormatter={(val) => `₹${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', fontSize: '11px', color: '#1e293b' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="Revenue" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={1.5} fillOpacity={1} fill="url(#colorExp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Cost Breakdown Distribution */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Operations Cost Allocation</h3>
          <div className="w-full h-80 flex-1 flex items-center justify-center">
            <ResponsiveContainer width="120%" height="105%">
              <BarChart data={expenseBreakdown} layout="vertical" margin={{ top: 10, right: 40, left: 25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" stroke="#64748b" fontSize={9} tickFormatter={(v) => `₹${v/1000}k`} />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={75} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', fontSize: '11px' }}
                  formatter={(value) => [`₹${(value as number).toLocaleString('en-IN')}`, 'Amount']}
                />
                <Bar dataKey="Amount" fill="#fbbf24" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table: Equipment Operational Performance Meter */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Machine Operational Performance</h3>
            <p className="text-slate-400 text-[11px] mt-0.5">Summary of fleet work metrics, diesel, repairs, service and margin profitability</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3 px-4">Equipment</th>
                <th className="py-3 px-4">Hours Logged</th>
                <th className="py-3 px-4">Total Revenue</th>
                <th className="py-3 px-4">Operational Cost</th>
                <th className="py-3 px-4">Net Profit</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {machinePerformance.map(perf => (
                <tr key={perf.machineId} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3.5 px-4">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{perf.name}</div>
                      <div className="text-slate-450 text-[10px] mt-0.5 uppercase tracking-wide">{perf.type}</div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-amber-600">{perf.hoursWorked} hrs</td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">₹{perf.revenue.toLocaleString('en-IN')}</td>
                  <td className="py-3.5 px-4 text-slate-500">₹{perf.expenses.total.toLocaleString('en-IN')}</td>
                  <td className={`py-3.5 px-4 font-black ${perf.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    ₹{perf.profit.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      perf.status === 'Working' 
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                        : perf.status === 'Repair'
                        ? 'bg-rose-50 text-rose-600 border border-rose-100'
                        : 'bg-amber-50 text-amber-600 border border-amber-100'
                    }`}>
                      {perf.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Project Sites profitability tracking (Admin Only) */}
      {role === 'admin' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Physical Project Sites Audit</h3>
            <p className="text-slate-400 text-[11px] mt-0.5">Approximate proportional cost breakdown & margins per project location</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
            {sitePerformance.map(site => (
              <div key={site.siteName} className="p-4 rounded-xl bg-slate-50/50 border border-slate-250 space-y-3">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs truncate uppercase tracking-tight">{site.siteName}</h4>
                  <p className="text-slate-500 text-[10px] mt-0.5 font-medium">{site.clientName}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] py-2 bg-slate-100/50 rounded-lg px-3 font-semibold text-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">REVENUE</span>
                    <span className="text-amber-600">₹{site.revenue.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">PROP. COST</span>
                    <span className="text-rose-600">₹{site.expenses.toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] font-bold border-t border-slate-200/50 pt-2 text-slate-600">
                  <span className="flex items-center gap-1 font-semibold"><Clock className="h-3.5 w-3.5 text-amber-500" /> {site.hoursWorked} hrs</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${site.profit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    ₹{site.profit.toLocaleString('en-IN')} Profit
                  </span>
                </div>
              </div>
            ))}
            {sitePerformance.length === 0 && (
              <div className="col-span-full text-center py-6 text-slate-400 text-xs">No project work entries logged yet to compute site performance.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
