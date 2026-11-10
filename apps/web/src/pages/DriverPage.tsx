import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Play,
  Flag,
  FileSpreadsheet,
} from 'lucide-react';
import { gqlRequest } from '../lib/graphql';
import {
  LegacyTabs,
  FloatingDateFilter,
  FloatingSelect,
  SectionToolbar,
  LegacyPagination,
  RowContextMenu,
  renderTripTypeBadge,
  renderRequestStatusBadge,
  usePagination,
  exportTableToCsv,
} from '../components/legacy-ui';

function formatDriverTimeWindow(
  startStr?: string | null,
  endStr?: string | null,
  businessDate?: string
): string {
  const fmtPart = (val?: string | null) => {
    if (!val) return '';
    if (val.includes('T') || val.includes('-')) {
      const d = new Date(val);
      if (!Number.isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return `${dd}/${mm} ${hh}:${mi}`;
      }
    }
    if (businessDate && businessDate.includes('-')) {
      const [, mm, dd] = businessDate.split('-');
      return `${dd}/${mm} ${val.slice(0, 5)}`;
    }
    return val;
  };
  const s = fmtPart(startStr);
  const e = fmtPart(endStr);
  if (!s && !e) return '—';
  if (s && e) return `${s} - ${e}`;
  return s || e;
}

export const DriverPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'CONFIRM' | 'START' | 'COMPLETE'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [businessDate, setBusinessDate] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [contextRow, setContextRow] = useState<{
    trip: any;
    index: number;
    x: number;
    y: number;
  } | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadDriverTrips = async () => {
    setLoading(true);
    try {
      const effectiveStatus =
        statusFilter ||
        (activeTab === 'CONFIRM'
          ? 'DISPATCHED'
          : activeTab === 'START'
            ? 'DRIVER_CONFIRMED'
            : activeTab === 'COMPLETE'
              ? 'IN_PROGRESS'
              : undefined);

      const res = await gqlRequest<{ driverTrips: any[] }>(
        `query GetDriverTrips($businessDate: String, $status: String) {
          driverTrips(businessDate: $businessDate, status: $status) {
            id tripCode businessDate tripType dispatchType status
            vehiclePlateSnapshot driverNameSnapshot driverPhoneSnapshot
            plannedDepartureAt plannedArrivalAt passengerCount
            departurePickupPointText departureDropoffPointText notes
            route { id routeCode routeName }
          }
        }`,
        {
          businessDate: businessDate || undefined,
          status: effectiveStatus,
        }
      );
      setTrips(res.driverTrips || []);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDriverTrips();
  }, [activeTab, statusFilter, businessDate]);

  const handleConfirm = async (trip: any) => {
    try {
      await gqlRequest(`mutation ConfirmMyTrip($id: BigInt!) { confirmTrip(id: $id) { id status } }`, {
        id: trip.id,
      });
      showToast(`Đã xác nhận nhận chuyến ${trip.tripCode}`);
      loadDriverTrips();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStart = async (trip: any) => {
    try {
      await gqlRequest(`mutation StartMyTrip($id: BigInt!) { startTrip(id: $id) { id status } }`, {
        id: trip.id,
      });
      showToast(`Đã bắt đầu chạy chuyến ${trip.tripCode}`);
      loadDriverTrips();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleComplete = async (trip: any) => {
    try {
      await gqlRequest(
        `mutation CompleteMyTrip($id: BigInt!) { completeTrip(id: $id) { id status } }`,
        { id: trip.id }
      );
      showToast(`Đã hoàn thành chuyến ${trip.tripCode}`);
      loadDriverTrips();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const kw = search.trim().toLowerCase();
  const filteredTrips = trips
    .filter((t) => !businessDate || t.businessDate === businessDate)
    .filter((t) => {
      if (!statusFilter) return true;
      if (statusFilter === 'DISPATCHED')
        return t.status === 'DISPATCHED' || t.status === 'WAITING_DRIVER_CONFIRM';
      return t.status === statusFilter;
    })
    .filter(
      (t) =>
        !kw ||
        String(t.tripCode || '').toLowerCase().includes(kw) ||
        String(t.driverNameSnapshot || '').toLowerCase().includes(kw) ||
        String(t.vehiclePlateSnapshot || '').toLowerCase().includes(kw) ||
        String(t.route?.routeName || '').toLowerCase().includes(kw) ||
        String(t.departurePickupPointText || '').toLowerCase().includes(kw) ||
        String(t.departureDropoffPointText || '').toLowerCase().includes(kw)
    );

  const driverPaging = usePagination(filteredTrips, 20);

  return (
    <div>
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#00897b] text-white px-4 py-2.5 rounded-[8px] shadow-lg text-[13px] font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}

      {/* 1. Underline Tabs (Exact match to 038-driver-confirmation.png) */}
      <LegacyTabs
        tabs={[
          { id: 'ALL', label: 'Chuyến' },
          { id: 'CONFIRM', label: 'Xác nhận' },
          { id: 'START', label: 'Bắt đầu' },
          { id: 'COMPLETE', label: 'Hoàn thành' },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* 2. Filters Row */}
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <FloatingDateFilter
          label="Ngày"
          value={businessDate}
          onChange={setBusinessDate}
        />
        <FloatingSelect
          label="Trạng thái"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'DISPATCHED', label: 'Chờ tài xế xác nhận' },
            { value: 'DRIVER_CONFIRMED', label: 'Tài xế đã xác nhận' },
            { value: 'IN_PROGRESS', label: 'Đang chạy' },
            { value: 'COMPLETED', label: 'Hoàn thành' },
          ]}
        />
      </div>

      {/* 3. Section Toolbar */}
      <SectionToolbar
        title="Xác nhận chuyến tài xế"
        loading={loading}
        onRefresh={loadDriverTrips}
        search={search}
        onSearchChange={setSearch}
        showCustomize
        primaryButton={{
          label: 'Xuất excel trang hiện tại',
          icon: <FileSpreadsheet className="w-4 h-4" />,
          onClick: () => {
            exportTableToCsv('xac-nhan-chuyen-tai-xe');
            showToast('Đã xuất Excel Xác nhận chuyến tài xế');
          },
        }}
      />

      {/* 4. Table (Exact match to 038-driver-confirmation.png) */}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left border-collapse">
          <thead>
            <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] text-[13px] font-semibold text-[#1f2937]">
              <th className="px-2.5 w-[4%]">#</th>
              <th className="px-2.5 w-[13%]">Loại chuyến đi</th>
              <th className="px-2.5 w-[13%]">Trạng thái</th>
              <th className="px-2.5 w-[12%]">Tài xế</th>
              <th className="px-2.5 w-[10%]">Xe</th>
              <th className="px-2.5 w-[18%]">Tuyến</th>
              <th className="px-2.5 w-[11%]">Khung giờ</th>
              <th className="px-2.5 w-[9%]">Quãng đường</th>
              <th className="px-2.5 w-[10%]">Chế độ xác nhận</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e7eb] text-[13px] text-[#1f2937]">
            {driverPaging.pagedItems.map((trip, idx) => {
              const isDeadhead =
                (trip.notes || '').toLowerCase().includes('rỗng') ||
                trip.passengerCount === 0;
              const rowIndex = (driverPaging.page - 1) * driverPaging.pageSize + idx + 1;
              return (
                <tr
                  key={trip.id}
                  onClick={(e) =>
                    setContextRow({
                      trip,
                      index: rowIndex,
                      x: e.clientX,
                      y: e.clientY,
                    })
                  }
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextRow({
                      trip,
                      index: rowIndex,
                      x: e.clientX,
                      y: e.clientY,
                    });
                  }}
                  className="hover:bg-[#f9fafb] cursor-pointer transition-colors"
                >
                  <td className="px-2.5 text-[#374151]">{rowIndex}</td>
                  <td className="px-2.5">
                    {renderTripTypeBadge(trip.dispatchType, isDeadhead)}
                  </td>
                  <td className="px-2.5">
                    {renderRequestStatusBadge(trip.status)}
                  </td>
                  <td className="px-2.5 text-[#1f2937] truncate">
                    {trip.driverNameSnapshot || '—'}
                  </td>
                  <td className="px-2.5 text-[#1f2937] truncate">
                    {trip.vehiclePlateSnapshot || '—'}
                  </td>
                  <td className="px-2.5 text-[#1f2937] truncate">
                    {trip.route
                      ? trip.route.routeName
                      : `${trip.departurePickupPointText || 'Điểm đón'} → ${
                          trip.departureDropoffPointText || 'Điểm trả'
                        }`}
                  </td>
                  <td className="px-2.5 text-[#1f2937] truncate">
                    {formatDriverTimeWindow(
                      trip.plannedDepartureAt,
                      trip.plannedArrivalAt,
                      trip.businessDate
                    )}
                  </td>
                  <td className="px-2.5 text-[#374151]"></td>
                  <td className="px-2.5 text-[#1f2937]">Tài xế</td>
                </tr>
              );
            })}
            {filteredTrips.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-[13px] text-[#9ca3af]">
                  Không có chuyến đi nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <LegacyPagination
        totalCount={filteredTrips.length}
        shownCount={driverPaging.pagedItems.length}
        page={driverPaging.page}
        pageSize={driverPaging.pageSize}
        onPageChange={driverPaging.setPage}
        onPageSizeChange={driverPaging.setPageSize}
      />

      {contextRow && (
        <RowContextMenu
          title={`# ${contextRow.index} (${contextRow.trip.tripCode})`}
          position={{ x: contextRow.x, y: contextRow.y }}
          onClose={() => setContextRow(null)}
          actions={[
            {
              label: 'Xác nhận nhận chuyến',
              icon: <CheckCircle2 className="w-4 h-4 text-[#00897b]" />,
              disabled: !['DISPATCHED', 'WAITING_DRIVER_CONFIRM'].includes(
                contextRow.trip.status
              ),
              onClick: () => handleConfirm(contextRow.trip),
            },
            {
              label: 'Bắt đầu chạy chuyến',
              icon: <Play className="w-4 h-4 text-[#0284c7]" />,
              disabled:
                contextRow.trip.dispatchType === 'FIXED_ROUTE' ||
                !['DISPATCHED', 'DRIVER_CONFIRMED'].includes(contextRow.trip.status),
              onClick: () => handleStart(contextRow.trip),
            },
            {
              label: 'Hoàn thành chuyến',
              icon: <Flag className="w-4 h-4 text-[#00897b]" />,
              disabled:
                contextRow.trip.dispatchType === 'FIXED_ROUTE' ||
                contextRow.trip.status !== 'IN_PROGRESS',
              onClick: () => handleComplete(contextRow.trip),
            },
          ]}
        />
      )}
    </div>
  );
};
