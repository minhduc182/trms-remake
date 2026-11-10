import React, { useEffect, useMemo, useState } from 'react';
import {
  List,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Clock,
  UserCheck,
  AlertTriangle,
  Settings,
  Eye,
  Lock,
} from 'lucide-react';
import { gqlRequest } from '../lib/graphql';
import {
  FloatingDateFilter,
  FloatingSelect,
  SectionToolbar,
  LegacyPagination,
  PastelBadge,
  usePagination,
  exportTableToCsv,
} from '../components/legacy-ui';

function formatDdMmYyyy(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
}

function formatShiftTimeRange(startTime?: string | null, endTime?: string | null): string {
  if (!startTime && !endTime) return '—';
  const fmt = (t?: string | null) => {
    if (!t) return '';
    return t.includes(':') ? t : `${t}:00`;
  };
  return `${fmt(startTime)} - ${fmt(endTime)}`;
}

export const ShiftsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // 7-day Shift Registration Grid filters & data
  const [startDate, setStartDate] = useState<string>('2026-10-12');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [subjectTypeFilter, setSubjectTypeFilter] = useState<string>('');
  const [searchEmp, setSearchEmp] = useState<string>('');
  const [windowDates, setWindowDates] = useState<string[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);

  // Real lookups from DB
  const [orgUnits, setOrgUnits] = useState<any[]>([]);
  const [etpByEmpCode, setEtpByEmpCode] = useState<Record<string, any>>({});

  // Shift Catalog Modal state
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [shifts, setShifts] = useState<any[]>([]);
  const [transportFlagFilter, setTransportFlagFilter] = useState<string>('');
  const [masterFlagFilter, setMasterFlagFilter] = useState<string>('');
  const [activeFlagFilter, setActiveFlagFilter] = useState<string>('');
  const [searchShift, setSearchShift] = useState<string>('');

  // Employee Shift Detail Drawer
  const [selectedEmpRow, setSelectedEmpRow] = useState<any | null>(null);

  // Shift Config Edit Modal
  const [editingShift, setEditingShift] = useState<{
    id: string;
    shiftCode: string;
    shiftName: string;
    masterFlag: string;
    startTime: string;
    endTime: string;
    activeFlag: string;
    transportFlag: string;
    segmentUsageCount: number;
  } | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const getSevenDatesFallback = (baseDateStr: string): string[] => {
    const base = new Date(`${baseDateStr || '2026-10-12'}T00:00:00Z`);
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(base.getTime() + i * 24 * 3600 * 1000);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  };

  const loadLookups = async () => {
    try {
      const res = await gqlRequest<{
        orgUnits: any[];
        shifts: any[];
        etpProfiles: any[];
      }>(`
        query LoadShiftPageLookups {
          orgUnits {
            id
            unitCode
            name
          }
          shifts {
            id
            shiftCode
            shiftName
            startTime
            endTime
            workHours
            activeFlag
            masterFlag
            transportFlag
            segmentUsageCount
          }
          etpProfiles(limit: 500) {
            id
            employeeCode
            employeeName
            departmentName
            passengerType
            route {
              id
              routeCode
              routeName
            }
          }
        }
      `);
      setOrgUnits(res.orgUnits || []);
      setShifts(res.shifts || []);
      const map: Record<string, any> = {};
      for (const p of res.etpProfiles || []) {
        if (p.employeeCode) {
          map[String(p.employeeCode).trim().toUpperCase()] = p;
        }
      }
      setEtpByEmpCode(map);
    } catch {
      // ignore
    }
  };

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const res = await gqlRequest<{
        shiftRegistrations: { windowDates: string[]; rows: any[] };
      }>(
        `query GetShiftRegistrations($startDate: String!, $departmentName: String, $search: String) {
          shiftRegistrations(
            startDate: $startDate
            departmentName: $departmentName
            search: $search
            limit: 300
          ) {
            windowDates
            rows {
              employeeCode
              employeeName
              departmentName
              dailyShifts
              invalidDays
            }
          }
        }`,
        {
          startDate: startDate || '2026-10-12',
          departmentName: departmentFilter || undefined,
          search: searchEmp || undefined,
        }
      );
      const dates =
        res.shiftRegistrations?.windowDates?.length === 7
          ? res.shiftRegistrations.windowDates
          : getSevenDatesFallback(startDate);
      setWindowDates(dates);

      const rows = res.shiftRegistrations?.rows || [];
      setRegistrations(
        rows.map((r, idx) => ({
          id: `${r.employeeCode}-${idx}`,
          empCode: r.employeeCode,
          fullName: r.employeeName,
          departmentName: r.departmentName,
          days: r.dailyShifts || [],
          invalidDays: r.invalidDays || [],
        }))
      );
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadShiftsCatalog = async () => {
    try {
      const res = await gqlRequest<{ shifts: any[] }>(
        `query GetShifts(
          $transportFlag: String
          $masterFlag: String
          $activeFlag: String
          $search: String
        ) {
          shifts(
            transportFlag: $transportFlag
            masterFlag: $masterFlag
            activeFlag: $activeFlag
            search: $search
          ) {
            id
            shiftCode
            shiftName
            startTime
            endTime
            workHours
            activeFlag
            masterFlag
            transportFlag
            segmentUsageCount
          }
        }`,
        {
          transportFlag: transportFlagFilter || undefined,
          masterFlag: masterFlagFilter || undefined,
          activeFlag: activeFlagFilter || undefined,
          search: searchShift || undefined,
        }
      );
      setShifts(res.shifts || []);
    } catch (err: any) {
      alert(err.message);
    }
  };

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [startDate, departmentFilter]);

  useEffect(() => {
    if (catalogOpen) {
      loadShiftsCatalog();
    }
  }, [catalogOpen, transportFlagFilter, masterFlagFilter, activeFlagFilter]);

  const handleToggleTransportFlag = async (sh: any) => {
    const nextFlag = sh.transportFlag === 'Y' ? 'N' : 'Y';
    if (nextFlag === 'N' && Number(sh.segmentUsageCount || 0) > 0) {
      alert(
        `Ca làm việc ${sh.shiftCode} đang được gắn trong ${sh.segmentUsageCount} lượt chạy của tuyến cố định, không thể tắt cờ Đưa đón.`
      );
      return;
    }
    try {
      await gqlRequest(
        `mutation ToggleShiftTransport($id: BigInt!, $transportFlag: String!) {
          updateShiftTransportFlag(id: $id, transportFlag: $transportFlag) {
            id
            transportFlag
          }
        }`,
        { id: sh.id, transportFlag: nextFlag }
      );
      showToast(
        `Đã ${nextFlag === 'Y' ? 'bật' : 'tắt'} cờ Đưa đón cho mã ca ${sh.shiftCode}`
      );
      loadShiftsCatalog();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveShiftEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShift) return;
    try {
      await gqlRequest(
        `mutation SaveShiftTransportFlag($id: BigInt!, $transportFlag: String!) {
          updateShiftTransportFlag(id: $id, transportFlag: $transportFlag) {
            id
            transportFlag
          }
        }`,
        {
          id: editingShift.id,
          transportFlag: editingShift.transportFlag,
        }
      );
      // Update local state for shift metadata & reload catalog
      setShifts((prev) =>
        prev.map((s) =>
          String(s.id) === String(editingShift.id)
            ? {
                ...s,
                shiftName: editingShift.shiftName,
                startTime: editingShift.startTime,
                endTime: editingShift.endTime,
                masterFlag: editingShift.masterFlag,
                activeFlag: editingShift.activeFlag,
                transportFlag: editingShift.transportFlag,
              }
            : s
        )
      );
      showToast(`Đã lưu cấu hình ca làm việc ${editingShift.shiftCode}`);
      setEditingShift(null);
      loadShiftsCatalog();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const sevenDates =
    windowDates.length === 7 ? windowDates : getSevenDatesFallback(startDate);

  const shiftByCode = useMemo(() => {
    const map = new Map<string, any>();
    for (const s of shifts) {
      if (s.shiftCode) {
        map.set(String(s.shiftCode).trim().toUpperCase(), s);
      }
    }
    return map;
  }, [shifts]);

  const distinctDepartments = useMemo(() => {
    const set = new Set<string>();
    for (const ou of orgUnits) {
      if (ou.name && ou.name.trim() && ou.name.trim() !== '-') {
        set.add(ou.name.trim());
      }
    }
    for (const r of registrations) {
      const d = String(r.departmentName || '').trim();
      if (d && d !== '-' && d !== '—') {
        set.add(d);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [orgUnits, registrations]);

  const getEmployeeSubjectType = (row: any): 'STAFF' | 'EXPERT' | 'WORKER' => {
    const code = String(row.empCode || '').trim().toUpperCase();
    const etp = etpByEmpCode[code];
    if (code.startsWith('EXP') || (row.departmentName || '').toLowerCase().includes('chuyên gia')) {
      return 'EXPERT';
    }
    if (etp?.passengerType === 'WORKER') return 'WORKER';
    if (etp?.passengerType === 'STAFF') return 'STAFF';
    if (
      (row.departmentName || '').toLowerCase().includes('sản xuất') &&
      (row.days || []).some((d: string) => ['C1', 'C2', 'C3'].includes(d))
    ) {
      return 'WORKER';
    }
    return 'STAFF';
  };

  const filteredRegistrations = useMemo(() => {
    const kw = searchEmp.trim().toLowerCase();
    return registrations
      .filter(
        (r) =>
          !departmentFilter ||
          String(r.departmentName || '')
            .toLowerCase()
            .includes(departmentFilter.toLowerCase())
      )
      .filter((r) => {
        if (!subjectTypeFilter) return true;
        return getEmployeeSubjectType(r) === subjectTypeFilter;
      })
      .filter(
        (r) =>
          !kw ||
          String(r.empCode || '').toLowerCase().includes(kw) ||
          String(r.fullName || '').toLowerCase().includes(kw) ||
          String(r.departmentName || '').toLowerCase().includes(kw) ||
          (r.days || []).some((d: string) => String(d || '').toLowerCase().includes(kw))
      );
  }, [registrations, departmentFilter, subjectTypeFilter, searchEmp, etpByEmpCode]);

  const shiftsPaging = usePagination(filteredRegistrations, 20);

  return (
    <div>
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#00897b] text-white px-4 py-2.5 rounded-[8px] shadow-lg text-[13px] font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}

      {/* 1. Top Filters Row */}
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <FloatingDateFilter
          label="Ngày bắt đầu"
          value={startDate}
          onChange={setStartDate}
          floatingAlways
        />
        <FloatingSelect
          label="Phòng ban"
          value={departmentFilter}
          onChange={setDepartmentFilter}
          options={distinctDepartments.map((d) => ({ value: d, label: d }))}
        />
        <FloatingSelect
          label="Loại đối tượng"
          value={subjectTypeFilter}
          onChange={setSubjectTypeFilter}
          options={[
            { value: 'STAFF', label: 'Nhân viên / Kỹ sư (STAFF)' },
            { value: 'EXPERT', label: 'Chuyên gia (EXPERT)' },
            { value: 'WORKER', label: 'Công nhân sản xuất (WORKER)' },
          ]}
        />
      </div>

      {/* 2. Section Toolbar Row */}
      <SectionToolbar
        title="Danh sách đăng ký ca"
        loading={loading}
        onRefresh={loadSchedule}
        search={searchEmp}
        onSearchChange={setSearchEmp}
        onSearchSubmit={loadSchedule}
        showCustomize
        primaryButton={{
          label: 'Danh sách ca làm việc',
          icon: <List className="w-4 h-4" />,
          onClick: () => setCatalogOpen(true),
          splitItems: [
            {
              label: 'Cấu hình cờ xe đưa đón theo ca',
              onClick: () => setCatalogOpen(true),
            },
            {
              label: 'Xuất excel lịch phân ca 7 ngày',
              onClick: () => {
                exportTableToCsv('danh-sach-dang-ky-ca-7-ngay');
                showToast('Đã xuất Excel Danh sách đăng ký ca');
              },
            },
          ],
        }}
      />

      {/* 3. 7-Day Shift Registration Table */}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left border-collapse">
          <thead>
            <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] text-[13px] font-semibold text-[#1f2937]">
              <th className="px-2.5 w-[4%]">#</th>
              <th className="px-2.5 w-[9%]">Mã nhân viên</th>
              <th className="px-2.5 w-[14%]">Tên nhân viên</th>
              <th className="px-2.5 w-[17%]">Phòng ban</th>
              {sevenDates.map((d, idx) => (
                <th key={idx} className="px-2 w-[8%]">
                  {formatDdMmYyyy(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e7eb] text-[13px] text-[#1f2937]">
            {shiftsPaging.pagedItems.map((row, idx) => (
              <tr
                key={row.id}
                onClick={() => setSelectedEmpRow(row)}
                title="Nhấn để xem chi tiết phân ca & cấu hình ca làm việc"
                className="hover:bg-[#f9fafb] cursor-pointer transition-colors"
              >
                <td className="px-2.5 text-[#374151]">
                  {(shiftsPaging.page - 1) * shiftsPaging.pageSize + idx + 1}
                </td>
                <td className="px-2.5 font-medium text-[#0f766e] truncate">
                  {row.empCode}
                </td>
                <td className="px-2.5 text-[#1f2937] truncate">{row.fullName}</td>
                <td className="px-2.5 text-[#374151] truncate">
                  {row.departmentName && row.departmentName !== '-'
                    ? row.departmentName
                    : '—'}
                </td>
                {(row.days || []).map((shiftCode: string | null, dayIdx: number) => {
                  const isInvalid = row.invalidDays?.[dayIdx];
                  return (
                    <td key={dayIdx} className="px-2">
                      {isInvalid ? (
                        <PastelBadge label={shiftCode || 'Lỗi'} tone="red" />
                      ) : (
                        <span className="text-[#1f2937] font-medium">
                          {shiftCode || '—'}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {filteredRegistrations.length === 0 && (
              <tr>
                <td colSpan={11} className="py-10 text-center text-[13px] text-[#9ca3af]">
                  Không có dữ liệu đăng ký ca làm việc khớp với bộ lọc hiện tại
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <LegacyPagination
        totalCount={filteredRegistrations.length}
        shownCount={shiftsPaging.pagedItems.length}
        page={shiftsPaging.page}
        pageSize={shiftsPaging.pageSize}
        onPageChange={shiftsPaging.setPage}
        onPageSizeChange={shiftsPaging.setPageSize}
      />

      {/* ==================================================================== */}
      {/* DRAWER: CHI TIẾT PHÂN CA NHÂN VIÊN TRONG TUẦN */}
      {/* ==================================================================== */}
      {selectedEmpRow && (
        <div className="fixed inset-0 z-50 bg-black/35 flex justify-end">
          <div className="bg-white w-full max-w-[660px] h-full shadow-2xl border-l border-[#e5e7eb] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb] bg-[#f8fafc]">
              <div>
                <h3 className="text-[15px] font-bold text-[#1f2937]">
                  {selectedEmpRow.empCode} — {selectedEmpRow.fullName}
                </h3>
                <p className="text-[12px] text-[#6b7280] mt-0.5">
                  Phòng ban: {selectedEmpRow.departmentName || '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmpRow(null)}
                className="text-[#4b5563] hover:text-[#1f2937] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-[13px]">
              {/* Thông tin nhân sự & tuyến đăng ký */}
              <div className="border border-[#e5e7eb] rounded-[8px] p-4 bg-[#f8fafc] grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[#6b7280] text-[12px] block">Phân nhóm đối tượng:</span>
                  <span className="font-semibold text-[#1f2937]">
                    {getEmployeeSubjectType(selectedEmpRow) === 'EXPERT'
                      ? 'Chuyên gia (EXPERT)'
                      : getEmployeeSubjectType(selectedEmpRow) === 'WORKER'
                        ? 'Công nhân sản xuất (WORKER)'
                        : 'Nhân viên hành chính / Kỹ sư (STAFF)'}
                  </span>
                </div>
                <div>
                  <span className="text-[#6b7280] text-[12px] block">
                    Tuyến xe cố định đăng ký (ETP):
                  </span>
                  <span className="font-semibold text-[#0f766e]">
                    {etpByEmpCode[String(selectedEmpRow.empCode).toUpperCase()]?.route
                      ? `${etpByEmpCode[String(selectedEmpRow.empCode).toUpperCase()].route.routeCode} - ${etpByEmpCode[String(selectedEmpRow.empCode).toUpperCase()].route.routeName}`
                      : 'Chưa đăng ký tuyến cố định'}
                  </span>
                </div>
              </div>

              {/* Bảng lịch ca 7 ngày chi tiết */}
              <div className="border border-[#e5e7eb] rounded-[8px] overflow-hidden">
                <div className="bg-[#f3f4f6] px-4 py-2.5 font-bold text-[#1f2937] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#0f766e]" />
                    Chi tiết phân ca 7 ngày ({formatDdMmYyyy(sevenDates[0])} →{' '}
                    {formatDdMmYyyy(sevenDates[6])})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEmpRow(null);
                      setCatalogOpen(true);
                    }}
                    className="text-[12px] font-semibold text-[#00897b] hover:underline cursor-pointer"
                  >
                    Mở danh mục ca làm việc →
                  </button>
                </div>
                <table className="w-full text-left border-collapse text-[12px]">
                  <thead>
                    <tr className="border-b border-[#e5e7eb] bg-[#f8fafc] font-semibold text-[#374151]">
                      <th className="p-2.5">Ngày</th>
                      <th className="p-2.5">Mã ca</th>
                      <th className="p-2.5">Tên ca & Khung giờ</th>
                      <th className="p-2.5">Xe đưa đón</th>
                      <th className="p-2.5 text-right">Cấu hình ca</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e7eb]">
                    {sevenDates.map((d, idx) => {
                      const rawCode = selectedEmpRow.days?.[idx] || '-';
                      const isInvalid = selectedEmpRow.invalidDays?.[idx];
                      const firstCode = String(rawCode).split(',')[0].trim().toUpperCase();
                      const shiftObj = shiftByCode.get(firstCode);
                      return (
                        <tr key={d} className="hover:bg-[#f9fafb]">
                          <td className="p-2.5 font-medium text-[#1f2937]">
                            {formatDdMmYyyy(d)}
                          </td>
                          <td className="p-2.5">
                            {isInvalid ? (
                              <PastelBadge label={`${rawCode} (Không hợp lệ)`} tone="red" />
                            ) : (
                              <span className="font-bold text-[#0f766e]">{rawCode}</span>
                            )}
                          </td>
                          <td className="p-2.5 text-[#374151]">
                            {shiftObj ? (
                              <div>
                                <div className="font-medium text-[#1f2937]">
                                  {shiftObj.shiftName}
                                </div>
                                <div className="text-[11px] text-[#6b7280]">
                                  {formatShiftTimeRange(shiftObj.startTime, shiftObj.endTime)}
                                </div>
                              </div>
                            ) : rawCode === '-' ? (
                              <span className="text-[#9ca3af]">Nghỉ / Chưa phân ca</span>
                            ) : (
                              <span className="text-[#dc2626]">
                                Mã ca chưa có trong Danh mục ca
                              </span>
                            )}
                          </td>
                          <td className="p-2.5">
                            {shiftObj ? (
                              shiftObj.transportFlag === 'Y' ? (
                                <PastelBadge label="Có xe đưa đón" tone="green" />
                              ) : (
                                <PastelBadge label="Không đưa đón" tone="gray" />
                              )
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="p-2.5 text-right">
                            {shiftObj && (
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingShift({
                                    id: String(shiftObj.id),
                                    shiftCode: shiftObj.shiftCode,
                                    shiftName: shiftObj.shiftName,
                                    masterFlag: shiftObj.masterFlag || 'Y',
                                    startTime: shiftObj.startTime || '08:00',
                                    endTime: shiftObj.endTime || '17:00',
                                    activeFlag: shiftObj.activeFlag || 'Y',
                                    transportFlag: shiftObj.transportFlag || 'Y',
                                    segmentUsageCount: Number(
                                      shiftObj.segmentUsageCount || 0
                                    ),
                                  })
                                }
                                className="px-2.5 py-1 rounded bg-[#e0f2f1] text-[#00695c] font-medium hover:bg-[#b2dfdb] cursor-pointer"
                              >
                                Sửa ca
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-[#e5e7eb] bg-[#f8fafc] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEmpRow(null)}
                className="h-[34px] px-4 rounded-[6px] border border-[#d1d5db] bg-white text-[#374151] text-[12px] font-medium hover:bg-[#f3f4f6] cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: DANH SÁCH CA LÀM VIỆC */}
      {/* ==================================================================== */}
      {catalogOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-[#e5e7eb] w-full max-w-[1120px] p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-[#1f2937]">
                Danh sách ca làm việc
              </h3>
              <button
                type="button"
                onClick={() => setCatalogOpen(false)}
                className="text-[#ef4444] hover:text-[#dc2626] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <FloatingSelect
                label="Có xe đưa đón"
                value={transportFlagFilter}
                onChange={setTransportFlagFilter}
                options={[
                  { value: 'Y', label: 'Có xe đưa đón' },
                  { value: 'N', label: 'Không có xe đưa đón' },
                ]}
              />
              <FloatingSelect
                label="Loại ca (Chính / Phụ)"
                value={masterFlagFilter}
                onChange={setMasterFlagFilter}
                options={[
                  { value: 'Y', label: 'Ca chính' },
                  { value: 'N', label: 'Ca phụ / Làm thêm' },
                ]}
              />
              <FloatingSelect
                label="Trạng thái"
                value={activeFlagFilter}
                onChange={setActiveFlagFilter}
                options={[
                  { value: 'Y', label: 'Hoạt động' },
                  { value: 'N', label: 'Ngừng hoạt động' },
                ]}
              />
            </div>

            <SectionToolbar
              title=""
              loading={loading}
              onRefresh={loadShiftsCatalog}
              search={searchShift}
              onSearchChange={setSearchShift}
              onSearchSubmit={loadShiftsCatalog}
              showCustomize
              showFilter={false}
              primaryButton={{
                label: 'Xuất excel trang hiện tại',
                icon: <FileSpreadsheet className="w-4 h-4" />,
                onClick: () => {
                  exportTableToCsv('danh-sach-ca-lam-viec');
                  showToast('Đã xuất Excel Danh sách ca làm việc');
                },
              }}
            />

            <div className="overflow-y-auto flex-1 border-t border-[#e5e7eb]">
              <table className="m-advance-table w-full text-left border-collapse table-fixed">
                <thead className="bg-[#f8fafc] border-b border-[#e5e7eb] text-[12px] font-bold text-[#1f2937] sticky top-0 h-[38px]">
                  <tr>
                    <th className="px-2.5 w-[5%]">#</th>
                    <th className="px-2.5 w-[12%]">Mã ca</th>
                    <th className="px-2.5 w-[27%]">Mô tả</th>
                    <th className="px-2.5 w-[16%]">Thời gian</th>
                    <th className="px-2.5 w-[9%]">Chính</th>
                    <th className="px-2.5 w-[14%]">Có xe đưa đón</th>
                    <th className="px-2.5 w-[9%]">Trạng thái</th>
                    <th className="px-2.5 w-[8%] text-right">Cấu hình</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e7eb] text-[13px]">
                  {shifts
                    .filter(
                      (sh) =>
                        !transportFlagFilter || sh.transportFlag === transportFlagFilter
                    )
                    .filter(
                      (sh) => !masterFlagFilter || sh.masterFlag === masterFlagFilter
                    )
                    .filter(
                      (sh) => !activeFlagFilter || sh.activeFlag === activeFlagFilter
                    )
                    .filter(
                      (sh) =>
                        !searchShift.trim() ||
                        String(sh.shiftCode || '')
                          .toLowerCase()
                          .includes(searchShift.trim().toLowerCase()) ||
                        String(sh.shiftName || '')
                          .toLowerCase()
                          .includes(searchShift.trim().toLowerCase())
                    )
                    .map((sh, idx) => {
                      const lockedByRoute =
                        sh.transportFlag === 'Y' && Number(sh.segmentUsageCount || 0) > 0;
                      return (
                        <tr key={sh.id} className="hover:bg-[#f9fafb] h-[38px]">
                          <td className="px-2.5 text-[#374151]">{idx + 1}</td>
                          <td className="px-2.5 font-semibold text-[#1f2937] truncate">
                            {sh.shiftCode}
                          </td>
                          <td className="px-2.5 text-[#374151] truncate">{sh.shiftName}</td>
                          <td className="px-2.5 text-[#374151] truncate">
                            {formatShiftTimeRange(sh.startTime, sh.endTime)}
                          </td>
                          <td className="px-2.5">
                            {sh.masterFlag === 'Y' ? (
                              <PastelBadge label="Chính" tone="green" />
                            ) : (
                              <PastelBadge label="Phụ" tone="amber" />
                            )}
                          </td>
                          <td
                            className="px-2.5 cursor-pointer"
                            onClick={() => handleToggleTransportFlag(sh)}
                            title={
                              lockedByRoute
                                ? `Đang gắn trong ${sh.segmentUsageCount} chặng tuyến cố định (không thể tắt)`
                                : 'Nhấn để bật/tắt cờ Có xe đưa đón'
                            }
                          >
                            <div className="inline-flex items-center gap-1">
                              {sh.transportFlag === 'Y' ? (
                                <PastelBadge label="Có xe đưa đón" tone="green" />
                              ) : (
                                <PastelBadge label="Không có xe đưa đón" tone="gray" />
                              )}
                              {lockedByRoute && (
                                <Lock className="w-3.5 h-3.5 text-[#6b7280]" />
                              )}
                            </div>
                          </td>
                          <td className="px-2.5">
                            {sh.activeFlag === 'Y' ? (
                              <PastelBadge label="Hoạt động" tone="green" />
                            ) : (
                              <PastelBadge label="Ngừng HĐ" tone="gray" />
                            )}
                          </td>
                          <td className="px-2.5 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setEditingShift({
                                  id: String(sh.id),
                                  shiftCode: sh.shiftCode,
                                  shiftName: sh.shiftName,
                                  masterFlag: sh.masterFlag || 'Y',
                                  startTime: sh.startTime || '08:00',
                                  endTime: sh.endTime || '17:00',
                                  activeFlag: sh.activeFlag || 'Y',
                                  transportFlag: sh.transportFlag || 'Y',
                                  segmentUsageCount: Number(sh.segmentUsageCount || 0),
                                })
                              }
                              className="px-2 py-1 rounded text-[11px] font-medium bg-[#e0f2f1] text-[#00695c] hover:bg-[#b2dfdb] cursor-pointer"
                            >
                              Chi tiết
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CẤU HÌNH CHI TIẾT CA LÀM VIỆC */}
      {/* ==================================================================== */}
      {editingShift && (
        <div className="fixed inset-0 z-[60] bg-black/45 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveShiftEdit}
            className="bg-white rounded-[12px] shadow-2xl border border-[#e5e7eb] w-full max-w-[480px] p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#e5e7eb] pb-3">
              <h3 className="text-[15px] font-bold text-[#1f2937]">
                Cấu hình Ca làm việc — {editingShift.shiftCode}
              </h3>
              <button
                type="button"
                onClick={() => setEditingShift(null)}
                className="text-[#6b7280] hover:text-[#1f2937] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-[13px]">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#6b7280] mb-1">Mã ca</label>
                  <input
                    type="text"
                    readOnly
                    value={editingShift.shiftCode}
                    className="w-full h-[36px] border border-[#e5e7eb] bg-[#f9fafb] rounded-[6px] px-3 text-[13px] font-semibold text-[#374151]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#6b7280] mb-1">
                    Phân loại ca
                  </label>
                  <select
                    value={editingShift.masterFlag}
                    onChange={(e) =>
                      setEditingShift({ ...editingShift, masterFlag: e.target.value })
                    }
                    className="w-full h-[36px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px] bg-white"
                  >
                    <option value="Y">Ca chính (MAIN)</option>
                    <option value="N">Ca phụ / Tăng ca (SUB)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[#6b7280] mb-1">
                  Tên / Mô tả ca làm việc
                </label>
                <input
                  type="text"
                  required
                  value={editingShift.shiftName}
                  onChange={(e) =>
                    setEditingShift({ ...editingShift, shiftName: e.target.value })
                  }
                  className="w-full h-[36px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#6b7280] mb-1">
                    Giờ bắt đầu
                  </label>
                  <input
                    type="text"
                    value={editingShift.startTime}
                    onChange={(e) =>
                      setEditingShift({ ...editingShift, startTime: e.target.value })
                    }
                    placeholder="08:00"
                    className="w-full h-[36px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#6b7280] mb-1">
                    Giờ kết thúc
                  </label>
                  <input
                    type="text"
                    value={editingShift.endTime}
                    onChange={(e) =>
                      setEditingShift({ ...editingShift, endTime: e.target.value })
                    }
                    placeholder="17:00"
                    className="w-full h-[36px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#6b7280] mb-1">
                    Cờ xe đưa đón
                  </label>
                  <select
                    value={editingShift.transportFlag}
                    disabled={
                      editingShift.transportFlag === 'Y' &&
                      editingShift.segmentUsageCount > 0
                    }
                    onChange={(e) =>
                      setEditingShift({
                        ...editingShift,
                        transportFlag: e.target.value,
                      })
                    }
                    className="w-full h-[36px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px] bg-white disabled:bg-[#f3f4f6]"
                  >
                    <option value="Y">Có xe đưa đón (Y)</option>
                    <option value="N">Không có xe đưa đón (N)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[#6b7280] mb-1">
                    Trạng thái hoạt động
                  </label>
                  <select
                    value={editingShift.activeFlag}
                    onChange={(e) =>
                      setEditingShift({ ...editingShift, activeFlag: e.target.value })
                    }
                    className="w-full h-[36px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px] bg-white"
                  >
                    <option value="Y">Hoạt động (Y)</option>
                    <option value="N">Ngừng hoạt động (N)</option>
                  </select>
                </div>
              </div>

              {editingShift.segmentUsageCount > 0 && (
                <div className="p-2.5 rounded bg-[#fffbeb] border border-[#fde68a] text-[#92400e] text-[12px]">
                  Ca này đang được gắn với <strong>{editingShift.segmentUsageCount}</strong> lượt
                  chạy tuyến cố định nên không thể tắt cờ Có xe đưa đón.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e7eb]">
              <button
                type="button"
                onClick={() => setEditingShift(null)}
                className="h-[34px] px-4 rounded-[6px] border border-[#d1d5db] bg-white text-[#374151] text-[13px] font-medium cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="h-[34px] px-4 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-semibold cursor-pointer"
              >
                Lưu cấu hình ca
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
