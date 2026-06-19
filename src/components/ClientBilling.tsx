import React, { useState, useMemo, useEffect } from 'react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Client, ClientBill, DailyWorkEntry, PaymentHistory } from '../types';
import { Plus, Receipt, DollarSign, Calendar, Eye, Trash2, X, PlusCircle, CheckSquare, Square, FileText, Check, Edit, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface ClientBillingProps {
  clients: Client[];
  bills: ClientBill[];
  payments: PaymentHistory[];
  workEntries: DailyWorkEntry[];
  role: 'admin' | 'staff';
  onRefresh: () => void;
  showPaymentFormDirectly?: boolean;
  onPaymentFormCloseDirectly?: () => void;
}

export default function ClientBilling({
  clients,
  bills,
  payments,
  workEntries,
  role,
  onRefresh,
  showPaymentFormDirectly = false,
  onPaymentFormCloseDirectly
}: ClientBillingProps) {
  const [showAddClient, setShowAddClient] = useState(false);
  const [showBillGenerator, setShowBillGenerator] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(showPaymentFormDirectly);
  const [viewingBill, setViewingBill] = useState<ClientBill | null>(null);

  // Client Profile form
  const [clientName, setClientName] = useState('');
  const [siteName, setSiteName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [clientNotes, setClientNotes] = useState('');

  // Client Editing state
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editClientName, setEditClientName] = useState('');
  const [editSiteName, setEditSiteName] = useState('');
  const [editContactNumber, setEditContactNumber] = useState('');
  const [editClientNotes, setEditClientNotes] = useState('');

  // Bill Generator Form
  const [billClientId, setBillClientId] = useState('');
  const [selectedWorkEntryIds, setSelectedWorkEntryIds] = useState<string[]>([]);
  const [billPaymentType, setBillPaymentType] = useState<'Immediate' | 'Credit' | 'Partial'>('Credit');
  const [expectedPaymentDate, setExpectedPaymentDate] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 14 days default credit
  );

  // Pay Capture Form
  const [payBillId, setPayBillId] = useState('');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Sync prop changes
  useEffect(() => {
    if (showPaymentFormDirectly) {
      setShowPaymentModal(true);
    }
  }, [showPaymentFormDirectly]);

  // Unbilled logs of selected client in generator
  const clientUnbilledEntries = useMemo(() => {
    if (!billClientId) return [];
    return workEntries.filter(e => e.clientId === billClientId && !e.billed);
  }, [billClientId, workEntries]);

  // Total Hours and Amount for the selected logs in Bill Generator
  const billFormTotals = useMemo(() => {
    let hours = 0;
    let total = 0;
    let machinesUsed = new Set<string>();
    
    selectedWorkEntryIds.forEach(id => {
      const entry = workEntries.find(e => e.id === id);
      if (entry) {
        hours += entry.workingHours;
        total += entry.earnings;
        machinesUsed.add(entry.machineName);
      }
    });

    return {
      hours,
      total,
      machinesUsedStr: Array.from(machinesUsed).join(', ')
    };
  }, [selectedWorkEntryIds, workEntries]);

  // Handle billing client check box
  const toggleWorkEntrySelection = (id: string) => {
    setSelectedWorkEntryIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAllUnbilled = () => {
    setSelectedWorkEntryIds(clientUnbilledEntries.map(e => e.id));
  };

  const deselectAllUnbilled = () => {
    setSelectedWorkEntryIds([]);
  };

  // Submit Client profile
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !siteName) return;

    try {
      const newId = `cl_${Date.now()}`;
      const docData: Client = {
        id: newId,
        name: clientName,
        siteName,
        contactNumber,
        notes: clientNotes
      };
      await setDoc(doc(db, 'clients', newId), docData);
      
      // Cleanup
      setShowAddClient(false);
      setClientName('');
      setSiteName('');
      setContactNumber('');
      setClientNotes('');
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Failed saving client.');
    }
  };

  const startEditClient = (cl: Client) => {
    setEditingClient(cl);
    setEditClientName(cl.name);
    setEditSiteName(cl.siteName);
    setEditContactNumber(cl.contactNumber || '');
    setEditClientNotes(cl.notes || '');
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient || !editClientName || !editSiteName) return;
    setSubmitting(true);

    try {
      const updatedClient: Client = {
        id: editingClient.id,
        name: editClientName,
        siteName: editSiteName,
        contactNumber: editContactNumber,
        notes: editClientNotes
      };
      
      // Update Firestore client doc
      await setDoc(doc(db, 'clients', editingClient.id), updatedClient);

      // Gracefully cascade to related bills to maintain name sanity
      const relatedBills = bills.filter(b => b.clientId === editingClient.id);
      for (const bill of relatedBills) {
        await setDoc(doc(db, 'clientBills', bill.id), {
          ...bill,
          clientName: editClientName,
          siteName: editSiteName
        });
      }

      setEditingClient(null);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Failed updating client profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadInvoicePDF = (bill: ClientBill) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Dark Accent Header Bar
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, 210, 8, 'F');
    
    // Main enterprise headers
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42);
    doc.text('DD INFRA SOLUTIONS (V.E.M ROADLINES)', 15, 25);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); 
    doc.text('Earthmovers, Logistics & Project Site Heavy Machinery Fleet Billing', 15, 30);
    doc.text('Email: dhanushdharma1x@gmail.com | Call: +91 99005 25663, 90356 25663 | Insta: @vem_roadlines', 15, 34);

    // INVOICE Header Label
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(245, 158, 11); 
    doc.text('OFFICIAL INVOICE', 135, 25);

    // Separator line
    doc.setDrawColor(226, 232, 240); 
    doc.setLineWidth(0.5);
    doc.line(15, 38, 195, 38);

    // Left block - Metadata
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('INVOICE METADATA', 15, 46);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Invoice ID:      ${bill.id}`, 15, 52);
    doc.text(`Issue Date:      ${bill.date}`, 15, 57);
    doc.text(`Due Date:        ${bill.expectedPaymentDate || 'Immediate'}`, 15, 62);
    doc.text(`Terms:           ${bill.paymentType} Account`, 15, 67);

    // Right block - To customer
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('BILL TO (CUSTOMER)', 115, 46);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Client:            ${bill.clientName}`, 115, 52);
    doc.text(`Project Location:  ${bill.siteName}`, 115, 57);
    
    const clientDetails = clients.find(c => c.id === bill.clientId);
    if (clientDetails?.contactNumber) {
      doc.text(`Contact:          ${clientDetails.contactNumber}`, 115, 62);
    }
    doc.text(`Receipt Status:   ${bill.paymentStatus.toUpperCase()}`, 115, 67);

    // Grid divider
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.5);
    doc.line(15, 73, 195, 73);

    // Table Columns
    doc.setFillColor(248, 250, 252); 
    doc.rect(15, 74, 180, 8, 'F');
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('Work Log / Shift Details', 18, 79);
    doc.text('Job Site Name', 110, 79);
    doc.text('Billed Hours', 142, 79);
    doc.text('Rate/Hr', 162, 79);
    doc.text('Total Amount', 180, 79);

    doc.line(15, 82, 195, 82);

    // Linked Work entries query
    const linkedEntries = workEntries.filter(e => e.billId === bill.id);
    
    let currentY = 88;
    
    if (linkedEntries.length > 0) {
      linkedEntries.forEach((entry, idx) => {
        if (currentY > 260) {
          doc.addPage();
          currentY = 20;
          doc.setDrawColor(15, 23, 42);
          doc.setLineWidth(0.5);
          doc.line(15, currentY, 195, currentY);
          currentY += 8;
        }

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        doc.text(`${idx + 1}. Operator Log: ${entry.date} (${entry.machineName})`, 18, currentY);
        doc.text(entry.site || bill.siteName, 110, currentY, { maxWidth: 30 });
        doc.text(`${entry.workingHours} hrs`, 142, currentY);
        doc.text(`Rs. ${entry.hourlyRate}`, 162, currentY);
        doc.text(`Rs. ${entry.earnings.toLocaleString('en-IN')}`, 180, currentY);

        if (entry.operatorName) {
          doc.setFont('Helvetica', 'oblique');
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text(`Shift Operator: ${entry.operatorName}`, 22, currentY + 4);
          currentY += 10;
        } else {
          currentY += 8;
        }
      });
    } else {
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.text(`1. Machinery Rent/Lease - Billed Hours Compilation`, 18, currentY);
      doc.text(`Comp: ${bill.machineUsed}`, 18, currentY + 5);
      doc.text(bill.siteName, 110, currentY);
      doc.text(`${bill.hoursWorked} hrs`, 142, currentY);
      doc.text(`Rs. ${bill.ratePerHour}`, 162, currentY);
      doc.text(`Rs. ${bill.totalBillAmount.toLocaleString('en-IN')}`, 180, currentY);
      currentY += 14;
    }

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, currentY, 195, currentY);
    currentY += 8;

    // Financial breakdown block on the right
    const summaryX = 130;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text('BILL BREAKDOWN:', summaryX, currentY);
    currentY += 6;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Gross Amount:', summaryX, currentY);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Rs. ${bill.totalBillAmount.toLocaleString('en-IN')}`, 178, currentY);
    currentY += 5;

    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Advanced/Cleared:', summaryX, currentY);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(16, 185, 129); 
    doc.text(`Rs. ${bill.amountReceived.toLocaleString('en-IN')}`, 178, currentY);
    currentY += 5;

    // Amber highlight box for Balance Receivable
    doc.setFillColor(254, 243, 199); 
    doc.rect(summaryX - 2, currentY - 3.5, 67, 5.5, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(217, 119, 6); 
    doc.text('Net Balance Due:', summaryX, currentY);
    doc.text(`Rs. ${bill.pendingAmount.toLocaleString('en-IN')}`, 178, currentY);
    currentY += 14;

    if (currentY > 230) {
      doc.addPage();
      currentY = 30;
    }

    doc.setFont('Helvetica', 'oblique');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Guidelines & Certification Notes:', 15, currentY);
    doc.text('1. Invoice computed instantly using verified digital logs database counters.', 15, currentY + 4);
    doc.text('2. Please clear outstanding amounts within terms to avoid late interest charges.', 15, currentY + 8);
    doc.text('3. This is an electronically processed document requiring no manual signatures.', 15, currentY + 12);

    // Signatures
    const sigY = currentY + 4;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.line(140, sigY, 190, sigY);
    doc.text('AUTHORIZED COUNTER-SIGN', 141, sigY + 5);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('DD Infra Solutions Billing Dept', 140, sigY + 9);

    doc.save(`Invoice_${bill.clientName.replace(/\s+/g, '_')}_${bill.id}.pdf`);
  };

  // Compile bill selection into actual Invoice
  const handleGenerateBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billClientId || selectedWorkEntryIds.length === 0) {
      alert('Please select at least one hourly log to invoice.');
      return;
    }
    setSubmitting(true);

    try {
      const targetClient = clients.find(c => c.id === billClientId)!;
      const billId = `bill_${Date.now()}`;
      
      const ratePerHourAvg = selectedWorkEntryIds.length > 0 
        ? Math.round((billFormTotals.total / billFormTotals.hours) * 10) / 10 
        : 0;

      const newBill: ClientBill = {
        id: billId,
        date: new Date().toISOString().split('T')[0],
        clientId: billClientId,
        clientName: targetClient.name,
        siteName: targetClient.siteName,
        machineUsed: billFormTotals.machinesUsedStr || 'Construction fleet',
        hoursWorked: billFormTotals.hours,
        ratePerHour: ratePerHourAvg,
        totalBillAmount: billFormTotals.total,
        amountReceived: 0,
        pendingAmount: billFormTotals.total,
        paymentType: billPaymentType,
        expectedPaymentDate,
        paymentStatus: 'Pending'
      };

      await setDoc(doc(db, 'clientBills', billId), newBill);

      // Flag all child work entries as billed
      for (const id of selectedWorkEntryIds) {
        const matchingEntry = workEntries.find(e => e.id === id)!;
        await setDoc(doc(db, 'dailyWorkEntries', id), {
          ...matchingEntry,
          billed: true,
          billId: billId
        });
      }

      setShowBillGenerator(false);
      setBillClientId('');
      setSelectedWorkEntryIds([]);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Invoicing failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Incoming payment record
  const handlePostPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payBillId || payAmount <= 0) {
      alert('Select a bill and input a valid cash payload.');
      return;
    }
    setSubmitting(true);

    try {
      const targetBill = bills.find(b => b.id === payBillId)!;
      const paymentId = `pay_${Date.now()}`;
      
      const newAmtReceived = targetBill.amountReceived + payAmount;
      const newPending = Math.max(0, targetBill.totalBillAmount - newAmtReceived);
      
      let status: 'Paid' | 'Partially Paid' | 'Pending' = 'Partially Paid';
      if (newPending === 0) status = 'Paid';
      else if (newAmtReceived === 0) status = 'Pending';

      // 1. Save historical payment ledger item
      const indexItem: PaymentHistory = {
        id: paymentId,
        date: paymentDate,
        clientId: targetBill.clientId,
        clientName: targetBill.clientName,
        billId: payBillId,
        amountReceived: payAmount,
        remainingBalance: newPending,
        notes: paymentNotes
      };
      await setDoc(doc(db, 'paymentHistory', paymentId), indexItem);

      // 2. Update Bill document
      const updatedBill: ClientBill = {
        ...targetBill,
        amountReceived: newAmtReceived,
        pendingAmount: newPending,
        paymentStatus: status,
        actualPaymentDate: status === 'Paid' ? paymentDate : undefined
      };
      await setDoc(doc(db, 'clientBills', payBillId), updatedBill);

      setShowPaymentModal(false);
      if (onPaymentFormCloseDirectly) onPaymentFormCloseDirectly();
      setPayBillId('');
      setPayAmount(0);
      setPaymentNotes('');
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Fail saving transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBill = async (bill: ClientBill) => {
    if (!window.confirm('Revert & delete this generated bill? Children entries will revert to Unbilled.')) return;
    try {
      // 1. Delete bill
      await deleteDoc(doc(db, 'clientBills', bill.id));
      
      // 2. Revert child work entries
      const children = workEntries.filter(e => e.billId === bill.id);
      for (const child of children) {
        await setDoc(doc(db, 'dailyWorkEntries', child.id), {
          ...child,
          billed: false,
          billId: ''
        });
      }

      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Error deleting bill.');
    }
  };

  return (
    <div id="clients_panel" className="space-y-8 font-sans">
      
      {/* Client Billing Summary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">Client Billings & Accounts</h2>
          <p className="text-slate-500 text-xs mt-1">Compile client bills from operator log hours, track payment milestones</p>
        </div>
        <div className="flex gap-2">
          {role === 'admin' && (
            <button
              onClick={() => setShowBillGenerator(true)}
              className="flex items-center gap-1.5 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-955 font-extrabold rounded-lg text-xs shadow-md shadow-amber-500/10 cursor-pointer"
              id="btn_trigger_billing"
            >
              <Receipt className="h-4 w-4" /> Generate Client Bill
            </button>
          )}
          <button
            onClick={() => setShowAddClient(true)}
            className="py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-250 rounded-lg text-xs font-bold cursor-pointer"
          >
            Add Client Profile
          </button>
        </div>
      </div>

      {/* Grid of registered clients and current site information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {clients.map(cl => {
          const clientBills = bills.filter(b => b.clientId === cl.id);
          const totalInvoiced = clientBills.reduce((s,b) => s + b.totalBillAmount, 0);
          const outstanding = clientBills.reduce((s,b) => s + b.pendingAmount, 0);

          return (
            <div key={cl.id} className="relative bg-white border border-slate-200 p-5 rounded-2xl space-y-4 transition-all duration-300 shadow-xs card-hover-effect animate-fade-in">
              <div className="pr-8">
                <h3 className="font-extrabold text-sm text-amber-600 truncate">{cl.name}</h3>
                <p className="text-slate-500 text-xs font-semibold mt-1 truncate">Site HQ: {cl.siteName}</p>
                {cl.contactNumber && <p className="text-slate-400 text-[11px] mt-0.5">Phone: {cl.contactNumber}</p>}
              </div>

              {role === 'admin' && (
                <button
                  onClick={() => startEditClient(cl)}
                  className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50/50 rounded-lg transition-all duration-200 cursor-pointer"
                  title="Edit Client Name / Info"
                >
                  <Edit className="h-3.5 w-3.5" />
                </button>
              )}

              <div className="grid grid-cols-2 gap-3 py-2.5 px-3 bg-slate-50 rounded-xl text-xs font-bold text-slate-600 border border-slate-100">
                <div>
                  <span className="text-slate-400 text-[9px] block uppercase">Total Billed</span>
                  <span className="text-slate-850 text-xs">₹{totalInvoiced.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[9px] block uppercase">Outstanding</span>
                  <span className="text-orange-600 text-xs">₹{outstanding.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {cl.notes && <p className="text-[11px] text-slate-500 italic font-medium">*{cl.notes}</p>}
            </div>
          );
        })}
      </div>

      {/* SECTION 2: Bills status panel */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-md font-extrabold text-slate-900">Client Bills, Payment Milestones & Status</h3>
          {role === 'admin' && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs cursor-pointer"
            >
              Record Payment Receipt
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider divide-y">
                  <th className="py-3 px-4">Bill Date</th>
                  <th className="py-3 px-4">Client Name & Site</th>
                  <th className="py-3 px-4">Asset machine Used</th>
                  <th className="py-3 px-4">Hours Logged</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Pending Receivable</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {bills.map(bill => (
                  <tr key={bill.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-600 whitespace-nowrap">{bill.date}</td>
                    <td className="py-3.5 px-4">
                      <div>
                        <div className="font-extrabold text-slate-900 text-sm">{bill.clientName}</div>
                        <div className="text-slate-500 text-xs mt-0.5">{bill.siteName}</div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-500">{bill.machineUsed}</td>
                    <td className="py-3.5 px-4 font-bold text-amber-600">{bill.hoursWorked} hrs</td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-900">₹{bill.totalBillAmount.toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4 font-extrabold text-orange-605">₹{bill.pendingAmount.toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 text-[9px] font-bold rounded ${
                        bill.paymentStatus === 'Paid' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : bill.paymentStatus === 'Partially Paid'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
                      }`}>
                        {bill.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex justify-end items-center gap-1.5">
                        <button
                          onClick={() => handleDownloadInvoicePDF(bill)}
                          className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg border border-amber-200 hover:border-amber-300 transition cursor-pointer flex items-center justify-center"
                          title="Download Official PDF Bill"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        {role === 'admin' && (
                          <button
                            onClick={() => handleDeleteBill(bill)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-655 rounded-lg border border-rose-150 transition cursor-pointer flex items-center justify-center"
                            title="Void bill"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {bills.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-bold uppercase text-[10px] tracking-wide">
                      No customer bills compiled yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION 3: Payment History Receipt Timeline */}
      <div className="space-y-4">
        <div>
          <h3 className="text-md font-extrabold text-slate-900">Payment Receipts History Ledger</h3>
          <p className="text-slate-500 text-xs mt-0.5">Chronological list of payments cleared from clients</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider divide-y">
                  <th className="py-3 px-4">Txn Date</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Cleared Amount</th>
                  <th className="py-3 px-4">Remaining Balance</th>
                  <th className="py-3 px-4">Receipt Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-101 text-slate-700 font-medium">
                {payments.map(pay => (
                  <tr key={pay.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-600 whitespace-nowrap">{pay.date}</td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-905">{pay.clientName}</td>
                    <td className="py-3.5 px-4 font-bold text-emerald-600">₹{pay.amountReceived.toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-600 font-extrabold">₹{pay.remainingBalance.toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 italic">{pay.notes || 'N/A'}</td>
                  </tr>
                ))}

                {payments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-bold uppercase text-[10px] tracking-wide">
                      No cash transfer receipts logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pop up 1: Add Client Profile */}
      {showAddClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-2xl py-6 px-6 shadow-md relative animate-in">
            <button onClick={() => setShowAddClient(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 cursor-pointer">
              <X className="h-6 w-6" />
            </button>
            <h3 className="text-sm font-extrabold text-slate-950 mb-4 animate-fade-in">Register Client Account</h3>

            <form onSubmit={handleCreateClient} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Company / client Name *</label>
                <input
                  type="text" required value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Sobha Developers"
                  className="w-full bg-slate-5 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Working Site Location HQ *</label>
                <input
                  type="text" required value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="e.g. Hebbal water mains"
                  className="w-full bg-slate-5 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Contact Phone Number</label>
                <input
                  type="tel" value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="e.g. +91 99887 76655"
                  className="w-full bg-slate-5 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Credit / billing remarks remarks</label>
                <input
                  type="text" value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  placeholder="e.g. 30 days cycle"
                  className="w-full bg-slate-5 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-1.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-955 font-bold rounded-xl text-xs cursor-pointer">
                  Create Client
                </button>
                <button type="button" onClick={() => setShowAddClient(false)} className="py-1.5 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-705 rounded-xl text-xs font-bold transition-all cursor-pointer">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pop up 1.5: Edit Client Profile */}
      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-2xl py-6 px-6 shadow-md relative animate-pop-in">
            <button onClick={() => setEditingClient(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 cursor-pointer">
              <X className="h-6 w-6" />
            </button>
            <h3 className="text-sm font-extrabold text-slate-955 mb-4 animate-fade-in">Edit Client Profile</h3>

            <form onSubmit={handleUpdateClient} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Company / client Name *</label>
                <input
                  type="text" required value={editClientName}
                  onChange={(e) => setEditClientName(e.target.value)}
                  placeholder="e.g. Sobha Developers"
                  className="w-full bg-slate-5 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Working Site Location HQ *</label>
                <input
                  type="text" required value={editSiteName}
                  onChange={(e) => setEditSiteName(e.target.value)}
                  placeholder="e.g. Hebbal water mains"
                  className="w-full bg-slate-5 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Contact Phone Number</label>
                <input
                  type="tel" value={editContactNumber}
                  onChange={(e) => setEditContactNumber(e.target.value)}
                  placeholder="e.g. +91 99887 76655"
                  className="w-full bg-slate-5 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Credit / billing remarks</label>
                <input
                  type="text" value={editClientNotes}
                  onChange={(e) => setEditClientNotes(e.target.value)}
                  placeholder="e.g. 30 days cycle"
                  className="w-full bg-slate-5 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={submitting} className="flex-1 py-1.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-955 font-bold rounded-xl text-xs cursor-pointer">
                  {submitting ? 'Saving...' : 'Update Client'}
                </button>
                <button type="button" onClick={() => setEditingClient(null)} className="py-1.5 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-705 rounded-xl text-xs font-bold transition-all cursor-pointer">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pop up 2: Generate Client Bill Invoicing (Multi Selection) */}
      {showBillGenerator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl py-6 px-6 shadow-md relative">
            <button onClick={() => setShowBillGenerator(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 cursor-pointer">
              <X className="h-6 w-6" />
            </button>
            <h3 className="text-sm font-extrabold text-slate-955 mb-1">Compile Invoiced Client Bill</h3>
            <p className="text-slate-500 text-xs mb-4">Select client & checked hourly work logs to group together</p>

            <form onSubmit={handleGenerateBillSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Target Client Account</label>
                  <select
                    required
                    value={billClientId}
                    onChange={(e) => { setBillClientId(e.target.value); setSelectedWorkEntryIds([]); }}
                    className="w-full bg-slate-5 border border-slate-200 rounded-xl px-2.5 py-2.5 text-xs font-semibold text-slate-800"
                  >
                    <option value="">Select client...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Direct credit term rules</label>
                  <select
                    value={billPaymentType}
                    onChange={(e) => setBillPaymentType(e.target.value as any)}
                    className="w-full bg-slate-5 border border-slate-200 rounded-xl px-2.5 py-2.5 text-xs font-semibold text-slate-800"
                  >
                    <option value="Credit">Credit Term</option>
                    <option value="Immediate">Immediate Cash</option>
                    <option value="Partial">Downpayment Partial</option>
                  </select>
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Invoice Due Expiry Date</label>
                  <input
                    type="date"
                    required
                    value={expectedPaymentDate}
                    onChange={(e) => setExpectedPaymentDate(e.target.value)}
                    className="w-full bg-slate-5 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>
                        {/* Work log selectors */}
              {billClientId && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <span>Unbilled operations hour logs ({clientUnbilledEntries.length}):</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={selectAllUnbilled} className="text-amber-600 hover:underline cursor-pointer">Select All</button>
                      <button type="button" onClick={deselectAllUnbilled} className="text-slate-400 hover:underline cursor-pointer">Deselect</button>
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-205 rounded-xl p-2 bg-slate-50">
                    {clientUnbilledEntries.map(e => {
                      const isSelected = selectedWorkEntryIds.includes(e.id);
                      return (
                        <div
                          key={e.id}
                          onClick={() => toggleWorkEntrySelection(e.id)}
                          className={`p-2.5 rounded-xl border text-xs flex justify-between items-center cursor-pointer transition ${
                            isSelected 
                              ? 'bg-amber-50 border-amber-300 text-slate-900 font-bold shadow-xs' 
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isSelected ? <CheckSquare className="h-4 w-4 text-amber-600" /> : <Square className="h-4 w-4 text-slate-355" />}
                            <div>
                              <span>{e.date} - {e.machineName} ({e.workingHours} hrs)</span>
                              <span className="block text-[10px] text-slate-450">{e.site}</span>
                            </div>
                          </div>
                          <span className="font-bold text-slate-900">₹{e.earnings.toLocaleString('en-IN')}</span>
                        </div>
                      );
                    })}

                    {clientUnbilledEntries.length === 0 && (
                      <p className="text-center py-6 text-slate-400 text-xs font-bold uppercase tracking-wide text-[9px]">No pending unbilled operations found for current client.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Invoice Compilation Panel */}
              {selectedWorkEntryIds.length > 0 && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1 text-xs">
                  <span className="text-[9px] text-amber-600 font-black uppercase tracking-wider block">PROV. INVOICE PREVIEW</span>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Hours Billed:</span>
                    <span className="font-bold text-slate-900">{billFormTotals.hours} hrs</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Machines Used:</span>
                    <span className="font-semibold text-slate-900 max-w-xs truncate">{billFormTotals.machinesUsedStr}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-extrabold text-sm border-t border-slate-200 pt-1.5 mt-1.5">
                    <span>Total Bill amount:</span>
                    <span className="text-emerald-600">₹{billFormTotals.total.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting || selectedWorkEntryIds.length === 0}
                  className="flex-1 py-1.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-955 font-bold rounded-xl text-xs disabled:opacity-50 cursor-pointer text-center animate-fade-in"
                >
                  {submitting ? 'Generating Invoice...' : 'Generate and Finalize Bill'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBillGenerator(false)}
                  className="py-1.5 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-707 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pop up 3: Post cash receipt payment */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl py-6 px-6 shadow-md relative">
            <button 
              onClick={() => { setShowPaymentModal(false); if (onPaymentFormCloseDirectly) onPaymentFormCloseDirectly(); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 cursor-pointer"
            >
              <X className="h-6 w-6" />
            </button>
            <h3 className="text-sm font-extrabold text-slate-955 mb-4 animate-fade-in">Record Client Payment Transaction</h3>

            <form onSubmit={handlePostPayment} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Transaction date</label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full bg-slate-5 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Select Outstanding bill *</label>
                <select
                  required
                  value={payBillId}
                  onChange={(e) => { 
                    setPayBillId(e.target.value); 
                    const bill = bills.find(b => b.id === e.target.value);
                    if (bill) setPayAmount(bill.pendingAmount);
                  }}
                  className="w-full bg-slate-5 border border-slate-200 rounded-xl px-2.5 py-2.5 text-xs font-semibold text-slate-800"
                >
                  <option value="">Select pending invoice...</option>
                  {bills.filter(b => b.paymentStatus !== 'Paid').map(b => (
                    <option key={b.id} value={b.id}>
                      {b.clientName} - {b.siteName} (Pending: ₹{b.pendingAmount.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>

              {payBillId && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Amount received (₹) *</label>
                  <input
                    type="number"
                    required
                    value={payAmount || ''}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    placeholder="e.g. 10000"
                    className="w-full bg-slate-5 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-850 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Receipt Remarks (Txn ref info)</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. NEFT transfer reference #123456"
                  className="w-full bg-slate-5 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting || !payBillId}
                  className="flex-1 py-1.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-955 font-bold rounded-xl text-xs disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Recording...' : 'Post Payment Receipt'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowPaymentModal(false); if (onPaymentFormCloseDirectly) onPaymentFormCloseDirectly(); }}
                  className="py-1.5 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-705 rounded-xl text-xs font-bold transition-all cursor-pointer"
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
