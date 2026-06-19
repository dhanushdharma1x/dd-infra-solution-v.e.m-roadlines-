import React, { useState, useMemo, useEffect } from 'react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { DailyWorkEntry, Machine, Operator, Client } from '../types';
import { Plus, Edit2, Trash2, Calendar, Clock, DollarSign, User, Briefcase, FileSpreadsheet, X, Search, Info } from 'lucide-react';
import { calculateWorkingHours } from '../utils/calc';

interface DailyWorkEntriesProps {
  workEntries: DailyWorkEntry[];
  machines: Machine[];
  operators: Operator[];
  clients: Client[];
  role: 'admin' | 'staff';
  onRefresh: () => void;
  showFormDirectly?: boolean;
  onFormCloseDirectly?: () => void;
}

export default function DailyWorkEntries({
  workEntries,
  machines,
  operators,
  clients,
  role,
  onRefresh,
  showFormDirectly = false,
  onFormCloseDirectly
}: DailyWorkEntriesProps) {
  const [showAddForm, setShowAddForm] = useState(showFormDirectly);
  const [editingEntry, setEditingEntry] = useState<DailyWorkEntry | null>(null);

  // Filters State
  const [filterDate, setFilterDate] = useState('');
  const [filterMachine, setFilterMachine] = useState('');
  const [filterClient, setFilterClient] = useState('');

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [site, setSite] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [hourlyRate, setHourlyRate] = useState<number>(1000);
  const [breakMinutes, setBreakMinutes] = useState<number>(0);
  const [billingMode, setBillingMode] = useState<'hourly' | 'load' | 'daily'>('hourly');
  const [tripsCount, setTripsCount] = useState<number>(0);
  const [pricePerLoad, setPricePerLoad] = useState<number>(1500);
  const [dailyRentalRate, setDailyRentalRate] = useState<number>(8000);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Quick Inline Add Forms State
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [quickClientName, setQuickClientName] = useState('');
  const [quickClientSite, setQuickClientSite] = useState('');
  const [quickClientContact, setQuickClientContact] = useState('');
  const [quickClientNotes, setQuickClientNotes] = useState('');

  const [showQuickMachine, setShowQuickMachine] = useState(false);
  const [quickMachineName, setQuickMachineName] = useState('');
  const [quickMachineType, setQuickMachineType] = useState('Excavator');
  const [quickMachineReg, setQuickMachineReg] = useState('');
  const [quickMachineOperator, setQuickMachineOperator] = useState('');

  const [showQuickOperator, setShowQuickOperator] = useState(false);
  const [quickOperatorName, setQuickOperatorName] = useState('');
  const [quickOperatorPhone, setQuickOperatorPhone] = useState('');
  const [quickOperatorSalary, setQuickOperatorSalary] = useState<number>(18000);

  // Sync prop control
  useEffect(() => {
    if (showFormDirectly) {
      setShowAddForm(true);
    }
  }, [showFormDirectly]);

  // Auto populate logic to minimize clicks
  const handleMachineChange = (mId: string) => {
    setSelectedMachineId(mId);
    const macDoc = machines.find(m => m.id === mId);
    if (macDoc) {
      // Auto assign operator if registered
      if (macDoc.assignedOperator) {
        const op = operators.find(o => o.name === macDoc.assignedOperator);
        if (op) {
          setSelectedOperatorId(op.id);
        }
      }
      // Auto assign current location site as default
      if (macDoc.currentSite) {
        setSite(macDoc.currentSite);
      }
      
      const isTipper = (macDoc.type || '').toLowerCase().includes('tipper') || (macDoc.name || '').toLowerCase().includes('tipper');
      if (isTipper) {
        setBillingMode('load');
        setTripsCount(5); // default to 5 load/trips
        setPricePerLoad(1500);
        setDailyRentalRate(8000);
      } else {
        setBillingMode('hourly');
        // Proportional default rate based on machine size
        if (macDoc.name.includes('Kubota')) setHourlyRate(900);
        else if (macDoc.name.includes('Tata')) setHourlyRate(1300);
        else setHourlyRate(1100);
      }
    }
  };

  const handleClientChange = (cId: string) => {
    setSelectedClientId(cId);
    const clientDoc = clients.find(c => c.id === cId);
    if (clientDoc && clientDoc.siteName) {
      setSite(clientDoc.siteName);
    }
  };

  const handleQuickClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickClientName.trim()) return;
    try {
      const newId = `cli_${Date.now()}`;
      await setDoc(doc(db, 'clients', newId), {
        id: newId,
        name: quickClientName.trim(),
        siteName: quickClientSite.trim(),
        contactNumber: quickClientContact.trim(),
        notes: quickClientNotes.trim()
      });
      setShowQuickClient(false);
      setQuickClientName('');
      setQuickClientSite('');
      setQuickClientContact('');
      setQuickClientNotes('');
      onRefresh(); // Reload main queries
      setSelectedClientId(newId); // select it automatically!
      if (quickClientSite.trim()) {
        setSite(quickClientSite.trim());
      }
    } catch (err) {
      console.error(err);
      alert('Failed to add client profile');
    }
  };

  const handleQuickMachineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMachineName.trim()) return;
    try {
      const newId = `mac_${Date.now()}`;
      await setDoc(doc(db, 'machines', newId), {
        id: newId,
        name: quickMachineName.trim(),
        type: quickMachineType || 'Excavator',
        registrationNumber: quickMachineReg.trim(),
        currentSite: site ? site.trim() : 'HQ Location',
        assignedOperator: quickMachineOperator || 'No operator',
        status: 'Idle',
        purchaseDate: new Date().toISOString().split('T')[0],
        notes: 'Quick added from Log Work window'
      });
      setShowQuickMachine(false);
      setQuickMachineName('');
      setQuickMachineType('Excavator');
      setQuickMachineReg('');
      setQuickMachineOperator('');
      onRefresh();
      setSelectedMachineId(newId);
    } catch (err) {
      console.error(err);
      alert('Failed to add machine to fleet');
    }
  };

  const handleQuickOperatorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickOperatorName.trim()) return;
    try {
      const newId = `op_${Date.now()}`;
      await setDoc(doc(db, 'operators', newId), {
        id: newId,
        name: quickOperatorName.trim(),
        phone: quickOperatorPhone.trim(),
        monthlySalary: Number(quickOperatorSalary) || 18000,
        advanceGiven: 0,
        pendingSalary: 0
      });
      setShowQuickOperator(false);
      setQuickOperatorName('');
      setQuickOperatorPhone('');
      setQuickOperatorSalary(18000);
      onRefresh();
      setSelectedOperatorId(newId);
    } catch (err) {
      console.error(err);
      alert('Failed to add operator');
    }
  };

  const computedHours = useMemo(() => {
    return calculateWorkingHours(startTime, endTime, breakMinutes);
  }, [startTime, endTime, breakMinutes]);

  const computedEarnings = useMemo(() => {
    if (billingMode === 'load') {
      return Math.round(tripsCount * pricePerLoad);
    } else if (billingMode === 'daily') {
      return Math.round(dailyRentalRate);
    } else {
      return Math.round(computedHours * hourlyRate);
    }
  }, [billingMode, tripsCount, pricePerLoad, dailyRentalRate, computedHours, hourlyRate]);

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setSelectedMachineId('');
    setSelectedOperatorId('');
    setSelectedClientId('');
    setSite('');
    setStartTime('08:00');
    setEndTime('17:00');
    setHourlyRate(1000);
    setBreakMinutes(0);
    setBillingMode('hourly');
    setTripsCount(0);
    setPricePerLoad(1500);
    setDailyRentalRate(8000);
    setError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachineId || !selectedOperatorId || !selectedClientId || !site || !startTime || !endTime) {
      setError('Please fill in physical work parameters: Machine, Operator, Client, Site Location, Hours.');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      const mac = machines.find(m => m.id === selectedMachineId)!;
      const op = operators.find(o => o.id === selectedOperatorId)!;
      const cl = clients.find(c => c.id === selectedClientId)!;

      const newId = `work_${Date.now()}`;
      const entryDoc: DailyWorkEntry = {
        id: newId,
        date,
        machineId: selectedMachineId,
        machineName: mac.name,
        operatorId: selectedOperatorId,
        operatorName: op.name,
        site,
        clientId: selectedClientId,
        clientName: cl.name,
        startTime,
        endTime,
        workingHours: computedHours,
        hourlyRate,
        earnings: computedEarnings,
        breakMinutes: Number(breakMinutes) || 0,
        billed: false,
        billingMode,
        tripsCount: billingMode === 'load' ? Number(tripsCount) : 0,
        pricePerLoad: billingMode === 'load' ? Number(pricePerLoad) : 1500,
        dailyRentalRate: billingMode === 'daily' ? Number(dailyRentalRate) : 8000
      };

      await setDoc(doc(db, 'dailyWorkEntries', newId), entryDoc);
      
      // Update machine's current location seamlessly
      await setDoc(doc(db, 'machines', selectedMachineId), {
        ...mac,
        currentSite: site,
        status: 'Working' // Set working on work log creation
      });

      setShowAddForm(false);
      if (onFormCloseDirectly) onFormCloseDirectly();
      resetForm();
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Log entry write failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (entry: DailyWorkEntry) => {
    setEditingEntry(entry);
    setDate(entry.date);
    setSelectedMachineId(entry.machineId);
    setSelectedOperatorId(entry.operatorId);
    setSelectedClientId(entry.clientId);
    setSite(entry.site);
    setStartTime(entry.startTime);
    setEndTime(entry.endTime);
    setHourlyRate(entry.hourlyRate);
    setBreakMinutes(entry.breakMinutes || 0);
    setBillingMode(entry.billingMode || 'hourly');
    setTripsCount(entry.tripsCount || 0);
    setPricePerLoad(entry.pricePerLoad || 1500);
    setDailyRentalRate(entry.dailyRentalRate || 8000);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    setError('');
    setSubmitting(true);

    try {
      const mac = machines.find(m => m.id === selectedMachineId)!;
      const op = operators.find(o => o.id === selectedOperatorId)!;
      const cl = clients.find(c => c.id === selectedClientId)!;

      const updatedDoc: DailyWorkEntry = {
        ...editingEntry,
        date,
        machineId: selectedMachineId,
        machineName: mac.name,
        operatorId: selectedOperatorId,
        operatorName: op.name,
        site,
        clientId: selectedClientId,
        clientName: cl.name,
        startTime,
        endTime,
        workingHours: computedHours,
        hourlyRate,
        earnings: computedEarnings,
        breakMinutes: Number(breakMinutes) || 0,
        billingMode,
        tripsCount: billingMode === 'load' ? Number(tripsCount) : 0,
        pricePerLoad: billingMode === 'load' ? Number(pricePerLoad) : 1500,
        dailyRentalRate: billingMode === 'daily' ? Number(dailyRentalRate) : 8000
      };

      await setDoc(doc(db, 'dailyWorkEntries', editingEntry.id), updatedDoc);
      setEditingEntry(null);
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
    if (!window.confirm('Delete this day work entry record? This reverts auto calculations.')) return;
    try {
      await deleteDoc(doc(db, 'dailyWorkEntries', id));
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Delete failed.');
    }
  };

  // Filtered entries memo
  const filteredEntries = useMemo(() => {
    return workEntries.filter(entry => {
      const matchDate = filterDate ? entry.date === filterDate : true;
      const matchMac = filterMachine ? entry.machineId === filterMachine : true;
      const matchClient = filterClient ? entry.clientId === filterClient : true;
      return matchDate && matchMac && matchClient;
    }).sort((a,b) => b.date.localeCompare(a.date));
  }, [workEntries, filterDate, filterMachine, filterClient]);

  return (
    <div id="work_entries_panel" className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">Daily Operations Work Ledger</h2>
          <p className="text-slate-500 text-xs mt-1">Record and aggregate daily billing work parameters</p>
        </div>
        <button
          onClick={() => { setShowAddForm(true); setEditingEntry(null); resetForm(); }}
          className="flex items-center justify-center gap-1.5 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg font-bold transition shadow-md shadow-amber-500/10 cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" /> Log Daily Work
        </button>
      </div>

      {/* Operations Quick Search/Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap gap-3 items-center shadow-xs">
        <div className="flex items-center gap-2 text-slate-550 text-xs font-bold uppercase shrink-0">
          <Search className="h-4 w-4 text-amber-500" /> Filter Logs:
        </div>
        
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-850 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
        />

        <select
          value={filterMachine}
          onChange={(e) => setFilterMachine(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-850 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
        >
          <option value="">By Machine...</option>
          {machines.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-850 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
        >
          <option value="">By Client...</option>
          {clients.map(cl => (
            <option key={cl.id} value={cl.id}>{cl.name}</option>
          ))}
        </select>

        {(filterDate || filterMachine || filterClient) && (
          <button
            onClick={() => { setFilterDate(''); setFilterMachine(''); setFilterClient(''); }}
            className="text-xs text-amber-600 hover:text-amber-700 underline font-semibold cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Main Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider divide-y">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Machine & Operator</th>
                <th className="py-3 px-4">Client & Work Site</th>
                <th className="py-3 px-4">Operational Hours</th>
                <th className="py-3 px-4">Rate / Hr</th>
                <th className="py-3 px-4">Earnings</th>
                <th className="py-3 px-4 text-center">Invoiced</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filteredEntries.map(entry => (
                <tr key={entry.id} className="hover:bg-slate-50/50">
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                    {entry.date}
                  </td>
                  <td className="py-3.5 px-4">
                    <div>
                      <div className="font-extrabold text-slate-900 text-xs">{entry.machineName}</div>
                      <div className="text-slate-400 text-[10px] mt-0.5 flex items-center gap-1 font-bold">
                        <User className="h-3 w-3 text-amber-500" /> {entry.operatorName}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div>
                      <div className="font-extrabold text-slate-900 text-xs max-w-xs truncate">{entry.clientName}</div>
                      <div className="text-slate-450 text-[10px] mt-0.5 max-w-xs truncate flex items-center gap-1 font-semibold">
                        <Briefcase className="h-3 w-3 text-slate-450" /> {entry.site}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-800 font-bold">
                    {entry.billingMode === 'load' ? (
                      <div>
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wider mb-1">Load Basis</span>
                        <div className="text-xs font-bold text-slate-900">{entry.tripsCount || 0} Loads</div>
                      </div>
                    ) : entry.billingMode === 'daily' ? (
                      <div>
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-purple-50 text-purple-700 border border-purple-100 uppercase tracking-wider mb-1">Daily Flat</span>
                        <div className="text-xs font-bold text-slate-900">1 Day Rental</div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-amber-500" />
                          <span>{entry.workingHours} hrs</span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold block">({entry.startTime} - {entry.endTime})</span>
                        {entry.breakMinutes ? (
                          <span className="text-[9px] text-rose-500 font-extrabold block mt-0.5">(- {entry.breakMinutes}m break)</span>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-500">
                    {entry.billingMode === 'load' ? (
                      <span>₹{entry.pricePerLoad?.toLocaleString('en-IN') || 0}/load</span>
                    ) : entry.billingMode === 'daily' ? (
                      <span>₹{entry.dailyRentalRate?.toLocaleString('en-IN') || 0}/day</span>
                    ) : (
                      <span>₹{entry.hourlyRate}/hr</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-black text-amber-600 text-xs">
                    ₹{entry.earnings.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className={`inline-flex px-2 py-0.5 text-[9px] font-bold rounded-full ${
                      entry.billed 
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                        : 'bg-amber-50 text-amber-700 border border-amber-100'
                    }`}>
                      {entry.billed ? 'Billed' : 'Pending'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        onClick={() => startEdit(entry)}
                        disabled={entry.billed}
                        className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-950 border border-slate-255 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title="Edit Entry"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        disabled={entry.billed}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-650 rounded-lg border border-rose-150 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title="Delete Day Log"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-bold text-xs uppercase tracking-wide">
                    No operations work logs matched the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Edit / Insertion Overlay Box */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto w-full">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl py-6 px-6 shadow-md relative">
            <button 
              onClick={() => { setShowAddForm(false); if (onFormCloseDirectly) onFormCloseDirectly(); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-6 w-6" />
            </button>
            <h3 className="text-sm font-extrabold text-slate-950 mb-4">
              {editingEntry ? 'Edit Operations Work Log' : 'Log Daily Machine Work Parameter'}
            </h3>

            {error && <p className="mb-4 text-[11px] text-rose-800 font-bold bg-rose-50 p-2.5 rounded-lg border border-rose-200">{error}</p>}

            <form onSubmit={editingEntry ? handleUpdate : handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Work Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Client Profile</label>
                    <button
                      type="button"
                      onClick={() => setShowQuickClient(true)}
                      className="text-amber-600 hover:text-amber-700 font-extrabold text-[10px] flex items-center cursor-pointer"
                    >
                      + Quick Add
                    </button>
                  </div>
                  <select
                    required
                    value={selectedClientId}
                    onChange={(e) => handleClientChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">Select client...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Fleet Machine</label>
                    <button
                      type="button"
                      onClick={() => setShowQuickMachine(true)}
                      className="text-amber-600 hover:text-amber-700 font-extrabold text-[10px] flex items-center cursor-pointer"
                    >
                      + Quick Add
                    </button>
                  </div>
                  <select
                    required
                    value={selectedMachineId}
                    onChange={(e) => handleMachineChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">Select equipment...</option>
                    {machines.filter(m => m.status !== 'Repair' || editingEntry).map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.status})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Assigned Operator</label>
                    <button
                      type="button"
                      onClick={() => setShowQuickOperator(true)}
                      className="text-amber-600 hover:text-amber-700 font-extrabold text-[10px] flex items-center cursor-pointer"
                    >
                      + Quick Add
                    </button>
                  </div>
                  <select
                    required
                    value={selectedOperatorId}
                    onChange={(e) => setSelectedOperatorId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">Select operator...</option>
                    {operators.map(op => (
                      <option key={op.id} value={op.id}>{op.name}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Work Site / Trench Location</label>
                  <input
                    type="text"
                    required
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                    placeholder="e.g. Block C Pipeline trenching"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Shift Start Time</label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Shift End Time</label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Lunch break (Minutes)</label>
                  <input
                    type="number"
                    min="0"
                    max="480"
                    placeholder="e.g. 60"
                    value={breakMinutes || ''}
                    onChange={(e) => setBreakMinutes(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Billing options selection */}
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Billing Basis / Calculation Mode</label>
                  <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setBillingMode('hourly')}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                        billingMode === 'hourly'
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/50'
                      }`}
                    >
                      Hourly Rent
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingMode('load')}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                        billingMode === 'load'
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/50'
                      }`}
                    >
                      Per Load
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingMode('daily')}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                        billingMode === 'daily'
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/50'
                      }`}
                    >
                      Daily Rental
                    </button>
                  </div>
                </div>

                {/* Conditional fields based on selected billing basis */}
                {billingMode === 'hourly' ? (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Hourly Rent Rate (₹)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                ) : null}

                {billingMode === 'load' ? (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Price Per Load (₹)</label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={pricePerLoad}
                        onChange={(e) => setPricePerLoad(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Loads logged</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={tripsCount}
                        onChange={(e) => setTripsCount(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </>
                ) : null}

                {billingMode === 'daily' ? (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">One Day Rental Rate (₹)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={dailyRentalRate}
                      onChange={(e) => setDailyRentalRate(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                ) : null}

                <div className="col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-250 font-bold space-y-1.5 shadow-xs">
                  <span className="text-[9px] text-slate-450 block uppercase tracking-wider font-extrabold">AUTO CALCULATION PREVIEW</span>
                  
                  {billingMode === 'load' ? (
                    <div className="text-xs text-slate-750 flex justify-between">
                      <span>Formula:</span>
                      <span className="text-slate-850 font-bold">{tripsCount} loads * ₹{pricePerLoad.toLocaleString('en-IN')}/load</span>
                    </div>
                  ) : billingMode === 'daily' ? (
                    <div className="text-xs text-slate-750 flex justify-between">
                      <span>Formula:</span>
                      <span className="text-slate-850 font-bold">Flat 1 day charge</span>
                    </div>
                  ) : (
                    <>
                      <div className="text-xs text-slate-750 flex justify-between">
                        <span>Net Working Hours:</span>
                        <span>{computedHours} hrs</span>
                      </div>
                      <div className="text-xs text-slate-750 flex justify-between">
                        <span>Hourly Rent Rate:</span>
                        <span>₹{hourlyRate.toLocaleString('en-IN')}/hr</span>
                      </div>
                    </>
                  )}

                  <div className="text-xs text-slate-900 flex justify-between font-black border-t border-slate-200 pt-1.5 mt-1.5">
                    <span>Est. Total Earnings:</span>
                    <span className="text-emerald-600 font-extrabold text-sm">₹{computedEarnings.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting || (billingMode === 'hourly' && computedHours <= 0) || (billingMode === 'load' && tripsCount <= 0)}
                  className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-955 font-bold rounded-xl text-xs transition-all text-center flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4" /> {submitting ? 'Logging...' : editingEntry ? 'Save Entry Details' : 'Write Work Entry Log'}
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

      {/* Quick Add Client Sub-Modal Overlay */}
      {showQuickClient && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-2xl py-6 px-6 shadow-xl relative animate-pop-in">
            <button
              onClick={() => setShowQuickClient(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-4">Quick Add Client</h3>
            <form onSubmit={handleQuickClientSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Company / client Name *</label>
                <input
                  type="text" required value={quickClientName}
                  onChange={(e) => setQuickClientName(e.target.value)}
                  placeholder="e.g. Sobha Developers"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-850 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Working Site Headquarters</label>
                <input
                  type="text" value={quickClientSite}
                  onChange={(e) => setQuickClientSite(e.target.value)}
                  placeholder="e.g. Hebbal water mains"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-850 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Phone Number</label>
                <input
                  type="text" value={quickClientContact}
                  onChange={(e) => setQuickClientContact(e.target.value)}
                  placeholder="e.g. +91 99887 76655"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-850 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Credit Notes / Payment Period</label>
                <input
                  type="text" value={quickClientNotes}
                  onChange={(e) => setQuickClientNotes(e.target.value)}
                  placeholder="e.g. 15 days bill window"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-850 focus:outline-none"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button type="submit" className="flex-1 py-2 px-4 bg-amber-500 hover:bg-amber-600 font-bold text-xs text-slate-950 rounded-xl cursor-pointer">
                  Save Client
                </button>
                <button type="button" onClick={() => setShowQuickClient(false)} className="py-2 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-650 font-bold text-xs rounded-xl cursor-pointer">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Fleet Machine Sub-Modal Overlay */}
      {showQuickMachine && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-2xl py-6 px-6 shadow-xl relative animate-pop-in">
            <button
              onClick={() => setShowQuickMachine(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-4">Quick Add Fleet Machine</h3>
            <form onSubmit={handleQuickMachineSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Machine Name / specifications *</label>
                <input
                  type="text" required value={quickMachineName}
                  onChange={(e) => setQuickMachineName(e.target.value)}
                  placeholder="e.g. TATA HITACHI EX200"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-850 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Machine Type</label>
                <select
                  value={quickMachineType}
                  onChange={(e) => setQuickMachineType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-850 focus:outline-none"
                >
                  <option value="Excavator">Excavator</option>
                  <option value="JCB Backhoe">JCB Backhoe</option>
                  <option value="Soil Compactor">Soil Compactor</option>
                  <option value="Loader">Loader</option>
                  <option value="Dumper truck">Dumper truck</option>
                  <option value="Other Heavy Machinery">Other Heavy Machinery</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Registration RTO / Chassis Plate Number</label>
                <input
                  type="text" value={quickMachineReg}
                  onChange={(e) => setQuickMachineReg(e.target.value)}
                  placeholder="e.g. KA-04-ME-4521"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-850 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Assigned Operator Name</label>
                <input
                  type="text" value={quickMachineOperator}
                  onChange={(e) => setQuickMachineOperator(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-850 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button type="submit" className="flex-1 py-2 px-4 bg-amber-500 hover:bg-amber-600 font-bold text-xs text-slate-950 rounded-xl cursor-pointer">
                  Save Equipment
                </button>
                <button type="button" onClick={() => setShowQuickMachine(false)} className="py-2 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-650 font-bold text-xs rounded-xl cursor-pointer">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Operator Sub-Modal Overlay */}
      {showQuickOperator && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-2xl py-6 px-6 shadow-xl relative animate-pop-in">
            <button
              onClick={() => setShowQuickOperator(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-4">Quick Add Operator</h3>
            <form onSubmit={handleQuickOperatorSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Operator Full Name *</label>
                <input
                  type="text" required value={quickOperatorName}
                  onChange={(e) => setQuickOperatorName(e.target.value)}
                  placeholder="e.g. Ramesh Pujari"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-850 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Mobile Contact Number</label>
                <input
                  type="text" value={quickOperatorPhone}
                  onChange={(e) => setQuickOperatorPhone(e.target.value)}
                  placeholder="e.g. +91 99002 11002"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-850 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Monthly Basic Salary (₹) *</label>
                <input
                  type="number" required value={quickOperatorSalary}
                  onChange={(e) => setQuickOperatorSalary(Number(e.target.value))}
                  placeholder="e.g. 18000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-850 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button type="submit" className="flex-1 py-2 px-4 bg-amber-500 hover:bg-amber-600 font-bold text-xs text-slate-950 rounded-xl cursor-pointer">
                  Save Operator
                </button>
                <button type="button" onClick={() => setShowQuickOperator(false)} className="py-2 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-650 font-bold text-xs rounded-xl cursor-pointer">
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
