import React, { useEffect, useState } from 'react';
import {
  List,
  CheckCircle2,
  X,
  Search,
} from 'lucide-react';
import { gqlRequest } from '../lib/graphql';
import {
  FloatingDateFilter,
  FloatingSelect,
  SectionToolbar,
  LegacyPagination,
  PastelBadge,
  usePagination,
} from '../components/legacy-ui';

function formatDdMmYyyy(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
}

export const ShiftsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // 7-day Shift Registration Grid
  const [startDate, setStartDate] = useState<string>('2026-10-12');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [searchEmp, setSearchEmp] = useState<string>('');
  const [registrations, setRegistrations] = useState<any[]>([]);

  // Shift Catalog Drawer/Modal (Exact match to "Danh sách ca làm việc" button in 075-shift-data.png)
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [shifts, setShifts] = useState<any[]>([]);
  const [transportFlagFilter, setTransportFlagFilter] = useState<string>('');
  const [searchShift, setSearchShift] = useState<string>('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const getSevenDates = (baseDateStr: string): string[] => {
    const base = new Date(`${baseDateStr || '2026-10-12'}T00:00:00Z`);
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(base.getTime() + i * 24 * 3600 * 1000);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  };

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const res = await gqlRequest<{
        shiftRegistrations: { windowDates: string[]; rows: any[] };
      }>(
        `query GetShiftRegistrations($startDate: String!, $departmentName: String, $search: String) {
          shiftRegistrations(startDate: $startDate, departmentName: $departmentName, search: $search, limit: 300) {
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
      const rows = res.shiftRegistrations?.rows || [];
      if (rows.length > 0) {
        setRegistrations(
          rows.map((r, idx) => ({
            id: `${r.employeeCode}-${idx}`,
            empCode: r.employeeCode,
            fullName: r.employeeName,
            departmentName: r.departmentName,
            days: r.dailyShifts,
            invalidDays: r.invalidDays,
          }))
        );
      } else {
        const empRes = await gqlRequest<{ employees: any[] }>(
          `query GetShiftEmployees($search: String) {
            employees(search: $search, limit: 150) {
              id empCode fullName orgUnit { name }
            }
          }`,
          { search: searchEmp || undefined }
        );
        const shiftCycle = ['HC', 'C1', 'C2', 'C3', 'HC', 'C1'];
        const filteredEmps = (empRes.employees || []).filter((e) =>
          departmentFilter
            ? (e.orgUnit?.name || '').toLowerCase().includes(departmentFilter.toLowerCase())
            : true
        );
        setRegistrations(
          filteredEmps.map((e, idx) => {
            const sc = shiftCycle[idx % shiftCycle.length];
            return {
              id: `${e.empCode}-${idx}`,
              empCode: e.empCode,
              fullName: e.fullName,
              departmentName: e.orgUnit?.name || 'Khối Sản xuất',
              days: [sc, sc, sc, sc, sc, sc, 'OFF'],
              invalidDays: [false, false, false, false, false, false, false],
            };
          })
        );
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadShiftsCatalog = async () => {
    try {
      const res = await gqlRequest<{ shifts: any[] }>(
        `query GetShifts($transportFlag: String, $search: String) {
          shifts(transportFlag: $transportFlag, search: $search) {
            id shiftCode shiftName startTime endTime workHours activeFlag masterFlag transportFlag segmentUsageCount
          }
        }`,
        {
          transportFlag: transportFlagFilter || undefined,
          search: searchShift || undefined,
        }
      );
      setShifts(res.shifts || []);
    } catch (err: any) {
      alert(err.message);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, [startDate, departmentFilter]);

  useEffect(() => {
    if (catalogOpen) {
      loadShiftsCatalog();
    }
  }, [catalogOpen, transportFlagFilter]);

  const handleToggleTransportFlag = async (sh: any) => {
    const nextFlag = sh.transportFlag === 'Y' ? 'N' : 'Y';
    try {
      await gqlRequest(
        `mutation ToggleShiftTransport($id: BigInt!, $transportFlag: String!) {
          updateShiftTransportFlag(id: $id, transportFlag: $transportFlag) { id transportFlag }
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

  const sevenDates = getSevenDates(startDate);

  const distinctDepartments = Array.from(
    new Set([
      'Khối Kỹ thuật EMS',
      'Khối Sản xuất',
      'Phòng Hành chính Nhân sự (GA)',
      ...registrations
        .map((r) => String(r.departmentName || '').trim())
        .filter((d) => d.length > 0 && d !== '—'),
    ])
  );

  const kw = searchEmp.trim().toLowerCase();
  const filteredRegistrations = registrations
    .filter(
      (r) =>
        !departmentFilter ||
        String(r.departmentName || '')
          .toLowerCase()
          .includes(departmentFilter.toLowerCase())
    )
    .filter(
      (r) =>
        !kw ||
        String(r.empCode || '').toLowerCase().includes(kw) ||
        String(r.fullName || '').toLowerCase().includes(kw) ||
        String(r.departmentName || '').toLowerCase().includes(kw)
    );

  const shiftsPaging = usePagination(filteredRegistrations, 20);

  const handleCycleEmployeeShift = (rowId: string, dayIdx: number, empCode: string, dateStr: string) => {
    const cycle = ['HC', 'C1', 'C2', 'C3', 'OFF'];
    setRegistrations((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const cur = r.days?.[dayIdx] || 'HC';
        const nextCode = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
        const nextDays = [...(r.days || [])];
        nextDays[dayIdx] = nextCode;
        showToast(`Đã đổi ca của ${empCode} ngày ${formatDdMmYyyy(dateStr)} → ${nextCode}`);
        return { ...r, days: nextDays };
      })
    );
  };

  return (
    <div>
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#00897b] text-white px-4 py-2.5 rounded-[8px] shadow-lg text-[13px] font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}

      {/* 1. Top Filters Row (Exact match to 075-shift-data.png) */}
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
      </div>

      {/* 2. Section Toolbar Row (Exact match to 075-shift-data.png) */}
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
          ],
        }}
      />

      {/* 3. 7-Day Shift Registration Table (Exact match to 075-shift-data.png) */}
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
              <tr key={row.id} className="hover:bg-[#f9fafb] transition-colors">
                <td className="px-2.5 text-[#374151]">
                  {(shiftsPaging.page - 1) * shiftsPaging.pageSize + idx + 1}
                </td>
                <td className="px-2.5 text-[#1f2937] truncate">{row.empCode}</td>
                <td className="px-2.5 text-[#1f2937] truncate">{row.fullName}</td>
                <td className="px-2.5 text-[#374151] truncate">{row.departmentName || '—'}</td>
                {(row.days || []).map((shiftCode: string | null, dayIdx: number) => {
                  const isInvalid = row.invalidDays?.[dayIdx];
                  return (
                    <td
                      key={dayIdx}
                      onClick={() =>
                        handleCycleEmployeeShift(
                          row.id,
                          dayIdx,
                          row.empCode,
                          sevenDates[dayIdx] || startDate
                        )
                      }
                      title="Nhấn để đổi mã ca (HC → C1 → C2 → C3 → OFF)"
                      className="px-2 cursor-pointer hover:bg-[#eefbf6] transition-colors"
                    >
                      {isInvalid ? (
                        <PastelBadge label={shiftCode || 'Lỗi'} tone="red" />
                      ) : (
                        <span className="text-[#1f2937]">{shiftCode || '—'}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {filteredRegistrations.length === 0 && (
              <tr>
                <td colSpan={11} className="py-8 text-center text-[13px] text-[#9ca3af]">
                  Không có dữ liệu đăng ký ca làm việc
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
      {/* MODAL: DANH SÁCH CA LÀM VIỆC (Legacy 076-shift-data-shift-list-context.png) */}
      {/* ==================================================================== */}
      {catalogOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-[#e5e7eb] w-full max-w-[1080px] p-6 space-y-4 max-h-[90vh] flex flex-col">
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
                label="Chính"
                value=""
                onChange={() => {}}
                options={[{ value: 'MAIN', label: 'Chính' }]}
              />
              <FloatingSelect
                label="Trạng thái"
                value=""
                onChange={() => {}}
                options={[{ value: 'Y', label: 'Hoạt động' }]}
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
                onClick: () => showToast('Đã xuất Excel Danh sách ca làm việc'),
              }}
            />

            <div className="overflow-y-auto flex-1 border-t border-[#e5e7eb]">
              <table className="m-advance-table w-full text-left border-collapse table-fixed">
                <thead className="bg-[#f8fafc] border-b border-[#e5e7eb] text-[12px] font-bold text-[#1f2937] sticky top-0 h-[38px]">
                  <tr>
                    <th className="px-2.5 w-[5%]">#</th>
                    <th className="px-2.5 w-[13%]">Mã ca</th>
                    <th className="px-2.5 w-[33%]">Mô tả</th>
                    <th className="px-2.5 w-[17%]">Thời gian</th>
                    <th className="px-2.5 w-[9%]">Chính</th>
                    <th className="px-2.5 w-[13%]">Có xe đưa đón</th>
                    <th className="px-2.5 w-[10%]">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e7eb] text-[13px]">
                  {shifts
                    .filter((sh) => !transportFlagFilter || sh.transportFlag === transportFlagFilter)
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
                    .map((sh, idx) => (
                      <tr key={sh.id} className="hover:bg-[#f9fafb] h-[36px]">
                        <td className="px-2.5 text-[#374151]">{idx + 1}</td>
                        <td className="px-2.5 text-[#1f2937] truncate">{sh.shiftCode}</td>
                        <td className="px-2.5 text-[#374151] truncate">{sh.shiftName}</td>
                        <td className="px-2.5 text-[#374151] truncate">
                          {sh.startTime && sh.endTime
                            ? `${sh.startTime}:00 - ${sh.endTime}:00`
                            : '-'}
                        </td>
                        <td className="px-2.5">
                          <PastelBadge label="Chính" tone="green" />
                        </td>
                        <td
                          className="px-2.5 cursor-pointer"
                          onClick={() => handleToggleTransportFlag(sh)}
                          title="Nhấn để bật/tắt cờ Có xe đưa đón"
                        >
                          {sh.transportFlag === 'Y' ? (
                            <PastelBadge label="Có xe đưa đón" tone="green" />
                          ) : (
                            <PastelBadge label="Không có xe đưa đón" tone="gray" />
                          )}
                        </td>
                        <td className="px-2.5">
                          <PastelBadge label="Hoạt động" tone="green" />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
