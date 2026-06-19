import React, { useState, useMemo, useEffect } from 'react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Expense, Machine } from '../types';
import { Plus, Edit2, Trash2, Calendar, Fuel, PenTool, CircleDollarSign, AlertTriangle, X, Search } from 'lucide-react';

interface ExpensesListProps {
  expenses: Expense[];
  machines: Machine[];
  role: 'admin' | 'staff';
  onRefresh: () => void;
  showFormDirectly?: boolean;
  onFormCloseDirectly?: () => void;
}

export default function ExpensesList({
  expenses,
  machines,
  role,
  onRefresh,
  showFormDirectly = false,
  onFormCloseDirectly
}: ExpensesListProps) {
  const [showAddForm, setShowAddForm] = useState(showFormDirectly);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [dieselLiters, setDieselLiters] = useState<number>(0);
  const [dieselCost, setDieselCost] = useState<number>(0);
  const [dieselPaymentType, setDieselPaymentType] = useState<'Cash' | 'Credit'>('Cash');
  const [dieselPaidStatus, setDieselPaidStatus] = useState<'Paid' | 'Pending'>('Paid');
  const [repairCost, setRepairCost] = useState<number>(0);
  const [sparePartsCost, setSparePartsCost] = useState<number>(0);
  const [serviceCost, setServiceCost] = useState<number>(0);
  const [miscellaneousCost, setMiscellaneousCost] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [openingMeterHours, setOpeningMeterHours] = useState<number>(0);
  const [closingMeterHours, setClosingMeterHours] = useState<number>(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filters State
  const [filterMachine, setFilterMachine] = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    if (showFormDirectly) {
      setShowAddForm(true);
    }
  }, [showFormDirectly]);

  // Auto calculate Diesel Cost based on Liters as quick aid
  const handleLitersChange = (liters: number) => {
    setDieselLiters(liters);
    // Approximate Indian diesel rate in 2026: ₹90 per liter
    setDieselCost(Math.round(liters * 90));
  };

  const handlePaymentTypeChange = (pType: 'Cash' | 'Credit') => {
    setDieselPaymentType(pType);
    setDieselPaidStatus(pType === 'Credit' ? 'Pending' : 'Paid');
  };

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setSelectedMachineId('');
    setDieselLiters(0);
    setDieselCost(0);
    setDieselPaymentType('Cash');
    setDieselPaidStatus('Paid');
    setRepairCost(0);
    setSparePartsCost(0);
    setServiceCost(0);
    setMiscellaneousCost(0);
    setOpeningMeterHours(0);
    setClosingMeterHours(0);
    setNotes('');
    setError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachineId) {
      setError('A target equipment machine must be specified for any cost logs.');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      const mac = machines.find(m => m.id === selectedMachineId)!;
      const newId = `exp_${Date.now()}`;
      
      const expenseDoc: Expense = {
        id: newId,
        date,
        machineId: selectedMachineId,
        machineName: mac.name,
        dieselLiters,
        dieselCost,
        dieselPaymentType,
        dieselPaidStatus,
        repairCost,
        sparePartsCost,
        serviceCost,
        miscellaneousCost,
        notes,
        openingMeterHours: dieselLiters > 0 ? Number(openingMeterHours) || 0 : undefined,
        closingMeterHours: dieselLiters > 0 ? Number(closingMeterHours) || 0 : undefined
      };

      await setDoc(doc(db, 'expenses', newId), expenseDoc);
      
      // Update machine metadata: transitions status (Repairs) and current cumulative machine hours
      const updatedMacFields: any = {};
      if (repairCost > 0 && mac.status !== 'Repair') {
        updatedMacFields.status = 'Repair';
      }
      if (dieselLiters > 0 && closingMeterHours > 0 && Number(closingMeterHours) > (mac.currentMachineHours || 0)) {
        updatedMacFields.currentMachineHours = Number(closingMeterHours);
      }
      
      if (Object.keys(updatedMacFields).length > 0) {
        await setDoc(doc(db, 'machines', selectedMachineId), {
          ...mac,
          ...updatedMacFields
        });
      }

      setShowAddForm(false);
      if (onFormCloseDirectly) onFormCloseDirectly();
      resetForm();
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Log write failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setDate(exp.date);
    setSelectedMachineId(exp.machineId);
    setDieselLiters(exp.dieselLiters);
    setDieselCost(exp.dieselCost);
    setDieselPaymentType(exp.dieselPaymentType);
    setDieselPaidStatus(exp.dieselPaidStatus);
    setRepairCost(exp.repairCost);
    setSparePartsCost(exp.sparePartsCost);
    setServiceCost(exp.serviceCost);
    setMiscellaneousCost(exp.miscellaneousCost);
    setOpeningMeterHours(exp.openingMeterHours || 0);
    setClosingMeterHours(exp.closingMeterHours || 0);
    setNotes(exp.notes);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;

    setError('');
    setSubmitting(true);

    try {
      const mac = machines.find(m => m.id === selectedMachineId)!;
      const updatedDoc: Expense = {
        ...editingExpense,
        date,
        machineId: selectedMachineId,
        machineName: mac.name,
        dieselLiters,
        dieselCost,
        dieselPaymentType,
        dieselPaidStatus,
        repairCost,
        sparePartsCost,
        serviceCost,
        miscellaneousCost,
        notes,
        openingMeterHours: dieselLiters > 0 ? Number(openingMeterHours) || 0 : undefined,
        closingMeterHours: dieselLiters > 0 ? Number(closingMeterHours) || 0 : undefined
      };

      await setDoc(doc(db, 'expenses', editingExpense.id), updatedDoc);
      
      // Update machine cumulative hours if closing meter hours exceeded previous reading
      const updatedMacFields: any = {};
      if (dieselLiters > 0 && closingMeterHours > 0 && Number(closingMeterHours) > (mac.currentMachineHours || 0)) {
        updatedMacFields.currentMachineHours = Number(closingMeterHours);
      }
      
      if (Object.keys(updatedMacFields).length > 0) {
        await setDoc(doc(db, 'machines', selectedMachineId), {
          ...mac,
          ...updatedMacFields
        });
      }
      
      setEditingExpense(null);
      if (onFormCloseDirectly) onFormCloseDirectly();
      resetForm();
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Save failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this operational expense asset entry?')) return;
    try {
      await deleteDoc(doc(db, 'expenses', id));
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Delete failed.');
    }
  };

  const handleClearDieselCredit = async (exp: Expense) => {
    if (!window.confirm(`Mark diesel credit of ₹${exp.dieselCost} as PAID for ${exp.machineName}?`)) return;
    try {
      await setDoc(doc(db, 'expenses', exp.id), {
        ...exp,
        dieselPaidStatus: 'Paid'
      });
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Failed clearing balance.');
    }
  };

  // Filtered expenses memo
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const matchMac = filterMachine ? exp.machineId === filterMachine : true;
      if (filterType === 'diesel') return exp.dieselCost > 0;
      if (filterType === 'repair') return exp.repairCost > 0 || exp.sparePartsCost > 0;
      if (filterType === 'credit') return exp.dieselPaymentType === 'Credit' && exp.dieselPaidStatus === 'Pending';
      return matchMac;
    }).sort((a,b) => b.date.localeCompare(a.date));
  }, [expenses, filterMachine, filterType]);

  return (
    <div id="expenses_panel" className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">Fleet Expenses & Diesel Credit Ledger</h2>
          <p className="text-slate-500 text-xs mt-1">Record and aggregate daily fueling, repairs and spares costs</p>
        </div>
        <button
          onClick={() => { setShowAddForm(true); setEditingExpense(null); resetForm(); }}
          className="flex items-center justify-center gap-1.5 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg font-bold transition shadow-md shadow-amber-500/10 cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" /> Log Operational Cost
        </button>
      </div>

      {/* Expenses Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap gap-3 items-center shadow-xs">
        <select
          value={filterMachine}
          onChange={(e) => setFilterMachine(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
        >
          <option value="">By Machine...</option>
          {machines.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        <div className="flex flex-wrap gap-1.5">
          {['all', 'diesel', 'repair', 'credit'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                filterType === type 
                  ? 'bg-amber-500 text-slate-950 shadow-xs' 
                  : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {type === 'all' && 'All Costs'}
              {type === 'diesel' && 'Fuel Only'}
              {type === 'repair' && 'Repairs & Spares'}
              {type === 'credit' && 'Pending Credit'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider divide-y">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Equipment Machine</th>
                <th className="py-3 px-4">Fuel (Diesel) Details</th>
                <th className="py-3 px-4">Repairs & Maintenance</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filteredExpenses.map(exp => {
                const totalCost = exp.dieselCost + exp.repairCost + exp.sparePartsCost + exp.serviceCost + exp.miscellaneousCost;
                return (
                  <tr key={exp.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-700 whitespace-nowrap">
                      {exp.date}
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-900 whitespace-nowrap text-xs">
                      {exp.machineName}
                    </td>
                    <td className="py-3.5 px-4">
                      {exp.dieselCost > 0 ? (
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1">
                            <Fuel className="h-3.5 w-3.5 text-amber-500" /> {exp.dieselLiters} Liters
                          </div>
                          <div className="text-slate-500 text-[10px] mt-0.5">
                            Cost: ₹{exp.dieselCost.toLocaleString('en-IN')} ({exp.dieselPaymentType})
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-bold">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {(exp.repairCost > 0 || exp.sparePartsCost > 0 || exp.serviceCost > 0) ? (
                        <div className="space-y-0.5 text-[10px] font-bold text-slate-600">
                          {exp.repairCost > 0 && <div>Repairs: <span className="text-slate-900">₹{exp.repairCost}</span></div>}
                          {exp.sparePartsCost > 0 && <div>Spares: <span className="text-slate-900">₹{exp.sparePartsCost}</span></div>}
                          {exp.serviceCost > 0 && <div>Service: <span className="text-slate-900">₹{exp.serviceCost}</span></div>}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[10px] uppercase font-bold">Standard Fleet</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-black text-rose-600 text-xs">
                      ₹{totalCost.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {exp.dieselPaymentType === 'Credit' && exp.dieselPaidStatus === 'Pending' ? (
                        <button
                          onClick={() => handleClearDieselCredit(exp)}
                          className="inline-flex px-2 py-0.5 text-[9px] font-black rounded-full bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-100 active:scale-95 transition cursor-pointer"
                          title="Click to clear balance"
                        >
                          Credit Pending (Pay)
                        </button>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                          Cleared
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => startEdit(exp)}
                          className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-950 border border-slate-200 rounded-lg transition cursor-pointer"
                          title="Edit Entry"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(exp.id)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-650 rounded-lg border border-rose-150 transition cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-extrabold text-xs uppercase tracking-wide">
                    No expense work entries matched selected options.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Insertion Overlay */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl py-6 px-6 shadow-md relative">
            <button 
              onClick={() => { setShowAddForm(false); if (onFormCloseDirectly) onFormCloseDirectly(); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-6 w-6" />
            </button>
            <h3 className="text-sm font-extrabold text-slate-950 mb-4">
              {editingExpense ? 'Edit Costs Log' : 'New Operational Cost / Fuel Log'}
            </h3>

            {error && <p className="mb-4 text-[11px] text-rose-800 font-bold bg-rose-50 border border-rose-200 p-2.5 rounded-lg">{error}</p>}

            <form onSubmit={editingExpense ? handleUpdate : handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Expense Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-850 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Select Fleet Machine</label>
                  <select
                    required
                    value={selectedMachineId}
                    onChange={(e) => setSelectedMachineId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-xs font-semibold text-slate-850 focus:outline-none"
                  >
                    <option value="">Select equipment...</option>
                    {machines.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.status})</option>
                    ))}
                  </select>
                </div>

                {/* Left Side: Diesel Params */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3 col-span-2 md:col-span-1">
                  <span className="text-[9px] font-black text-amber-600 block uppercase tracking-wide">DIESEL (FUELING) ACCRUALS</span>
                  
                  <div>
                    <label className="block text-[9px] text-slate-450 uppercase font-bold mb-0.5">liters filled</label>
                    <input
                      type="number"
                      value={dieselLiters || ''}
                      onChange={(e) => handleLitersChange(Number(e.target.value))}
                      placeholder="e.g. 50"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-slate-450 uppercase font-bold mb-0.5">Calculated Cost (₹)</label>
                    <input
                      type="number"
                      value={dieselCost || ''}
                      onChange={(e) => setDieselCost(Number(e.target.value))}
                      placeholder="Automatic"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[9px]">
                    <div>
                      <label className="block text-slate-450 font-bold mb-0.5 uppercase">Pay Term</label>
                      <select
                        value={dieselPaymentType}
                        onChange={(e) => handlePaymentTypeChange(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 rounded-lg py-1 px-1 text-[10px] font-semibold text-slate-700"
                      >
                        <option value="Cash">Cash</option>
                        <option value="Credit">Credit</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-450 font-bold mb-0.5 uppercase">status</label>
                      <select
                        value={dieselPaidStatus}
                        onChange={(e) => setDieselPaidStatus(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 rounded-lg py-1 px-1 text-[10px] font-semibold text-slate-700"
                      >
                        <option value="Paid">Paid</option>
                        <option value="Pending">Pending</option>
                      </select>
                    </div>
                  </div>

                  {/* Meter hours for diesel efficiency tracking */}
                  <div className="grid grid-cols-2 gap-2 text-[9px] border-t border-slate-200 pt-2.5">
                    <div>
                      <label className="block text-slate-500 font-extrabold mb-0.5 uppercase">Opening Meter</label>
                      <input
                        type="number"
                        value={openingMeterHours || ''}
                        onChange={(e) => setOpeningMeterHours(Number(e.target.value))}
                        placeholder="e.g. 1200"
                        className="w-full bg-white border border-slate-200 rounded-lg py-1 px-1.5 text-[10px] font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 font-extrabold mb-0.5 uppercase">Closing Meter</label>
                      <input
                        type="number"
                        value={closingMeterHours || ''}
                        onChange={(e) => setClosingMeterHours(Number(e.target.value))}
                        placeholder="e.g. 1215"
                        className="w-full bg-white border border-slate-200 rounded-lg py-1 px-1.5 text-[10px] font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Side: Repair Spares Service */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 col-span-2 md:col-span-1">
                  <span className="text-[9px] font-black text-rose-600 block uppercase tracking-wide">REPAIRS & PARTS AUDIT</span>

                  <div>
                    <label className="block text-[9px] text-slate-450 uppercase font-bold mb-0.5">Repair Charges (₹)</label>
                    <input
                      type="number"
                      value={repairCost || ''}
                      onChange={(e) => setRepairCost(Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-slate-450 uppercase font-bold mb-0.5">Spare Parts Cost (₹)</label>
                    <input
                      type="number"
                      value={sparePartsCost || ''}
                      onChange={(e) => setSparePartsCost(Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-slate-450 uppercase font-bold mb-0.5">Service charges (₹)</label>
                    <input
                      type="number"
                      value={serviceCost || ''}
                      onChange={(e) => setServiceCost(Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="col-span-2 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Miscellaneous Cost (₹)</label>
                    <input
                      type="number"
                      value={miscellaneousCost || ''}
                      onChange={(e) => setMiscellaneousCost(Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-850 focus:outline-none animate-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Sum Total Audited</label>
                    <div className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-rose-650 font-black flex justify-between items-center">
                      <span>Total Costs:</span>
                      <span>₹{(dieselCost + repairCost + sparePartsCost + serviceCost + miscellaneousCost).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Notes / Spare Part Names</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Replaced oil filter, engine tuning, diesel loaded from IOC Fuel Pump"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-all text-center flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> {submitting ? 'Saving...' : editingExpense ? 'Save Expense details' : 'Log Fuel & Maintenance Costs'}
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
    </div>
  );
}
