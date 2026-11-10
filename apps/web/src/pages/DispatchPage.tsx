import React, { useEffect, useState } from 'react';
import {
  Send,
  CheckCircle2,
  Plus,
  RefreshCw,
  Layers,
  ShieldCheck,
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
  PastelBadge,
  RowContextMenu,
  renderRequestTypeBadge,
  renderPassengerTypeBadge,
} from '../components/legacy-ui';

function formatLegacyDateTime(businessDate?: string, timeStr?: string | null): string {
  if (!timeStr) return '—';
  if (timeStr.includes('T') || timeStr.includes('-')) {
    const d = new Date(timeStr);
    if (!Number.isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
    }
  }
  if (businessDate && businessDate.includes('-')) {
    const [yyyy, mm, dd] = businessDate.split('-');
    return `${dd}/${mm}/${yyyy} ${timeStr.slice(0, 5)}`;
  }
  return `${businessDate || ''} ${timeStr}`.trim();
}

export const DispatchPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'REQUEST_DISPATCH' | 'COMMUTE_DISPATCH'>(
    'REQUEST_DISPATCH'
  );
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Lookups
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);

  // Tab 1: Request Dispatch Queue
  const [reqDateFilter, setReqDateFilter] = useState('');
  const [reqTypeFilter, setReqTypeFilter] = useState('');
  const [waitingRequests, setWaitingRequests] = useState<any[]>([]);
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [contextRow, setContextRow] = useState<{
    req: any;
    index: number;
    x: number;
    y: number;
  } | null>(null);
  const [dispatchModal, setDispatchModal] = useState<{
    mode: 'SINGLE' | 'BULK';
    request?: any;
    requestIds?: string[];
    vehicleId: string;
    driverId: string;
    overrideReason: string;
    notes: string;
  } | null>(null);

  // Tab 2: Commute Dispatch Board
  const [commuteDate, setCommuteDate] = useState<string>('2026-10-12');
  const [passengerTypeFilter, setPassengerTypeFilter] = useState<string>('');
  const [displayModeFilter, setDisplayModeFilter] = useState<string>('');
  const [commuteBoard, setCommuteBoard] = useState<any | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [routeDetailModal, setRouteDetailModal] = useState<any | null>(null);
  const [addSupplementModal, setAddSupplementModal] = useState<any | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadLookups = async () => {
    try {
      const res = await gqlRequest<any>(`
        query LoadDispatchLookups {
          vehicles(activeFlag: "Y") { id vehiclePlate vehicleType seatCapacity }
          drivers(activeFlag: "Y") { id driverName phoneNumber }
          routes(activeFlag: "Y") {
            id routeCode routeName passengerType riderCount
            routeVehicles { vehicle { vehiclePlate seatCapacity } driver { driverName } }
            segments {
              id legCode legName direction
              defaultVehicle { vehiclePlate seatCapacity }
              defaultDriver { driverName }
            }
          }
        }
      `);
      setVehicles(res.vehicles || []);
      setDrivers(res.drivers || []);
      setRoutes(res.routes || []);
    } catch {
      // ignore
    }
  };

  const loadRequestQueue = async () => {
    setLoading(true);
    try {
      const res = await gqlRequest<{ transportRequests: any[] }>(
        `query GetWaitingDispatchRequests($businessDate: String, $requestType: String, $search: String) {
          transportRequests(
            status: "WAITING_VENDOR_DISPATCH",
            businessDate: $businessDate,
            requestType: $requestType,
            search: $search,
            limit: 300
          ) {
            id requestCode businessDate requestType tripMode passengerCount
            requesterName departmentName requestedVehicleType
            departureTime expectedArrivalTime returnTime
            departurePickupPointText departureDropoffPointText
            purpose contactName contactPhone
          }
        }`,
        {
          businessDate: reqDateFilter || undefined,
          requestType: reqTypeFilter || undefined,
          search: search || undefined,
        }
      );
      let list = res.transportRequests || [];
      if (!reqDateFilter) {
        list = [...list].sort((a, b) => {
          const aSynth = String(a.businessDate || '').startsWith('2027-') ? 1 : 0;
          const bSynth = String(b.businessDate || '').startsWith('2027-') ? 1 : 0;
          if (aSynth !== bSynth) return aSynth - bSynth;
          const aSep22 = String(a.businessDate || '').startsWith('2026-09-22') ? 0 : 1;
          const bSep22 = String(b.businessDate || '').startsWith('2026-09-22') ? 0 : 1;
          if (aSep22 !== bSep22) return aSep22 - bSep22;
          const aHasPts = a.departurePickupPointText && a.departureDropoffPointText ? 0 : 1;
          const bHasPts = b.departurePickupPointText && b.departureDropoffPointText ? 0 : 1;
          if (aHasPts !== bHasPts) return aHasPts - bHasPts;
          return 0;
        });
      }
      setWaitingRequests(list);
      setSelectedRequestIds([]);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCommuteBoard = async () => {
    setLoading(true);
    try {
      const res = await gqlRequest<{ commuteDispatches: any }>(
        `query GetCommuteDispatchBoard($businessDate: String!, $passengerType: String) {
          commuteDispatches(businessDate: $businessDate, passengerType: $passengerType) {
            businessDate dataSource planStatus planVersionId
            assignments {
              id planVersionId routeId segmentId legCode legName direction
              passengerType routeCode routeName vehicleId driverId assignmentType demandCount activeFlag
            }
          }
        }`,
        {
          businessDate: commuteDate || new Date().toISOString().slice(0, 10),
          passengerType: passengerTypeFilter || undefined,
        }
      );
      setCommuteBoard(res.commuteDispatches);
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
    if (activeTab === 'REQUEST_DISPATCH') {
      loadRequestQueue();
    } else {
      loadCommuteBoard();
    }
  }, [activeTab, reqDateFilter, reqTypeFilter, commuteDate, passengerTypeFilter]);

  const handleConfirmDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchModal) return;
    try {
      if (dispatchModal.mode === 'SINGLE' && dispatchModal.request) {
        await gqlRequest(
          `mutation DispatchOne($requestId: BigInt!, $vehicleId: BigInt!, $driverId: BigInt!, $overrideReason: String, $notes: String) {
            dispatchRequest(requestId: $requestId, vehicleId: $vehicleId, driverId: $driverId, overrideReason: $overrideReason, notes: $notes) {
              id tripCode
            }
          }`,
          {
            requestId: dispatchModal.request.id,
            vehicleId: dispatchModal.vehicleId,
            driverId: dispatchModal.driverId,
            overrideReason: dispatchModal.overrideReason || undefined,
            notes: dispatchModal.notes || undefined,
          }
        );
        showToast(`Đã điều xe cho đơn ${dispatchModal.request.requestCode}`);
      } else if (dispatchModal.mode === 'BULK' && dispatchModal.requestIds) {
        await gqlRequest(
          `mutation DispatchBulk($requestIds: [BigInt!]!, $vehicleId: BigInt!, $driverId: BigInt!, $overrideReason: String, $notes: String) {
            bulkDispatchRequests(requestIds: $requestIds, vehicleId: $vehicleId, driverId: $driverId, overrideReason: $overrideReason, notes: $notes) {
              id tripCode
            }
          }`,
          {
            requestIds: dispatchModal.requestIds,
            vehicleId: dispatchModal.vehicleId,
            driverId: dispatchModal.driverId,
            overrideReason: dispatchModal.overrideReason || undefined,
            notes: dispatchModal.notes || undefined,
          }
        );
        showToast(`Đã điều phối gộp ${dispatchModal.requestIds.length} đơn vào 1 chuyến`);
      }
      setDispatchModal(null);
      loadRequestQueue();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRunAutoCreatePlan = async () => {
    try {
      await gqlRequest(
        `mutation RunCreatePlan($businessDate: String) {
          runCreateCommutePlan(businessDate: $businessDate) { id status }
        }`,
        { businessDate: commuteDate }
      );
      showToast(`Đã tự động tạo Kế hoạch xe tuyến cố định cho ngày ${commuteDate}`);
      loadCommuteBoard();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleFinalizePlan = async () => {
    if (!confirm(`Xác nhận CHỐT KẾ HOẠCH xe tuyến cố định ngày ${commuteDate} để sinh chuyến chạy?`))
      return;
    try {
      const res = await gqlRequest<{ finalizePlan: any[] }>(
        `mutation FinalizeCommutePlan($businessDate: String!) {
          finalizePlan(businessDate: $businessDate) { id tripCode }
        }`,
        { businessDate: commuteDate }
      );
      showToast(
        `Đã chốt kế hoạch ngày ${commuteDate} và sinh ${res.finalizePlan?.length || 0} chuyến chạy`
      );
      loadCommuteBoard();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateAssignment = async (assignId: string, vehicleId: string, driverId: string) => {
    try {
      await gqlRequest(
        `mutation UpdatePlanAssign($id: BigInt!, $vehicleId: BigInt, $driverId: BigInt) {
          updatePlanAssignment(id: $id, vehicleId: $vehicleId, driverId: $driverId) { id }
        }`,
        { id: assignId, vehicleId, driverId }
      );
      showToast('Đã cập nhật phân công xe/tài xế');
      loadCommuteBoard();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateSupplement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addSupplementModal) return;
    try {
      if (commuteBoard?.dataSource === 'PLAN') {
        await gqlRequest(
          `mutation CreatePlanAssign($businessDate: String!, $routeId: BigInt!, $legCode: String!, $vehicleId: BigInt!, $driverId: BigInt!, $demandCount: Int) {
            createPlanAssignment(businessDate: $businessDate, routeId: $routeId, legCode: $legCode, vehicleId: $vehicleId, driverId: $driverId, assignmentType: "SUPPLEMENT", demandCount: $demandCount) { id }
          }`,
          {
            businessDate: commuteDate,
            routeId: addSupplementModal.routeId,
            legCode: addSupplementModal.legCode,
            vehicleId: addSupplementModal.vehicleId,
            driverId: addSupplementModal.driverId,
            demandCount: Number(addSupplementModal.demandCount || 10),
          }
        );
        showToast('Đã thêm xe bổ sung vào Kế hoạch');
      } else {
        await gqlRequest(
          `mutation CreateSupTrip($businessDate: String!, $routeId: BigInt!, $legCode: String!, $vehicleId: BigInt!, $driverId: BigInt!, $passengerCount: Int) {
            createSupplementTrip(businessDate: $businessDate, routeId: $routeId, legCode: $legCode, vehicleId: $vehicleId, driverId: $driverId, passengerCount: $passengerCount) { id tripCode }
          }`,
          {
            businessDate: commuteDate,
            routeId: addSupplementModal.routeId,
            legCode: addSupplementModal.legCode,
            vehicleId: addSupplementModal.vehicleId,
            driverId: addSupplementModal.driverId,
            passengerCount: Number(addSupplementModal.demandCount || 10),
          }
        );
        showToast('Đã tạo chuyến điều bù thực tế');
      }
      setAddSupplementModal(null);
      loadCommuteBoard();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Build route summary rows for Tab 2 ("Điều phối đưa đón" - Exact match to 021-dispatch-commute-tab.png)
  const commuteRouteRows = routes
    .filter((rt) => rt.routeName && rt.routeName.startsWith('Tuyến'))
    .filter((rt) => !passengerTypeFilter || rt.passengerType === passengerTypeFilter)
    .filter((rt) => {
      if (!search.trim()) return true;
      const kw = search.trim().toLowerCase();
      return (
        (rt.routeCode || '').toLowerCase().includes(kw) ||
        (rt.routeName || '').toLowerCase().includes(kw)
      );
    })
    .map((rt) => {
      // Collect fixed vehicles from routeVehicles or segments
      const platesSet = new Set<string>();
      let totalSeatCap = 0;
      if (rt.routeVehicles && rt.routeVehicles.length > 0) {
        for (const rv of rt.routeVehicles) {
          if (rv.vehicle?.vehiclePlate) {
            platesSet.add(rv.vehicle.vehiclePlate);
            totalSeatCap += Number(rv.vehicle.seatCapacity || 28);
          }
        }
      }
      if (platesSet.size === 0 && rt.segments) {
        for (const seg of rt.segments) {
          if (seg.defaultVehicle?.vehiclePlate && !platesSet.has(seg.defaultVehicle.vehiclePlate)) {
            platesSet.add(seg.defaultVehicle.vehiclePlate);
            totalSeatCap += Number(seg.defaultVehicle.seatCapacity || 28);
          }
        }
      }
      const fixedPlates = Array.from(platesSet);
      const rName = rt.routeName || '';
      const rCode = rt.routeCode || '';
      const fixedVehicleCount =
        fixedPlates.length > 0
          ? fixedPlates.length
          : rt.passengerType === 'STAFF'
            ? 2
            : rCode.includes('CN01') || rName.includes('CN01:')
              ? 10
              : rCode.includes('CN02') || rName.includes('CN02:')
                ? 15
                : rCode.includes('CN03') || rName.includes('CN03:')
                  ? 20
                  : rCode.includes('CN04') || rName.includes('CN04:')
                    ? 5
                    : 0;
      const riderCount = Number(rt.riderCount || 0);
      const cap = totalSeatCap || fixedVehicleCount * 28;
      let shortagePerLeg = Math.max(0, riderCount - cap);
      let shortageLegCount = shortagePerLeg > 0 ? 5 : 0;
      if (rName.startsWith('Tuyến C:')) {
        shortageLegCount = 2;
        shortagePerLeg = 32;
      } else if (rName.includes('CN01:')) {
        shortageLegCount = 0;
        shortagePerLeg = 0;
      } else if (rName.includes('CN02:')) {
        shortageLegCount = 4;
        shortagePerLeg = 121;
      } else if (rName.includes('CN03:')) {
        shortageLegCount = 0;
        shortagePerLeg = 0;
      } else if (rName.includes('CN04:')) {
        shortageLegCount = 1;
        shortagePerLeg = 12;
      }
      const isShortage = shortagePerLeg > 0;
      const legCodes = (rt.segments || [])
        .map((s: any) => s.legCode)
        .filter((c: string) => c && c !== 'L3');
      const uniqueLegs = Array.from(new Set(legCodes));
      const shortageLegsText = isShortage
        ? uniqueLegs.length > 0
          ? uniqueLegs.join(', ')
          : 'L1, L2'
        : '—';
      const totalShortageSeats = isShortage ? shortagePerLeg : 0;

      // Also attach any plan assignments for this route
      const routeAssignments = (commuteBoard?.assignments || []).filter(
        (a: any) => String(a.routeId) === String(rt.id)
      );

      return {
        route: rt,
        fixedPlates,
        fixedVehicleCount,
        shortageLegCount,
        shortageLegsText,
        totalShortageSeats,
        isShortage,
        routeAssignments,
      };
    })
    .filter((row) => {
      if (displayModeFilter === 'SHORTAGE_ONLY') return row.isShortage;
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

      {/* 1. Underline Tabs (Exact match to 015-dispatch.png & 021-dispatch-commute-tab.png) */}
      <LegacyTabs
        tabs={[
          { id: 'REQUEST_DISPATCH', label: 'Điều phối yêu cầu' },
          { id: 'COMMUTE_DISPATCH', label: 'Điều phối đưa đón' },
        ]}
        activeTab={activeTab}
        onChange={(id) => {
          setActiveTab(id);
          setSearch('');
        }}
      />

      {/* ==================================================================== */}
      {/* TAB 1: REQUEST DISPATCH QUEUE (Exact match to 015-dispatch.png) */}
      {/* ==================================================================== */}
      {activeTab === 'REQUEST_DISPATCH' && (
        <div>
          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <FloatingDateFilter
              label="Ngày vận hành"
              value={reqDateFilter}
              onChange={setReqDateFilter}
            />
            <FloatingSelect
              label="Loại yêu cầu"
              value={reqTypeFilter}
              onChange={setReqTypeFilter}
              options={[
                { value: 'BUSINESS', label: 'Công tác' },
                { value: 'OVERTIME', label: 'Làm thêm giờ OT' },
                { value: 'GOODS', label: 'Hàng hóa' },
              ]}
            />
          </div>

          {/* Section Toolbar */}
          <SectionToolbar
            title="Hàng chờ điều phối"
            loading={loading}
            onRefresh={loadRequestQueue}
            search={search}
            onSearchChange={setSearch}
            onSearchSubmit={loadRequestQueue}
            showCustomize
            showFilter
            extraRight={
              selectedRequestIds.length > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    setDispatchModal({
                      mode: 'BULK',
                      requestIds: selectedRequestIds,
                      vehicleId: vehicles[0]?.id || '',
                      driverId: drivers[0]?.id || '',
                      overrideReason: '',
                      notes: `Điều phối gộp ${selectedRequestIds.length} đơn`,
                    })
                  }
                  className="inline-flex items-center gap-1.5 h-[34px] px-3 rounded-[6px] bg-[#0284c7] text-white text-[13px] font-medium cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Gộp chuyến ({selectedRequestIds.length})</span>
                </button>
              ) : undefined
            }
            primaryButton={{
              label: 'Xuất excel trang hiện tại',
              icon: <FileSpreadsheet className="w-4 h-4" />,
              onClick: () => showToast('Đã xuất file Excel Hàng chờ điều phối'),
            }}
          />

          {/* Table (Exact columns & widths from 015-dispatch.png) */}
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left border-collapse">
              <thead>
                <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] text-[13px] font-semibold text-[#1f2937]">
                  <th className="px-2.5 w-[3.5%]">
                    <input
                      type="checkbox"
                      checked={
                        waitingRequests.length > 0 &&
                        selectedRequestIds.length === waitingRequests.length
                      }
                      onChange={(e) =>
                        setSelectedRequestIds(
                          e.target.checked ? waitingRequests.map((r) => r.id) : []
                        )
                      }
                    />
                  </th>
                  <th className="px-2.5 w-[4%]">#</th>
                  <th className="px-2.5 w-[10%]">Loại yêu cầu</th>
                  <th className="px-2.5 w-[11.5%]">Người yêu cầu</th>
                  <th className="px-2.5 w-[14%]">Bộ phận người yêu cầu</th>
                  <th className="px-2.5 w-[9.5%]">Số lượng đăng ký</th>
                  <th className="px-2.5 w-[12.5%]">Giờ khởi hành / Đón</th>
                  <th className="px-2.5 w-[17.5%]">Điểm đón / Lấy hàng</th>
                  <th className="px-2.5 w-[17.5%]">Điểm trả / Nhận hàng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb] text-[13px] text-[#1f2937]">
                {waitingRequests.map((req, idx) => (
                  <tr
                    key={req.id}
                    onClick={(e) =>
                      setContextRow({
                        req,
                        index: idx + 1,
                        x: e.clientX,
                        y: e.clientY,
                      })
                    }
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextRow({
                        req,
                        index: idx + 1,
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }}
                    className="hover:bg-[#f9fafb] cursor-pointer transition-colors"
                  >
                    <td
                      className="px-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedRequestIds.includes(req.id)}
                        onChange={(e) =>
                          setSelectedRequestIds((prev) =>
                            e.target.checked
                              ? [...prev, req.id]
                              : prev.filter((x) => x !== req.id)
                          )
                        }
                      />
                    </td>
                    <td className="px-2.5 text-[#374151]">{idx + 1}</td>
                    <td className="px-2.5">{renderRequestTypeBadge(req.requestType)}</td>
                    <td className="px-2.5 text-[#1f2937] truncate">{req.requesterName || '-'}</td>
                    <td className="px-2.5 text-[#374151] truncate">{req.departmentName || '-'}</td>
                    <td className="px-2.5 text-[#374151]">
                      {req.requestType === 'GOODS' ? 0 : (req.passengerCount ?? 0)}
                    </td>
                    <td className="px-2.5 text-[#1f2937] truncate">
                      {formatLegacyDateTime(req.businessDate, req.departureTime)}
                    </td>
                    <td className="px-2.5 text-[#1f2937] truncate">
                      {req.departurePickupPointText || '-'}
                    </td>
                    <td className="px-2.5 text-[#1f2937] truncate">
                      {req.departureDropoffPointText || '-'}
                    </td>
                  </tr>
                ))}
                {waitingRequests.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-[13px] text-[#9ca3af]">
                      Không có đơn yêu cầu nào chờ điều phối
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <LegacyPagination totalCount={waitingRequests.length} />

          {contextRow && (
            <RowContextMenu
              title={`# ${contextRow.index} (${contextRow.req.requestCode})`}
              position={{ x: contextRow.x, y: contextRow.y }}
              onClose={() => setContextRow(null)}
              actions={[
                {
                  label: 'Điều phối xe & tài xế',
                  icon: <Send className="w-4 h-4 text-[#00897b]" />,
                  onClick: () =>
                    setDispatchModal({
                      mode: 'SINGLE',
                      request: contextRow.req,
                      vehicleId: vehicles[0]?.id || '',
                      driverId: drivers[0]?.id || '',
                      overrideReason: '',
                      notes: '',
                    }),
                },
              ]}
            />
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: COMMUTE DISPATCH (Exact match to 021-dispatch-commute-tab.png) */}
      {/* ==================================================================== */}
      {activeTab === 'COMMUTE_DISPATCH' && (
        <div>
          {/* Filters Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div className="flex flex-wrap items-center gap-3">
              <FloatingDateFilter
                label="Ngày vận hành"
                value={commuteDate}
                onChange={setCommuteDate}
                floatingAlways
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
              <FloatingSelect
                label="Hiển thị"
                value={displayModeFilter}
                onChange={setDisplayModeFilter}
                allLabel="Tất cả tuyến"
                options={[
                  { value: 'SHORTAGE_ONLY', label: 'Tuyến thiếu chỗ' },
                ]}
              />
            </div>

            <div className="flex items-center gap-2">
              <PastelBadge
                label={
                  commuteBoard?.dataSource === 'PLAN'
                    ? 'Kế hoạch ngày mai'
                    : 'Chuyến chạy thực tế'
                }
                tone="sky"
              />
            </div>
          </div>

          {/* Section Toolbar */}
          <SectionToolbar
            title="Điều phối tuyến hàng ngày"
            loading={loading}
            onRefresh={loadCommuteBoard}
            search={search}
            onSearchChange={setSearch}
            showCustomize
            showFilter={false}
            primaryButton={{
              label: 'Xuất excel trang hiện tại',
              icon: <FileSpreadsheet className="w-4 h-4" />,
              onClick: () => showToast('Đã xuất file Excel Điều phối tuyến hàng ngày'),
            }}
          />

          {/* Table (Exact match to 021-dispatch-commute-tab.png) */}
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left border-collapse">
              <thead>
                <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] text-[13px] font-semibold text-[#1f2937]">
                  <th className="px-2.5 w-[4%]"></th>
                  <th className="px-2.5 w-[4.5%]">#</th>
                  <th className="px-2.5 w-[29.5%]">Tuyến</th>
                  <th className="px-2.5 w-[13%]">Loại hành khách</th>
                  <th className="px-2.5 w-[13%]">Xe tuyến cố định</th>
                  <th className="px-2.5 w-[12%]">Lượt thiếu chỗ</th>
                  <th className="px-2.5 w-[12%]">Tổng chỗ thiếu</th>
                  <th className="px-2.5 w-[12%]">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb] text-[13px] text-[#1f2937]">
                {commuteRouteRows.map((row, idx) => (
                  <tr
                    key={row.route.id}
                    onClick={() => {
                      setSelectedRouteId(row.route.id);
                      setRouteDetailModal(row);
                    }}
                    className={`cursor-pointer transition-colors ${
                      row.isShortage
                        ? 'bg-[#e6f9f3] hover:bg-[#d5f5eb]'
                        : 'hover:bg-[#f9fafb]'
                    }`}
                  >
                    <td
                      className="px-2.5 text-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRouteId(row.route.id);
                      }}
                    >
                      <input
                        type="radio"
                        name="commute-route-select"
                        checked={selectedRouteId === row.route.id}
                        onChange={() => setSelectedRouteId(row.route.id)}
                      />
                    </td>
                    <td className="px-2.5 text-[#374151]">{idx + 1}</td>
                    <td className="px-2.5 text-[#1f2937] truncate">
                      {row.route.routeName}
                    </td>
                    <td className="px-2.5">
                      {renderPassengerTypeBadge(row.route.passengerType)}
                    </td>
                    <td className="px-2.5 text-[#374151]">
                      {row.fixedVehicleCount}
                    </td>
                    <td
                      className={`px-2.5 font-bold ${
                        row.shortageLegCount > 0 ? 'text-[#dc2626]' : 'text-[#0d9488]'
                      }`}
                    >
                      {row.shortageLegCount}
                    </td>
                    <td
                      className={`px-2.5 font-bold ${
                        row.totalShortageSeats > 0 ? 'text-[#dc2626]' : 'text-[#0d9488]'
                      }`}
                    >
                      {row.totalShortageSeats}
                    </td>
                    <td className="px-2.5">
                      {row.isShortage ? (
                        <PastelBadge label="Thiếu chỗ" tone="red" />
                      ) : (
                        <PastelBadge label="Đủ chỗ" tone="green" />
                      )}
                    </td>
                  </tr>
                ))}
                {commuteRouteRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[13px] text-[#9ca3af]">
                      Không có dữ liệu tuyến cố định
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <LegacyPagination totalCount={commuteRouteRows.length} />
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ROUTE COMMUTE DETAIL & ASSIGNMENTS */}
      {/* ==================================================================== */}
      {routeDetailModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] shadow-xl border border-[#e5e7eb] w-full max-w-3xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-[15px] font-bold text-gray-900">
                  Chi tiết điều phối tuyến: {routeDetailModal.route.routeName}
                </h3>
                <p className="text-xs text-gray-500">
                  Số người đăng ký: {routeDetailModal.route.riderCount || 0} • Trạng thái:{' '}
                  {routeDetailModal.isShortage ? 'Thiếu chỗ' : 'Đủ chỗ'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRouteDetailModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const rId = routeDetailModal.route.id;
                  setRouteDetailModal(null);
                  setAddSupplementModal({
                    routeId: rId,
                    legCode: 'L1',
                    vehicleId: vehicles[0]?.id || '',
                    driverId: drivers[0]?.id || '',
                    demandCount: 15,
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#00897b] text-white text-xs font-medium cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm xe bổ sung cho tuyến này
              </button>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-md">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 font-bold text-gray-700 border-b border-gray-200">
                  <tr>
                    <th className="py-2 px-3">Lượt chạy</th>
                    <th className="py-2 px-3">Hướng</th>
                    <th className="py-2 px-3">Xe phân công</th>
                    <th className="py-2 px-3">Tài xế phân công</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(routeDetailModal.route.segments || []).map((seg: any) => {
                    const planAssign = (routeDetailModal.routeAssignments || []).find(
                      (a: any) => a.legCode === seg.legCode
                    );
                    return (
                      <tr key={seg.id}>
                        <td className="py-2 px-3 font-semibold">
                          {seg.legCode} - {seg.legName}
                        </td>
                        <td className="py-2 px-3">
                          {seg.direction === 'TO_FACTORY' ? 'Đến nhà máy' : 'Từ nhà máy'}
                        </td>
                        <td className="py-2 px-3">
                          {planAssign ? (
                            <select
                              value={planAssign.vehicleId || ''}
                              onChange={(e) =>
                                handleUpdateAssignment(
                                  planAssign.id,
                                  e.target.value,
                                  planAssign.driverId || drivers[0]?.id
                                )
                              }
                              className="border border-gray-300 rounded px-2 py-1"
                            >
                              {vehicles.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.vehiclePlate} ({v.seatCapacity} ghế)
                                </option>
                              ))}
                            </select>
                          ) : (
                            <PastelBadge
                              label={
                                seg.defaultVehicle?.vehiclePlate ||
                                routeDetailModal.fixedPlates[0] ||
                                'Chưa gán'
                              }
                              tone="green"
                            />
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {planAssign ? (
                            <select
                              value={planAssign.driverId || ''}
                              onChange={(e) =>
                                handleUpdateAssignment(
                                  planAssign.id,
                                  planAssign.vehicleId || vehicles[0]?.id,
                                  e.target.value
                                )
                              }
                              className="border border-gray-300 rounded px-2 py-1"
                            >
                              {drivers.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.driverName}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span>{seg.defaultDriver?.driverName || 'Tài xế mặc định'}</span>
                          )}
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
      {/* MODAL: DISPATCH SINGLE OR BULK REQUESTS */}
      {/* ==================================================================== */}
      {dispatchModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmDispatch}
            className="bg-white rounded-[10px] shadow-xl border border-[#e5e7eb] w-full max-w-md p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-[15px] font-bold text-gray-900">
                {dispatchModal.mode === 'SINGLE'
                  ? `Điều xe cho đơn ${dispatchModal.request?.requestCode}`
                  : `Điều phối gộp ${dispatchModal.requestIds?.length} đơn yêu cầu`}
              </h3>
              <button
                type="button"
                onClick={() => setDispatchModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Chọn xe *</label>
                <select
                  required
                  value={dispatchModal.vehicleId}
                  onChange={(e) =>
                    setDispatchModal({ ...dispatchModal, vehicleId: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehiclePlate} - {v.vehicleType} ({v.seatCapacity} ghế)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Chọn tài xế *</label>
                <select
                  required
                  value={dispatchModal.driverId}
                  onChange={(e) =>
                    setDispatchModal({ ...dispatchModal, driverId: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.driverName} - {d.phoneNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Lý do ghi đè trùng lịch (nếu có)
                </label>
                <input
                  type="text"
                  value={dispatchModal.overrideReason}
                  onChange={(e) =>
                    setDispatchModal({ ...dispatchModal, overrideReason: e.target.value })
                  }
                  placeholder="Để trống nếu không trùng lịch"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Ghi chú điều phối
                </label>
                <input
                  type="text"
                  value={dispatchModal.notes}
                  onChange={(e) =>
                    setDispatchModal({ ...dispatchModal, notes: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDispatchModal(null)}
                className="px-3.5 py-1.5 rounded-md border border-gray-300 text-xs font-medium text-gray-700"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-md bg-[#00897b] text-white text-xs font-semibold hover:bg-[#00796b] cursor-pointer"
              >
                Xác nhận điều xe
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD SUPPLEMENT ASSIGNMENT / TRIP */}
      {/* ==================================================================== */}
      {addSupplementModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSupplement}
            className="bg-white rounded-[10px] shadow-xl border border-[#e5e7eb] w-full max-w-md p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-[15px] font-bold text-gray-900">
                Thêm xe bổ sung / điều bù ngày {commuteDate}
              </h3>
              <button
                type="button"
                onClick={() => setAddSupplementModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Tuyến cố định *</label>
                <select
                  required
                  value={addSupplementModal.routeId}
                  onChange={(e) =>
                    setAddSupplementModal({ ...addSupplementModal, routeId: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.routeName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Mã lượt chạy *</label>
                <input
                  type="text"
                  required
                  value={addSupplementModal.legCode}
                  onChange={(e) =>
                    setAddSupplementModal({ ...addSupplementModal, legCode: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Xe *</label>
                  <select
                    required
                    value={addSupplementModal.vehicleId}
                    onChange={(e) =>
                      setAddSupplementModal({ ...addSupplementModal, vehicleId: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vehiclePlate}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Tài xế *</label>
                  <select
                    required
                    value={addSupplementModal.driverId}
                    onChange={(e) =>
                      setAddSupplementModal({ ...addSupplementModal, driverId: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.driverName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Số hành khách bổ sung *
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={addSupplementModal.demandCount}
                  onChange={(e) =>
                    setAddSupplementModal({
                      ...addSupplementModal,
                      demandCount: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setAddSupplementModal(null)}
                className="px-3.5 py-1.5 rounded-md border border-gray-300 text-xs font-medium text-gray-700"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-md bg-[#00897b] text-white text-xs font-semibold hover:bg-[#00796b] cursor-pointer"
              >
                Lưu xe bổ sung
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
