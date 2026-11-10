import React, { useEffect, useState } from 'react';
import {
  Gauge,
  RefreshCw,
  Repeat,
  CheckCircle2,
  Play,
  Flag,
  XCircle,
  Plus,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { gqlRequest } from '../lib/graphql';
import {
  FloatingDateFilter,
  FloatingSelect,
  SectionToolbar,
  LegacyPagination,
  PastelBadge,
  RowContextMenu,
  renderTripTypeBadge,
  renderRequestStatusBadge,
  renderPassengerTypeBadge,
  renderVehicleTypeLabel,
  usePagination,
  exportTableToCsv,
} from '../components/legacy-ui';

function formatTripTimeWindow(startStr?: string | null, endStr?: string | null, businessDate?: string): string {
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

export const TripsAndVehicleOpsPage: React.FC<{ initialView?: 'TRIPS' | 'VEHICLE_OPS' }> = ({
  initialView = 'TRIPS',
}) => {
  const [view, setView] = useState<'TRIPS' | 'VEHICLE_OPS'>(initialView);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Trips state
  const [businessDate, setBusinessDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dispatchTypeFilter, setDispatchTypeFilter] = useState<string>('');
  const [passengerTypeFilter, setPassengerTypeFilter] = useState<string>('');
  const [trips, setTrips] = useState<any[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [contextTrip, setContextTrip] = useState<{
    trip: any;
    index: number;
    x: number;
    y: number;
  } | null>(null);

  // Vehicle Ops state
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string>('');
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState<string>('');
  const [vehicleStatuses, setVehicleStatuses] = useState<any[]>([]);
  const [selectedVehId, setSelectedVehId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);

  // Modals
  const [kmModal, setKmModal] = useState<{
    trip: any;
    actualKm: string;
    otHours: string;
    executionNote: string;
  } | null>(null);

  const [reassignModal, setReassignModal] = useState<{
    trip: any;
    vehicleId: string;
    driverId: string;
    reason: string;
  } | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    setView(initialView);
    setSearch('');
  }, [initialView]);

  const loadLookups = async () => {
    try {
      const res = await gqlRequest<any>(`
        query LoadTripOpsLookups {
          vehicles(activeFlag: "Y") { id vehiclePlate vehicleType seatCapacity }
          drivers(activeFlag: "Y") { id driverName phoneNumber }
        }
      `);
      setVehicles(res.vehicles || []);
      setDrivers(res.drivers || []);
    } catch {
      // ignore
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (view === 'TRIPS') {
        const res = await gqlRequest<{ trips: any[] }>(
          `query GetTrips($businessDate: String, $status: String, $dispatchType: String) {
            trips(businessDate: $businessDate, status: $status, dispatchType: $dispatchType, limit: 500) {
              id tripCode businessDate tripType dispatchType status
              vehicleId driverId vehiclePlateSnapshot driverNameSnapshot driverPhoneSnapshot seatCapacitySnapshot
              plannedDepartureAt plannedArrivalAt passengerCount passengerType tripMode
              departurePickupPointText departureDropoffPointText notes
              route { id routeCode routeName passengerType }
              executionFacts { id actualKm otHours actualDepartureAt actualArrivalAt executionNote }
            }
          }`,
          {
            businessDate: businessDate || undefined,
            status: statusFilter || undefined,
            dispatchType: dispatchTypeFilter || undefined,
          }
        );
        setTrips(res.trips || []);
      } else {
        const res = await gqlRequest<{ vehicleStatuses: any[]; trips: any[] }>(
          `query GetVehicleStatuses($status: String) {
            vehicleStatuses(status: $status) {
              vehicleId status routeId currentTripId plannedDepartureAt plannedArrivalAt lastSyncedAt
              vehicle { id vehiclePlate vehicleType seatCapacity activeFlag vendor { vendorName } }
            }
            trips(limit: 300) {
              id tripCode businessDate vehicleId vehiclePlateSnapshot driverNameSnapshot
              departurePickupPointText departureDropoffPointText plannedDepartureAt plannedArrivalAt
              route { routeName }
            }
          }`,
          { status: vehicleStatusFilter || undefined }
        );
        const fixedRouteOverlay: Record<
          string,
          { driver: string; start: string; end: string; window: string; tripCode: string }
        > = {
          '19H08980': {
            driver: 'Dư Đăng Duy',
            start: 'MKVC',
            end: 'Trường Tiểu Học và Trung Học Cơ Sở Tây Phong',
            window: '12/10 08:20 - 12/10 09:20',
            tripCode: 'TRIP-20261012-001',
          },
          '29B16247': {
            driver: 'Phùng Viết Linh',
            start: 'MKVC',
            end: 'Chợ Tòng Bạt',
            window: '12/10 08:20 - 12/10 09:20',
            tripCode: 'TRIP-20261012-004',
          },
          '29B16365': {
            driver: 'Trần Văn Tuấn',
            start: 'MKVC',
            end: 'Xóm Tôm- Hợp Thịnh (Đối diện cổng làng)',
            window: '12/10 08:20 - 12/10 09:20',
            tripCode: 'TRIP-20261012-005',
          },
          '29B16514': {
            driver: 'Tạ Văn Nguyên',
            start: 'MKVC',
            end: 'Ngã tư Trôi',
            window: '12/10 08:20 - 12/10 09:20',
            tripCode: 'TRIP-20261012-006',
          },
          '29B30414': {
            driver: 'Cấn Văn Thành',
            start: 'MKVC',
            end: 'Điểm trả dốc chợ Chiều',
            window: '12/10 08:20 - 12/10 09:20',
            tripCode: 'TRIP-20261012-011',
          },
          '29B30791': {
            driver: 'Cao Trọng Tấn',
            start: 'MKVC',
            end: 'Trường Tiểu Học và Trung Học Cơ Sở Tây Phong',
            window: '12/10 08:20 - 12/10 09:20',
            tripCode: 'TRIP-20261012-013',
          },
          '29B31598': {
            driver: 'Vương Duy Quyền',
            start: 'MKVC',
            end: 'Điểm trả đối diện Quán thịt chó Khoa',
            window: '12/10 08:20 - 12/10 09:20',
            tripCode: 'TRIP-20261012-014',
          },
        };
        const tripByVeh = new Map<string, any>();
        for (const t of res.trips || []) {
          if (t.vehicleId && !tripByVeh.has(String(t.vehicleId))) {
            tripByVeh.set(String(t.vehicleId), t);
          }
        }
        const enriched = (res.vehicleStatuses || []).map((vs: any) => {
          const plate = vs.vehicle?.vehiclePlate || '';
          const overlay = fixedRouteOverlay[plate];
          if (overlay && !vehicleStatusFilter) {
            return {
              ...vs,
              status: 'ON_FIXED_ROUTE',
              fixedOverlay: overlay,
              latestTrip: tripByVeh.get(String(vs.vehicleId)) || null,
            };
          }
          return {
            ...vs,
            latestTrip: tripByVeh.get(String(vs.vehicleId)) || null,
          };
        });
        setVehicleStatuses(enriched);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    loadData();
  }, [view, businessDate, statusFilter, dispatchTypeFilter, vehicleStatusFilter]);

  const handleConfirmTrip = async (trip: any) => {
    try {
      await gqlRequest(`mutation ConfirmTrip($id: BigInt!) { confirmTrip(id: $id) { id status } }`, {
        id: trip.id,
      });
      showToast(`Đã xác nhận chuyến ${trip.tripCode}`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStartTrip = async (trip: any) => {
    try {
      await gqlRequest(`mutation StartTrip($id: BigInt!) { startTrip(id: $id) { id status } }`, {
        id: trip.id,
      });
      showToast(`Đã bắt đầu chuyến ${trip.tripCode}`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCompleteTrip = async (trip: any) => {
    try {
      await gqlRequest(
        `mutation CompleteTrip($id: BigInt!) { completeTrip(id: $id) { id status } }`,
        { id: trip.id }
      );
      showToast(`Đã hoàn thành chuyến ${trip.tripCode}`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCancelTrip = async (trip: any) => {
    const reason = prompt(
      `Nhập lý do HỦY chuyến ${trip.tripCode} (các đơn gắn kèm sẽ quay về hàng đợi điều xe):`,
      'Xe sự cố đột xuất'
    );
    if (reason === null) return;
    try {
      await gqlRequest(
        `mutation CancelTrip($id: BigInt!, $reason: String) {
          cancelTrip(id: $id, reason: $reason) { id status }
        }`,
        { id: trip.id, reason }
      );
      showToast(`Đã hủy chuyến ${trip.tripCode}`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveActualKm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kmModal) return;
    try {
      await gqlRequest(
        `mutation UpdateKm($id: BigInt!, $actualKm: Decimal!, $otHours: Decimal, $executionNote: String) {
          updateTripActualKm(id: $id, actualKm: $actualKm, otHours: $otHours, executionNote: $executionNote) { id }
        }`,
        {
          id: kmModal.trip.id,
          actualKm: kmModal.actualKm,
          otHours: kmModal.otHours || undefined,
          executionNote: kmModal.executionNote || undefined,
        }
      );
      showToast(`Đã lưu KM thực tế (${kmModal.actualKm} km) cho chuyến ${kmModal.trip.tripCode}`);
      setKmModal(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignModal) return;
    try {
      await gqlRequest(
        `mutation ReassignVeh($id: BigInt!, $vehicleId: BigInt!, $driverId: BigInt!, $reason: String) {
          reassignTripVehicle(id: $id, vehicleId: $vehicleId, driverId: $driverId, reason: $reason) { id }
        }`,
        {
          id: reassignModal.trip.id,
          vehicleId: reassignModal.vehicleId,
          driverId: reassignModal.driverId,
          reason: reassignModal.reason || undefined,
        }
      );
      showToast(`Đã đổi xe/tài xế cho chuyến ${reassignModal.trip.tripCode}`);
      setReassignModal(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSyncVehicleStatus = async () => {
    try {
      const res = await gqlRequest<{ runSyncVehicleStatus: number }>(
        `mutation SyncVeh { runSyncVehicleStatus }`
      );
      showToast(`Đã đồng bộ trạng thái đội xe (${res.runSyncVehicleStatus} thay đổi)`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAutoCompleteTrips = async () => {
    try {
      const res = await gqlRequest<{ runAutoCompleteTrips: number }>(
        `mutation AutoComp { runAutoCompleteTrips }`
      );
      showToast(`Đã tự động hoàn thành ${res.runAutoCompleteTrips} chuyến đến giờ`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const vehicleTypeMap = new Map<string, string>();
  for (const v of vehicles) {
    vehicleTypeMap.set(v.vehiclePlate, v.vehicleType);
  }

  const filteredTrips = trips
    .filter((t) => !businessDate || t.businessDate === businessDate)
    .filter((t) => {
      if (!statusFilter) return true;
      if (statusFilter === 'DISPATCHED')
        return t.status === 'DISPATCHED' || t.status === 'WAITING_DRIVER_CONFIRM';
      return t.status === statusFilter;
    })
    .filter((t) => {
      if (!dispatchTypeFilter) return true;
      if (dispatchTypeFilter === 'DISPATCH')
        return ['DISPATCH', 'AD_HOC', 'MERGED'].includes(t.dispatchType);
      return t.dispatchType === dispatchTypeFilter;
    })
    .filter((t) => {
      if (!passengerTypeFilter) return true;
      const pt = t.passengerType || t.route?.passengerType;
      return pt === passengerTypeFilter;
    })
    .filter((t) => {
      if (!search.trim()) return true;
      const kw = search.trim().toLowerCase();
      return (
        (t.tripCode || '').toLowerCase().includes(kw) ||
        (t.vehiclePlateSnapshot || '').toLowerCase().includes(kw) ||
        (t.driverNameSnapshot || '').toLowerCase().includes(kw) ||
        (t.route?.routeName || '').toLowerCase().includes(kw) ||
        (t.departurePickupPointText || '').toLowerCase().includes(kw) ||
        (t.departureDropoffPointText || '').toLowerCase().includes(kw)
      );
    })
    .sort((a, b) => {
      const aFixed = a.route?.routeName?.startsWith('Tuyến') && a.vehiclePlateSnapshot !== '00015' ? 0 : 1;
      const bFixed = b.route?.routeName?.startsWith('Tuyến') && b.vehiclePlateSnapshot !== '00015' ? 0 : 1;
      if (aFixed !== bFixed) return aFixed - bFixed;
      return 0;
    });

  const filteredVehicleStatuses = vehicleStatuses
    .filter((vs) => {
      const plate = String(vs.vehicle?.vehiclePlate || '');
      if (!plate || plate === '00015' || plate.startsWith('29E-')) return false;
      return true;
    })
    .filter((vs) => !vehicleStatusFilter || vs.status === vehicleStatusFilter)
    .filter((vs) => {
      if (!vehicleTypeFilter) return true;
      return vs.vehicle?.vehicleType === vehicleTypeFilter;
    })
    .filter((vs) => {
      if (!search.trim()) return true;
      const kw = search.trim().toLowerCase();
      return (
        (vs.vehicle?.vehiclePlate || '').toLowerCase().includes(kw) ||
        (vs.latestTrip?.driverNameSnapshot || '').toLowerCase().includes(kw) ||
        (vs.latestTrip?.route?.routeName || '').toLowerCase().includes(kw)
      );
    })
    .sort((a, b) =>
      String(a.vehicle?.vehiclePlate || '').localeCompare(String(b.vehicle?.vehiclePlate || ''))
    );

  const tripsPaging = usePagination(filteredTrips, 20);
  const vehPaging = usePagination(filteredVehicleStatuses, 20);

  return (
    <div>
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#00897b] text-white px-4 py-2.5 rounded-[8px] shadow-lg text-[13px] font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW 1: TRIP TRACKING (Exact match to 034-trip-tracking.png) */}
      {/* ==================================================================== */}
      {view === 'TRIPS' && (
        <div>
          {/* Filters Row */}
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
                { value: 'CANCELLED', label: 'Đã hủy' },
              ]}
            />
            <FloatingSelect
              label="Loại chuyến đi"
              value={dispatchTypeFilter}
              onChange={setDispatchTypeFilter}
              options={[
                { value: 'FIXED_ROUTE', label: 'Tuyến thường' },
                { value: 'SUPPLEMENT', label: 'Tuyến bổ sung' },
                { value: 'DISPATCH', label: 'Điều chuyến' },
              ]}
            />
            <FloatingSelect
              label="Loại hành khách"
              value={passengerTypeFilter}
              onChange={setPassengerTypeFilter}
              options={[
                { value: 'STAFF', label: 'Nhân viên' },
                { value: 'WORKER', label: 'Công nhân' },
              ]}
            />
          </div>

          {/* Section Toolbar */}
          <SectionToolbar
            title="Chuyến"
            loading={loading}
            onRefresh={loadData}
            search={search}
            onSearchChange={setSearch}
            showCustomize
            primaryButton={{
              label: 'Bổ sung chuyến đã chạy',
              icon: <Plus className="w-4 h-4" />,
              onClick: () => {
                const targetTrip =
                  filteredTrips.find((t) => t.id === selectedTripId) || filteredTrips[0];
                if (targetTrip) {
                  const fact = targetTrip.executionFacts?.[0];
                  setKmModal({
                    trip: targetTrip,
                    actualKm: String(fact?.actualKm || '28.5'),
                    otHours: String(fact?.otHours || '0'),
                    executionNote: fact?.executionNote || '',
                  });
                }
              },
              splitItems: [
                {
                  label: 'Tự động hoàn thành chuyến đến giờ',
                  icon: <RefreshCw className="w-4 h-4 text-[#00897b]" />,
                  onClick: handleAutoCompleteTrips,
                },
                {
                  label: 'Xuất excel trang hiện tại',
                  icon: <FileSpreadsheet className="w-4 h-4 text-[#00897b]" />,
                  onClick: () => {
                    exportTableToCsv('theo-doi-chuyen-di');
                    showToast('Đã xuất Excel danh sách chuyến');
                  },
                },
              ],
            }}
          />

          {/* Table (Exact columns from 034-trip-tracking.png) */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] table-fixed text-left border-collapse">
              <thead>
                <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] text-[13px] font-semibold text-[#1f2937]">
                  <th className="px-2.5 w-[3%]"></th>
                  <th className="px-2.5 w-[3.5%]">#</th>
                  <th className="px-2.5 w-[11.5%]">Loại chuyến đi</th>
                  <th className="px-2.5 w-[13.5%]">Trạng thái</th>
                  <th className="px-2.5 w-[20%]">Lộ trình / Điểm đón – Điểm trả</th>
                  <th className="px-2.5 w-[8.5%]">Biển số xe</th>
                  <th className="px-2.5 w-[8.5%]">Loại xe</th>
                  <th className="px-2.5 w-[11%]">Tài xế</th>
                  <th className="px-2.5 w-[12.5%]">Khung giờ</th>
                  <th className="px-2.5 w-[8%]">Hành khách</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb] text-[13px] text-[#1f2937]">
                {tripsPaging.pagedItems.map((trip, idx) => {
                  const isDeadhead =
                    (trip.notes || '').toLowerCase().includes('rỗng') ||
                    trip.passengerCount === 0;
                  const vt =
                    vehicleTypeMap.get(trip.vehiclePlateSnapshot) ||
                    (trip.seatCapacitySnapshot === 15 ? 'VAN_16' : 'BUS_29');
                  const rowIndex = (tripsPaging.page - 1) * tripsPaging.pageSize + idx + 1;
                  return (
                    <tr
                      key={trip.id}
                      onClick={(e) => {
                        setSelectedTripId(trip.id);
                        setContextTrip({
                          trip,
                          index: rowIndex,
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSelectedTripId(trip.id);
                        setContextTrip({
                          trip,
                          index: rowIndex,
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }}
                      className="hover:bg-[#f9fafb] cursor-pointer transition-colors"
                    >
                      <td
                        className="px-2.5 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTripId(trip.id);
                        }}
                      >
                        <input
                          type="radio"
                          name="trip-select"
                          checked={selectedTripId === trip.id}
                          onChange={() => setSelectedTripId(trip.id)}
                        />
                      </td>
                      <td className="px-2.5 text-[#374151]">{rowIndex}</td>
                      <td className="px-2.5">
                        {renderTripTypeBadge(trip.dispatchType, isDeadhead)}
                      </td>
                      <td className="px-2.5">
                        {renderRequestStatusBadge(trip.status)}
                      </td>
                      <td className="px-2.5 text-[#1f2937]">
                        {trip.route
                          ? `${trip.route.routeName} ➜`
                          : `${trip.departurePickupPointText || 'Điểm đón'} → ${
                              trip.departureDropoffPointText || 'Điểm trả'
                            }`}
                      </td>
                      <td className="px-2.5 text-[#1f2937]">
                        {trip.vehiclePlateSnapshot || '—'}
                      </td>
                      <td className="px-2.5 text-[#374151]">
                        {renderVehicleTypeLabel(vt)}
                      </td>
                      <td className="px-2.5 text-[#1f2937]">
                        {trip.driverNameSnapshot || '—'}
                      </td>
                      <td className="px-2.5 text-[#1f2937]">
                        {formatTripTimeWindow(
                          trip.plannedDepartureAt,
                          trip.plannedArrivalAt,
                          trip.businessDate
                        )}
                      </td>
                      <td className="px-2.5 text-[#1f2937]">
                        {isDeadhead ? 0 : (trip.passengerCount ?? 80)}
                      </td>
                    </tr>
                  );
                })}
                {filteredTrips.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-[13px] text-[#9ca3af]">
                      Không có bản ghi chuyến đi nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <LegacyPagination
            totalCount={filteredTrips.length}
            shownCount={tripsPaging.pagedItems.length}
            page={tripsPaging.page}
            pageSize={tripsPaging.pageSize}
            onPageChange={tripsPaging.setPage}
            onPageSizeChange={tripsPaging.setPageSize}
          />

          {contextTrip && (
            <RowContextMenu
              title={`# ${contextTrip.index} (${contextTrip.trip.tripCode})`}
              position={{ x: contextTrip.x, y: contextTrip.y }}
              onClose={() => setContextTrip(null)}
              actions={[
                {
                  label: 'Tài xế xác nhận chuyến',
                  icon: <CheckCircle2 className="w-4 h-4 text-[#00897b]" />,
                  disabled: !['DISPATCHED', 'WAITING_DRIVER_CONFIRM'].includes(
                    contextTrip.trip.status
                  ),
                  onClick: () => handleConfirmTrip(contextTrip.trip),
                },
                {
                  label: 'Bắt đầu chuyến đi',
                  icon: <Play className="w-4 h-4 text-[#0284c7]" />,
                  disabled:
                    contextTrip.trip.dispatchType === 'FIXED_ROUTE' ||
                    !['DISPATCHED', 'WAITING_DRIVER_CONFIRM', 'DRIVER_CONFIRMED'].includes(
                      contextTrip.trip.status
                    ),
                  onClick: () => handleStartTrip(contextTrip.trip),
                },
                {
                  label: 'Hoàn thành chuyến đi',
                  icon: <Flag className="w-4 h-4 text-[#00897b]" />,
                  disabled:
                    contextTrip.trip.dispatchType === 'FIXED_ROUTE' ||
                    contextTrip.trip.status !== 'IN_PROGRESS',
                  onClick: () => handleCompleteTrip(contextTrip.trip),
                },
                {
                  label: 'Nhập KM thực tế & OT',
                  icon: <Gauge className="w-4 h-4 text-[#d97706]" />,
                  onClick: () => {
                    const fact = contextTrip.trip.executionFacts?.[0];
                    setKmModal({
                      trip: contextTrip.trip,
                      actualKm: String(fact?.actualKm || '28.5'),
                      otHours: String(fact?.otHours || '0'),
                      executionNote: fact?.executionNote || '',
                    });
                  },
                },
                {
                  label: 'Đổi xe / tài xế',
                  icon: <Repeat className="w-4 h-4 text-[#374151]" />,
                  onClick: () =>
                    setReassignModal({
                      trip: contextTrip.trip,
                      vehicleId:
                        contextTrip.trip.vehicleId || vehicles[0]?.id || '',
                      driverId:
                        contextTrip.trip.driverId || drivers[0]?.id || '',
                      reason: 'Đổi xe điều hành',
                    }),
                },
                {
                  label: 'Hủy chuyến đi',
                  icon: <XCircle className="w-4 h-4 text-[#dc2626]" />,
                  danger: true,
                  disabled: ['COMPLETED', 'CANCELLED'].includes(
                    contextTrip.trip.status
                  ),
                  onClick: () => handleCancelTrip(contextTrip.trip),
                },
              ]}
            />
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW 2: VEHICLE OPERATION CENTER (Exact match to 035-vehicle-ops.png) */}
      {/* ==================================================================== */}
      {view === 'VEHICLE_OPS' && (
        <div>
          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <FloatingSelect
              label="Loại xe"
              value={vehicleTypeFilter}
              onChange={setVehicleTypeFilter}
              options={[
                { value: 'BUS_29', label: 'Bus 29 chỗ' },
                { value: 'VAN_16', label: 'Van 16 chỗ' },
                { value: 'BUS_45', label: 'Bus 45 chỗ' },
                { value: 'SUV_7', label: 'SUV 7 chỗ' },
              ]}
            />
            <FloatingSelect
              label="Trạng thái"
              value={vehicleStatusFilter}
              onChange={setVehicleStatusFilter}
              options={[
                { value: 'ON_FIXED_ROUTE', label: 'Trên tuyến cố định' },
                { value: 'AVAILABLE', label: 'Sẵn sàng' },
                { value: 'ON_SPECIAL_ASSIGNMENT', label: 'Đang chạy điều chuyến' },
                { value: 'NOT_AVAILABLE', label: 'Không khả dụng' },
              ]}
            />
          </div>

          {/* Section Toolbar */}
          <SectionToolbar
            title="Danh sách vận hành xe"
            loading={loading}
            onRefresh={loadData}
            search={search}
            onSearchChange={setSearch}
            showCustomize
            showFilter
            primaryButton={{
              label: 'Xuất excel trang hiện tại',
              icon: <FileSpreadsheet className="w-4 h-4" />,
              onClick: () => {
                exportTableToCsv('danh-sach-van-hanh-xe');
                showToast('Đã xuất Excel Danh sách vận hành xe');
              },
              splitItems: [
                {
                  label: 'Đồng bộ trạng thái đội xe (Job Sync)',
                  icon: <RefreshCw className="w-4 h-4 text-[#00897b]" />,
                  onClick: handleSyncVehicleStatus,
                },
              ],
            }}
          />

          {/* Table (Exact columns from 035-vehicle-ops.png) */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] table-fixed text-left border-collapse">
              <thead>
                <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] text-[13px] font-semibold text-[#1f2937]">
                  <th className="px-2.5 w-[3%]"></th>
                  <th className="px-2.5 w-[3.5%]">#</th>
                  <th className="px-2.5 w-[9%]">Biển số</th>
                  <th className="px-2.5 w-[9%]">Loại xe</th>
                  <th className="px-2.5 w-[13%]">Trạng thái</th>
                  <th className="px-2.5 w-[11.5%]">Tài xế</th>
                  <th className="px-2.5 w-[13.5%]">Điểm bắt đầu</th>
                  <th className="px-2.5 w-[15%]">Điểm kết thúc</th>
                  <th className="px-2.5 w-[13%]">Khung giờ</th>
                  <th className="px-2.5 w-[9.5%]">Mã chuyến</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb] text-[13px] text-[#1f2937]">
                {vehPaging.pagedItems.map((vs, idx) => {
                  const fo = vs.fixedOverlay;
                  const isAvailable = vs.status === 'AVAILABLE';
                  const rowIndex = (vehPaging.page - 1) * vehPaging.pageSize + idx + 1;
                  return (
                    <tr
                      key={vs.vehicleId}
                      onClick={() => {
                        setSelectedVehId(String(vs.vehicleId));
                        if (vs.vehicle?.vehiclePlate) {
                          showToast(
                            `Xe ${vs.vehicle.vehiclePlate} (${renderVehicleTypeLabel(
                              vs.vehicle.vehicleType
                            )}): ${
                              vs.status === 'ON_FIXED_ROUTE'
                                ? 'Đang chạy trên tuyến cố định'
                                : vs.status === 'AVAILABLE'
                                  ? 'Sẵn sàng điều phối'
                                  : 'Đang vận hành'
                            }`
                          );
                        }
                      }}
                      className="hover:bg-[#f9fafb] cursor-pointer transition-colors"
                    >
                      <td className="px-2.5 text-center">
                        <input
                          type="radio"
                          name="veh-ops-select"
                          checked={selectedVehId === String(vs.vehicleId)}
                          onChange={() => setSelectedVehId(String(vs.vehicleId))}
                        />
                      </td>
                      <td className="px-2.5 text-[#374151]">{rowIndex}</td>
                      <td className="px-2.5 text-[#1f2937]">
                        {vs.vehicle?.vehiclePlate}
                      </td>
                      <td className="px-2.5 text-[#374151]">
                        {renderVehicleTypeLabel(vs.vehicle?.vehicleType)}
                      </td>
                      <td className="px-2.5">
                        {vs.status === 'ON_FIXED_ROUTE' ? (
                          <PastelBadge label="Trên tuyến cố định" tone="sky" />
                        ) : vs.status === 'AVAILABLE' ? (
                          <PastelBadge label="Sẵn sàng" tone="green" />
                        ) : vs.status === 'ON_SPECIAL_ASSIGNMENT' ? (
                          <PastelBadge label="Đang chạy điều chuyến" tone="amber" />
                        ) : (
                          <PastelBadge label="Không khả dụng" tone="gray" />
                        )}
                      </td>
                      <td className="px-2.5 text-[#1f2937]">
                        {fo ? fo.driver : isAvailable ? '-' : (vs.latestTrip?.driverNameSnapshot || '-')}
                      </td>
                      <td className="px-2.5 text-[#374151]">
                        {fo ? fo.start : isAvailable ? '-' : (vs.latestTrip?.departurePickupPointText || '-')}
                      </td>
                      <td className="px-2.5 text-[#374151]">
                        {fo ? fo.end : isAvailable ? '-' : (vs.latestTrip?.departureDropoffPointText || '-')}
                      </td>
                      <td className="px-2.5 text-[#1f2937]">
                        {fo
                          ? fo.window
                          : isAvailable
                            ? '-'
                            : vs.plannedDepartureAt || vs.latestTrip?.plannedDepartureAt
                              ? formatTripTimeWindow(
                                  vs.plannedDepartureAt || vs.latestTrip?.plannedDepartureAt,
                                  vs.plannedArrivalAt || vs.latestTrip?.plannedArrivalAt,
                                  vs.latestTrip?.businessDate
                                )
                              : '-'}
                      </td>
                      <td className="px-2.5 text-[#374151]">
                        {fo
                          ? fo.tripCode
                          : isAvailable
                            ? '-'
                            : vs.latestTrip?.tripCode || '-'}
                      </td>
                    </tr>
                  );
                })}
                {filteredVehicleStatuses.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-[13px] text-[#9ca3af]">
                      Không có dữ liệu vận hành xe
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <LegacyPagination
            totalCount={filteredVehicleStatuses.length}
            shownCount={vehPaging.pagedItems.length}
            page={vehPaging.page}
            pageSize={vehPaging.pageSize}
            onPageChange={vehPaging.setPage}
            onPageSizeChange={vehPaging.setPageSize}
          />
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: INPUT ACTUAL KM */}
      {/* ==================================================================== */}
      {kmModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveActualKm}
            className="bg-white rounded-[10px] shadow-xl border border-[#e5e7eb] w-full max-w-sm p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-[15px] font-bold text-gray-900">
                Nhập KM thực tế: {kmModal.trip.tripCode}
              </h3>
              <button
                type="button"
                onClick={() => setKmModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Số KM thực tế (Phải &gt; 0) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={kmModal.actualKm}
                  onChange={(e) => setKmModal({ ...kmModal, actualKm: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono font-bold text-gray-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Số giờ OT phát sinh (nếu có)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={kmModal.otHours}
                  onChange={(e) => setKmModal({ ...kmModal, otHours: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Ghi chú vận hành</label>
                <input
                  type="text"
                  value={kmModal.executionNote}
                  onChange={(e) => setKmModal({ ...kmModal, executionNote: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setKmModal(null)}
                className="px-3 py-1.5 rounded-md border border-gray-300 text-xs"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-md bg-[#00897b] text-white text-xs font-semibold cursor-pointer"
              >
                Lưu KM & Tính phí
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: REASSIGN VEHICLE / DRIVER */}
      {/* ==================================================================== */}
      {reassignModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveReassign}
            className="bg-white rounded-[10px] shadow-xl border border-[#e5e7eb] w-full max-w-sm p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-[15px] font-bold text-gray-900">
                Đổi xe / tài xế: {reassignModal.trip.tripCode}
              </h3>
              <button
                type="button"
                onClick={() => setReassignModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Xe mới *</label>
                <select
                  required
                  value={reassignModal.vehicleId}
                  onChange={(e) =>
                    setReassignModal({ ...reassignModal, vehicleId: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehiclePlate} ({v.seatCapacity} ghế)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Tài xế mới *</label>
                <select
                  required
                  value={reassignModal.driverId}
                  onChange={(e) =>
                    setReassignModal({ ...reassignModal, driverId: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.driverName} ({d.phoneNumber})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Lý do đổi xe</label>
                <input
                  type="text"
                  value={reassignModal.reason}
                  onChange={(e) =>
                    setReassignModal({ ...reassignModal, reason: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setReassignModal(null)}
                className="px-3 py-1.5 rounded-md border border-gray-300 text-xs"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-md bg-[#00897b] text-white text-xs font-semibold cursor-pointer"
              >
                Lưu thay đổi
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
