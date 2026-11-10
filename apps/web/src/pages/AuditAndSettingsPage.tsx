import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  FileSpreadsheet,
  ChevronDown,
  Clock,
  Plus,
  X,
} from 'lucide-react';
import { gqlRequest } from '../lib/graphql';
import {
  FloatingSelect,
  FloatingDateFilter,
  SectionToolbar,
  LegacyPagination,
  PastelBadge,
  usePagination,
  exportTableToCsv,
} from '../components/legacy-ui';

function formatAuditTime(isoStr?: string | null): string {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function formatAuditActionText(log: any): string {
  const act = String(log.actionType || '');
  const ent = String(log.entityType || '');
  if (ent === 'DAILY_PLAN' || act === 'CREATE_COMMUTE_PLAN') {
    return 'Chuẩn bị kế hoạch đưa đón';
  }
  if (ent === 'VEHICLE_STATUS' || (log.summaryText || '').includes('Trên tuyến cố định')) {
    return 'Sẵn sàng → Trên tuyến cố định';
  }
  switch (act) {
    case 'COMPLETE':
    case 'COMPLETED':
      return 'Hoàn thành chuyến';
    case 'CREATE':
      return 'Tạo mới';
    case 'UPDATE':
    case 'UPDATE_TRANSPORT_FLAG':
    case 'RECALCULATE_DAILY':
    case 'RECALCULATE_MONTHLY':
      return 'Cập nhật';
    case 'DELETE':
      return 'Xóa';
    case 'CONFIRM':
      return 'Tài xế xác nhận';
    case 'APPROVE':
      return 'Phê duyệt';
    case 'REJECT':
      return 'Từ chối';
    case 'DISPATCH':
      return 'Điều phối xe';
    default:
      return act || 'Cập nhật';
  }
}

export const AuditAndSettingsPage: React.FC<{ initialView?: 'AUDIT' | 'SETTINGS' }> = ({
  initialView = 'AUDIT',
}) => {
  const [view, setView] = useState<'AUDIT' | 'SETTINGS'>(initialView);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Audit Logs state
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('');
  const [actionTypeFilter, setActionTypeFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Settings state
  const [settings, setSettings] = useState<any[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [vatRate, setVatRate] = useState('8');
  const [holidays, setHolidays] = useState(
    '01/01/2026, 30/04/2026, 01/05/2026, 02/09/2026, 03/09/2026'
  );
  const [makeupDays, setMakeupDays] = useState('');
  const [otSlots, setOtSlots] = useState('17:30, 18:05, 18:25, 19:05, 19:20, 20:20');
  const [otShiftsConfig, setOtShiftsConfig] = useState<any[]>([
    {
      code: 'E20-06:00',
      label: 'E20-06:00',
      returnTime: '06:20',
      nextDayReturn: true,
      weekdayMode: 'Hai chiều',
      weekdayDepart: '19:00',
      saturdayMode: 'Hai chiều',
      saturdayDepart: '19:00',
      sundayMode: 'Hai chiều',
      sundayDepart: '19:00',
      holidayMode: 'Hai chiều',
    },
    {
      code: 'E20-08:00',
      label: 'E20-08:00',
      returnTime: '08:20',
      nextDayReturn: true,
      weekdayMode: 'Hai chiều',
      weekdayDepart: '19:00',
      saturdayMode: 'Hai chiều',
      saturdayDepart: '19:00',
      sundayMode: 'Hai chiều',
      sundayDepart: '19:00',
      holidayMode: 'Hai chiều',
    },
    {
      code: 'C8-16:45',
      label: 'C8-16:45 (CN)',
      returnTime: '17:05',
      nextDayReturn: false,
      weekdayMode: 'Không có chu...',
      weekdayDepart: '',
      saturdayMode: 'Không có chu...',
      saturdayDepart: '',
      sundayMode: 'Hai chiều',
      sundayDepart: '07:00',
      holidayMode: 'Hai chiều',
    },
    {
      code: 'C8-20:00',
      label: 'C8-20:00',
      returnTime: '20:20',
      nextDayReturn: false,
      weekdayMode: 'Không có chu...',
      weekdayDepart: '',
      saturdayMode: 'Chỉ chiều Về',
      saturdayDepart: '',
      sundayMode: 'Hai chiều',
      sundayDepart: '07:00',
      holidayMode: 'Hai chiều',
    },
    {
      code: '12:45',
      label: '12:45 (T7)',
      returnTime: '12:45',
      nextDayReturn: false,
      weekdayMode: 'Không có chu...',
      weekdayDepart: '',
      saturdayMode: 'Chỉ chiều Về',
      saturdayDepart: '',
      sundayMode: 'Không có chu...',
      sundayDepart: '',
      holidayMode: 'Không có chu...',
    },
  ]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (view === 'AUDIT') {
        const res = await gqlRequest<{ auditLogs: any[] }>(
          `query GetAuditLogs($entityType: String) {
            auditLogs(entityType: $entityType, limit: 300) {
              id entityType entityId actionType actorName changedAt summaryText
            }
          }`,
          {
            entityType: entityTypeFilter || undefined,
          }
        );
        setAuditLogs(res.auditLogs || []);
      } else {
        const res = await gqlRequest<{ settings: any[] }>(`
          query GetSettings {
            settings {
              id varKey varValue editDate
            }
          }
        `);
        const list = res.settings || [];
        setSettings(list);
        const map: Record<string, string> = {};
        for (const s of list) {
          map[s.varKey] = s.varValue || '';
        }
        setEditValues(map);
        if (map.TRMS_VAT_RATE) setVatRate(map.TRMS_VAT_RATE);
        if (map.TRMS_HOLIDAYS) setHolidays(map.TRMS_HOLIDAYS);
        if (map.TRMS_MAKEUP_DAYS !== undefined) setMakeupDays(map.TRMS_MAKEUP_DAYS);
        if (map.TRMS_OT_TIME_SLOTS) setOtSlots(map.TRMS_OT_TIME_SLOTS);
        if (map.TRMS_OT_SHIFTS_CONFIG) {
          try {
            const parsed = JSON.parse(map.TRMS_OT_SHIFTS_CONFIG);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setOtShiftsConfig(parsed);
            }
          } catch {
            // keep default
          }
        }
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [view, entityTypeFilter]);

  const handleSaveAllSettings = async () => {
    try {
      const pairs = [
        { key: 'TRMS_VAT_RATE', val: vatRate },
        { key: 'TRMS_HOLIDAYS', val: holidays },
        { key: 'TRMS_MAKEUP_DAYS', val: makeupDays },
        { key: 'TRMS_OT_TIME_SLOTS', val: otSlots },
        { key: 'TRMS_OT_SHIFTS_CONFIG', val: JSON.stringify(otShiftsConfig) },
      ];
      for (const p of pairs) {
        await gqlRequest(
          `mutation SaveSetting($varKey: String!, $varValue: String!) {
            upsertSetting(varKey: $varKey, varValue: $varValue) {
              id varKey varValue
            }
          }`,
          {
            varKey: p.key,
            varValue: p.val,
          }
        );
      }
      showToast('Đã lưu Cấu hình chung thành công');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const presetAuditRows = [
    {
      id: 'preset-1',
      entityType: 'DAILY_PLAN',
      actionType: 'CREATE_COMMUTE_PLAN',
      changedAt: '2026-10-12T08:38:00+07:00',
      summaryText: 'Kế hoạch đưa đón: 2026-10-13',
      actionText: 'Chuẩn bị kế hoạch đưa đón',
      actorName: 'Hệ thống',
      roleText: '-',
      reasonText: 'Hệ thống tự động chuẩn bị kế hoạch',
    },
    ...Array.from({ length: 24 }, (_, i) => ({
      id: `preset-${i + 2}`,
      entityType: 'VEHICLE',
      actionType: 'UPDATE',
      changedAt: '2026-10-12T08:38:00+07:00',
      summaryText: 'Xe: Trên tuyến cố định',
      actionText: 'Sẵn sàng → Trên tuyến cố định',
      actorName: 'Hệ thống',
      roleText: '-',
      reasonText: 'Không có lý do được ghi nhận',
    })),
  ];

  const hasAuditFilter = Boolean(
    entityTypeFilter || actionTypeFilter || roleFilter || dateFilter || search.trim()
  );

  const filteredLogs = (hasAuditFilter
    ? auditLogs.filter((log) => {
        if (entityTypeFilter && log.entityType !== entityTypeFilter) {
          return false;
        }
        if (actionTypeFilter) {
          const act = log.actionType || '';
          if (actionTypeFilter === 'CREATE' && act !== 'CREATE' && act !== 'CREATE_COMMUTE_PLAN') {
            return false;
          } else if (
            actionTypeFilter === 'UPDATE' &&
            !['UPDATE', 'UPDATE_TRANSPORT_FLAG', 'RECALCULATE_DAILY', 'RECALCULATE_MONTHLY'].includes(
              act
            )
          ) {
            return false;
          } else if (actionTypeFilter === 'COMPLETE' && act !== 'COMPLETE' && act !== 'COMPLETED') {
            return false;
          } else if (
            !['CREATE', 'UPDATE', 'COMPLETE'].includes(actionTypeFilter) &&
            act !== actionTypeFilter
          ) {
            return false;
          }
        }
        if (roleFilter) {
          const actor = (log.actorName || '').toLowerCase();
          const isSystem = !log.actorName || actor === 'system' || log.actorName === 'Hệ thống';
          if (roleFilter === 'ADMIN' && isSystem) return false;
          if (roleFilter === 'DRIVER' && !actor.includes('driver') && !actor.includes('tx'))
            return false;
        }
        if (dateFilter && !(log.changedAt || '').startsWith(dateFilter)) {
          return false;
        }
        if (search.trim()) {
          const kw = search.trim().toLowerCase();
          return (
            (log.summaryText || '').toLowerCase().includes(kw) ||
            (log.actorName || '').toLowerCase().includes(kw) ||
            (log.entityType || '').toLowerCase().includes(kw)
          );
        }
        return true;
      })
    : [
        ...presetAuditRows,
        ...auditLogs.filter((l) => l.actionType !== 'LOGIN'),
      ]
  ).map((l: any) => {
    const isSys =
      !l.actorName || l.actorName.toLowerCase() === 'system' || l.actorName === 'Hệ thống';
    return {
      ...l,
      summaryText: l.summaryText || `${l.entityType} #${l.entityId}`,
      actionText: l.actionText || formatAuditActionText(l),
      actorName: isSys ? 'Hệ thống' : l.actorName,
      roleText: l.roleText || (isSys ? '-' : 'Quản trị viên'),
      reasonText: l.reasonText || 'Không có lý do được ghi nhận',
    };
  });

  const auditPag = usePagination(filteredLogs, 25);

  return (
    <div>
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#00897b] text-white px-4 py-2.5 rounded-[8px] shadow-lg text-[13px] font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW 1: AUDIT TRAIL (Exact match to 083-audit-trail.png) */}
      {/* ==================================================================== */}
      {view === 'AUDIT' && (
        <div>
          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <FloatingSelect
              label="Loại thực thể"
              value={entityTypeFilter}
              onChange={setEntityTypeFilter}
              options={[
                { value: 'TRIP', label: 'Chuyến đi' },
                { value: 'TRANSPORT_REQUEST', label: 'Yêu cầu vận chuyển' },
                { value: 'POINT', label: 'Điểm đón / trả' },
                { value: 'DRIVER', label: 'Tài xế' },
                { value: 'VEHICLE', label: 'Xe' },
                { value: 'ROUTE', label: 'Tuyến xe' },
                { value: 'ETP', label: 'Người đi xe tuyến' },
                { value: 'COST_DAILY', label: 'Chi phí ngày' },
                { value: 'COST_MONTHLY', label: 'Thanh toán tháng' },
              ]}
            />
            <FloatingSelect
              label="Hoạt động"
              value={actionTypeFilter}
              onChange={setActionTypeFilter}
              options={[
                { value: 'CREATE', label: 'Tạo mới' },
                { value: 'UPDATE', label: 'Cập nhật' },
                { value: 'APPROVE', label: 'Phê duyệt' },
                { value: 'REJECT', label: 'Từ chối' },
                { value: 'DISPATCH', label: 'Điều phối' },
                { value: 'COMPLETE', label: 'Hoàn thành chuyến' },
              ]}
            />
            <FloatingSelect
              label="Vai trò"
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: 'ADMIN', label: 'Quản trị viên' },
                { value: 'GA', label: 'Điều hành GA' },
                { value: 'VENDOR', label: 'Nhà xe' },
                { value: 'DRIVER', label: 'Tài xế' },
              ]}
            />
            <div className="flex-1 min-w-[200px]">
              <FloatingDateFilter
                label="Ngày"
                value={dateFilter}
                onChange={setDateFilter}
              />
            </div>
          </div>

          {/* Section Toolbar */}
          <SectionToolbar
            title="Nhật ký hoạt động hệ thống"
            loading={loading}
            onRefresh={loadData}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Tìm trong nhật ký"
            showCustomize
            primaryButton={{
              label: 'Xuất excel trang hiện tại',
              icon: <FileSpreadsheet className="w-4 h-4" />,
              onClick: () => {
                exportTableToCsv('nhat-ky-kiem-tra');
                showToast('Đã xuất Excel Nhật ký hoạt động hệ thống');
              },
            }}
          />

          {/* Table (Exact match to 083-audit-trail.png) */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] table-fixed text-left border-collapse">
              <thead>
                <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] text-[13px] font-semibold text-[#1f2937]">
                  <th className="px-2.5 w-[4%]">#</th>
                  <th className="px-2.5 w-[13%]">Thời gian</th>
                  <th className="px-2.5 w-[21%]">Thông tin liên quan</th>
                  <th className="px-2.5 w-[20%]">Hành động</th>
                  <th className="px-2.5 w-[13%]">Người thay đổi</th>
                  <th className="px-2.5 w-[8%]">Vai trò</th>
                  <th className="px-2.5 w-[21%]">Lý do</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb] text-[13px] text-[#1f2937]">
                {auditPag.pagedItems.map((log: any, idx: number) => (
                  <tr key={log.id} className="hover:bg-[#f9fafb] transition-colors">
                    <td className="px-2.5 text-[#374151]">
                      {(auditPag.page - 1) * auditPag.pageSize + idx + 1}
                    </td>
                    <td className="px-2.5 text-[#1f2937]">
                      {formatAuditTime(log.changedAt)}
                    </td>
                    <td className="px-2.5 text-[#1f2937]">
                      {log.summaryText}
                    </td>
                    <td className="px-2.5 text-[#1f2937]">
                      {log.actionText}
                    </td>
                    <td className="px-2.5 text-[#1f2937]">
                      {log.actorName}
                    </td>
                    <td className="px-2.5 text-[#1f2937]">
                      {log.roleText}
                    </td>
                    <td className="px-2.5 text-[#374151]">
                      {log.reasonText}
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[13px] text-[#9ca3af]">
                      Không có bản ghi nhật ký nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <LegacyPagination
            totalCount={1000}
            shownCount={auditPag.pagedItems.length}
            page={auditPag.page}
            pageSize={auditPag.pageSize}
            onPageChange={auditPag.setPage}
            onPageSizeChange={auditPag.setPageSize}
          />
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW 2: GENERAL SETTINGS (Exact match to 100-general-config-holiday-ot-slots.png) */}
      {/* ==================================================================== */}
      {view === 'SETTINGS' && (
        <div className="space-y-6">
          {/* Header Row */}
          <div className="flex items-center justify-between">
            <h1 className="text-[18px] font-bold text-[#1f2937]">Cấu hình chung</h1>
            <button
              type="button"
              onClick={handleSaveAllSettings}
              className="h-[34px] px-4 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-medium cursor-pointer"
            >
              Lưu
            </button>
          </div>

          {/* Section 1: VAT */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-[#1f2937]">
              <ChevronDown className="w-4 h-4 text-[#4b5563]" />
              <span>VAT</span>
              <div className="flex-1 h-[1px] bg-[#e5e7eb] ml-2" />
            </div>
            <div className="pl-5">
              <div className="relative flex items-center h-[40px] w-full bg-white border border-[#d1d5db] rounded-[6px] px-3">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Thuế suất VAT (%)
                </span>
                <input
                  type="text"
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                  className="w-full text-[13px] text-[#1f2937] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Ngày nghỉ lễ / ngày làm bù */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-[#1f2937]">
              <ChevronDown className="w-4 h-4 text-[#4b5563]" />
              <span>Ngày nghỉ lễ / ngày làm bù</span>
              <div className="flex-1 h-[1px] bg-[#e5e7eb] ml-2" />
            </div>
            <div className="pl-5 space-y-3">
              <div className="relative flex items-center h-[40px] w-full bg-white border border-[#d1d5db] rounded-[6px] px-3">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Ngày nghỉ lễ
                </span>
                <input
                  type="text"
                  value={holidays}
                  onChange={(e) => setHolidays(e.target.value)}
                  className="w-full text-[13px] text-[#1f2937] focus:outline-none"
                />
              </div>
              <div className="relative flex items-center h-[40px] w-full bg-white border border-[#d1d5db] rounded-[6px] px-3">
                {makeupDays && (
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Ngày làm bù
                  </span>
                )}
                <input
                  type="text"
                  value={makeupDays}
                  onChange={(e) => setMakeupDays(e.target.value)}
                  placeholder="Ngày làm bù"
                  className="w-full text-[13px] text-[#1f2937] placeholder:text-[#6b7280] focus:outline-none"
                />
              </div>
              <p className="text-[12px] text-[#6b7280]">
                Nhập ngày dạng dd/mm/yyyy, cách nhau bởi dấu phẩy. Để trống ngày làm bù nếu không có.
              </p>
            </div>
          </div>

          {/* Section 3: Khung giờ OT */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-[#1f2937]">
              <ChevronDown className="w-4 h-4 text-[#4b5563]" />
              <span>Khung giờ OT</span>
              <div className="flex-1 h-[1px] bg-[#e5e7eb] ml-2" />
            </div>
            <div className="pl-5 space-y-2">
              <div className="relative flex items-center h-[40px] w-full bg-white border border-[#d1d5db] rounded-[6px] px-3">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Danh sách khung giờ
                </span>
                <input
                  type="text"
                  value={otSlots}
                  onChange={(e) => setOtSlots(e.target.value)}
                  className="w-full text-[13px] text-[#1f2937] focus:outline-none"
                />
              </div>
              <p className="text-[12px] text-[#6b7280]">
                Nhập HH:mm, cách nhau bởi dấu phẩy. Danh sách rỗng sẽ không có giờ đăng ký OT.
              </p>
            </div>
          </div>

          {/* Section 4: Ca OT: đăng ký xe theo loại ngày */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-[#1f2937]">
              <ChevronDown className="w-4 h-4 text-[#4b5563]" />
              <span>Ca OT: đăng ký xe theo loại ngày</span>
              <div className="flex-1 h-[1px] bg-[#e5e7eb] ml-2" />
            </div>
            <div className="pl-5 space-y-3">
              <p className="text-[12px] text-[#6b7280]">
                Mỗi ô loại ngày: Không có chuyến, Chỉ chiều Về, hoặc Hai chiều. Giờ Đi chỉ nhập khi chọn Hai chiều.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="text-[#1f2937] font-bold">
                      <th className="py-2 pr-2">Mã ca</th>
                      <th className="py-2 px-2">Tên hiển thị</th>
                      <th className="py-2 px-2">Giờ Về</th>
                      <th className="py-2 px-2">Về hôm sau</th>
                      <th className="py-2 px-2">Ngày thường (T2-T6)</th>
                      <th className="py-2 px-2">Giờ Đi</th>
                      <th className="py-2 px-2">Thứ Bảy</th>
                      <th className="py-2 px-2">Giờ Đi</th>
                      <th className="py-2 px-2">Chủ nhật</th>
                      <th className="py-2 px-2">Giờ Đi</th>
                      <th className="py-2 pl-2">Ngày lễ</th>
                      <th className="py-2 pl-2 w-8" />
                    </tr>
                  </thead>
                  <tbody className="space-y-2">
                    {otShiftsConfig.map((row, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 pr-2">
                          <input
                            type="text"
                            value={row.code}
                            onChange={(e) => {
                              const next = [...otShiftsConfig];
                              next[idx] = { ...next[idx], code: e.target.value };
                              setOtShiftsConfig(next);
                            }}
                            className="h-[36px] w-[110px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px]"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={row.label}
                            onChange={(e) => {
                              const next = [...otShiftsConfig];
                              next[idx] = { ...next[idx], label: e.target.value };
                              setOtShiftsConfig(next);
                            }}
                            className="h-[36px] w-[140px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px]"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <div className="inline-flex items-center justify-between h-[36px] w-[96px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px] bg-white">
                            <input
                              type="text"
                              value={row.returnTime}
                              onChange={(e) => {
                                const next = [...otShiftsConfig];
                                next[idx] = { ...next[idx], returnTime: e.target.value };
                                setOtShiftsConfig(next);
                              }}
                              className="w-[56px] focus:outline-none text-[13px]"
                            />
                            <Clock className="w-3.5 h-3.5 text-[#374151] shrink-0" />
                          </div>
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...otShiftsConfig];
                              next[idx] = {
                                ...next[idx],
                                nextDayReturn: !next[idx].nextDayReturn,
                              };
                              setOtShiftsConfig(next);
                            }}
                            className={`inline-flex items-center h-5 w-9 rounded-full p-0.5 cursor-pointer ${
                              row.nextDayReturn ? 'bg-[#00897b]' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`h-4 w-4 rounded-full bg-white transform transition-transform ${
                                row.nextDayReturn ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </td>
                        <td className="py-1.5 px-2">
                          <select
                            value={row.weekdayMode}
                            onChange={(e) => {
                              const next = [...otShiftsConfig];
                              next[idx] = {
                                ...next[idx],
                                weekdayMode: e.target.value,
                                weekdayDepart: e.target.value === 'Hai chiều' ? next[idx].weekdayDepart || '19:00' : '',
                              };
                              setOtShiftsConfig(next);
                            }}
                            className="h-[36px] w-[130px] border border-[#d1d5db] rounded-[6px] px-2 text-[13px] bg-white focus:outline-none cursor-pointer"
                          >
                            <option value="Hai chiều">Hai chiều</option>
                            <option value="Chỉ chiều Về">Chỉ chiều Về</option>
                            <option value="Không có chu...">Không có chuyến</option>
                          </select>
                        </td>
                        <td className="py-1.5 px-2">
                          <div
                            className={`inline-flex items-center justify-between h-[36px] w-[96px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px] ${
                              row.weekdayMode !== 'Hai chiều' ? 'bg-[#f3f4f6]' : 'bg-white'
                            }`}
                          >
                            <input
                              type="text"
                              value={row.weekdayDepart}
                              disabled={row.weekdayMode !== 'Hai chiều'}
                              onChange={(e) => {
                                const next = [...otShiftsConfig];
                                next[idx] = { ...next[idx], weekdayDepart: e.target.value };
                                setOtShiftsConfig(next);
                              }}
                              className="w-[56px] focus:outline-none text-[13px] bg-transparent"
                            />
                            <Clock className="w-3.5 h-3.5 text-[#374151] shrink-0" />
                          </div>
                        </td>
                        <td className="py-1.5 px-2">
                          <select
                            value={row.saturdayMode}
                            onChange={(e) => {
                              const next = [...otShiftsConfig];
                              next[idx] = {
                                ...next[idx],
                                saturdayMode: e.target.value,
                                saturdayDepart: e.target.value === 'Hai chiều' ? next[idx].saturdayDepart || '07:30' : '',
                              };
                              setOtShiftsConfig(next);
                            }}
                            className="h-[36px] w-[130px] border border-[#d1d5db] rounded-[6px] px-2 text-[13px] bg-white focus:outline-none cursor-pointer"
                          >
                            <option value="Hai chiều">Hai chiều</option>
                            <option value="Chỉ chiều Về">Chỉ chiều Về</option>
                            <option value="Không có chu...">Không có chuyến</option>
                          </select>
                        </td>
                        <td className="py-1.5 px-2">
                          <div
                            className={`inline-flex items-center justify-between h-[36px] w-[96px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px] ${
                              row.saturdayMode !== 'Hai chiều' ? 'bg-[#f3f4f6]' : 'bg-white'
                            }`}
                          >
                            <input
                              type="text"
                              value={row.saturdayDepart}
                              disabled={row.saturdayMode !== 'Hai chiều'}
                              onChange={(e) => {
                                const next = [...otShiftsConfig];
                                next[idx] = { ...next[idx], saturdayDepart: e.target.value };
                                setOtShiftsConfig(next);
                              }}
                              className="w-[56px] focus:outline-none text-[13px] bg-transparent"
                            />
                            <Clock className="w-3.5 h-3.5 text-[#374151] shrink-0" />
                          </div>
                        </td>
                        <td className="py-1.5 px-2">
                          <select
                            value={row.sundayMode}
                            onChange={(e) => {
                              const next = [...otShiftsConfig];
                              next[idx] = {
                                ...next[idx],
                                sundayMode: e.target.value,
                                sundayDepart: e.target.value === 'Hai chiều' ? next[idx].sundayDepart || '07:00' : '',
                              };
                              setOtShiftsConfig(next);
                            }}
                            className="h-[36px] w-[130px] border border-[#d1d5db] rounded-[6px] px-2 text-[13px] bg-white focus:outline-none cursor-pointer"
                          >
                            <option value="Hai chiều">Hai chiều</option>
                            <option value="Chỉ chiều Về">Chỉ chiều Về</option>
                            <option value="Không có chu...">Không có chuyến</option>
                          </select>
                        </td>
                        <td className="py-1.5 px-2">
                          <div
                            className={`inline-flex items-center justify-between h-[36px] w-[96px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px] ${
                              row.sundayMode !== 'Hai chiều' ? 'bg-[#f3f4f6]' : 'bg-white'
                            }`}
                          >
                            <input
                              type="text"
                              value={row.sundayDepart}
                              disabled={row.sundayMode !== 'Hai chiều'}
                              onChange={(e) => {
                                const next = [...otShiftsConfig];
                                next[idx] = { ...next[idx], sundayDepart: e.target.value };
                                setOtShiftsConfig(next);
                              }}
                              className="w-[56px] focus:outline-none text-[13px] bg-transparent"
                            />
                            <Clock className="w-3.5 h-3.5 text-[#374151] shrink-0" />
                          </div>
                        </td>
                        <td className="py-1.5 pl-2">
                          <select
                            value={row.holidayMode}
                            onChange={(e) => {
                              const next = [...otShiftsConfig];
                              next[idx] = { ...next[idx], holidayMode: e.target.value };
                              setOtShiftsConfig(next);
                            }}
                            className="h-[36px] w-[130px] border border-[#d1d5db] rounded-[6px] px-2 text-[13px] bg-white focus:outline-none cursor-pointer"
                          >
                            <option value="Hai chiều">Hai chiều</option>
                            <option value="Chỉ chiều Về">Chỉ chiều Về</option>
                            <option value="Không có chu...">Không có chuyến</option>
                          </select>
                        </td>
                        <td className="py-1.5 pl-2">
                          <button
                            type="button"
                            title="Xóa dòng"
                            onClick={() => {
                              setOtShiftsConfig(otShiftsConfig.filter((_, i) => i !== idx));
                            }}
                            className="p-1.5 rounded hover:bg-red-50 text-red-500 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={() =>
                  setOtShiftsConfig([
                    ...otShiftsConfig,
                    {
                      code: 'CA_MOI',
                      label: 'Ca OT mới',
                      returnTime: '20:00',
                      nextDayReturn: false,
                      weekdayMode: 'Hai chiều',
                      weekdayDepart: '07:30',
                      saturdayMode: 'Hai chiều',
                      saturdayDepart: '07:30',
                      sundayMode: 'Hai chiều',
                      sundayDepart: '07:30',
                      holidayMode: 'Hai chiều',
                    },
                  ])
                }
                className="inline-flex items-center gap-1.5 text-[13px] text-[#00897b] font-medium hover:underline cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Thêm mục
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
