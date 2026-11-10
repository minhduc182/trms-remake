/**
 * C-05: Shared UI primitives & formatting helpers for TRMS Remake
 */

export interface StatusBadgeMeta {
  code: string;
  label: string;
  tone: 'slate' | 'blue' | 'amber' | 'emerald' | 'rose' | 'purple';
}

export const STATUS_BADGE_MAP: Record<string, StatusBadgeMeta> = {
  PENDING_DEPARTMENT: { code: 'PENDING_DEPARTMENT', label: 'Chờ TBP duyệt', tone: 'amber' },
  PENDING_GA: { code: 'PENDING_GA', label: 'Chờ GA duyệt', tone: 'blue' },
  WAITING_VENDOR_DISPATCH: { code: 'WAITING_VENDOR_DISPATCH', label: 'Chờ điều xe', tone: 'purple' },
  DISPATCHED: { code: 'DISPATCHED', label: 'Đã điều xe', tone: 'emerald' },
  DRIVER_CONFIRMED: { code: 'DRIVER_CONFIRMED', label: 'Tài xế đã nhận', tone: 'emerald' },
  IN_PROGRESS: { code: 'IN_PROGRESS', label: 'Đang thực hiện', tone: 'blue' },
  COMPLETED: { code: 'COMPLETED', label: 'Hoàn thành', tone: 'emerald' },
  REJECTED: { code: 'REJECTED', label: 'Đã từ chối', tone: 'rose' },
  RETURNED: { code: 'RETURNED', label: 'Trả về sửa', tone: 'amber' },
  CANCELLED: { code: 'CANCELLED', label: 'Đã hủy', tone: 'slate' },
};

export function getStatusBadgeMeta(status: string): StatusBadgeMeta {
  return (
    STATUS_BADGE_MAP[status] ?? {
      code: status,
      label: status,
      tone: 'slate',
    }
  );
}
