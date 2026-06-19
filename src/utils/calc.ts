import { DailyWorkEntry, Expense, ClientBill, PaymentHistory, Stats, Machine, Operator } from '../types';

/**
 * Calculates working hours from startTime and endTime in HH:MM format, deducting break time in minutes
 */
export function calculateWorkingHours(startTime: string, endTime: string, breakMinutes: number = 0): number {
  if (!startTime || !endTime) return 0;
  
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return 0;
  
  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;
  
  // Handle overnight shift just in case
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }
  
  let diffMinutes = endMinutes - startMinutes;
  
  // Deduct operator break from working minutes
  if (typeof breakMinutes === 'number' && breakMinutes > 0) {
    diffMinutes = Math.max(0, diffMinutes - breakMinutes);
  }
  
  return Math.round((diffMinutes / 60) * 100) / 100;
}

/**
 * Aggregates all work entries, expenses, bills, and payments into high-level dashboard business stats
 */
export function calculateBusinessStats(
  workEntries: DailyWorkEntry[],
  expenses: Expense[],
  bills: ClientBill[],
  payments: PaymentHistory[],
  machines: Machine[]
): Stats {
  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = new Date().toISOString().slice(0, 7); // e.g. "2026-06"

  // 1. Today's Revenue and Expenses
  let todayRevenue = 0;
  workEntries.forEach(entry => {
    if (entry.date === todayStr) {
      todayRevenue += entry.earnings;
    }
  });

  let todayExpenses = 0;
  expenses.forEach(exp => {
    if (exp.date === todayStr) {
      todayExpenses += (exp.dieselCost + exp.repairCost + exp.sparePartsCost + exp.serviceCost + exp.miscellaneousCost);
    }
  });

  // 2. Monthly Revenue and Expenses (For current month)
  let monthlyRevenue = 0;
  workEntries.forEach(entry => {
    if (entry.date.startsWith(currentMonthStr)) {
      monthlyRevenue += entry.earnings;
    }
  });

  let monthlyExpenses = 0;
  expenses.forEach(exp => {
    if (exp.date.startsWith(currentMonthStr)) {
      monthlyExpenses += (exp.dieselCost + exp.repairCost + exp.sparePartsCost + exp.serviceCost + exp.miscellaneousCost);
    }
  });

  // 3. Cash Received
  let cashReceived = 0;
  payments.forEach(pay => {
    cashReceived += pay.amountReceived;
  });

  // 4. Pending Client Payments (Outstanding Receivables = Monthly Revenue - Cash Received or Sum of all pending bills)
  // Let's compute outstanding bills pending amount
  let pendingClientPayments = 0;
  bills.forEach(bill => {
    pendingClientPayments += bill.pendingAmount;
  });

  // 5. Diesel Credit Pending
  let dieselCreditPending = 0;
  expenses.forEach(exp => {
    if (exp.dieselPaymentType === 'Credit' && exp.dieselPaidStatus === 'Pending') {
      dieselCreditPending += exp.dieselCost;
    }
  });

  // 6. Active and Under Repair Machines
  let activeMachinesCount = 0;
  let repairMachinesCount = 0;
  machines.forEach(mac => {
    if (mac.status === 'Working') activeMachinesCount++;
    if (mac.status === 'Repair') repairMachinesCount++;
  });

  const netProfit = monthlyRevenue - monthlyExpenses;

  return {
    todayRevenue,
    todayExpenses,
    monthlyRevenue,
    monthlyExpenses,
    netProfit,
    cashReceived,
    pendingClientPayments,
    dieselCreditPending,
    activeMachinesCount,
    repairMachinesCount
  };
}

/**
 * Calculates performance stats for a single machine
 */
export interface MachinePerformance {
  machineId: string;
  name: string;
  type: string;
  status: string;
  hoursWorked: number;
  revenue: number;
  expenses: {
    diesel: number;
    repairs: number;
    spareParts: number;
    service: number;
    miscellaneous: number;
    total: number;
  };
  profit: number;
}

export function calculateMachinePerformance(
  machines: Machine[],
  workEntries: DailyWorkEntry[],
  expenses: Expense[],
  rangeMonth?: string // Format: "YYYY-MM"
): MachinePerformance[] {
  return machines.map(mac => {
    const macEntries = workEntries.filter(entry => {
      const matchMac = entry.machineId === mac.id;
      if (!matchMac) return false;
      if (rangeMonth) {
        return entry.date.startsWith(rangeMonth);
      }
      return true;
    });

    const macExpenses = expenses.filter(exp => {
      const matchMac = exp.machineId === mac.id;
      if (!matchMac) return false;
      if (rangeMonth) {
        return exp.date.startsWith(rangeMonth);
      }
      return true;
    });

    const hoursWorked = macEntries.reduce((sum, entry) => sum + entry.workingHours, 0);
    const revenue = macEntries.reduce((sum, entry) => sum + entry.earnings, 0);

    let diesel = 0;
    let repairs = 0;
    let spareParts = 0;
    let service = 0;
    let miscellaneous = 0;

    macExpenses.forEach(exp => {
      diesel += exp.dieselCost;
      repairs += exp.repairCost;
      spareParts += exp.sparePartsCost;
      service += exp.serviceCost;
      miscellaneous += exp.miscellaneousCost;
    });

    const totalExpenses = diesel + repairs + spareParts + service + miscellaneous;
    const profit = revenue - totalExpenses;

    return {
      machineId: mac.id,
      name: mac.name,
      type: mac.type,
      status: mac.status,
      hoursWorked,
      revenue,
      expenses: {
        diesel,
        repairs,
        spareParts,
        service,
        miscellaneous,
        total: totalExpenses
      },
      profit
    };
  });
}

/**
 * Calculates profitability for each physical working site
 */
export interface SitePerformance {
  siteName: string;
  clientName: string;
  revenue: number;
  expenses: number;
  profit: number;
  hoursWorked: number;
}

export function calculateSitePerformance(
  workEntries: DailyWorkEntry[],
  expenses: Expense[]
): SitePerformance[] {
  const sitesMap: Record<string, { siteName: string; clientName: string; revenue: number; hours: number; machineIds: Set<string> }> = {};

  workEntries.forEach(entry => {
    const key = `${entry.site}__${entry.clientName}`;
    if (!sitesMap[key]) {
      sitesMap[key] = {
        siteName: entry.site,
        clientName: entry.clientName,
        revenue: 0,
        hours: 0,
        machineIds: new Set()
      };
    }
    sitesMap[key].revenue += entry.earnings;
    sitesMap[key].hours += entry.workingHours;
    sitesMap[key].machineIds.add(entry.machineId);
  });

  return Object.values(sitesMap).map(site => {
    // Collect expenses from any machines that worked on this site
    let siteExpenses = 0;
    const arrayMacs = Array.from(site.machineIds);
    expenses.forEach(exp => {
      // Approximate expense allocation to this site: if machine is working at this site
      // (This is highly useful for construction operators, as expenses are machine-specific).
      if (arrayMacs.includes(exp.machineId)) {
        // If the machine works on multiple sites, we can partition based on total hours,
        // but simple mapping of those machine expenses is a solid operational approximation.
        // Let's sum up expenses for this machine that occurred during this site work
        siteExpenses += (exp.dieselCost + exp.repairCost + exp.sparePartsCost + exp.serviceCost + exp.miscellaneousCost);
      }
    });

    // If a machine worked on multiple sites, let's distribute its expenses proportionally based on hours,
    // which prevents double-counting or inflating expenses of a single site.
    // Let's implement this proportional distribution for maximum accuracy!
    let proportionalSiteExpenses = 0;
    arrayMacs.forEach(macId => {
      const macTotalHours = workEntries
        .filter(e => e.machineId === macId)
        .reduce((sum, e) => sum + e.workingHours, 0);
      
      const macSiteHours = workEntries
        .filter(e => e.machineId === macId && e.site === site.siteName)
        .reduce((sum, e) => sum + e.workingHours, 0);

      const macTotalExpenses = expenses
        .filter(exp => exp.machineId === macId)
        .reduce((sum, exp) => sum + (exp.dieselCost + exp.repairCost + exp.sparePartsCost + exp.serviceCost + exp.miscellaneousCost), 0);
      
      if (macTotalHours > 0) {
        proportionalSiteExpenses += (macSiteHours / macTotalHours) * macTotalExpenses;
      }
    });

    const roundedExpenses = Math.round(proportionalSiteExpenses * 100) / 100;

    return {
      siteName: site.siteName,
      clientName: site.clientName,
      revenue: site.revenue,
      expenses: roundedExpenses,
      profit: Math.round((site.revenue - roundedExpenses) * 100) / 100,
      hoursWorked: site.hours
    };
  });
}
