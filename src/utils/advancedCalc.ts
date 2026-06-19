import { Machine, Operator, DailyWorkEntry, Expense, ClientBill, CashbookEntry } from '../types';

/**
 * Interface representing the detailed monthly machine profitability row
 */
export interface MachineProfitabilityRow {
  machineId: string;
  machineName: string;
  totalHours: number;
  earnings: number;
  diesel: number;
  repairs: number;
  spareParts: number;
  salaryAllocation: number;
  misc: number;
  netProfit: number;
  profitMargin: number;
}

/**
 * Calculates monthly or overall profitability for each machine including proportional operator salary assignment
 */
export function calculateMachineProfitability(
  machines: Machine[],
  workEntries: DailyWorkEntry[],
  expenses: Expense[],
  operators: Operator[],
  targetMonth?: string // Format: "YYYY-MM"
): MachineProfitabilityRow[] {
  // Pre-calculate operator total hours for the target month to proportionally distribute their monthly salary
  const operatorTotalHoursMap: Record<string, number> = {};
  
  operators.forEach(op => {
    const opEntries = workEntries.filter(entry => {
      const matchOp = entry.operatorId === op.id;
      if (!matchOp) return false;
      if (targetMonth) {
        return entry.date.startsWith(targetMonth);
      }
      return true;
    });
    
    operatorTotalHoursMap[op.id] = opEntries.reduce((sum, entry) => sum + entry.workingHours, 0);
  });

  return machines.map(mac => {
    // 1. Get work entries for this machine
    const macEntries = workEntries.filter(entry => {
      const matchMac = entry.machineId === mac.id;
      if (!matchMac) return false;
      if (targetMonth) {
        return entry.date.startsWith(targetMonth);
      }
      return true;
    });

    // 2. Get expenses for this machine
    const macExpenses = expenses.filter(exp => {
      const matchMac = exp.machineId === mac.id;
      if (!matchMac) return false;
      if (targetMonth) {
        return exp.date.startsWith(targetMonth);
      }
      return true;
    });

    // 3. Compute earnings and hours
    const totalHours = macEntries.reduce((sum, entry) => sum + entry.workingHours, 0);
    const earnings = macEntries.reduce((sum, entry) => sum + entry.earnings, 0);

    // 4. Compute expense components
    let diesel = 0;
    let repairs = 0; // repairs + service
    let spareParts = 0;
    let misc = 0;

    macExpenses.forEach(exp => {
      diesel += exp.dieselCost || 0;
      repairs += (exp.repairCost || 0) + (exp.serviceCost || 0);
      spareParts += exp.sparePartsCost || 0;
      misc += exp.miscellaneousCost || 0;
    });

    // 5. Calculate Operator Salary Allocation based on work hours on this machine
    let salaryAllocation = 0;
    macEntries.forEach(entry => {
      if (!entry.operatorId) return;
      const op = operators.find(o => o.id === entry.operatorId);
      if (!op) return;
      
      const opTotalHours = operatorTotalHoursMap[op.id] || 0;
      if (opTotalHours > 0) {
        // Allocated amount for this entry
        const entryAllocation = (entry.workingHours / opTotalHours) * op.monthlySalary;
        salaryAllocation += entryAllocation;
      } else {
        // Fallback: assume average base hourly salary of ₹100/hour if they have no overall logged hours but have a work entry
        salaryAllocation += entry.workingHours * 100;
      }
    });

    // Round values to nearest Rupees
    salaryAllocation = Math.round(salaryAllocation);

    // Formula: Machine Profit = Earnings - Diesel - Repairs - Salary Allocation - Misc
    // Spares parts are part of repairs, but let's deduct spareParts as well to be fully accurate on net profit,
    // or let repairs sum include spare parts. Let's explicitly calculate:
    const netProfit = earnings - diesel - repairs - spareParts - salaryAllocation - misc;
    
    const profitMargin = earnings > 0 ? Math.round((netProfit / earnings) * 1000) / 10 : 0;

    return {
      machineId: mac.id,
      machineName: mac.name,
      totalHours,
      earnings,
      diesel,
      repairs,
      spareParts,
      salaryAllocation,
      misc,
      netProfit,
      profitMargin
    };
  });
}

/**
 * Classifies overdue invoice receivables into aging brackets
 */
export interface AgingAgingBreakdown {
  label: string;
  amount: number;
  count: number;
  bills: ClientBill[];
}

export function calculatePaymentAging(bills: ClientBill[]): Record<string, AgingAgingBreakdown> {
  const aging = {
    current: { label: '0-15 Days', amount: 0, count: 0, bills: [] as ClientBill[] },
    moderate: { label: '15-30 Days', amount: 0, count: 0, bills: [] as ClientBill[] },
    serious: { label: '30-60 Days', amount: 0, count: 0, bills: [] as ClientBill[] },
    overdue: { label: '60+ Days Overdue', amount: 0, count: 0, bills: [] as ClientBill[] }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  bills.forEach(bill => {
    if (bill.paymentStatus === 'Paid' || bill.pendingAmount <= 0) return;

    const dueDate = new Date(bill.expectedPaymentDate || bill.date);
    dueDate.setHours(0,0,0,0);
    
    const diffTime = today.getTime() - dueDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 15) {
      aging.current.amount += bill.pendingAmount;
      aging.current.count++;
      aging.current.bills.push(bill);
    } else if (diffDays <= 30) {
      aging.moderate.amount += bill.pendingAmount;
      aging.moderate.count++;
      aging.moderate.bills.push(bill);
    } else if (diffDays <= 60) {
      aging.serious.amount += bill.pendingAmount;
      aging.serious.count++;
      aging.serious.bills.push(bill);
    } else {
      aging.overdue.amount += bill.pendingAmount;
      aging.overdue.count++;
      aging.overdue.bills.push(bill);
    }
  });

  return aging;
}

/**
 * Calculates diesel efficiencies and returns entries with alerts
 */
export interface DieselEfficiencyReport {
  expenseId: string;
  date: string;
  machineId: string;
  machineName: string;
  litersFilled: number;
  hoursUsed: number;
  efficiency: number; // liters / hour
  warning: boolean;
  notes: string;
}

export function calculateDieselEfficiency(expenses: Expense[]): DieselEfficiencyReport[] {
  return expenses
    .filter(exp => exp.dieselLiters && exp.dieselLiters > 0 && exp.openingMeterHours !== undefined && exp.closingMeterHours !== undefined)
    .map(exp => {
      const opening = exp.openingMeterHours || 0;
      const closing = exp.closingMeterHours || 0;
      const hoursUsed = closing - opening;
      const liters = exp.dieselLiters;
      
      const efficiency = hoursUsed > 0 ? liters / hoursUsed : 0;
      // High fuel consumption threshold: e.g. more than 16 liters filled per hour of operation
      const warning = efficiency > 16;

      return {
        expenseId: exp.id,
        date: exp.date,
        machineId: exp.machineId,
        machineName: exp.machineName,
        litersFilled: liters,
        hoursUsed,
        efficiency: Math.round(efficiency * 100) / 100,
        warning,
        notes: exp.notes
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
