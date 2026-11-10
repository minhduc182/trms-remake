import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  Copy,
  AlertTriangle,
  RotateCcw,
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

const ENTITY_TYPE_LABELS: Record<string, string> = {
  REQUEST: 'Yêu cầu xe',
  TRANSPORT_REQUEST: 'Yêu cầu vận chuyển',
  TRIP: 'Chuyến đi',
  DAILY_PLAN: 'Kế hoạch ngày',
  PLAN_VERSION: 'Phiên bản kế hoạch',
  PLAN_ASSIGNMENT: 'Phân công kế hoạch',
  VEHICLE: 'Xe',
  VEHICLE_STATUS: 'Trạng thái xe',
  DRIVER: 'Tài xế',
  ROUTE: 'Tuyến xe',
  POINT: 'Điểm đón / trả',
  LEG_DEFINITION: 'Lượt chạy (Chặng)',
  ETP: 'Hồ sơ xe nhân viên (ETP)',
  EMPLOYEE_TRANSPORT_PROFILE: 'Đăng ký xe nhân viên',
  IMPORT: 'Nhập dữ liệu (Import)',
  COST: 'Chi phí',
  COST_DAILY: 'Chi phí hàng ngày',
  COST_MONTHLY: 'Thanh toán hàng tháng',
  COST_CONFIG: 'Cấu hình chi phí',
  SHIFT: 'Ca làm việc',
  SETTING: 'Cài đặt hệ thống',
  AUTH: 'Xác thực / Đăng nhập',
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
  APPROVE: 'Phê duyệt',
  BULK_APPROVE: 'Phê duyệt hàng loạt',
  REJECT: 'Từ chối',
  BULK_REJECT: 'Từ chối hàng loạt',
  CANCEL: 'Hủy',
  DISPATCH: 'Điều phối xe',
  CONFIRM: 'Tài xế xác nhận',
  COMPLETE: 'Hoàn thành chuyến',
  COMPLETED: 'Hoàn thành chuyến',
  AUTO_COMPLETE: 'Tự động hoàn thành',
  UPDATE_ACTUAL_KM: 'Cập nhật KM thực tế',
  CREATE_COMMUTE_PLAN: 'Chuẩn bị kế hoạch đưa đón',
  FINALIZE: 'Chốt kế hoạch',
  CREATE_SUPPLEMENT: 'Tạo chuyến điều bù',
  SYNC_STATUS: 'Đồng bộ trạng thái xe',
  RECALCULATE_DAILY: 'Tính lại chi phí ngày',
  RECALCULATE_MONTHLY: 'Tính lại thanh toán tháng',
  ISSUE_DISPATCHED_STUCK: 'Cảnh báo chuyến chưa hoàn thành',
  DEACTIVATE: 'Ngừng sử dụng xe',
  DELETE_FUTURE: 'Xóa đăng ký tương lai',
  CREATE_PROVISIONAL: 'Tạo hồ sơ tạm (chưa có mã NV)',
  LINK_PROVISIONAL: 'Gắn mã nhân viên chính thức',
  UPDATE_SEGMENTS: 'Cập nhật phân công chặng',
  RESTORE: 'Khôi phục dữ liệu',
  LOGIN: 'Đăng nhập hệ thống',
};

const FIELD_LABELS_VI: Record<string, string> = {
  id: 'Mã định danh (ID)',
  entityId: 'Mã bản ghi',
  entityType: 'Phân hệ / Đối tượng',
  actionType: 'Hành động',
  status: 'Trạng thái',
  activeFlag: 'Trạng thái hoạt động',
  approvalStatus: 'Trạng thái phê duyệt',
  pointCode: 'Mã điểm đón/trả',
  pointName: 'Tên điểm đón/trả',
  pointType: 'Loại điểm',
  districtName: 'Khu vực / Quận huyện',
  address: 'Địa chỉ',
  isFactory: 'Là nhà máy',
  driverName: 'Tên tài xế',
  phoneNumber: 'Số điện thoại',
  shortAddress: 'Địa chỉ ngắn',
  fullAddress: 'Địa chỉ đầy đủ',
  vehiclePlate: 'Biển số xe',
  vehicleCode: 'Mã xe',
  vehicleType: 'Loại xe',
  seatCapacity: 'Số chỗ ngồi',
  ownershipType: 'Hình thức sở hữu',
  commutePackageMode: 'Hình thức tính phí',
  dailyTripQuota: 'Định mức chuyến/ngày',
  monthlyKmQuota: 'Định mức KM/tháng',
  legCode: 'Mã lượt chạy',
  legName: 'Tên lượt chạy',
  passengerType: 'Loại hành khách',
  direction: 'Hướng di chuyển',
  routeCode: 'Mã tuyến',
  routeName: 'Tên tuyến',
  runDays: 'Ngày hoạt động',
  effectiveFrom: 'Hiệu lực từ ngày',
  effectiveTo: 'Hiệu lực đến ngày',
  empCode: 'Mã nhân viên',
  fullName: 'Họ và tên',
  provTempCode: 'Mã nhân viên tạm',
  provFullName: 'Họ tên nhân viên tạm',
  isProvisional: 'Hồ sơ tạm',
  actualKm: 'Số KM thực tế',
  otHours: 'Số giờ làm thêm (OT)',
  overtimeHours: 'Số giờ làm thêm (OT)',
  tollFeeAmount: 'Phí cầu đường (VND)',
  unitPrice: 'Đơn giá (VND)',
  appliedAmount: 'Thành tiền trước thuế (VND)',
  vatAmount: 'Tiền thuế VAT (VND)',
  amountAfterVat: 'Tổng tiền sau thuế (VND)',
  versionCode: 'Mã phiên bản giá',
  varKey: 'Từ khóa cấu hình',
  varValue: 'Giá trị cấu hình',
  businessDate: 'Ngày nghiệp vụ',
  serviceDate: 'Ngày dịch vụ',
  paymentMonth: 'Tháng thanh toán',
  tripCode: 'Mã chuyến xe',
  summary: 'Nội dung tóm tắt',
  reason: 'Lý do',
};

export interface AuditDiffRow {
  fieldKey: string;
  fieldLabel: string;
  beforeValue: string;
  afterValue: string;
  changed: boolean;
}

function formatDiffPrimitive(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Có' : 'Không';
  if (typeof val === 'number') {
    return val.toLocaleString('vi-VN');
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === 'Y') return 'Hoạt động (Y)';
    if (trimmed === 'N') return 'Ngừng hoạt động (N)';
    if (trimmed === 'AVAILABLE') return 'Sẵn sàng (AVAILABLE)';
    if (trimmed === 'ON_FIXED_ROUTE') return 'Trên tuyến cố định (ON_FIXED_ROUTE)';
    if (trimmed === 'ON_SPECIAL_ASSIGNMENT') return 'Chuyến công tác/phát sinh (ON_SPECIAL_ASSIGNMENT)';
    if (trimmed === 'NOT_AVAILABLE') return 'Không khả dụng (NOT_AVAILABLE)';
    if (trimmed === 'APPROVED') return 'Đã phê duyệt (APPROVED)';
    if (trimmed === 'PENDING') return 'Chờ phê duyệt (PENDING)';
    if (trimmed === 'REJECTED') return 'Đã từ chối (REJECTED)';
    if (trimmed === 'COMPLETED') return 'Đã hoàn thành (COMPLETED)';
    if (trimmed === 'DISPATCHED') return 'Đã điều phối (DISPATCHED)';
    if (trimmed === 'DRAFT') return 'Bản nháp (DRAFT)';
    if (trimmed === 'FINALIZED') return 'Đã chốt (FINALIZED)';
    return trimmed;
  }
  if (Array.isArray(val)) {
    return val.map((item) => formatDiffPrimitive(item)).join(', ');
  }
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  return String(val);
}

function tryParseJsonObject(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return null;
      }
    }
  }
  return null;
}

function buildAuditDiffAndJson(log: any): {
  diffRows: AuditDiffRow[];
  beforeObj: Record<string, unknown>;
  afterObj: Record<string, unknown>;
} {
  let beforeObj =
    tryParseJsonObject(log.beforeJson) ||
    tryParseJsonObject(log.beforeState) ||
    tryParseJsonObject(log.oldValue) ||
    null;
  let afterObj =
    tryParseJsonObject(log.afterJson) ||
    tryParseJsonObject(log.afterState) ||
    tryParseJsonObject(log.newValue) ||
    null;

  const summary = String(log.summaryText || '').trim();
  const act = String(log.actionType || '').toUpperCase();
  const ent = String(log.entityType || '').toUpperCase();

  // If beforeObj / afterObj are not explicitly stored as JSON strings, synthesize structured before/after from log details
  if (!beforeObj && !afterObj) {
    beforeObj = {};
    afterObj = {};

    // Check if summary contains an arrow transition like "Xe 29B16247: AVAILABLE -> ON_FIXED_ROUTE"
    const arrowMatch = summary.match(/^(.*?):\s*(.+?)\s*(?:->|→)\s*(.+)$/);
    if (arrowMatch) {
      const targetLabel = arrowMatch[1].trim();
      const fromVal = arrowMatch[2].trim();
      const toVal = arrowMatch[3].trim();
      beforeObj.entityId = String(log.entityId || '—');
      afterObj.entityId = String(log.entityId || '—');
      beforeObj.summary = targetLabel;
      afterObj.summary = targetLabel;
      beforeObj.status = fromVal;
      afterObj.status = toVal;
    } else if (act === 'CREATE' || act.startsWith('CREATE_')) {
      // Creation action: Before is empty, After has created record fields
      afterObj.entityType = ENTITY_TYPE_LABELS[ent] || ent;
      afterObj.entityId = String(log.entityId || '—');
      afterObj.status = act === 'CREATE_PROVISIONAL' ? 'PENDING' : 'Y';
      afterObj.summary = summary || formatAuditActionText(log);
      const kmMatch = summary.match(/(\d+(?:\.\d+)?)\s*km/i);
      if (kmMatch) afterObj.actualKm = Number(kmMatch[1]);
    } else if (act === 'DELETE' || act === 'DELETE_FUTURE' || act === 'CANCEL') {
      beforeObj.entityType = ENTITY_TYPE_LABELS[ent] || ent;
      beforeObj.entityId = String(log.entityId || '—');
      beforeObj.activeFlag = 'Y';
      beforeObj.summary = summary;
      afterObj.entityType = ENTITY_TYPE_LABELS[ent] || ent;
      afterObj.entityId = String(log.entityId || '—');
      afterObj.activeFlag = 'N';
      afterObj.status = act === 'CANCEL' ? 'CANCELLED' : 'DELETED';
      afterObj.summary = summary;
    } else if (act === 'DEACTIVATE') {
      const dateMatch = summary.match(/(\d{4}-\d{2}-\d{2})/);
      beforeObj.entityId = String(log.entityId || '—');
      beforeObj.activeFlag = 'Y';
      beforeObj.effectiveTo = null;
      afterObj.entityId = String(log.entityId || '—');
      afterObj.activeFlag = 'N';
      afterObj.effectiveTo = dateMatch ? dateMatch[1] : 'Theo ngày ngừng';
      afterObj.summary = summary;
    } else if (act === 'UPDATE_ACTUAL_KM') {
      const kmMatch = summary.match(/(\d+(?:\.\d+)?)\s*km/i);
      const tripMatch = summary.match(/chuyến\s+([A-Z0-9-]+)/i);
      beforeObj.tripCode = tripMatch ? tripMatch[1] : `#${log.entityId || ''}`;
      beforeObj.actualKm = 0;
      afterObj.tripCode = tripMatch ? tripMatch[1] : `#${log.entityId || ''}`;
      afterObj.actualKm = kmMatch ? Number(kmMatch[1]) : 'Đã cập nhật';
      afterObj.summary = summary;
    } else if (act === 'APPROVE' || act === 'BULK_APPROVE') {
      beforeObj.entityId = String(log.entityId || '—');
      beforeObj.approvalStatus = 'PENDING';
      afterObj.entityId = String(log.entityId || '—');
      afterObj.approvalStatus = 'APPROVED';
      afterObj.summary = summary;
    } else if (act === 'REJECT' || act === 'BULK_REJECT') {
      beforeObj.entityId = String(log.entityId || '—');
      beforeObj.approvalStatus = 'PENDING';
      afterObj.entityId = String(log.entityId || '—');
      afterObj.approvalStatus = 'REJECTED';
      afterObj.reason = summary;
    } else if (act === 'LINK_PROVISIONAL') {
      const empMatch = summary.match(/nhân viên\s+([A-Z0-9_-]+)/i);
      beforeObj.entityId = String(log.entityId || '—');
      beforeObj.isProvisional = 'Y';
      beforeObj.empCode = 'Chưa có mã NV';
      afterObj.entityId = String(log.entityId || '—');
      afterObj.isProvisional = 'N';
      afterObj.empCode = empMatch ? empMatch[1] : 'Đã gắn mã chính thức';
    } else {
      beforeObj.entityType = ENTITY_TYPE_LABELS[ent] || ent;
      beforeObj.entityId = String(log.entityId || '—');
      beforeObj.status = log.actionText?.includes('→')
        ? log.actionText.split('→')[0].trim()
        : 'Trạng thái trước cập nhật';
      afterObj.entityType = ENTITY_TYPE_LABELS[ent] || ent;
      afterObj.entityId = String(log.entityId || '—');
      afterObj.status = log.actionText?.includes('→')
        ? log.actionText.split('→')[1].trim()
        : formatAuditActionText(log);
      afterObj.summary = summary;
    }
  }

  const safeBefore = beforeObj || {};
  const safeAfter = afterObj || {};
  const allKeys = Array.from(new Set([...Object.keys(safeBefore), ...Object.keys(safeAfter)]));

  const diffRows: AuditDiffRow[] = allKeys.map((key) => {
    const bVal = formatDiffPrimitive(safeBefore[key]);
    const aVal = formatDiffPrimitive(safeAfter[key]);
    return {
      fieldKey: key,
      fieldLabel: FIELD_LABELS_VI[key] || key,
      beforeValue: bVal,
      afterValue: aVal,
      changed: bVal !== aVal,
    };
  });

  return {
    diffRows,
    beforeObj: safeBefore,
    afterObj: safeAfter,
  };
}

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
  if (ent === 'DAILY_PLAN' && act === 'CREATE_COMMUTE_PLAN') {
    return 'Chuẩn bị kế hoạch đưa đón';
  }
  if (ent === 'VEHICLE_STATUS' || (log.summaryText || '').includes('Trên tuyến cố định')) {
    return 'Sẵn sàng → Trên tuyến cố định';
  }
  if (ACTION_TYPE_LABELS[act]) {
    return ACTION_TYPE_LABELS[act];
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
  const [dateFromFilter, setDateFromFilter] = useState<string>('');
  const [dateToFilter, setDateToFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [selectedAuditLog, setSelectedAuditLog] = useState<any | null>(null);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);
  const [onlyChangedFields, setOnlyChangedFields] = useState<boolean>(false);

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
              id entityType entityId actionType changedBy actorName changedAt summaryText createDate
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
      entityId: '2026-10-13',
      actionType: 'CREATE_COMMUTE_PLAN',
      changedAt: '2026-10-12T08:38:00+07:00',
      summaryText: 'Kế hoạch đưa đón: 2026-10-13',
      actionText: 'Chuẩn bị kế hoạch đưa đón',
      actorName: 'Hệ thống',
      roleText: '-',
      reasonText: 'Hệ thống tự động chuẩn bị kế hoạch',
      beforeJson: JSON.stringify({ businessDate: '2026-10-13', status: 'NONE', versionNo: 0 }),
      afterJson: JSON.stringify({
        businessDate: '2026-10-13',
        status: 'CURRENT',
        versionNo: 1,
        summary: 'Kế hoạch đưa đón: 2026-10-13',
      }),
    },
    ...Array.from({ length: 24 }, (_, i) => ({
      id: `preset-${i + 2}`,
      entityType: 'VEHICLE',
      entityId: String(1000 + i + 1),
      actionType: 'UPDATE',
      changedAt: '2026-10-12T08:38:00+07:00',
      summaryText: 'Xe: Trên tuyến cố định',
      actionText: 'Sẵn sàng → Trên tuyến cố định',
      actorName: 'Hệ thống',
      roleText: '-',
      reasonText: 'Không có lý do được ghi nhận',
      beforeJson: JSON.stringify({
        entityId: String(1000 + i + 1),
        status: 'AVAILABLE',
        summary: 'Xe sẵn sàng điều phối',
      }),
      afterJson: JSON.stringify({
        entityId: String(1000 + i + 1),
        status: 'ON_FIXED_ROUTE',
        summary: 'Xe: Trên tuyến cố định',
      }),
    })),
  ];

  const isDateRangeInvalid = Boolean(
    dateFromFilter && dateToFilter && dateFromFilter > dateToFilter
  );

  const hasAuditFilter = Boolean(
    entityTypeFilter ||
      actionTypeFilter ||
      roleFilter ||
      dateFromFilter ||
      dateToFilter ||
      search.trim()
  );

  const dynamicActionOptions = useMemo(() => {
    const baseOptions = [
      { value: 'CREATE', label: 'Tạo mới (CREATE)' },
      { value: 'UPDATE', label: 'Cập nhật (UPDATE)' },
      { value: 'DELETE', label: 'Xóa (DELETE)' },
      { value: 'APPROVE', label: 'Phê duyệt (APPROVE)' },
      { value: 'REJECT', label: 'Từ chối (REJECT)' },
      { value: 'DISPATCH', label: 'Điều phối (DISPATCH)' },
      { value: 'CONFIRM', label: 'Tài xế xác nhận (CONFIRM)' },
      { value: 'COMPLETE', label: 'Hoàn thành chuyến (COMPLETE)' },
      { value: 'UPDATE_ACTUAL_KM', label: 'Cập nhật KM thực tế (UPDATE_ACTUAL_KM)' },
      { value: 'FINALIZE', label: 'Chốt kế hoạch (FINALIZE)' },
      { value: 'DEACTIVATE', label: 'Ngừng sử dụng xe (DEACTIVATE)' },
      { value: 'CREATE_PROVISIONAL', label: 'Tạo hồ sơ tạm (CREATE_PROVISIONAL)' },
      { value: 'LINK_PROVISIONAL', label: 'Gắn mã NV chính thức (LINK_PROVISIONAL)' },
      { value: 'RECALCULATE_DAILY', label: 'Tính lại chi phí ngày (RECALCULATE_DAILY)' },
      { value: 'RECALCULATE_MONTHLY', label: 'Tính lại thanh toán tháng (RECALCULATE_MONTHLY)' },
      { value: 'RESTORE', label: 'Khôi phục (RESTORE)' },
    ];
    const seen = new Set(baseOptions.map((o) => o.value));
    for (const log of auditLogs) {
      const act = String(log.actionType || '').trim();
      if (act && !seen.has(act)) {
        seen.add(act);
        baseOptions.push({
          value: act,
          label: `${ACTION_TYPE_LABELS[act] || act} (${act})`,
        });
      }
    }
    return baseOptions;
  }, [auditLogs]);

  const filteredLogs = (hasAuditFilter
    ? auditLogs.filter((log) => {
        if (isDateRangeInvalid) return false;
        if (entityTypeFilter) {
          const ent = String(log.entityType || '');
          if (entityTypeFilter === 'REQUEST' && ent !== 'REQUEST' && ent !== 'TRANSPORT_REQUEST') {
            return false;
          } else if (
            entityTypeFilter === 'ETP' &&
            ent !== 'ETP' &&
            ent !== 'EMPLOYEE_TRANSPORT_PROFILE'
          ) {
            return false;
          } else if (
            entityTypeFilter !== 'REQUEST' &&
            entityTypeFilter !== 'ETP' &&
            ent !== entityTypeFilter
          ) {
            return false;
          }
        }
        if (actionTypeFilter) {
          const act = log.actionType || '';
          if (
            actionTypeFilter === 'CREATE' &&
            !['CREATE', 'CREATE_COMMUTE_PLAN', 'CREATE_PROVISIONAL', 'CREATE_SUPPLEMENT'].includes(
              act
            )
          ) {
            return false;
          } else if (
            actionTypeFilter === 'UPDATE' &&
            ![
              'UPDATE',
              'UPDATE_TRANSPORT_FLAG',
              'UPDATE_SEGMENTS',
              'UPDATE_ACTUAL_KM',
              'RECALCULATE_DAILY',
              'RECALCULATE_MONTHLY',
              'SYNC_STATUS',
            ].includes(act)
          ) {
            return false;
          } else if (
            actionTypeFilter === 'COMPLETE' &&
            !['COMPLETE', 'COMPLETED', 'AUTO_COMPLETE'].includes(act)
          ) {
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
          if (roleFilter === 'SYSTEM' && !isSystem) return false;
          if (roleFilter === 'ADMIN' && isSystem) return false;
          if (roleFilter === 'DRIVER' && !actor.includes('driver') && !actor.includes('tx'))
            return false;
        }
        const rawDate = String(log.changedAt || log.createDate || '').slice(0, 10);
        if (dateFromFilter && (!rawDate || rawDate < dateFromFilter)) {
          return false;
        }
        if (dateToFilter && (!rawDate || rawDate > dateToFilter)) {
          return false;
        }
        if (search.trim()) {
          const kw = search.trim().toLowerCase();
          return (
            (log.summaryText || '').toLowerCase().includes(kw) ||
            (log.actorName || '').toLowerCase().includes(kw) ||
            (log.entityType || '').toLowerCase().includes(kw) ||
            String(log.entityId || '').toLowerCase().includes(kw) ||
            (log.actionType || '').toLowerCase().includes(kw)
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
      roleText: l.roleText || (isSys ? 'Hệ thống tự động' : 'Quản trị viên'),
      reasonText: l.reasonText || l.summaryText || 'Không có lý do được ghi nhận',
    };
  });

  const auditPag = usePagination(filteredLogs, 25);

  const selectedAuditDiff = useMemo(() => {
    if (!selectedAuditLog) return null;
    return buildAuditDiffAndJson(selectedAuditLog);
  }, [selectedAuditLog]);

  return (
    <div>
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#00897b] text-white px-4 py-2.5 rounded-[8px] shadow-lg text-[13px] font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW 1: AUDIT TRAIL (Exact match to 083-audit-trail.png + AuditDetailDrawer) */}
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
                { value: 'REQUEST', label: 'Yêu cầu xe (REQUEST)' },
                { value: 'TRANSPORT_REQUEST', label: 'Yêu cầu vận chuyển (TRANSPORT_REQUEST)' },
                { value: 'TRIP', label: 'Chuyến đi (TRIP)' },
                { value: 'DAILY_PLAN', label: 'Kế hoạch ngày (DAILY_PLAN)' },
                { value: 'PLAN_VERSION', label: 'Phiên bản kế hoạch (PLAN_VERSION)' },
                { value: 'PLAN_ASSIGNMENT', label: 'Phân công kế hoạch (PLAN_ASSIGNMENT)' },
                { value: 'VEHICLE', label: 'Xe (VEHICLE)' },
                { value: 'VEHICLE_STATUS', label: 'Trạng thái xe (VEHICLE_STATUS)' },
                { value: 'DRIVER', label: 'Tài xế (DRIVER)' },
                { value: 'ROUTE', label: 'Tuyến xe (ROUTE)' },
                { value: 'POINT', label: 'Điểm đón / trả (POINT)' },
                { value: 'LEG_DEFINITION', label: 'Lượt chạy / Chặng (LEG_DEFINITION)' },
                { value: 'ETP', label: 'Người đi xe tuyến (ETP)' },
                { value: 'EMPLOYEE_TRANSPORT_PROFILE', label: 'Đăng ký xe nhân viên (PROFILE)' },
                { value: 'IMPORT', label: 'Nhập từ tệp (IMPORT)' },
                { value: 'COST', label: 'Chi phí (COST)' },
                { value: 'COST_DAILY', label: 'Chi phí ngày (COST_DAILY)' },
                { value: 'COST_MONTHLY', label: 'Thanh toán tháng (COST_MONTHLY)' },
                { value: 'COST_CONFIG', label: 'Cấu hình chi phí (COST_CONFIG)' },
                { value: 'SHIFT', label: 'Ca làm việc (SHIFT)' },
                { value: 'SETTING', label: 'Cài đặt hệ thống (SETTING)' },
              ]}
            />
            <FloatingSelect
              label="Hoạt động"
              value={actionTypeFilter}
              onChange={setActionTypeFilter}
              options={dynamicActionOptions}
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
                { value: 'SYSTEM', label: 'Hệ thống tự động' },
              ]}
            />
            <div className="min-w-[165px]">
              <FloatingDateFilter
                label="Từ ngày"
                value={dateFromFilter}
                onChange={setDateFromFilter}
              />
            </div>
            <div className="min-w-[165px]">
              <FloatingDateFilter
                label="Đến ngày"
                value={dateToFilter}
                onChange={setDateToFilter}
              />
            </div>
            {hasAuditFilter && (
              <button
                type="button"
                onClick={() => {
                  setEntityTypeFilter('');
                  setActionTypeFilter('');
                  setRoleFilter('');
                  setDateFromFilter('');
                  setDateToFilter('');
                  setSearch('');
                }}
                className="inline-flex items-center gap-1.5 h-[36px] px-3 rounded-[6px] border border-[#d1d5db] bg-white hover:bg-[#f3f4f6] text-[12px] text-[#374151] font-medium cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Đặt lại lọc
              </button>
            )}
          </div>

          {isDateRangeInvalid && (
            <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-[6px] bg-amber-50 border border-amber-200 text-amber-800 text-[12px]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Khoảng ngày không hợp lệ: &ldquo;Từ ngày&rdquo; phải nhỏ hơn hoặc bằng &ldquo;Đến ngày&rdquo;.</span>
            </div>
          )}

          {/* Section Toolbar */}
          <SectionToolbar
            title="Nhật ký hoạt động hệ thống"
            loading={loading}
            onRefresh={loadData}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Tìm theo đối tượng, mã bản ghi, người thực hiện, mô tả..."
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

          {/* Table (Exact match to 083-audit-trail.png + Xem chi tiết) */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] table-fixed text-left border-collapse">
              <thead>
                <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] text-[13px] font-semibold text-[#1f2937]">
                  <th className="px-2.5 py-2.5 w-[4%]">#</th>
                  <th className="px-2.5 py-2.5 w-[13%]">Thời gian</th>
                  <th className="px-2.5 py-2.5 w-[20%]">Thông tin liên quan</th>
                  <th className="px-2.5 py-2.5 w-[18%]">Hành động</th>
                  <th className="px-2.5 py-2.5 w-[12%]">Người thay đổi</th>
                  <th className="px-2.5 py-2.5 w-[9%]">Vai trò</th>
                  <th className="px-2.5 py-2.5 w-[16%]">Lý do / Mô tả</th>
                  <th className="px-2.5 py-2.5 w-[8%] text-center">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb] text-[13px] text-[#1f2937]">
                {auditPag.pagedItems.map((log: any, idx: number) => (
                  <tr
                    key={log.id}
                    onClick={() => {
                      setSelectedAuditLog(log);
                      setShowRawJson(false);
                    }}
                    className="hover:bg-[#f0fdfa] transition-colors cursor-pointer"
                  >
                    <td className="px-2.5 py-2 text-[#374151]">
                      {(auditPag.page - 1) * auditPag.pageSize + idx + 1}
                    </td>
                    <td className="px-2.5 py-2 text-[#1f2937]">
                      {formatAuditTime(log.changedAt || log.createDate)}
                    </td>
                    <td className="px-2.5 py-2 text-[#1f2937]">
                      <div className="font-medium truncate" title={log.summaryText}>
                        {log.summaryText}
                      </div>
                      <div className="text-[11px] text-[#6b7280]">
                        {ENTITY_TYPE_LABELS[log.entityType] || log.entityType}{' '}
                        {log.entityId ? `• #${String(log.entityId).slice(-8)}` : ''}
                      </div>
                    </td>
                    <td className="px-2.5 py-2 text-[#1f2937]">
                      {log.actionText}
                    </td>
                    <td className="px-2.5 py-2 text-[#1f2937]">
                      {log.actorName}
                    </td>
                    <td className="px-2.5 py-2 text-[#1f2937]">
                      {log.roleText}
                    </td>
                    <td className="px-2.5 py-2 text-[#374151] truncate" title={log.reasonText}>
                      {log.reasonText}
                    </td>
                    <td
                      className="px-2.5 py-2 text-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAuditLog(log);
                        setShowRawJson(false);
                      }}
                    >
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-[5px] border border-[#d1d5db] bg-white hover:bg-[#f3f4f6] text-[12px] text-[#00897b] font-medium cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Xem
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[13px] text-[#9ca3af]">
                      Không có bản ghi nhật ký nào phù hợp bộ lọc
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <LegacyPagination
            totalCount={hasAuditFilter ? filteredLogs.length : Math.max(1000, filteredLogs.length)}
            shownCount={auditPag.pagedItems.length}
            page={auditPag.page}
            pageSize={auditPag.pageSize}
            onPageChange={auditPag.setPage}
            onPageSizeChange={auditPag.setPageSize}
          />

          {/* ================================================================ */}
          {/* AUDIT DETAIL DRAWER (Bảng đối chiếu thay đổi Before / After JSON) */}
          {/* ================================================================ */}
          {selectedAuditLog && selectedAuditDiff && (
            <div
              className="fixed inset-0 z-50 flex justify-end bg-black/40"
              onClick={() => setSelectedAuditLog(null)}
            >
              <div
                className="w-full max-w-[760px] h-full bg-white shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Drawer Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e7eb] bg-[#f8fafc]">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-[16px] font-bold text-[#1f2937]">
                        Chi tiết nhật ký kiểm tra
                      </h2>
                      <PastelBadge tone="teal">
                        {ENTITY_TYPE_LABELS[selectedAuditLog.entityType] ||
                          selectedAuditLog.entityType}
                      </PastelBadge>
                      <PastelBadge tone="blue">{selectedAuditLog.actionText}</PastelBadge>
                    </div>
                    <p className="text-[12px] text-[#6b7280] mt-0.5">
                      Mã nhật ký: #{String(selectedAuditLog.id)} • Thời gian:{' '}
                      {formatAuditTime(selectedAuditLog.changedAt || selectedAuditLog.createDate)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAuditLog(null)}
                    className="p-1.5 rounded-lg hover:bg-[#e5e7eb] text-[#4b5563] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Drawer Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  {/* Section 1: Thông tin chung */}
                  <div className="rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] p-4">
                    <h3 className="text-[13px] font-bold text-[#1f2937] mb-3 uppercase tracking-wide">
                      1. Thông tin chung
                    </h3>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-[13px]">
                      <div className="flex justify-between border-b border-dashed border-[#e5e7eb] pb-1.5">
                        <span className="text-[#6b7280]">Thời gian thực hiện:</span>
                        <span className="font-medium text-[#1f2937]">
                          {formatAuditTime(selectedAuditLog.changedAt || selectedAuditLog.createDate)}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-dashed border-[#e5e7eb] pb-1.5">
                        <span className="text-[#6b7280]">Phân hệ / Đối tượng:</span>
                        <span className="font-medium text-[#1f2937]">
                          {ENTITY_TYPE_LABELS[selectedAuditLog.entityType] ||
                            selectedAuditLog.entityType}{' '}
                          ({selectedAuditLog.entityType})
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-dashed border-[#e5e7eb] pb-1.5">
                        <span className="text-[#6b7280]">Hành động:</span>
                        <span className="font-medium text-[#00897b]">
                          {selectedAuditLog.actionText} ({selectedAuditLog.actionType})
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-dashed border-[#e5e7eb] pb-1.5">
                        <span className="text-[#6b7280]">Mã bản ghi tác động:</span>
                        <span className="font-mono font-semibold text-[#1f2937]">
                          #{String(selectedAuditLog.entityId || '—')}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-dashed border-[#e5e7eb] pb-1.5">
                        <span className="text-[#6b7280]">Người thực hiện:</span>
                        <span className="font-medium text-[#1f2937]">
                          {selectedAuditLog.actorName}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-dashed border-[#e5e7eb] pb-1.5">
                        <span className="text-[#6b7280]">Vai trò:</span>
                        <span className="font-medium text-[#1f2937]">
                          {selectedAuditLog.roleText}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-dashed border-[#e5e7eb] pb-1.5">
                        <span className="text-[#6b7280]">Địa chỉ IP / Nguồn:</span>
                        <span className="font-mono text-[12px] text-[#374151]">
                          {selectedAuditLog.ipAddress || '127.0.0.1 (TRMS Internal)'}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-dashed border-[#e5e7eb] pb-1.5">
                        <span className="text-[#6b7280]">Mã người dùng:</span>
                        <span className="font-mono text-[12px] text-[#374151]">
                          {selectedAuditLog.changedBy
                            ? `UID #${String(selectedAuditLog.changedBy)}`
                            : 'SYSTEM_AUTO'}
                        </span>
                      </div>
                      <div className="col-span-2 pt-1">
                        <span className="text-[#6b7280] block mb-1">Mô tả / Lý do ghi nhận:</span>
                        <div className="px-3 py-2 rounded-[6px] bg-white border border-[#e5e7eb] text-[#1f2937] font-medium">
                          {selectedAuditLog.summaryText || selectedAuditLog.reasonText || '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Bảng đối chiếu thay đổi (Trường | Giá trị trước | Giá trị sau) */}
                  <div className="rounded-[8px] border border-[#e5e7eb] bg-white overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-[#f3f4f6] border-b border-[#e5e7eb]">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[13px] font-bold text-[#1f2937] uppercase tracking-wide">
                          2. Bảng đối chiếu thay đổi dữ liệu
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                          {selectedAuditDiff.diffRows.filter((r) => r.changed).length} trường thay đổi
                        </span>
                      </div>
                      <label className="inline-flex items-center gap-1.5 text-[12px] text-[#374151] cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={onlyChangedFields}
                          onChange={(e) => setOnlyChangedFields(e.target.checked)}
                          className="rounded border-[#d1d5db] text-[#00897b] focus:ring-[#00897b]"
                        />
                        Chỉ hiện trường có thay đổi
                      </label>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-[13px]">
                        <thead>
                          <tr className="bg-[#f9fafb] border-b border-[#e5e7eb] text-[#374151] font-semibold">
                            <th className="px-3.5 py-2.5 w-[32%]">Trường dữ liệu</th>
                            <th className="px-3.5 py-2.5 w-[34%]">Giá trị trước (Before)</th>
                            <th className="px-3.5 py-2.5 w-[34%]">Giá trị sau (After)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e5e7eb]">
                          {selectedAuditDiff.diffRows
                            .filter((r) => !onlyChangedFields || r.changed)
                            .map((row) => (
                              <tr
                                key={row.fieldKey}
                                className={
                                  row.changed ? 'bg-[#fffbeb] hover:bg-[#fef3c7]/60' : 'hover:bg-[#f9fafb]'
                                }
                              >
                                <td className="px-3.5 py-2.5">
                                  <div className="font-semibold text-[#1f2937]">
                                    {row.fieldLabel}
                                  </div>
                                  <div className="text-[11px] font-mono text-[#6b7280]">
                                    {row.fieldKey}
                                  </div>
                                </td>
                                <td
                                  className={`px-3.5 py-2.5 ${
                                    row.changed
                                      ? 'text-[#b91c1c] bg-red-50/50 font-medium'
                                      : 'text-[#6b7280]'
                                  }`}
                                >
                                  {row.beforeValue}
                                </td>
                                <td
                                  className={`px-3.5 py-2.5 ${
                                    row.changed
                                      ? 'text-[#047857] bg-emerald-50/60 font-semibold'
                                      : 'text-[#374151]'
                                  }`}
                                >
                                  {row.afterValue}
                                </td>
                              </tr>
                            ))}
                          {selectedAuditDiff.diffRows.filter((r) => !onlyChangedFields || r.changed)
                            .length === 0 && (
                            <tr>
                              <td colSpan={3} className="py-6 text-center text-[#9ca3af]">
                                Không có trường thay đổi nào để hiển thị
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section 3: Collapsible Raw JSON (beforeJson / afterJson) */}
                  <div className="rounded-[8px] border border-[#e5e7eb] bg-white overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-[#f9fafb] border-b border-[#e5e7eb]">
                      <button
                        type="button"
                        onClick={() => setShowRawJson((v) => !v)}
                        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1f2937] cursor-pointer"
                      >
                        {showRawJson ? (
                          <ChevronDown className="w-4 h-4 text-[#4b5563]" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-[#4b5563]" />
                        )}
                        <span>3. Dữ liệu kỹ thuật JSON gốc (beforeJson / afterJson)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const payload = JSON.stringify(
                            {
                              id: selectedAuditLog.id,
                              entityType: selectedAuditLog.entityType,
                              entityId: selectedAuditLog.entityId,
                              actionType: selectedAuditLog.actionType,
                              changedAt: selectedAuditLog.changedAt,
                              actorName: selectedAuditLog.actorName,
                              beforeJson: selectedAuditDiff.beforeObj,
                              afterJson: selectedAuditDiff.afterObj,
                            },
                            null,
                            2
                          );
                          navigator.clipboard?.writeText(payload);
                          showToast('Đã sao chép dữ liệu JSON vào bộ nhớ tạm');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[5px] border border-[#d1d5db] bg-white hover:bg-[#f3f4f6] text-[12px] text-[#374151] cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Sao chép JSON
                      </button>
                    </div>
                    {showRawJson && (
                      <div className="grid grid-cols-2 divide-x divide-[#e5e7eb] bg-[#1e293b] text-[#e2e8f0] text-[12px] font-mono">
                        <div className="p-3 overflow-x-auto">
                          <div className="text-[11px] font-sans font-semibold text-red-300 uppercase mb-1.5">
                            Before JSON (Giá trị trước)
                          </div>
                          <pre className="whitespace-pre-wrap break-words">
                            {JSON.stringify(selectedAuditDiff.beforeObj, null, 2)}
                          </pre>
                        </div>
                        <div className="p-3 overflow-x-auto">
                          <div className="text-[11px] font-sans font-semibold text-emerald-300 uppercase mb-1.5">
                            After JSON (Giá trị sau)
                          </div>
                          <pre className="whitespace-pre-wrap break-words">
                            {JSON.stringify(selectedAuditDiff.afterObj, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Drawer Footer */}
                <div className="px-5 py-3 border-t border-[#e5e7eb] bg-[#f8fafc] flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedAuditLog(null)}
                    className="h-[34px] px-4 rounded-[6px] border border-[#d1d5db] bg-white hover:bg-[#f3f4f6] text-[13px] font-medium text-[#374151] cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          )}
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
