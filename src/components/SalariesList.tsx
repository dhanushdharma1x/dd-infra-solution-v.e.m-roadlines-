import React, { useState, useMemo, useEffect } from 'react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Operator, SalaryRecord } from '../types';
import { Plus, Edit2, Trash2, Calendar, User, Phone, DollarSign, Wallet, RefreshCw, X, CircleAlert } from 'lucide-react';

interface SalariesListProps {
  operators: Operator[];
  salaryRecords: SalaryRecord[];
  role: 'admin' | 'staff';
  onRefresh: () => void;
  showFormDirectly?: boolean;
  onFormCloseDirectly?: () => void;
}

export default function SalariesList({
  operators,
  salaryRecords,
  role,
  onRefresh,
  showFormDirectly = false,
  onFormCloseDirectly
}: SalariesListProps) {
  const [showAddForm, setShowAddForm] = useState(showFormDirectly);
  const [editingRecord, setEditingRecord] = useState<SalaryRecord | null>(null);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const [salaryAmount, setSalaryAmount] = useState<number>(0);
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const [pendingSalary, setPendingSalary] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Operator Creation States for quick additions
  const [showAddOp, setShowAddOp] = useState(false);
  const [opName, setOpName] = useState('');
  const [opPhone, setOpPhone] = useState('');
  const [opSalary, setOpSalary] = useState<number>(25000);

  useEffect(() => {
    if (showFormDirectly) {
      setShowAddForm(true);
    }
  }, [showFormDirectly]);

  const handleOperatorSelectChange = (opId: string) => {
    setSelectedOperatorId(opId);
    const op = operators.find(o => o.id === opId);
    if (op) {
      setSalaryAmount(op.monthlySalary);
      // Pending salary before this payout
      const estimatedPending = op.monthlySalary - op.advanceGiven;
      setPendingSalary(estimatedPending);
    }
  };

  const handleAdvanceChange = (adv: number) => {
    setAdvanceAmount(adv);
    // Recalculate pending
    const op = operators.find(o => o.id === selectedOperatorId);
    if (op) {
      setPendingSalary(op.monthlySalary - adv);
    }
  };

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setSelectedOperatorId('');
    setSalaryAmount(0);
    setAdvanceAmount(0);
    setPendingSalary(0);
    setNotes('');
    setError('');
  };

  const handleCreateSalaryRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOperatorId || salaryAmount <= 0) {
      setError('Please select a valid operator employee.');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      const op = operators.find(o => o.id === selectedOperatorId)!;
      const newId = `sal_${Date.now()}`;
      
      const record: SalaryRecord = {
        id: newId,
        date,
        operatorId: selectedOperatorId,
        operatorName: op.name,
        salaryAmount,
        advanceAmount,
        pendingSalary,
        notes
      };

      await setDoc(doc(db, 'salaryRecords', newId), record);

      // Update actual Operator model's advanceGiven and pendingSalary
      const updatedOp: Operator = {
        ...op,
        advanceGiven: op.advanceGiven + advanceAmount,
        pendingSalary: pendingSalary
      };
      await setDoc(doc(db, 'operators', selectedOperatorId), updatedOp);

      setShowAddForm(false);
      if (onFormCloseDirectly) onFormCloseDirectly();
      resetForm();
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Saving salary record failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opName || opSalary <= 0) {
      alert('Fill in Operator Name and Base Monthly Salary.');
      return;
    }
    try {
      const newId = `op_${Date.now()}`;
      const newOp: Operator = {
        id: newId,
        name: opName,
        phone: opPhone,
        monthlySalary: opSalary,
        advanceGiven: 0,
        pendingSalary: opSalary
      };
      await setDoc(doc(db, 'operators', newId), newOp);
      setShowAddOp(false);
      setOpName('');
      setOpPhone('');
      setOpSalary(25000);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Fail creating operator.');
    }
  };

  const handleDeleteRecord = async (rec: SalaryRecord) => {
    if (!window.confirm('Delete this historical salary record? This will revert stats.')) return;
    try {
      await deleteDoc(doc(db, 'salaryRecords', rec.id));
      
      // Attempt to decrement operator stats
      const op = operators.find(o => o.id === rec.operatorId);
      if (op) {
        await setDoc(doc(db, 'operators', op.id), {
          ...op,
          advanceGiven: Math.max(0, op.advanceGiven - rec.advanceAmount),
          pendingSalary: op.pendingSalary + rec.advanceAmount // Revert pending
        });
      }
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Failed deletion.');
    }
  };

  return (
    <div id="salaries_panel" className="space-y-8 font-sans">
      
      {/* SECTION 1: Operators fleet list */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">Operators Payroll Accounts</h2>
            <p className="text-slate-500 text-xs mt-1">Manage driver payroll profiles, base pay terms, and advances logs</p>
          </div>
          {role === 'admin' && (
            <button
              onClick={() => setShowAddOp(true)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg font-bold transition shadow-md shadow-amber-500/10 cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" /> Add Operator Profile
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {operators.map(op => (
            <div key={op.id} className="p-5 bg-white border border-slate-200 rounded-2xl flex flex-col justify-between hover:border-slate-300 transition duration-300 shadow-xs">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-55 text-amber-600 rounded-xl border border-amber-100">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">{op.name}</h3>
                    <p className="text-slate-500 text-xs flex items-center gap-1 font-semibold mt-0.5">
                      <Phone className="h-3 w-3 text-amber-500" /> {op.phone || '+91 N/A'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Monthly Base</span>
                  <span className="text-base font-black text-amber-600">₹{op.monthlySalary.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4 py-3 px-4 bg-slate-50 rounded-xl text-xs font-semibold border border-slate-100">
                <div>
                  <span className="text-slate-455 block text-[9px] font-bold uppercase">TOTAL ADVANCE PAID</span>
                  <span className="text-rose-655 font-bold text-sm">₹{op.advanceGiven.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-slate-455 block text-[9px] font-bold uppercase">NET RETENTION REMAINING</span>
                  <span className="text-emerald-600 font-bold text-sm">₹{op.pendingSalary.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {role === 'admin' && (
                <div className="mt-3.5 flex justify-end">
                  <button
                    onClick={() => { setSelectedOperatorId(op.id); handleOperatorSelectChange(op.id); setShowAddForm(true); }}
                    className="py-1.5 px-3 bg-slate-105 hover:bg-slate-200 text-slate-800 hover:text-slate-950 font-extrabold rounded-lg text-[10px] uppercase border border-slate-200 cursor-pointer transition-all"
                  >
                    Pay Advance / Record Payout
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: Salary Historical Ledger */}
      <div className="space-y-4">
        <div>
          <h3 className="text-md font-extrabold text-slate-900">Wage & Advance Historical Ledger</h3>
          <p className="text-slate-500 text-xs mt-0.5">Audit payouts and credit tracking timeline records</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider divide-y">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Operator Name</th>
                  <th className="py-3 px-4">Standard Base Salary</th>
                  <th className="py-3 px-4">Advance Paid</th>
                  <th className="py-3 px-4">Retention Pending</th>
                  <th className="py-3 px-4">Notes</th>
                  {role === 'admin' && <th className="py-3 px-4 text-right">Delete</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {salaryRecords.map(rec => (
                  <tr key={rec.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">{rec.date}</td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-905">{rec.operatorName}</td>
                    <td className="py-3.5 px-4">₹{rec.salaryAmount.toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4 font-bold text-rose-600">₹{rec.advanceAmount.toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4 font-bold text-emerald-600">₹{rec.pendingSalary.toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4 text-xs max-w-xs truncate text-slate-500">{rec.notes || '-'}</td>
                    {role === 'admin' && (
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteRecord(rec)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-655 rounded-lg border border-rose-150 transition cursor-pointer"
                          title="Revert payout"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}

                {salaryRecords.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-bold uppercase text-[10px] tracking-wide">
                      No payroll or advance payouts logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pop up 1: New Advance/Payout Record */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl py-6 px-6 shadow-md relative">
            <button 
              onClick={() => { setShowAddForm(false); if (onFormCloseDirectly) onFormCloseDirectly(); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-6 w-6" />
            </button>
            <h3 className="text-sm font-extrabold text-slate-950 mb-4">Record Operator Payroll / Advance</h3>

            {error && <p className="mb-4 text-[11px] text-rose-805 bg-rose-50 border border-rose-200 p-2.5 rounded-lg font-bold">{error}</p>}

            <form onSubmit={handleCreateSalaryRecord} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Payment Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Select Operator Profile</label>
                <select
                  required
                  value={selectedOperatorId}
                  onChange={(e) => handleOperatorSelectChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-xs font-semibold text-slate-805 focus:outline-none"
                >
                  <option value="">Select operator...</option>
                  {operators.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              {selectedOperatorId && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Base Monthly (₹)</label>
                    <input
                      type="number"
                      disabled
                      value={salaryAmount}
                      className="w-full bg-slate-100 border border-slate-105 rounded-xl px-3 py-2 text-xs font-bold text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Advance Disbursed (₹)</label>
                    <input
                      type="number"
                      required
                      value={advanceAmount || ''}
                      onChange={(e) => handleAdvanceChange(Number(e.target.value))}
                      placeholder="e.g. 5000"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-850 focus:outline-none"
                    />
                  </div>

                  <div className="col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-500 uppercase tracking-wide text-[9px]">OPERATOR REMAINING RETENTION:</span>
                    <span className="text-emerald-600 font-extrabold text-sm">₹{pendingSalary.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Remarks / Note</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Paid advance for home function"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting || !selectedOperatorId}
                  className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-all text-center flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Recording...' : 'Disburse & Log Advance'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); if (onFormCloseDirectly) onFormCloseDirectly(); }}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pop up 2: Create Operator Profile */}
      {showAddOp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-2xl py-6 px-6 shadow-md relative">
            <button onClick={() => setShowAddOp(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 cursor-pointer">
              <X className="h-6 w-6" />
            </button>
            <h3 className="text-sm font-extrabold text-slate-950 mb-4">Add Operator payroll profile</h3>

            <form onSubmit={handleCreateOperator} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Operator Full Name</label>
                <input
                  type="text"
                  required
                  value={opName}
                  onChange={(e) => setOpName(e.target.value)}
                  placeholder="e.g. Nagaraj M"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={opPhone}
                  onChange={(e) => setOpPhone(e.target.value)}
                  placeholder="+91 99000 88000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Base Monthly wage Salary (₹)</label>
                <input
                  type="number"
                  required
                  value={opSalary}
                  onChange={(e) => setOpSalary(Number(e.target.value))}
                  placeholder="25000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-all text-center flex items-center justify-center cursor-pointer">
                  Create Profile
                </button>
                <button type="button" onClick={() => setShowAddOp(false)} className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
