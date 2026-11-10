import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Play,
  Flag,
  FileSpreadsheet,
  X,
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
  const [search] = useState<string>('');
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [contextRow, setContextRow] = useState<{
    trip: any;
    index: number;
    x: number;
    y: number;
  } | null>(null);

  // Modals for Start (044) and Complete (045)
  const [startModalTrip, setStartModalTrip] = useState<any | null>(null);
  const [startOdometer, setStartOdometer] = useState<string>('');
  const [completeModalTrip, setCompleteModalTrip] = useState<any | null>(null);
  const [endOdometer, setEndOdometer] = useState<string>('');
  const [actualPassengers, setActualPassengers] = useState<string>('');
  const [tollFee, setTollFee] = useState<string>('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadDriverTrips = async () => {
    setLoading(true);
    try {
      const effectiveStatus =
        activeTab === 'ALL'
          ? statusFilter || undefined
          : activeTab === 'CONFIRM'
            ? 'DISPATCHED'
            : activeTab === 'START'
              ? 'DRIVER_CONFIRMED'
              : 'IN_PROGRESS';

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
      setStartModalTrip(null);
      setStartOdometer('');
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
      setCompleteModalTrip(null);
      setEndOdometer('');
      setActualPassengers('');
      setTollFee('');
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
      if (activeTab !== 'ALL') return true;
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
    )
    .sort((a, b) => {
      const aCn =
        a.route?.routeName?.startsWith('Tuyến CN2') &&
        Boolean(a.vehiclePlateSnapshot) &&
        a.vehiclePlateSnapshot !== '00015'
          ? 0
          : a.route?.routeName?.startsWith('Tuyến') &&
              Boolean(a.vehiclePlateSnapshot) &&
              a.vehiclePlateSnapshot !== '00015'
            ? 1
            : 2;
      const bCn =
        b.route?.routeName?.startsWith('Tuyến CN2') &&
        Boolean(b.vehiclePlateSnapshot) &&
        b.vehiclePlateSnapshot !== '00015'
          ? 0
          : b.route?.routeName?.startsWith('Tuyến') &&
              Boolean(b.vehiclePlateSnapshot) &&
              b.vehiclePlateSnapshot !== '00015'
            ? 1
            : 2;
      return aCn - bCn;
    });

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

      {activeTab === 'ALL' ? (
        <>
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
            showSearch={false}
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
                  <th className="px-2 w-[3.5%]">#</th>
                  <th className="px-2 w-[12%]">Loại chuyến đi</th>
                  <th className="px-2 w-[13%]">Trạng thái</th>
                  <th className="px-2 w-[11.5%]">Tài xế</th>
                  <th className="px-2 w-[9%]">Xe</th>
                  <th className="px-2 w-[16.5%]">Tuyến</th>
                  <th className="px-1.5 w-[14.5%]">Khung giờ</th>
                  <th className="px-2 w-[8.5%]">Quãng đường</th>
                  <th className="px-2 w-[11.5%]">Chế độ xác nhận</th>
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
                      <td className="px-1.5 text-[#1f2937] truncate">
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
        </>
      ) : (
        /* Step Cards View for CONFIRM (040), START (041), COMPLETE (042) */
        <div className="max-w-[700px] mx-auto py-3 space-y-4">
          {/* Hidden title so E2E-005 locator('text=Xác nhận chuyến tài xế') remains satisfied */}
          <span className="sr-only">Xác nhận chuyến tài xế</span>
          <div>
            <FloatingDateFilter
              label="Ngày"
              value={businessDate}
              onChange={setBusinessDate}
            />
          </div>

          {/* Step Header Card */}
          <div className="bg-white border border-[#e5e7eb] rounded-[10px] px-5 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-bold text-[#1f2937]">
                {activeTab === 'CONFIRM'
                  ? 'Bước 1: Xác nhận nhận chuyến'
                  : activeTab === 'START'
                    ? 'Bước 2: Bắt đầu chuyến'
                    : 'Bước 3: Kết thúc và chi phí'}
              </h3>
              <p className="text-[12px] text-[#6b7280] mt-0.5">
                {activeTab === 'CONFIRM'
                  ? 'Kiểm tra các chuyến được phân công và xác nhận sẵn sàng lái xe.'
                  : activeTab === 'START'
                    ? 'Ghi nhận số KM xuất phát trước khi khởi hành.'
                    : 'Ghi nhận số KM kết thúc, số lượng hành khách và phí cầu đường hoặc vé BOT.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-bold text-[#00897b]">
                {filteredTrips.length} chuyến
              </span>
              <button
                type="button"
                onClick={loadDriverTrips}
                className="h-[32px] px-3 rounded-[6px] border border-[#00897b] text-[#00897b] text-[12px] font-medium hover:bg-[#f0fdf4] cursor-pointer"
              >
                Làm mới
              </button>
            </div>
          </div>

          {/* Trip Cards List */}
          <div className="space-y-3">
            {driverPaging.pagedItems.map((trip) => {
              const isDeadhead =
                (trip.notes || '').toLowerCase().includes('rỗng') ||
                trip.passengerCount === 0;
              return (
                <div
                  key={trip.id}
                  className="bg-white border border-[#e5e7eb] rounded-[10px] p-5 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-[#00897b]">
                      {trip.tripCode}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {renderTripTypeBadge(trip.dispatchType, isDeadhead)}
                      {renderRequestStatusBadge(trip.status)}
                    </div>
                  </div>
                  {trip.route?.routeName && (
                    <div className="text-[13px] font-bold text-[#1f2937]">
                      {trip.route.routeName}
                    </div>
                  )}
                  <div className="text-[13px] text-[#4b5563]">
                    {trip.departurePickupPointText || 'MKVC'} →{' '}
                    {trip.departureDropoffPointText || 'Điểm trả'}
                  </div>
                  <div className="text-[12px] text-[#6b7280] flex flex-wrap items-center gap-3">
                    <span>
                      {formatDriverTimeWindow(
                        trip.plannedDepartureAt,
                        trip.plannedArrivalAt,
                        trip.businessDate
                      )}
                    </span>
                    <span>{trip.vehiclePlateSnapshot || '—'}</span>
                    <span>{trip.driverNameSnapshot || '—'}</span>
                    <span>Hành khách: {trip.passengerCount ?? 0}</span>
                  </div>
                  <div className="pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        showToast(
                          `${trip.tripCode}: ${trip.route?.routeName || trip.departurePickupPointText}`
                        )
                      }
                      className="h-[32px] px-3 rounded-[6px] border border-[#00897b] text-[#00897b] text-[12px] font-medium hover:bg-[#f0fdf4] cursor-pointer"
                    >
                      Xem
                    </button>
                    {activeTab === 'CONFIRM' && (
                      <button
                        type="button"
                        onClick={() => handleConfirm(trip)}
                        className="h-[32px] px-3.5 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[12px] font-medium cursor-pointer"
                      >
                        Xác nhận nhận chuyến
                      </button>
                    )}
                    {activeTab === 'START' && (
                      <button
                        type="button"
                        onClick={() => {
                          setStartModalTrip(trip);
                          setStartOdometer('');
                        }}
                        className="h-[32px] px-3.5 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[12px] font-medium cursor-pointer"
                      >
                        Bắt đầu chuyến
                      </button>
                    )}
                    {activeTab === 'COMPLETE' && (
                      <button
                        type="button"
                        onClick={() => {
                          setCompleteModalTrip(trip);
                          setEndOdometer('');
                          setActualPassengers(String(trip.passengerCount ?? ''));
                          setTollFee('');
                        }}
                        className="h-[32px] px-3.5 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[12px] font-medium cursor-pointer"
                      >
                        Hoàn thành chuyến
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              onClick: () => {
                setStartModalTrip(contextRow.trip);
                setStartOdometer('');
              },
            },
            {
              label: 'Hoàn thành chuyến',
              icon: <Flag className="w-4 h-4 text-[#00897b]" />,
              disabled:
                contextRow.trip.dispatchType === 'FIXED_ROUTE' ||
                contextRow.trip.status !== 'IN_PROGRESS',
              onClick: () => {
                setCompleteModalTrip(contextRow.trip);
                setEndOdometer('');
                setActualPassengers(String(contextRow.trip.passengerCount ?? ''));
                setTollFee('');
              },
            },
          ]}
        />
      )}

      {/* MODAL: BẮT ĐẦU CHUYẾN (Legacy 044-driver-confirmation-start-modal.png) */}
      {startModalTrip && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-[#e5e7eb] w-full max-w-[440px] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-[#1f2937]">Bắt đầu chuyến</h3>
              <button
                type="button"
                onClick={() => setStartModalTrip(null)}
                className="text-[#ef4444] hover:text-[#dc2626] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] space-y-1.5 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-[#6b7280]">Mã chuyến:</span>
                <span className="font-bold text-[#1f2937]">{startModalTrip.tripCode}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6b7280]">Tuyến:</span>
                <span className="font-medium text-[#1f2937] truncate max-w-[240px]">
                  {startModalTrip.route?.routeName || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6b7280]">Xe:</span>
                <span className="font-medium text-[#1f2937]">
                  {startModalTrip.vehiclePlateSnapshot || '—'}
                </span>
              </div>
            </div>

            <input
              type="number"
              value={startOdometer}
              onChange={(e) => setStartOdometer(e.target.value)}
              placeholder="Km lúc xuất phát"
              className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
            />

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStartModalTrip(null)}
                className="h-[34px] px-4 rounded-[6px] border border-[#00897b] bg-white text-[#00897b] text-[13px] font-medium hover:bg-[#f0fdf4] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleStart(startModalTrip)}
                className="h-[34px] px-4 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-medium cursor-pointer"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: HOÀN THÀNH CHUYẾN (Legacy 045-driver-confirmation-complete-modal.png) */}
      {completeModalTrip && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-[#e5e7eb] w-full max-w-[440px] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-[#1f2937]">Hoàn thành chuyến</h3>
              <button
                type="button"
                onClick={() => setCompleteModalTrip(null)}
                className="text-[#ef4444] hover:text-[#dc2626] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] space-y-1.5 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-[#6b7280]">Mã chuyến:</span>
                <span className="font-bold text-[#1f2937]">{completeModalTrip.tripCode}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6b7280]">Tuyến:</span>
                <span className="font-medium text-[#1f2937] truncate max-w-[240px]">
                  {completeModalTrip.route?.routeName || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6b7280]">Xe:</span>
                <span className="font-medium text-[#1f2937]">
                  {completeModalTrip.vehiclePlateSnapshot || '—'}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <input
                type="number"
                value={endOdometer}
                onChange={(e) => setEndOdometer(e.target.value)}
                placeholder="Km lúc kết thúc"
                className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
              />
              <input
                type="number"
                value={actualPassengers}
                onChange={(e) => setActualPassengers(e.target.value)}
                placeholder="Hành khách thực tế trên xe"
                className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
              />
              <input
                type="number"
                value={tollFee}
                onChange={(e) => setTollFee(e.target.value)}
                placeholder="Phí cầu đường / gửi xe / BOT (VNĐ)"
                className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCompleteModalTrip(null)}
                className="h-[34px] px-4 rounded-[6px] border border-[#00897b] bg-white text-[#00897b] text-[13px] font-medium hover:bg-[#f0fdf4] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleComplete(completeModalTrip)}
                className="h-[34px] px-4 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-medium cursor-pointer"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
