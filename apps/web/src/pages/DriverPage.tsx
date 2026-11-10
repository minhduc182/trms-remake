import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Play,
  Flag,
  FileSpreadsheet,
  X,
  Eye,
  Gauge,
  LayoutGrid,
  Table as TableIcon,
  Phone,
  MapPin,
  Users,
  Package,
  Clock,
} from 'lucide-react';
import { gqlRequest } from '../lib/graphql';
import {
  LegacyTabs,
  FloatingDateFilter,
  FloatingSelect,
  SectionToolbar,
  LegacyPagination,
  PastelBadge,
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
  const [activeTab, setActiveTab] = useState<
    'ALL' | 'CONFIRM' | 'START' | 'COMPLETE' | 'COMPLETED_LIST'
  >('ALL');
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARDS'>('TABLE');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [driverIdFilter, setDriverIdFilter] = useState<string>('');
  const [tripTypeFilter, setTripTypeFilter] = useState<string>('');
  const [businessDate, setBusinessDate] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [trips, setTrips] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [contextRow, setContextRow] = useState<{
    trip: any;
    index: number;
    x: number;
    y: number;
  } | null>(null);

  // Detail Drawer
  const [detailTrip, setDetailTrip] = useState<any | null>(null);

  // Modals for Start, Complete, and Update KM
  const [startModalTrip, setStartModalTrip] = useState<any | null>(null);
  const [startOdometer, setStartOdometer] = useState<string>('');

  const [completeModalTrip, setCompleteModalTrip] = useState<any | null>(null);
  const [endOdometer, setEndOdometer] = useState<string>('');
  const [actualPassengers, setActualPassengers] = useState<string>('');
  const [tollFee, setTollFee] = useState<string>('');
  const [executionNote, setExecutionNote] = useState<string>('');

  const [kmModalTrip, setKmModalTrip] = useState<{
    trip: any;
    actualKm: string;
    otHours: string;
    tollFeeAmount: string;
    executionNote: string;
  } | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadDriversLookup = async () => {
    try {
      const res = await gqlRequest<{ drivers: any[] }>(`
        query LoadDriversForDriverPage {
          drivers(activeFlag: "Y") {
            id
            driverName
            phoneNumber
          }
        }
      `);
      setDrivers(res.drivers || []);
    } catch {
      // ignore
    }
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
              : activeTab === 'COMPLETE'
                ? 'IN_PROGRESS'
                : 'COMPLETED';

      const res = await gqlRequest<{ driverTrips: any[] }>(
        `query GetDriverTrips($businessDate: String, $driverId: BigInt, $status: String) {
          driverTrips(businessDate: $businessDate, driverId: $driverId, status: $status) {
            id
            tripCode
            businessDate
            tripType
            dispatchType
            status
            driverId
            vehicleId
            vehiclePlateSnapshot
            driverNameSnapshot
            driverPhoneSnapshot
            seatCapacitySnapshot
            plannedDepartureAt
            plannedArrivalAt
            passengerCount
            passengerType
            tripMode
            tripLeg
            pairedTripId
            departurePickupPointText
            departureDropoffPointText
            returnPickupPointText
            returnDropoffPointText
            deadheadKind
            overrideReason
            notes
            actualKm
            actualStartAt
            actualEndAt
            actualPassengerCount
            startOdometerKm
            endOdometerKm
            tollFeeAmount
            route {
              id
              routeCode
              routeName
              passengerType
            }
            requestLinks {
              id
              linkRole
              requestLeg
              request {
                id
                requestCode
                requestType
                requesterName
                departmentName
                passengerCount
                departurePickupPointText
                departureDropoffPointText
                contactName
                contactPhone
                senderInfo
                receiverInfo
                purpose
                notes
                status
                otShiftCode
                passengers {
                  id
                  passengerId
                  passengerName
                  passengerType
                  departurePickupPointText
                  departureDropoffPointText
                }
              }
            }
            executionFacts {
              id
              actualKm
              otHours
              startOdometerKm
              endOdometerKm
              actualPassengerCount
              actualDepartureAt
              actualArrivalAt
              executionNote
            }
          }
        }`,
        {
          businessDate: businessDate || undefined,
          driverId: driverIdFilter ? driverIdFilter : undefined,
          status: effectiveStatus,
        }
      );
      const list = res.driverTrips || [];
      setTrips(list);
      if (detailTrip) {
        const updated = list.find((t: any) => String(t.id) === String(detailTrip.id));
        if (updated) setDetailTrip(updated);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDriversLookup();
  }, []);

  useEffect(() => {
    loadDriverTrips();
  }, [activeTab, statusFilter, driverIdFilter, businessDate]);

  const openStartModal = (trip: any) => {
    setStartModalTrip(trip);
    setStartOdometer(
      trip.startOdometerKm !== undefined && trip.startOdometerKm !== null
        ? String(trip.startOdometerKm)
        : '12500'
    );
  };

  const openCompleteModal = (trip: any) => {
    const startOdo =
      trip.startOdometerKm !== undefined && trip.startOdometerKm !== null
        ? Number(trip.startOdometerKm)
        : null;
    const defaultEndOdo =
      trip.endOdometerKm !== undefined && trip.endOdometerKm !== null
        ? String(trip.endOdometerKm)
        : startOdo !== null
          ? String(startOdo + 28)
          : '';
    setCompleteModalTrip(trip);
    setEndOdometer(defaultEndOdo);
    setActualPassengers(
      String(trip.actualPassengerCount ?? trip.passengerCount ?? 0)
    );
    setTollFee(
      trip.tollFeeAmount !== undefined && trip.tollFeeAmount !== null
        ? String(trip.tollFeeAmount)
        : '0'
    );
    setExecutionNote(trip.executionFacts?.[0]?.executionNote || '');
  };

  const openKmModal = (trip: any) => {
    const fact = trip.executionFacts?.[0];
    setKmModalTrip({
      trip,
      actualKm:
        trip.actualKm !== undefined && trip.actualKm !== null
          ? String(trip.actualKm)
          : '28.5',
      otHours:
        fact?.otHours !== undefined && fact?.otHours !== null
          ? String(fact.otHours)
          : '0',
      tollFeeAmount:
        trip.tollFeeAmount !== undefined && trip.tollFeeAmount !== null
          ? String(trip.tollFeeAmount)
          : '0',
      executionNote: fact?.executionNote || trip.notes || '',
    });
  };

  const handleConfirm = async (trip: any) => {
    try {
      await gqlRequest(
        `mutation ConfirmMyTrip($id: BigInt!) { confirmTrip(id: $id) { id status } }`,
        { id: trip.id }
      );
      showToast(`Đã xác nhận nhận chuyến ${trip.tripCode}`);
      loadDriverTrips();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStart = async (trip: any) => {
    try {
      const startOdoVal =
        startOdometer.trim() !== '' && Number(startOdometer) >= 0
          ? String(startOdometer.trim())
          : undefined;

      await gqlRequest(
        `mutation StartMyTrip($id: BigInt!, $startOdometerKm: Decimal) {
          startTrip(id: $id, startOdometerKm: $startOdometerKm) {
            id
            status
            startOdometerKm
          }
        }`,
        {
          id: trip.id,
          startOdometerKm: startOdoVal,
        }
      );
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
      if (
        trip.startOdometerKm !== null &&
        trip.startOdometerKm !== undefined &&
        endOdometer.trim() !== ''
      ) {
        if (Number(endOdometer) < Number(trip.startOdometerKm)) {
          alert(
            `Số công-tơ-mét kết thúc (${endOdometer}) không được nhỏ hơn số công-tơ-mét xuất phát (${trip.startOdometerKm})`
          );
          return;
        }
      }

      await gqlRequest(
        `mutation CompleteMyTrip(
          $id: BigInt!
          $endOdometerKm: Decimal
          $actualPassengerCount: Int
          $tollFeeAmount: Decimal
          $executionNote: String
        ) {
          completeTrip(
            id: $id
            endOdometerKm: $endOdometerKm
            actualPassengerCount: $actualPassengerCount
            tollFeeAmount: $tollFeeAmount
            executionNote: $executionNote
          ) {
            id
            status
            actualKm
            endOdometerKm
          }
        }`,
        {
          id: trip.id,
          endOdometerKm:
            endOdometer.trim() !== '' ? String(endOdometer.trim()) : undefined,
          actualPassengerCount:
            actualPassengers.trim() !== '' ? Number(actualPassengers) : undefined,
          tollFeeAmount:
            tollFee.trim() !== '' && Number(tollFee) >= 0
              ? String(tollFee.trim())
              : undefined,
          executionNote: executionNote.trim() || undefined,
        }
      );
      setCompleteModalTrip(null);
      setEndOdometer('');
      setActualPassengers('');
      setTollFee('');
      setExecutionNote('');
      showToast(`Đã hoàn thành chuyến ${trip.tripCode}`);
      loadDriverTrips();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveKmModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kmModalTrip) return;
    const kmVal = Number(kmModalTrip.actualKm);
    if (!Number.isFinite(kmVal) || kmVal <= 0) {
      alert('Số KM thực tế phải lớn hơn 0');
      return;
    }
    try {
      await gqlRequest(
        `mutation DriverUpdateKm(
          $id: BigInt!
          $actualKm: Decimal!
          $otHours: Decimal
          $tollFeeAmount: Decimal
          $executionNote: String
        ) {
          updateTripActualKm(
            id: $id
            actualKm: $actualKm
            otHours: $otHours
            tollFeeAmount: $tollFeeAmount
            executionNote: $executionNote
          ) {
            id
            actualKm
          }
        }`,
        {
          id: kmModalTrip.trip.id,
          actualKm: String(kmVal),
          otHours:
            kmModalTrip.otHours !== '' ? String(kmModalTrip.otHours) : undefined,
          tollFeeAmount:
            kmModalTrip.tollFeeAmount !== ''
              ? String(kmModalTrip.tollFeeAmount)
              : undefined,
          executionNote: kmModalTrip.executionNote || undefined,
        }
      );
      showToast(`Đã cập nhật KM thực tế (${kmVal} km) cho chuyến ${kmModalTrip.trip.tripCode}`);
      setKmModalTrip(null);
      loadDriverTrips();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredTrips = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return trips
      .filter((t) => !businessDate || t.businessDate === businessDate)
      .filter((t) => {
        if (activeTab !== 'ALL') return true;
        if (!statusFilter) return true;
        if (statusFilter === 'DISPATCHED') {
          return t.status === 'DISPATCHED' || t.status === 'WAITING_DRIVER_CONFIRM';
        }
        return t.status === statusFilter;
      })
      .filter((t) => {
        if (!tripTypeFilter) return true;
        if (tripTypeFilter === 'FIXED_ROUTE') {
          return t.dispatchType === 'FIXED_ROUTE' || t.tripType === 'FIXED_ROUTE';
        }
        if (tripTypeFilter === 'SUPPLEMENT') {
          return t.dispatchType === 'SUPPLEMENT' || t.tripType === 'SUPPLEMENT';
        }
        if (tripTypeFilter === 'DISPATCH') {
          return ['DISPATCH', 'AD_HOC', 'MERGED'].includes(t.dispatchType);
        }
        return t.tripType === tripTypeFilter;
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
  }, [trips, businessDate, activeTab, statusFilter, tripTypeFilter, search]);

  const driverPaging = usePagination(filteredTrips, 20);

  const showStepCards = activeTab !== 'ALL' || viewMode === 'CARDS';

  return (
    <div>
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#00897b] text-white px-4 py-2.5 rounded-[8px] shadow-lg text-[13px] font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}

      {/* 1. Underline Tabs */}
      <div className="flex flex-wrap items-center justify-between border-b border-[#e5e7eb] mb-3">
        <LegacyTabs
          tabs={[
            { id: 'ALL', label: 'Chuyến' },
            { id: 'CONFIRM', label: 'Xác nhận' },
            { id: 'START', label: 'Bắt đầu' },
            { id: 'COMPLETE', label: 'Hoàn thành' },
            { id: 'COMPLETED_LIST', label: 'Lịch sử chạy' },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {/* Toggle Card / Table View */}
        <div className="flex items-center gap-1 pr-2">
          <button
            type="button"
            onClick={() => setViewMode('TABLE')}
            className={`h-[30px] px-2.5 rounded-[6px] text-[12px] font-medium flex items-center gap-1 cursor-pointer ${
              !showStepCards
                ? 'bg-[#00897b] text-white'
                : 'bg-[#f3f4f6] text-[#4b5563] hover:bg-[#e5e7eb]'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            Bảng
          </button>
          <button
            type="button"
            onClick={() => setViewMode('CARDS')}
            className={`h-[30px] px-2.5 rounded-[6px] text-[12px] font-medium flex items-center gap-1 cursor-pointer ${
              showStepCards
                ? 'bg-[#00897b] text-white'
                : 'bg-[#f3f4f6] text-[#4b5563] hover:bg-[#e5e7eb]'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Thẻ hành trình
          </button>
        </div>
      </div>

      {/* 2. Filters Row (Always available) */}
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <FloatingDateFilter
          label="Ngày"
          value={businessDate}
          onChange={setBusinessDate}
        />
        <FloatingSelect
          label="Tài xế"
          value={driverIdFilter}
          onChange={setDriverIdFilter}
          options={drivers.map((d) => ({
            value: String(d.id),
            label: `${d.driverName} (${d.phoneNumber})`,
          }))}
        />
        <FloatingSelect
          label="Loại chuyến đi"
          value={tripTypeFilter}
          onChange={setTripTypeFilter}
          options={[
            { value: 'FIXED_ROUTE', label: 'Tuyến cố định' },
            { value: 'SUPPLEMENT', label: 'Tuyến bổ sung' },
            { value: 'DISPATCH', label: 'Điều chuyến' },
          ]}
        />
        {activeTab === 'ALL' && (
          <FloatingSelect
            label="Trạng thái"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'DISPATCHED', label: 'Chờ tài xế xác nhận' },
              { value: 'DRIVER_CONFIRMED', label: 'Tài xế đã xác nhận' },
              { value: 'IN_PROGRESS', label: 'Đang chạy' },
              { value: 'COMPLETED', label: 'Hoàn thành' },
              { value: 'CANCELLED', label: 'Đã hủy' },
            ]}
          />
        )}
      </div>

      {!showStepCards ? (
        <>
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

          {/* 4. Table */}
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left border-collapse">
              <thead>
                <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] text-[13px] font-semibold text-[#1f2937]">
                  <th className="px-2 w-[3.5%]">#</th>
                  <th className="px-2 w-[13%]">Loại chuyến đi</th>
                  <th className="px-2 w-[13%]">Trạng thái</th>
                  <th className="px-2 w-[11.5%]">Tài xế</th>
                  <th className="px-2 w-[9%]">Xe</th>
                  <th className="px-2 w-[16.5%]">Tuyến</th>
                  <th className="px-1.5 w-[14%]">Khung giờ</th>
                  <th className="px-2 w-[8.5%]">Quãng đường</th>
                  <th className="px-2 w-[11%]">Chế độ xác nhận</th>
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
                      onClick={() => setDetailTrip(trip)}
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
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] font-semibold text-[#0f766e]">
                            {trip.tripCode}
                          </span>
                          <div>{renderTripTypeBadge(trip.dispatchType, isDeadhead)}</div>
                        </div>
                      </td>
                      <td className="px-2.5">
                        {renderRequestStatusBadge(trip.status)}
                      </td>
                      <td className="px-2.5 text-[#1f2937] truncate">
                        {trip.driverNameSnapshot || '—'}
                      </td>
                      <td className="px-2.5 font-medium text-[#1f2937] truncate">
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
                          trip.actualStartAt || trip.plannedDepartureAt,
                          trip.actualEndAt || trip.plannedArrivalAt,
                          trip.businessDate
                        )}
                      </td>
                      <td className="px-2.5 font-medium text-[#374151]">
                        {trip.actualKm !== undefined && trip.actualKm !== null
                          ? `${Number(trip.actualKm)} km`
                          : '—'}
                      </td>
                      <td className="px-2.5 text-[#1f2937]">
                        {trip.dispatchType === 'FIXED_ROUTE' ? 'Tự động / Tài xế' : 'Tài xế'}
                      </td>
                    </tr>
                  );
                })}
                {filteredTrips.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-[13px] text-[#9ca3af]">
                      Không có chuyến đi nào khớp bộ lọc
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
        /* Step Cards View */
        <div className="max-w-[780px] mx-auto py-2 space-y-4">
          <span className="sr-only">Xác nhận chuyến tài xế</span>

          {/* Step Header Card */}
          <div className="bg-white border border-[#e5e7eb] rounded-[10px] px-5 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-bold text-[#1f2937]">
                {activeTab === 'CONFIRM'
                  ? 'Bước 1: Xác nhận nhận chuyến (WAITING_CONFIRM)'
                  : activeTab === 'START'
                    ? 'Bước 2: Bắt đầu chuyến (CONFIRMED)'
                    : activeTab === 'COMPLETE'
                      ? 'Bước 3: Kết thúc chuyến & chi phí (IN_PROGRESS)'
                      : activeTab === 'COMPLETED_LIST'
                        ? 'Danh sách chuyến đã hoàn thành (COMPLETED)'
                        : 'Danh sách hành trình tài xế'}
              </h3>
              <p className="text-[12px] text-[#6b7280] mt-0.5">
                {activeTab === 'CONFIRM'
                  ? 'Kiểm tra các chuyến được phân công và xác nhận sẵn sàng lái xe.'
                  : activeTab === 'START'
                    ? 'Ghi nhận số công-tơ-mét xuất phát trước khi khởi hành.'
                    : activeTab === 'COMPLETE'
                      ? 'Ghi nhận số công-tơ-mét kết thúc, số lượng hành khách thực tế và phí cầu đường.'
                      : 'Bấm vào từng thẻ hành trình để xem chi tiết lộ trình, hành khách và cập nhật chỉ số.'}
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
                  onClick={() => setDetailTrip(trip)}
                  className="bg-white border border-[#e5e7eb] hover:border-[#00897b] rounded-[10px] p-5 space-y-2.5 cursor-pointer transition-colors"
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
                        trip.actualStartAt || trip.plannedDepartureAt,
                        trip.actualEndAt || trip.plannedArrivalAt,
                        trip.businessDate
                      )}
                    </span>
                    <span className="font-semibold text-[#1f2937]">
                      {trip.vehiclePlateSnapshot || '—'}
                    </span>
                    <span>{trip.driverNameSnapshot || '—'}</span>
                    <span>
                      Hành khách:{' '}
                      {trip.actualPassengerCount ?? trip.passengerCount ?? 0}
                    </span>
                    {trip.actualKm != null && (
                      <span className="font-semibold text-[#0f766e]">
                        Quãng đường: {Number(trip.actualKm)} km
                      </span>
                    )}
                  </div>
                  <div
                    className="pt-1 flex flex-wrap items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setDetailTrip(trip)}
                      className="h-[32px] px-3 rounded-[6px] border border-[#00897b] text-[#00897b] text-[12px] font-medium hover:bg-[#f0fdf4] cursor-pointer"
                    >
                      Xem chi tiết
                    </button>
                    {['DISPATCHED', 'WAITING_DRIVER_CONFIRM'].includes(trip.status) && (
                      <button
                        type="button"
                        onClick={() => handleConfirm(trip)}
                        className="h-[32px] px-3.5 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[12px] font-medium cursor-pointer"
                      >
                        Xác nhận nhận chuyến
                      </button>
                    )}
                    {trip.dispatchType !== 'FIXED_ROUTE' &&
                      ['DISPATCHED', 'WAITING_DRIVER_CONFIRM', 'DRIVER_CONFIRMED'].includes(
                        trip.status
                      ) && (
                        <button
                          type="button"
                          onClick={() => openStartModal(trip)}
                          className="h-[32px] px-3.5 rounded-[6px] bg-[#0284c7] hover:bg-[#0369a1] text-white text-[12px] font-medium cursor-pointer"
                        >
                          Bắt đầu chuyến
                        </button>
                      )}
                    {trip.dispatchType !== 'FIXED_ROUTE' &&
                      trip.status === 'IN_PROGRESS' && (
                        <button
                          type="button"
                          onClick={() => openCompleteModal(trip)}
                          className="h-[32px] px-3.5 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[12px] font-medium cursor-pointer"
                        >
                          Hoàn thành chuyến
                        </button>
                      )}
                    <button
                      type="button"
                      onClick={() => openKmModal(trip)}
                      className="h-[32px] px-3 rounded-[6px] border border-[#d97706] text-[#d97706] text-[12px] font-medium hover:bg-[#fffbeb] cursor-pointer"
                    >
                      Cập nhật KM
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredTrips.length === 0 && (
              <div className="bg-white border border-[#e5e7eb] rounded-[10px] py-10 text-center text-[13px] text-[#9ca3af]">
                Không có chuyến xe nào trong danh mục này
              </div>
            )}
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
              label: 'Xem chi tiết chuyến đi',
              icon: <Eye className="w-4 h-4 text-[#4b5563]" />,
              onClick: () => setDetailTrip(contextRow.trip),
            },
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
                !['DISPATCHED', 'WAITING_DRIVER_CONFIRM', 'DRIVER_CONFIRMED'].includes(
                  contextRow.trip.status
                ),
              onClick: () => openStartModal(contextRow.trip),
            },
            {
              label: 'Hoàn thành chuyến',
              icon: <Flag className="w-4 h-4 text-[#00897b]" />,
              disabled:
                contextRow.trip.dispatchType === 'FIXED_ROUTE' ||
                contextRow.trip.status !== 'IN_PROGRESS',
              onClick: () => openCompleteModal(contextRow.trip),
            },
            {
              label: 'Cập nhật KM thực tế',
              icon: <Gauge className="w-4 h-4 text-[#d97706]" />,
              onClick: () => openKmModal(contextRow.trip),
            },
          ]}
        />
      )}

      {/* ==================================================================== */}
      {/* DRAWER: DRIVER TRIP DETAIL DRAWER */}
      {/* ==================================================================== */}
      {detailTrip && (
        <div className="fixed inset-0 z-50 bg-black/35 flex justify-end">
          <div className="bg-white w-full max-w-[700px] h-full shadow-2xl border-l border-[#e5e7eb] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb] bg-[#f8fafc]">
              <div className="flex items-center gap-2.5">
                <h3 className="text-[15px] font-bold text-[#1f2937]">
                  {detailTrip.tripCode} — Chi tiết hành trình tài xế
                </h3>
                {renderRequestStatusBadge(detailTrip.status)}
              </div>
              <button
                type="button"
                onClick={() => setDetailTrip(null)}
                className="text-[#4b5563] hover:text-[#1f2937] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-[13px]">
              {/* Lộ trình & Phương tiện */}
              <div className="border border-[#e5e7eb] rounded-[8px] p-4 bg-white space-y-2.5">
                <h4 className="text-[13px] font-bold text-[#0f766e] uppercase flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  1. Lộ trình & Thời gian vận hành
                </h4>
                <div className="grid grid-cols-2 gap-y-2 gap-x-6">
                  <div className="flex justify-between border-b border-[#f3f4f6] pb-1.5">
                    <span className="text-[#6b7280]">Ngày chạy:</span>
                    <span className="font-semibold text-[#1f2937]">
                      {detailTrip.businessDate}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#f3f4f6] pb-1.5">
                    <span className="text-[#6b7280]">Phương tiện:</span>
                    <span className="font-bold text-[#1f2937]">
                      {detailTrip.vehiclePlateSnapshot || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#f3f4f6] pb-1.5">
                    <span className="text-[#6b7280]">Tài xế:</span>
                    <span className="font-semibold text-[#1f2937]">
                      {detailTrip.driverNameSnapshot || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#f3f4f6] pb-1.5">
                    <span className="text-[#6b7280]">Điện thoại tài xế:</span>
                    <span className="text-[#0284c7] font-medium">
                      {detailTrip.driverPhoneSnapshot || '—'}
                    </span>
                  </div>
                  <div className="col-span-2 flex justify-between border-b border-[#f3f4f6] pb-1.5">
                    <span className="text-[#6b7280]">Tuyến / Điểm đón → Điểm trả:</span>
                    <span className="font-medium text-[#1f2937]">
                      {detailTrip.route
                        ? `${detailTrip.route.routeCode} - ${detailTrip.route.routeName}`
                        : `${detailTrip.departurePickupPointText || 'Điểm đón'} → ${
                            detailTrip.departureDropoffPointText || 'Điểm trả'
                          }`}
                    </span>
                  </div>
                  <div className="col-span-2 flex justify-between">
                    <span className="text-[#6b7280]">Khung giờ kế hoạch / thực tế:</span>
                    <span className="font-semibold text-[#0f766e]">
                      {formatDriverTimeWindow(
                        detailTrip.actualStartAt || detailTrip.plannedDepartureAt,
                        detailTrip.actualEndAt || detailTrip.plannedArrivalAt,
                        detailTrip.businessDate
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Chỉ số Công-tơ-mét & KM thực tế */}
              <div className="border border-[#e5e7eb] rounded-[8px] p-4 bg-white">
                <h4 className="text-[13px] font-bold text-[#0f766e] uppercase mb-3 flex items-center gap-1.5">
                  <Gauge className="w-4 h-4" />
                  2. Chỉ số Công-tơ-mét & Quãng đường
                </h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-[#f8fafc] p-2.5 rounded border border-[#e5e7eb]">
                    <div className="text-[11px] text-[#6b7280]">Odo xuất phát</div>
                    <div className="text-[14px] font-bold text-[#1f2937]">
                      {detailTrip.startOdometerKm ?? '—'}
                    </div>
                  </div>
                  <div className="bg-[#f8fafc] p-2.5 rounded border border-[#e5e7eb]">
                    <div className="text-[11px] text-[#6b7280]">Odo kết thúc</div>
                    <div className="text-[14px] font-bold text-[#1f2937]">
                      {detailTrip.endOdometerKm ?? '—'}
                    </div>
                  </div>
                  <div className="bg-[#f0fdf4] p-2.5 rounded border border-[#bbf7d0]">
                    <div className="text-[11px] text-[#0f766e]">KM thực tế</div>
                    <div className="text-[14px] font-bold text-[#0f766e]">
                      {detailTrip.actualKm != null
                        ? `${Number(detailTrip.actualKm)} km`
                        : 'Chưa nhập'}
                    </div>
                  </div>
                  <div className="bg-[#f8fafc] p-2.5 rounded border border-[#e5e7eb]">
                    <div className="text-[11px] text-[#6b7280]">Phí cầu đường</div>
                    <div className="text-[14px] font-bold text-[#d97706]">
                      {detailTrip.tollFeeAmount
                        ? `${Number(detailTrip.tollFeeAmount).toLocaleString('vi-VN')} đ`
                        : '0 đ'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Danh sách Đơn hàng / Hành khách liên kết */}
              <div className="border border-[#e5e7eb] rounded-[8px] p-4 bg-white space-y-3">
                <h4 className="text-[13px] font-bold text-[#0f766e] uppercase flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  3. Đơn yêu cầu & Hành khách trên chuyến (
                  {detailTrip.actualPassengerCount ?? detailTrip.passengerCount ?? 0} khách)
                </h4>
                {(detailTrip.requestLinks || []).length === 0 ? (
                  <div className="text-[12px] text-[#9ca3af] py-3 text-center bg-[#f9fafb] rounded">
                    Chuyến đưa đón tuyến cố định ({detailTrip.passengerCount ?? 0} khách theo danh
                    sách đăng ký tuyến)
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(detailTrip.requestLinks || []).map((link: any) => {
                      const req = link.request;
                      if (!req) return null;
                      return (
                        <div
                          key={link.id}
                          className="border border-[#e5e7eb] rounded-[6px] p-3 bg-[#f8fafc] space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#0f766e]">
                              {req.requestCode} — {req.requesterName} ({req.departmentName})
                            </span>
                            <PastelBadge
                              label={`${req.passengerCount} khách`}
                              tone="teal"
                            />
                          </div>
                          <div className="text-[12px] text-[#374151]">
                            <strong>Điểm đón → trả:</strong>{' '}
                            {req.departurePickupPointText || 'Điểm đón'} →{' '}
                            {req.departureDropoffPointText || 'Điểm trả'}
                          </div>
                          {(req.contactName || req.contactPhone) && (
                            <div className="flex items-center gap-2 text-[12px] text-[#0284c7]">
                              <Phone className="w-3.5 h-3.5" />
                              <span>
                                Liên hệ đón: {req.contactName || req.requesterName} (
                                {req.contactPhone ? (
                                  <a
                                    href={`tel:${req.contactPhone}`}
                                    className="underline font-semibold"
                                  >
                                    {req.contactPhone}
                                  </a>
                                ) : (
                                  '—'
                                )}
                                )
                              </span>
                            </div>
                          )}
                          {(req.senderInfo || req.receiverInfo) && (
                            <div className="flex items-center gap-2 text-[12px] text-[#92400e]">
                              <Package className="w-3.5 h-3.5" />
                              <span>
                                Hàng hóa — Người gửi: {req.senderInfo || '—'} | Người nhận:{' '}
                                {req.receiverInfo || '—'}
                              </span>
                            </div>
                          )}
                          {(req.passengers || []).length > 0 && (
                            <div className="pt-1 border-t border-[#e5e7eb] text-[11px] text-[#4b5563]">
                              <strong>Hành khách: </strong>
                              {req.passengers
                                .map((p: any) => `${p.passengerName} (${p.passengerId || 'Khách'})`)
                                .join(', ')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-3.5 border-t border-[#e5e7eb] bg-[#f8fafc] flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {['DISPATCHED', 'WAITING_DRIVER_CONFIRM'].includes(detailTrip.status) && (
                  <button
                    type="button"
                    onClick={() => handleConfirm(detailTrip)}
                    className="h-[34px] px-3.5 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Xác nhận nhận chuyến
                  </button>
                )}
                {detailTrip.dispatchType !== 'FIXED_ROUTE' &&
                  ['DISPATCHED', 'WAITING_DRIVER_CONFIRM', 'DRIVER_CONFIRMED'].includes(
                    detailTrip.status
                  ) && (
                    <button
                      type="button"
                      onClick={() => openStartModal(detailTrip)}
                      className="h-[34px] px-3.5 rounded-[6px] bg-[#0284c7] hover:bg-[#0369a1] text-white text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Bắt đầu chuyến
                    </button>
                  )}
                {detailTrip.dispatchType !== 'FIXED_ROUTE' &&
                  detailTrip.status === 'IN_PROGRESS' && (
                    <button
                      type="button"
                      onClick={() => openCompleteModal(detailTrip)}
                      className="h-[34px] px-3.5 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      Hoàn thành chuyến
                    </button>
                  )}
                <button
                  type="button"
                  onClick={() => openKmModal(detailTrip)}
                  className="h-[34px] px-3.5 rounded-[6px] border border-[#d97706] bg-white text-[#d97706] text-[12px] font-semibold hover:bg-[#fffbeb] flex items-center gap-1.5 cursor-pointer"
                >
                  <Gauge className="w-3.5 h-3.5" />
                  Cập nhật KM
                </button>
              </div>
              <button
                type="button"
                onClick={() => setDetailTrip(null)}
                className="h-[34px] px-4 rounded-[6px] border border-[#d1d5db] bg-white text-[#374151] text-[12px] font-medium hover:bg-[#f3f4f6] cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: BẮT ĐẦU CHUYẾN (Start Trip Modal) */}
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
                <span className="text-[#6b7280]">Tuyến / Lộ trình:</span>
                <span className="font-medium text-[#1f2937] truncate max-w-[240px]">
                  {startModalTrip.route?.routeName ||
                    `${startModalTrip.departurePickupPointText || 'Điểm đón'} → ${
                      startModalTrip.departureDropoffPointText || 'Điểm trả'
                    }`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6b7280]">Xe:</span>
                <span className="font-medium text-[#1f2937]">
                  {startModalTrip.vehiclePlateSnapshot || '—'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#374151] mb-1">
                Số công-tơ-mét đầu (Km lúc xuất phát)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={startOdometer}
                onChange={(e) => setStartOdometer(e.target.value)}
                placeholder="Km lúc xuất phát"
                className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
              />
            </div>

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

      {/* MODAL 2: HOÀN THÀNH CHUYẾN (Complete Trip Modal) */}
      {completeModalTrip && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-[#e5e7eb] w-full max-w-[460px] p-6 space-y-4">
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
                <span className="text-[#6b7280]">Tuyến / Lộ trình:</span>
                <span className="font-medium text-[#1f2937] truncate max-w-[240px]">
                  {completeModalTrip.route?.routeName ||
                    `${completeModalTrip.departurePickupPointText || 'Điểm đón'} → ${
                      completeModalTrip.departureDropoffPointText || 'Điểm trả'
                    }`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6b7280]">Xe:</span>
                <span className="font-medium text-[#1f2937]">
                  {completeModalTrip.vehiclePlateSnapshot || '—'}
                </span>
              </div>
              {completeModalTrip.startOdometerKm != null && (
                <div className="flex items-center justify-between text-[#0f766e]">
                  <span>Công-tơ-mét đầu:</span>
                  <span className="font-bold">
                    {Number(completeModalTrip.startOdometerKm)} km
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-[#6b7280] mb-1">
                  Số công-tơ-mét cuối (Km lúc kết thúc)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={endOdometer}
                  onChange={(e) => setEndOdometer(e.target.value)}
                  placeholder="Km lúc kết thúc"
                  className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                />
                {completeModalTrip.startOdometerKm != null &&
                  endOdometer !== '' &&
                  Number(endOdometer) > Number(completeModalTrip.startOdometerKm) && (
                    <div className="text-[11px] text-[#0f766e] font-semibold mt-1">
                      Quãng đường tự tính:{' '}
                      {(
                        Number(endOdometer) - Number(completeModalTrip.startOdometerKm)
                      ).toFixed(1)}{' '}
                      km
                    </div>
                  )}
              </div>
              <div>
                <label className="block text-[11px] text-[#6b7280] mb-1">
                  Số hành khách thực tế trên xe
                </label>
                <input
                  type="number"
                  min="0"
                  value={actualPassengers}
                  onChange={(e) => setActualPassengers(e.target.value)}
                  placeholder="Hành khách thực tế trên xe"
                  className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#6b7280] mb-1">
                  Phí cầu đường / gửi xe / BOT (VNĐ)
                </label>
                <input
                  type="number"
                  step="1000"
                  min="0"
                  value={tollFee}
                  onChange={(e) => setTollFee(e.target.value)}
                  placeholder="Phí cầu đường / gửi xe / BOT (VNĐ)"
                  className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#6b7280] mb-1">
                  Ghi chú thực hiện
                </label>
                <textarea
                  rows={2}
                  value={executionNote}
                  onChange={(e) => setExecutionNote(e.target.value)}
                  placeholder="Ghi chú phát sinh trên hành trình (nếu có)..."
                  className="w-full border border-[#d1d5db] rounded-[6px] px-3 py-2 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                />
              </div>
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

      {/* MODAL 3: CẬP NHẬT KM THỰC TẾ (updateTripActualKm) */}
      {kmModalTrip && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveKmModal}
            className="bg-white rounded-[12px] shadow-2xl border border-[#e5e7eb] w-full max-w-[440px] p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-[#1f2937]">
                Cập nhật KM thực tế ({kmModalTrip.trip.tripCode})
              </h3>
              <button
                type="button"
                onClick={() => setKmModalTrip(null)}
                className="text-[#6b7280] hover:text-[#1f2937] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-[13px]">
              <div>
                <label className="block text-[11px] text-[#6b7280] mb-1">
                  Số KM thực tế (* &gt; 0)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  value={kmModalTrip.actualKm}
                  onChange={(e) =>
                    setKmModalTrip({ ...kmModalTrip, actualKm: e.target.value })
                  }
                  className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#6b7280] mb-1">
                  Giờ OT phát sinh
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={kmModalTrip.otHours}
                  onChange={(e) =>
                    setKmModalTrip({ ...kmModalTrip, otHours: e.target.value })
                  }
                  className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#6b7280] mb-1">
                  Phí cầu đường (VNĐ)
                </label>
                <input
                  type="number"
                  step="1000"
                  min="0"
                  value={kmModalTrip.tollFeeAmount}
                  onChange={(e) =>
                    setKmModalTrip({
                      ...kmModalTrip,
                      tollFeeAmount: e.target.value,
                    })
                  }
                  className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#6b7280] mb-1">
                  Ghi chú thực hiện
                </label>
                <textarea
                  rows={2}
                  value={kmModalTrip.executionNote}
                  onChange={(e) =>
                    setKmModalTrip({
                      ...kmModalTrip,
                      executionNote: e.target.value,
                    })
                  }
                  className="w-full border border-[#d1d5db] rounded-[6px] px-3 py-2 text-[13px]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setKmModalTrip(null)}
                className="h-[34px] px-4 rounded-[6px] border border-[#d1d5db] bg-white text-[#374151] text-[13px] font-medium cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="h-[34px] px-4 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-semibold cursor-pointer"
              >
                Lưu KM
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
