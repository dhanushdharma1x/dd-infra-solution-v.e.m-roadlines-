export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'staff';
}

export interface Machine {
  id: string;
  name: string;
  type: string;
  registrationNumber: string;
  currentSite: string;
  assignedOperator: string; // operator ID or name
  status: 'Working' | 'Idle' | 'Repair';
  purchaseDate: string;
  notes: string;
  lastServiceHours?: number;
  serviceIntervalHours?: number;
  currentMachineHours?: number;
}

export interface Operator {
  id: string;
  name: string;
  phone: string;
  monthlySalary: number;
  advanceGiven: number;
  pendingSalary: number;
}

export interface Client {
  id: string;
  name: string;
  siteName: string;
  contactNumber: string;
  notes: string;
}

export interface DailyWorkEntry {
  id: string;
  date: string;
  machineId: string;
  machineName: string;
  operatorId: string;
  operatorName: string;
  site: string;
  clientId: string;
  clientName: string;
  startTime: string;
  endTime: string;
  workingHours: number; // End Time - Start Time
  hourlyRate: number;
  earnings: number; // Working Hours * Hourly Rate
  breakMinutes?: number; // Break duration in minutes
  billed?: boolean;
  billId?: string;
  billingMode?: 'hourly' | 'load' | 'daily';
  tripsCount?: number;
  pricePerLoad?: number;
  dailyRentalRate?: number;
  notes?: string;
}

export interface Expense {
  id: string;
  date: string;
  machineId: string;
  machineName: string;
  dieselLiters: number;
  dieselCost: number;
  dieselPaymentType: 'Cash' | 'Credit';
  dieselPaidStatus: 'Paid' | 'Pending';
  repairCost: number;
  sparePartsCost: number;
  serviceCost: number;
  miscellaneousCost: number;
  notes: string;
  openingMeterHours?: number;
  closingMeterHours?: number;
}

export interface SalaryRecord {
  id: string;
  date: string;
  operatorId: string;
  operatorName: string;
  salaryAmount: number;
  advanceAmount: number;
  pendingSalary: number;
  notes: string;
}

export interface ClientBill {
  id: string;
  date: string;
  clientId: string;
  clientName: string;
  siteName: string;
  machineUsed: string;
  hoursWorked: number;
  ratePerHour: number;
  totalBillAmount: number;
  amountReceived: number;
  pendingAmount: number;
  paymentType: 'Immediate' | 'Credit' | 'Partial';
  expectedPaymentDate: string;
  actualPaymentDate?: string;
  paymentStatus: 'Paid' | 'Partially Paid' | 'Pending' | 'Overdue';
}

export interface PaymentHistory {
  id: string;
  date: string;
  clientId: string;
  clientName: string;
  billId: string;
  amountReceived: number;
  remainingBalance: number;
  notes: string;
}

export interface Stats {
  todayRevenue: number;
  todayExpenses: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  netProfit: number;
  cashReceived: number;
  pendingClientPayments: number;
  dieselCreditPending: number;
  activeMachinesCount: number;
  repairMachinesCount: number;
}

export interface CashbookEntry {
  id: string;
  date: string;
  openingBalance: number;
  cashIn: number; // Receipts
  cashOut: number; // General cash out
  salary: number; // Salary expense
  diesel: number; // Diesel expense
  repairs: number; // Repairs expense
  misc: number; // Misc expense
  notes: string;
}
