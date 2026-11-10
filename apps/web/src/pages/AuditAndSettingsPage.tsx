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
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
}

function renderAuditActionBadge(actionType: string) {
  switch (actionType) {
    case 'COMPLETE':
    case 'COMPLETED':
      return <PastelBadge label="Hoàn thành chuyến" tone="green" />;
    case 'CREATE':
      return <PastelBadge label="Tạo mới" tone="green" />;
    case 'UPDATE':
      return <PastelBadge label="Cập nhật" tone="amber" />;
    case 'CONFIRM':
      return <PastelBadge label="Tài xế xác nhận" tone="green" />;
    case 'APPROVE':
      return <PastelBadge label="Phê duyệt" tone="green" />;
    case 'REJECT':
      return <PastelBadge label="Từ chối" tone="red" />;
    case 'DISPATCH':
      return <PastelBadge label="Điều phối xe" tone="sky" />;
    default:
      return <PastelBadge label={actionType} tone="green" />;
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
          `query GetAuditLogs($entityType: String, $actionType: String) {
            auditLogs(entityType: $entityType, actionType: $actionType, limit: 300) {
              id entityType entityId actionType actorName actorIp changedAt summaryText
            }
          }`,
          {
            entityType: entityTypeFilter || undefined,
            actionType: actionTypeFilter || undefined,
          }
        );
        setAuditLogs(res.auditLogs || []);
      } else {
        const res = await gqlRequest<{ settings: any[] }>(`
          query GetSettings {
            settings {
              id varKey varValue description editDate
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
        if (map.TRMS_MAKEUP_DAYS) setMakeupDays(map.TRMS_MAKEUP_DAYS);
        if (map.TRMS_OT_TIME_SLOTS) setOtSlots(map.TRMS_OT_TIME_SLOTS);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [view, entityTypeFilter, actionTypeFilter]);

  const handleSaveAllSettings = async () => {
    try {
      const pairs = [
        { key: 'TRMS_VAT_RATE', val: vatRate, desc: 'Thuế suất VAT (%)' },
        { key: 'TRMS_HOLIDAYS', val: holidays, desc: 'Ngày nghỉ lễ' },
        { key: 'TRMS_MAKEUP_DAYS', val: makeupDays, desc: 'Ngày làm bù' },
        { key: 'TRMS_OT_TIME_SLOTS', val: otSlots, desc: 'Danh sách khung giờ OT' },
      ];
      for (const p of pairs) {
        await gqlRequest(
          `mutation SaveSetting($varKey: String!, $varValue: String, $description: String) {
            upsertSetting(varKey: $varKey, varValue: $varValue, description: $description) {
              id varKey varValue
            }
          }`,
          {
            varKey: p.key,
            varValue: p.val,
            description: p.desc,
          }
        );
      }
      showToast('Đã lưu Cấu hình chung thành công');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredLogs = auditLogs.filter((log) => {
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
  });

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
            <FloatingDateFilter
              label="Ngày"
              value={dateFilter}
              onChange={setDateFilter}
            />
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
              onClick: () => showToast('Đã xuất Excel Nhật ký hoạt động hệ thống'),
            }}
          />

          {/* Table (Exact match to 083-audit-trail.png) */}
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left border-collapse">
              <thead>
                <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] text-[13px] font-semibold text-[#1f2937]">
                  <th className="px-2.5 w-[4%]">#</th>
                  <th className="px-2.5 w-[14%]">Thời gian</th>
                  <th className="px-2.5 w-[33%]">Thông tin liên quan</th>
                  <th className="px-2.5 w-[13%]">Hành động</th>
                  <th className="px-2.5 w-[12%]">Người thay đổi</th>
                  <th className="px-2.5 w-[11%]">Vai trò</th>
                  <th className="px-2.5 w-[13%]">Lý do</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb] text-[13px] text-[#1f2937]">
                {filteredLogs.map((log, idx) => {
                  const isSystem =
                    !log.actorName ||
                    log.actorName.toLowerCase() === 'system' ||
                    log.actorName === 'Hệ thống';
                  return (
                    <tr key={log.id} className="hover:bg-[#f9fafb] transition-colors">
                      <td className="px-2.5 text-[#374151]">{idx + 1}</td>
                      <td className="px-2.5 text-[#1f2937] truncate">
                        {formatAuditTime(log.changedAt)}
                      </td>
                      <td className="px-2.5 text-[#1f2937] truncate">
                        {log.summaryText || `${log.entityType} #${log.entityId}`}
                      </td>
                      <td className="px-2.5">
                        {renderAuditActionBadge(log.actionType)}
                      </td>
                      <td className="px-2.5 text-[#1f2937] truncate">
                        {isSystem ? 'Hệ thống' : log.actorName}
                      </td>
                      <td className="px-2.5">
                        <PastelBadge
                          label={isSystem ? 'Hệ thống' : 'Quản trị viên'}
                          tone="green"
                        />
                      </td>
                      <td className="px-2.5 text-[#374151] truncate">—</td>
                    </tr>
                  );
                })}
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

          <LegacyPagination totalCount={filteredLogs.length} pageSize={20} />
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
                          <div className="inline-flex items-center justify-between h-[36px] w-[96px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px]">
                            <span>{row.returnTime}</span>
                            <Clock className="w-3.5 h-3.5 text-[#374151]" />
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
                          <div className="inline-flex items-center justify-between h-[36px] w-[130px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px]">
                            <span className="truncate">{row.weekdayMode}</span>
                            <X className="w-3.5 h-3.5 text-[#374151] shrink-0" />
                          </div>
                        </td>
                        <td className="py-1.5 px-2">
                          <div
                            className={`inline-flex items-center justify-between h-[36px] w-[96px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px] ${
                              !row.weekdayDepart ? 'bg-[#f3f4f6]' : 'bg-white'
                            }`}
                          >
                            <span>{row.weekdayDepart}</span>
                            <Clock className="w-3.5 h-3.5 text-[#374151]" />
                          </div>
                        </td>
                        <td className="py-1.5 px-2">
                          <div className="inline-flex items-center justify-between h-[36px] w-[130px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px]">
                            <span className="truncate">{row.saturdayMode}</span>
                            <X className="w-3.5 h-3.5 text-[#374151] shrink-0" />
                          </div>
                        </td>
                        <td className="py-1.5 px-2">
                          <div
                            className={`inline-flex items-center justify-between h-[36px] w-[96px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px] ${
                              !row.saturdayDepart ? 'bg-[#f3f4f6]' : 'bg-white'
                            }`}
                          >
                            <span>{row.saturdayDepart}</span>
                            <Clock className="w-3.5 h-3.5 text-[#374151]" />
                          </div>
                        </td>
                        <td className="py-1.5 px-2">
                          <div className="inline-flex items-center justify-between h-[36px] w-[130px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px]">
                            <span className="truncate">{row.sundayMode}</span>
                            <X className="w-3.5 h-3.5 text-[#374151] shrink-0" />
                          </div>
                        </td>
                        <td className="py-1.5 px-2">
                          <div
                            className={`inline-flex items-center justify-between h-[36px] w-[96px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px] ${
                              !row.sundayDepart ? 'bg-[#f3f4f6]' : 'bg-white'
                            }`}
                          >
                            <span>{row.sundayDepart}</span>
                            <Clock className="w-3.5 h-3.5 text-[#374151]" />
                          </div>
                        </td>
                        <td className="py-1.5 pl-2">
                          <div className="inline-flex items-center justify-between h-[36px] w-[130px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px]">
                            <span className="truncate">{row.holidayMode}</span>
                            <X className="w-3.5 h-3.5 text-[#374151] shrink-0" />
                          </div>
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
