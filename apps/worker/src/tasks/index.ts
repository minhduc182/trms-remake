/**
 * B-14: 11 Periodic Background Tasks (Idempotent Cron / Worker Runner)
 * Triggers the internal HTTP Cron Endpoints on @trms/api with API Key authentication.
 */

export interface CronTaskConfig {
  id: string;
  name: string;
  schedule: string;
  endpoint: string;
}

export const TRMS_PERIODIC_TASKS: CronTaskConfig[] = [
  {
    id: 'sync-work-shift-list',
    name: 'Đồng bộ danh mục ca làm việc ASOFT',
    schedule: '30 15 * * *',
    endpoint: '/trms/tasks/sync/work-shift-list',
  },
  {
    id: 'sync-shift-registration',
    name: 'Đồng bộ đăng ký ca làm 7 ngày ASOFT',
    schedule: '30 0 * * *',
    endpoint: '/trms/tasks/sync/shift-registration',
  },
  {
    id: 'sync-etp-active-flags',
    name: 'Đồng bộ cờ trạng thái hiệu lực ETP',
    schedule: '5 * * * *',
    endpoint: '/trms/tasks/sync/employee-transport-active-flags',
  },
  {
    id: 'sync-etp-leave',
    name: 'Đồng bộ nghỉ việc nhân viên ETP',
    schedule: '5 * * * *',
    endpoint: '/trms/tasks/sync/employee-transport-leave',
  },
  {
    id: 'create-commute-plan',
    name: 'Tự động lập kế hoạch xe tuyến cố định ngày mai',
    schedule: '30 15 * * *',
    endpoint: '/trms/tasks/create-commute-plan',
  },
  {
    id: 'sync-vehicle-status',
    name: 'Đồng bộ trạng thái vận hành đội xe',
    schedule: '* * * * *',
    endpoint: '/trms/tasks/sync/vehicle-status',
  },
  {
    id: 'auto-complete-trips',
    name: 'Tự động hoàn thành chuyến đã qua giờ đến',
    schedule: '* * * * *',
    endpoint: '/trms/tasks/auto-complete-trips',
  },
  {
    id: 'remind-upcoming-departures',
    name: 'Nhắc lịch đơn sắp đến giờ khởi hành',
    schedule: '*/5 * * * *',
    endpoint: '/trms/tasks/remind-upcoming-departures',
  },
  {
    id: 'snapshot-daily-costs',
    name: 'Chốt chi phí vận chuyển hằng ngày (D-1)',
    schedule: '0 0 * * *',
    endpoint: '/trms/tasks/snapshot-daily-costs',
  },
  {
    id: 'snapshot-monthly-costs',
    name: 'Chốt bảng kê thanh toán tháng (M-1)',
    schedule: '30 0 1 * *',
    endpoint: '/trms/tasks/snapshot-monthly-costs',
  },
  {
    id: 'outbox-dispatcher',
    name: 'Xử lý hàng đợi Outbox & Email thông báo',
    schedule: '*/1 * * * *',
    endpoint: '/trms/tasks/remind-upcoming-departures',
  },
];

export async function runTaskOnce(
  task: CronTaskConfig,
  baseUrl = process.env.API_BASE_URL || 'http://localhost:4000',
  apiKey = process.env.INTERNAL_CRON_API_KEY || 'trms-internal-cron-key-2026',
): Promise<unknown> {
  const res = await fetch(`${baseUrl}${task.endpoint}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(`Task ${task.id} failed with HTTP ${res.status}`);
  }
  return res.json();
}
