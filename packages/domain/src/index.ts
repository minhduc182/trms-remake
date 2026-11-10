import { RequestStatus, TripMode } from '@trms/shared';

/**
 * Compose overall request status from outbound and return leg statuses
 * Mirrors ComposeRequestStatus in Go backend
 */
export function composeRequestStatus(
  tripMode: TripMode | string,
  outboundStatus: RequestStatus | string,
  returnStatus?: RequestStatus | string | null,
): RequestStatus {
  if (tripMode !== 'ROUND_TRIP' || !returnStatus) {
    return outboundStatus as RequestStatus;
  }

  const out = outboundStatus as RequestStatus;
  const ret = returnStatus as RequestStatus;

  if (out === ret) return out;

  // Terminal / cancellation precedence
  if (out === 'REJECTED' || ret === 'REJECTED') return 'REJECTED';
  if (out === 'RETURNED' || ret === 'RETURNED') return 'RETURNED';
  if (out === 'CANCELLED' && ret === 'CANCELLED') return 'CANCELLED';

  // If one leg is cancelled, the active leg dictates the overall status
  if (out === 'CANCELLED') return ret;
  if (ret === 'CANCELLED') return out;

  const order: RequestStatus[] = [
    'PENDING_DEPARTMENT',
    'PENDING_GA',
    'PENDING_GA_DEPARTMENT',
    'WAITING_VENDOR_DISPATCH',
    'WAITING_DRIVER_CONFIRM',
    'IN_PROGRESS',
    'WAITING_DISTANCE_INPUT',
    'APPROVED_TAXI',
    'COMPLETED',
  ];

  const idxOut = order.indexOf(out);
  const idxRet = order.indexOf(ret);

  if (idxOut === -1) return out;
  if (idxRet === -1) return ret;

  return idxOut <= idxRet ? out : ret;
}

/**
 * Time window overlap check for vehicle/driver conflict detection
 */
export function isTimeRangeOverlapping(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return startA < endB && startB < endA;
}

/**
 * Determine if a route runs on a given business date (YYYY-MM-DD)
 * Rules from QA Tester Doc section 1.5:
 * - Holiday: NO route runs on holiday (neither STAFF nor WORKER)
 * - MON_FRI: Monday(1)..Friday(5)
 * - MON_SAT: Monday(1)..Saturday(6)
 * - SAT_ONLY: Saturday(6)
 * - MON_SUN: Monday(1)..Sunday(0)
 */
export function doesRouteRunOnDate(
  runDays: string,
  dateStr: string,
  holidayDates: Set<string>,
): boolean {
  if (holidayDates.has(dateStr)) {
    return false;
  }
  const d = new Date(`${dateStr}T00:00:00+07:00`);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  switch (runDays) {
    case 'MON_FRI':
      return day >= 1 && day <= 5;
    case 'MON_SAT':
      return day >= 1 && day <= 6;
    case 'SAT_ONLY':
      return day === 6;
    case 'MON_SUN':
      return true;
    default:
      return day >= 1 && day <= 6;
  }
}

/**
 * Check if an EmployeeTransportProfile registration is effective on a target date (YYYY-MM-DD)
 * Rule from QA Doc 1.6:
 * - approvalStatus === 'APPROVED' && !isDeleted
 * - effectiveFrom <= targetDate
 * - !effectiveTo || effectiveTo >= targetDate (effectiveTo is inclusive last day of ride)
 */
export function isRegistrationEffectiveOnDate(
  reg: {
    approvalStatus: string;
    isDeleted?: boolean;
    effectiveFrom: string;
    effectiveTo?: string | null;
  },
  targetDate: string,
): boolean {
  if (reg.isDeleted) return false;
  if (reg.approvalStatus !== 'APPROVED') return false;
  if (reg.effectiveFrom > targetDate) return false;
  if (reg.effectiveTo && reg.effectiveTo < targetDate) return false;
  return true;
}

export function subtractOneDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}
