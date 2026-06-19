import React, { useState } from 'react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Machine, Operator } from '../types';
import { Plus, Edit2, Trash2, Fuel, PenTool, Truck, Hammer, X, Save, Calendar, User, Info, FileText } from 'lucide-react';

interface MachinesListProps {
  machines: Machine[];
  operators: Operator[];
  role: 'admin' | 'staff';
  onRefresh: () => void;
}

export default function MachinesList({ machines, operators, role, onRefresh }: MachinesListProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState('Excavator Loader');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [currentSite, setCurrentSite] = useState('');
  const [assignedOperator, setAssignedOperator] = useState('None');
  const [status, setStatus] = useState<'Working' | 'Idle' | 'Repair'>('Idle');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [notes, setNotes] = useState('');
  const [currentMachineHours, setCurrentMachineHours] = useState<number>(0);
  const [lastServiceHours, setLastServiceHours] = useState<number>(0);
  const [serviceIntervalHours, setServiceIntervalHours] = useState<number>(250);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setType('Excavator Loader');
    setRegistrationNumber('');
    setCurrentSite('');
    setAssignedOperator('None');
    setStatus('Idle');
    setPurchaseDate('');
    setNotes('');
    setCurrentMachineHours(0);
    setLastServiceHours(0);
    setServiceIntervalHours(250);
    setError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !type || !registrationNumber) {
      setError('Please fill in Name, Type and Registration number.');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      const newId = `mac_${Date.now()}`;
      const machineDoc: Machine = {
        id: newId,
        name,
        type,
        registrationNumber,
        currentSite,
        assignedOperator,
        status,
        purchaseDate,
        notes,
        currentMachineHours: Number(currentMachineHours) || 0,
        lastServiceHours: Number(lastServiceHours) || 0,
        serviceIntervalHours: Number(serviceIntervalHours) || 250
      };
      await setDoc(doc(db, 'machines', newId), machineDoc);
      setShowAddForm(false);
      resetForm();
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error occurred saving machine.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (mac: Machine) => {
    setEditingMachine(mac);
    setName(mac.name);
    setType(mac.type);
    setRegistrationNumber(mac.registrationNumber);
    setCurrentSite(mac.currentSite || '');
    setAssignedOperator(mac.assignedOperator || 'None');
    setStatus(mac.status || 'Idle');
    setPurchaseDate(mac.purchaseDate || '');
    setNotes(mac.notes || '');
    setCurrentMachineHours(mac.currentMachineHours || 0);
    setLastServiceHours(mac.lastServiceHours || 0);
    setServiceIntervalHours(mac.serviceIntervalHours || 250);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMachine) return;
    if (!name || !type || !registrationNumber) {
      setError('Name, Type & Registration are mandated fields.');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      const updatedDoc: Machine = {
        ...editingMachine,
        name,
        type,
        registrationNumber,
        currentSite,
        assignedOperator,
        status,
        purchaseDate,
        notes,
        currentMachineHours: Number(currentMachineHours) || 0,
        lastServiceHours: Number(lastServiceHours) || 0,
        serviceIntervalHours: Number(serviceIntervalHours) || 250
      };
      await setDoc(doc(db, 'machines', editingMachine.id), updatedDoc);
      setEditingMachine(null);
      resetForm();
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed saving.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this equipment from operational fleet lists?')) return;
    try {
      await deleteDoc(doc(db, 'machines', id));
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Delete failed. Check access permits.');
    }
  };

  return (
    <div id="machines_panel" className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">Equipment Operational Fleet ({machines.length})</h2>
          <p className="text-slate-500 text-xs mt-1">Add, update and status-track active heavy equipment assets</p>
        </div>
        {role === 'admin' && (
          <button
            onClick={() => { setShowAddForm(true); setEditingMachine(null); resetForm(); }}
            className="flex items-center justify-center gap-1.5 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg font-bold transition shadow-md shadow-amber-500/10 cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" /> Add Machine
          </button>
        )}
      </div>

      {/* Grid of machines */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {machines.map(mac => (
          <div key={mac.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 hover:shadow-xs hover:border-slate-300 transition flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-xs text-slate-900">{mac.name}</h3>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wide">{mac.type}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                  mac.status === 'Working' 
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                    : mac.status === 'Repair'
                    ? 'bg-rose-50 text-rose-600 border border-rose-100 animate-pulse'
                    : 'bg-amber-50 text-amber-600 border border-amber-100'
                }`}>
                  {mac.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-[11px] bg-slate-50 border border-slate-100 rounded-xl p-3 font-semibold text-slate-700">
                <div>
                  <span className="text-slate-400 text-[9px] block font-bold uppercase">REGISTRATION</span>
                  <span className="text-slate-900 truncate block font-bold">{mac.registrationNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[9px] block font-bold uppercase">OPERATOR</span>
                  <span className="text-slate-900 truncate block flex items-center gap-1 font-bold">
                    <User className="h-3 w-3 text-amber-500" /> {mac.assignedOperator || 'None'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[9px] block font-bold uppercase">METER HOURS</span>
                  <span className="text-slate-900 truncate block font-bold">{mac.currentMachineHours || 0} hrs</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[9px] block font-bold uppercase">LAST SERVICE</span>
                  <span className="text-slate-900 truncate block font-bold">{mac.lastServiceHours || 0} hrs</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 text-[9px] block font-bold uppercase">CURRENT SITE LOCATION</span>
                  <span className="text-slate-900 truncate block font-bold">{mac.currentSite || 'Not assigned'}</span>
                </div>
              </div>

              {/* Service Alert Check */}
              {(() => {
                const curHours = mac.currentMachineHours || 0;
                const lastServ = mac.lastServiceHours || 0;
                const interval = mac.serviceIntervalHours || 250;
                const diff = curHours - lastServ;
                const isDue = diff >= interval;
                if (!isDue) return null;
                return (
                  <div className="mt-3 flex items-center gap-2 bg-rose-50 border border-rose-105 p-2.5 rounded-xl text-[10.5px] text-rose-800 font-extrabold animate-pulse">
                    <span className="text-rose-500">⚠️</span>
                    <span>Service Overdue by {diff - interval} hours!</span>
                  </div>
                );
              })()}

              {mac.notes && (
                <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-start gap-1.5 mt-3">
                  <Info className="h-3.5 w-3.5 mt-0.5 text-slate-400 shrink-0" />
                  <p className="truncate-2-lines italic font-medium">{mac.notes}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 mt-3">
              <span className="text-slate-400 text-[9px] font-bold uppercase">PURCHASE: {mac.purchaseDate || 'N/A'}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(mac)}
                  className="p-1.5 bg-slate-105 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-150 border border-slate-200 transition cursor-pointer"
                  title="Edit Status / Properties"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                {role === 'admin' && (
                  <button
                    onClick={() => handleDelete(mac.id)}
                    className="p-1.5 bg-rose-50 text-rose-650 hover:bg-rose-100 rounded-lg border border-rose-150 transition cursor-pointer"
                    title="Delete Machine"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal form for active edits / insertions */}
      {(showAddForm || editingMachine) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl py-6 px-6 shadow-md relative">
            <button 
              onClick={() => { setShowAddForm(false); setEditingMachine(null); resetForm(); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-6 w-6" />
            </button>
            <h3 className="text-sm font-extrabold text-slate-950 mb-4">
              {editingMachine ? `Quick Edit Assets: ${editingMachine.name}` : 'Log New Fleet Equipment'}
            </h3>

            {error && <p className="mb-4 text-[11px] text-rose-800 font-bold bg-rose-50 p-2.5 rounded-lg border border-rose-200">{error}</p>}

            <form onSubmit={editingMachine ? handleUpdate : handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Asset Machine Name *</label>
                  <input
                    type="text"
                    required
                    disabled={role === 'staff'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. JCB 3DX Extra"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Equipment Type *</label>
                  <select
                    value={type}
                    disabled={role === 'staff'}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-transparent transition"
                  >
                    <option>Excavator Loader</option>
                    <option>Mini Excavator</option>
                    <option>Dumper Truck</option>
                    <option>Road Roller</option>
                    <option>Concrete Mixer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Registration # *</label>
                  <input
                    type="text"
                    required
                    disabled={role === 'staff'}
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    placeholder="KA-20-MB-1234"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Site Location</label>
                  <input
                    type="text"
                    value={currentSite}
                    onChange={(e) => setCurrentSite(e.target.value)}
                    placeholder="Active Site location"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Assigned Operator</label>
                  <select
                    value={assignedOperator}
                    onChange={(e) => setAssignedOperator(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-transparent transition"
                  >
                    <option value="None">None (Unassigned)</option>
                    {operators.map(op => (
                      <option key={op.id} value={op.name}>{op.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Status State</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-transparent transition"
                  >
                    <option value="Working">Working</option>
                    <option value="Idle">Idle</option>
                    <option value="Repair">Repair</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Purchase Date</label>
                  <input
                    type="date"
                    disabled={role === 'staff'}
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-medium focus:outline-none"
                  />
                </div>

                {/* Service Tracker Additions */}
                <div className="col-span-2 bg-[#FAF5FF] border border-[#E8DBFA] p-3.5 rounded-xl space-y-2">
                  <span className="text-[9.5px] font-black text-[#7C3AED] block uppercase tracking-wider">Fleet Service Scheduler & Meter (Hours)</span>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[9px] text-slate-500 font-bold uppercase mb-1">Current Hours</label>
                      <input
                        type="number"
                        value={currentMachineHours || ''}
                        onChange={(e) => setCurrentMachineHours(Number(e.target.value))}
                        placeholder="e.g. 1450"
                        className="w-full bg-white border border-[#FAF5FF] rounded-lg px-2 py-1.5 text-xs text-slate-800 font-bold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-500 font-bold uppercase mb-1">Last Serv Hours</label>
                      <input
                        type="number"
                        value={lastServiceHours || ''}
                        onChange={(e) => setLastServiceHours(Number(e.target.value))}
                        placeholder="e.g. 1200"
                        className="w-full bg-white border border-[#FAF5FF] rounded-lg px-2 py-1.5 text-xs text-slate-800 font-bold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-500 font-bold uppercase mb-1">Interval Hours</label>
                      <input
                        type="number"
                        value={serviceIntervalHours || ''}
                        onChange={(e) => setServiceIntervalHours(Number(e.target.value))}
                        placeholder="e.g. 250"
                        className="w-full bg-white border border-[#FAF5FF] rounded-lg px-2 py-1.5 text-xs text-slate-800 font-bold focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Operational Audit / Maintenance Notes</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Engine tuned on Jun 5, seal replaced"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-medium focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-all text-center flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="h-4 w-4" /> {submitting ? 'Saving...' : 'Save Equipment Details'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setEditingMachine(null); resetForm(); }}
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
