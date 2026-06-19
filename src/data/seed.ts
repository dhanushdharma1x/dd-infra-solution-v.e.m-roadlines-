import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Machine, Operator, Client, DailyWorkEntry, Expense, ClientBill } from '../types';

export const INITIAL_MACHINES: Omit<Machine, 'id'>[] = [
  {
    name: 'JCB 3DX-01',
    type: 'Excavator Loader',
    registrationNumber: 'KA-20-M-4512',
    currentSite: 'Vidyaranyapura Drainage Project',
    assignedOperator: 'Shekar',
    status: 'Working',
    purchaseDate: '2023-04-12',
    notes: 'Primary heavy digging excavator. Serviced quarterly.'
  },
  {
    name: 'JCB 3DX-02',
    type: 'Excavator Loader',
    registrationNumber: 'KA-20-M-4513',
    currentSite: 'Yelahanka Flyover Site',
    assignedOperator: 'Kumar',
    status: 'Working',
    purchaseDate: '2024-01-15',
    notes: 'Well maintained, high fuel efficiency.'
  },
  {
    name: 'Kubota 30S',
    type: 'Mini Excavator',
    registrationNumber: 'KA-04-P-8822',
    currentSite: 'Hebbal Water Pipeline Site',
    assignedOperator: 'Shekar',
    status: 'Idle',
    purchaseDate: '2025-05-20',
    notes: 'Compact excavator for narrow spaces, pipes, and garden works.'
  },
  {
    name: 'Tata 1613 Tipper',
    type: 'Dumper Truck',
    registrationNumber: 'KA-51-F-1029',
    currentSite: 'Peenya Industrial Area',
    assignedOperator: 'None',
    status: 'Repair',
    purchaseDate: '2022-09-08',
    notes: 'Hydraulic cylinder leaking. Under going repair at Deva Workshops.'
  }
];

export const INITIAL_OPERATORS: Omit<Operator, 'id'>[] = [
  {
    name: 'Shekar',
    phone: '+91 98765 43210',
    monthlySalary: 28000,
    advanceGiven: 5000,
    pendingSalary: 23000
  },
  {
    name: 'Kumar',
    phone: '+91 99887 76655',
    monthlySalary: 25000,
    advanceGiven: 2000,
    pendingSalary: 23000
  }
];

export const INITIAL_CLIENTS: Omit<Client, 'id'>[] = [
  {
    name: 'Brigade Constructions Ltd',
    siteName: 'Brigade Orchards Phase 3',
    contactNumber: '+91 80234 56789',
    notes: 'Corporate client. Direct credit term of 30 days.'
  },
  {
    name: 'BBMP Water Works Department',
    siteName: 'Hebbal Sewer Segment 2B',
    contactNumber: '+91 91234 56780',
    notes: 'Govt contract. Bills processed after executive clearance.'
  },
  {
    name: 'Sobha Developers',
    siteName: 'Sobha Dream Acres Project',
    contactNumber: '+91 95432 10123',
    notes: 'Regular client. Weekly billing cycles.'
  }
];

export async function checkAndSeedDatabase() {
  try {
    const machinesSnap = await getDocs(collection(db, 'machines'));
    if (!machinesSnap.empty) {
      console.log('Database already seeded or has data.');
      return;
    }

    console.log('Database empty. Seeding initial data...');
    const batch = writeBatch(db);

    // 1. Seed Machines
    const machineIds: string[] = [];
    INITIAL_MACHINES.forEach((m, idx) => {
      const id = `mac_0${idx + 1}`;
      machineIds.push(id);
      batch.set(doc(db, 'machines', id), { ...m, id });
    });

    // 2. Seed Operators
    const operatorIds: string[] = [];
    INITIAL_OPERATORS.forEach((op, idx) => {
      const id = `op_0${idx + 1}`;
      operatorIds.push(id);
      batch.set(doc(db, 'operators', id), { ...op, id });
    });

    // 3. Seed Clients
    const clientIds: string[] = [];
    INITIAL_CLIENTS.forEach((cl, idx) => {
      const id = `cl_0${idx + 1}`;
      clientIds.push(id);
      batch.set(doc(db, 'clients', id), { ...cl, id });
    });

    // 4. Seed Daily Work Entries for the current month
    // We will generate about 10 work entries to populate charts
    const workEntries: DailyWorkEntry[] = [
      {
        id: 'work_01',
        date: '2026-06-10',
        machineId: 'mac_01',
        machineName: 'JCB 3DX-01',
        operatorId: 'op_01',
        operatorName: 'Shekar',
        site: 'Brigade Orchards Phase 3',
        clientId: 'cl_01',
        clientName: 'Brigade Constructions Ltd',
        startTime: '08:00',
        endTime: '17:00',
        workingHours: 9,
        hourlyRate: 1100,
        earnings: 9900,
        billed: true,
        billId: 'bill_01'
      },
      {
        id: 'work_02',
        date: '2026-06-11',
        machineId: 'mac_01',
        machineName: 'JCB 3DX-01',
        operatorId: 'op_01',
        operatorName: 'Shekar',
        site: 'Brigade Orchards Phase 3',
        clientId: 'cl_01',
        clientName: 'Brigade Constructions Ltd',
        startTime: '08:00',
        endTime: '16:30',
        workingHours: 8.5,
        hourlyRate: 1100,
        earnings: 9350,
        billed: true,
        billId: 'bill_01'
      },
      {
        id: 'work_03',
        date: '2026-06-12',
        machineId: 'mac_02',
        machineName: 'JCB 3DX-02',
        operatorId: 'op_02',
        operatorName: 'Kumar',
        site: 'Sobha Dream Acres Project',
        clientId: 'cl_03',
        clientName: 'Sobha Developers',
        startTime: '07:30',
        endTime: '17:30',
        workingHours: 10,
        hourlyRate: 1150,
        earnings: 11500,
        billed: true,
        billId: 'bill_02'
      },
      {
        id: 'work_04',
        date: '2026-06-14',
        machineId: 'mac_02',
        machineName: 'JCB 3DX-02',
        operatorId: 'op_02',
        operatorName: 'Kumar',
        site: 'Sobha Dream Acres Project',
        clientId: 'cl_03',
        clientName: 'Sobha Developers',
        startTime: '08:00',
        endTime: '18:00',
        workingHours: 10,
        hourlyRate: 1150,
        earnings: 11500,
        billed: true,
        billId: 'bill_02'
      },
      {
        id: 'work_05',
        date: '2026-06-15',
        machineId: 'mac_03',
        machineName: 'Kubota 30S',
        operatorId: 'op_01',
        operatorName: 'Shekar',
        site: 'Hebbal Sewer Segment 2B',
        clientId: 'cl_02',
        clientName: 'BBMP Water Works Department',
        startTime: '09:00',
        endTime: '15:00',
        workingHours: 6,
        hourlyRate: 900,
        earnings: 5400,
        billed: false
      },
      {
        id: 'work_06',
        date: '2026-06-16',
        machineId: 'mac_01',
        machineName: 'JCB 3DX-01',
        operatorId: 'op_01',
        operatorName: 'Shekar',
        site: 'Brigade Orchards Phase 3',
        clientId: 'cl_01',
        clientName: 'Brigade Constructions Ltd',
        startTime: '08:00',
        endTime: '17:00',
        workingHours: 9,
        hourlyRate: 1100,
        earnings: 9900,
        billed: false
      },
      {
        id: 'work_07',
        date: '2026-06-17',
        machineId: 'mac_02',
        machineName: 'JCB 3DX-02',
        operatorId: 'op_02',
        operatorName: 'Kumar',
        site: 'Sobha Dream Acres Project',
        clientId: 'cl_03',
        clientName: 'Sobha Developers',
        startTime: '08:00',
        endTime: '16:00',
        workingHours: 8,
        hourlyRate: 1150,
        earnings: 9200,
        billed: false
      }
    ];

    workEntries.forEach(entry => {
      batch.set(doc(db, 'dailyWorkEntries', entry.id), entry);
    });

    // 5. Seed Expenses
    const expenses: Expense[] = [
      {
        id: 'exp_01',
        date: '2026-06-09',
        machineId: 'mac_01',
        machineName: 'JCB 3DX-01',
        dieselLiters: 45,
        dieselCost: 4050,
        dieselPaymentType: 'Credit',
        dieselPaidStatus: 'Pending',
        repairCost: 0,
        sparePartsCost: 0,
        serviceCost: 0,
        miscellaneousCost: 150,
        notes: 'Diesel filled at Peenya fuel bay'
      },
      {
        id: 'exp_02',
        date: '2026-06-11',
        machineId: 'mac_02',
        machineName: 'JCB 3DX-02',
        dieselLiters: 50,
        dieselCost: 4500,
        dieselPaymentType: 'Cash',
        dieselPaidStatus: 'Paid',
        repairCost: 1200,
        sparePartsCost: 800,
        serviceCost: 0,
        miscellaneousCost: 0,
        notes: 'Hydraulic hose replacement + diesel'
      },
      {
        id: 'exp_03',
        date: '2026-06-13',
        machineId: 'mac_03',
        machineName: 'Kubota 30S',
        dieselLiters: 20,
        dieselCost: 1800,
        dieselPaymentType: 'Cash',
        dieselPaidStatus: 'Paid',
        repairCost: 0,
        sparePartsCost: 0,
        serviceCost: 3500,
        miscellaneousCost: 200,
        notes: 'Regular engine oil service'
      },
      {
        id: 'exp_04',
        date: '2026-06-15',
        machineId: 'mac_04',
        machineName: 'Tata 1613 Tipper',
        dieselLiters: 0,
        dieselCost: 0,
        dieselPaymentType: 'Cash',
        dieselPaidStatus: 'Paid',
        repairCost: 8500,
        sparePartsCost: 12000,
        serviceCost: 4000,
        miscellaneousCost: 500,
        notes: 'Tipper heavy hydraulic repair and testing cost'
      }
    ];

    expenses.forEach(exp => {
      batch.set(doc(db, 'expenses', exp.id), exp);
    });

    // 6. Seed Bills
    const bills: ClientBill[] = [
      {
        id: 'bill_01',
        date: '2026-06-12',
        clientId: 'cl_01',
        clientName: 'Brigade Constructions Ltd',
        siteName: 'Brigade Orchards Phase 3',
        machineUsed: 'JCB 3DX-01',
        hoursWorked: 17.5,
        ratePerHour: 1100,
        totalBillAmount: 19250,
        amountReceived: 10000,
        pendingAmount: 9250,
        paymentType: 'Partial',
        expectedPaymentDate: '2026-06-25',
        paymentStatus: 'Partially Paid'
      },
      {
        id: 'bill_02',
        date: '2026-06-15',
        clientId: 'cl_03',
        clientName: 'Sobha Developers',
        siteName: 'Sobha Dream Acres Project',
        machineUsed: 'JCB 3DX-02',
        hoursWorked: 20,
        ratePerHour: 1150,
        totalBillAmount: 23000,
        amountReceived: 23000,
        pendingAmount: 0,
        paymentType: 'Immediate',
        expectedPaymentDate: '2026-06-15',
        actualPaymentDate: '2026-06-15',
        paymentStatus: 'Paid'
      }
    ];

    bills.forEach(bill => {
      batch.set(doc(db, 'clientBills', bill.id), bill);
    });

    // 7. Seed Payment History
    batch.set(doc(db, 'paymentHistory', 'pay_01'), {
      id: 'pay_01',
      date: '2026-06-12',
      clientId: 'cl_01',
      clientName: 'Brigade Constructions Ltd',
      billId: 'bill_01',
      amountReceived: 10000,
      remainingBalance: 9250,
      notes: 'Initial check payout received and cleared.'
    });

    batch.set(doc(db, 'paymentHistory', 'pay_02'), {
      id: 'pay_02',
      date: '2026-06-15',
      clientId: 'cl_03',
      clientName: 'Sobha Developers',
      billId: 'bill_02',
      amountReceived: 23000,
      remainingBalance: 0,
      notes: 'NEFT Transfer complete.'
    });

    // 8. Seed Salary records
    batch.set(doc(db, 'salaryRecords', 'sal_01'), {
      id: 'sal_01',
      date: '2026-06-01',
      operatorId: 'op_01',
      operatorName: 'Shekar',
      salaryAmount: 28000,
      advanceAmount: 5000,
      pendingSalary: 23000,
      notes: 'Advance for medical expenses paid on 1st'
    });

    batch.set(doc(db, 'salaryRecords', 'sal_02'), {
      id: 'sal_02',
      date: '2026-06-01',
      operatorId: 'op_02',
      operatorName: 'Kumar',
      salaryAmount: 25000,
      advanceAmount: 2000,
      pendingSalary: 23000,
      notes: 'Regular advance payout'
    });

    await batch.commit();
    console.log('Database seeded successfully.');
  } catch (error) {
    console.error('Error seeding database: ', error);
  }
}
