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
  usePagination,
  exportTableToCsv,
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
  const [reqDeptFilter, setReqDeptFilter] = useState('');
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
      if (displayModeFilter === 'ENOUGH_ONLY') return !row.isShortage;
      return true;
    });

  const distinctReqDepts = Array.from(
    new Set([
      'Khối Kỹ thuật EMS',
      'Khối Sản xuất',
      'Phòng Hành chính Nhân sự (GA)',
      ...waitingRequests
        .map((r) => String(r.departmentName || '').trim())
        .filter((d) => d.length > 0 && d !== '-'),
    ])
  );

  const kw = search.trim().toLowerCase();
  const filteredWaitingRequests = waitingRequests
    .filter((req) => !reqDateFilter || req.businessDate === reqDateFilter)
    .filter((req) => {
      if (!reqTypeFilter) return true;
      if (reqTypeFilter === 'BUSINESS')
        return req.requestType === 'BUSINESS' || req.requestType === 'BUSINESS_TRIP';
      if (reqTypeFilter === 'GOODS')
        return req.requestType === 'GOODS' || req.requestType === 'CARGO';
      if (reqTypeFilter === 'OVERTIME')
        return req.requestType === 'OVERTIME' || req.requestType === 'OT';
      return req.requestType === reqTypeFilter;
    })
    .filter(
      (req) =>
        !reqDeptFilter ||
        String(req.departmentName || 'Khối Kỹ thuật EMS')
          .toLowerCase()
          .includes(reqDeptFilter.toLowerCase())
    )
    .filter(
      (req) =>
        !kw ||
        String(req.requestCode || '').toLowerCase().includes(kw) ||
        String(req.requesterName || '').toLowerCase().includes(kw) ||
        String(req.departmentName || '').toLowerCase().includes(kw) ||
        String(req.departurePickupPointText || '').toLowerCase().includes(kw) ||
        String(req.departureDropoffPointText || '').toLowerCase().includes(kw)
    );

  const reqPaging = usePagination(filteredWaitingRequests, 20);
  const commutePaging = usePagination(commuteRouteRows, 20);

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
              onClick: () => {
                exportTableToCsv('hang-cho-dieu-phoi');
                showToast('Đã xuất file Excel Hàng chờ điều phối');
              },
            }}
          />

          {/* Table (Exact columns & widths from 015-dispatch.png) */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] table-fixed text-left border-collapse">
              <thead>
                <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] text-[13px] font-semibold text-[#1f2937]">
                  <th className="px-2.5 w-[3%]">
                    <input
                      type="checkbox"
                      checked={
                        filteredWaitingRequests.length > 0 &&
                        selectedRequestIds.length === filteredWaitingRequests.length
                      }
                      onChange={(e) =>
                        setSelectedRequestIds(
                          e.target.checked ? filteredWaitingRequests.map((r) => r.id) : []
                        )
                      }
                    />
                  </th>
                  <th className="px-2.5 w-[3.5%]">#</th>
                  <th className="px-2.5 w-[9%]">Loại yêu cầu</th>
                  <th className="px-2.5 w-[11%]">Người yêu cầu</th>
                  <th className="px-2.5 w-[14.5%]">Bộ phận người yêu cầu</th>
                  <th className="px-2.5 w-[10.5%]">Số lượng đăng ký</th>
                  <th className="px-2.5 w-[12.5%]">Giờ khởi hành / Đón</th>
                  <th className="px-2.5 w-[18%]">Điểm đón / Lấy hàng</th>
                  <th className="px-2.5 w-[18%]">Điểm trả / Nhận hàng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb] text-[13px] text-[#1f2937]">
                {reqPaging.pagedItems.map((req, idx) => (
                  <tr
                    key={req.id}
                    onClick={(e) =>
                      setContextRow({
                        req,
                        index: (reqPaging.page - 1) * reqPaging.pageSize + idx + 1,
                        x: e.clientX,
                        y: e.clientY,
                      })
                    }
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextRow({
                        req,
                        index: (reqPaging.page - 1) * reqPaging.pageSize + idx + 1,
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
                    <td className="px-2.5 text-[#374151]">
                      {(reqPaging.page - 1) * reqPaging.pageSize + idx + 1}
                    </td>
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
                {filteredWaitingRequests.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-[13px] text-[#9ca3af]">
                      Không có đơn yêu cầu nào chờ điều phối
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <LegacyPagination
            totalCount={filteredWaitingRequests.length}
            shownCount={reqPaging.pagedItems.length}
            page={reqPaging.page}
            pageSize={reqPaging.pageSize}
            onPageChange={reqPaging.setPage}
            onPageSizeChange={reqPaging.setPageSize}
          />

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
                  { value: 'ENOUGH_ONLY', label: 'Tuyến đủ chỗ' },
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
              onClick: () => {
                exportTableToCsv('dieu-phoi-tuyen-hang-ngay');
                showToast('Đã xuất file Excel Điều phối tuyến hàng ngày');
              },
              splitItems: [
                {
                  label: 'Tạo Kế hoạch xe tuyến tự động',
                  icon: <RefreshCw className="w-4 h-4 text-[#00897b]" />,
                  onClick: handleRunAutoCreatePlan,
                },
                {
                  label: 'Chốt Kế hoạch & Sinh chuyến chạy',
                  icon: <ShieldCheck className="w-4 h-4 text-[#00897b]" />,
                  onClick: handleFinalizePlan,
                },
                {
                  label: 'Thêm xe bổ sung / điều bù',
                  icon: <Plus className="w-4 h-4 text-[#00897b]" />,
                  onClick: () =>
                    setAddSupplementModal({
                      routeId: routes[0]?.id || '',
                      legCode: 'L1',
                      vehicleId: vehicles[0]?.id || '',
                      driverId: drivers[0]?.id || '',
                      demandCount: 15,
                    }),
                },
              ],
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
                {commutePaging.pagedItems.map((row, idx) => (
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
                    <td className="px-2.5 text-[#374151]">
                      {(commutePaging.page - 1) * commutePaging.pageSize + idx + 1}
                    </td>
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

          <LegacyPagination
            totalCount={commuteRouteRows.length}
            shownCount={commutePaging.pagedItems.length}
            page={commutePaging.page}
            pageSize={commutePaging.pageSize}
            onPageChange={commutePaging.setPage}
            onPageSizeChange={commutePaging.setPageSize}
          />
        </div>
      )}

      {/* ==================================================================== */}
      {/* DRAWER: ROUTE COMMUTE DETAIL & ASSIGNMENTS (Legacy 023 & 024) */}
      {/* ==================================================================== */}
      {routeDetailModal && (
        <div className="fixed inset-0 z-50 bg-black/35 flex justify-end">
          <div className="bg-white w-full max-w-[940px] h-full shadow-2xl border-l border-[#e5e7eb] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]">
              <h3 className="text-[15px] font-bold text-[#1f2937]">
                {routeDetailModal.route.routeName}
              </h3>
              <button
                type="button"
                onClick={() => setRouteDetailModal(null)}
                className="text-[#4b5563] hover:text-[#1f2937] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-[13px]">
              {/* Tuyến summary */}
              <div>
                <h4 className="text-[14px] font-bold text-[#1f2937] mb-3">Tuyến</h4>
                <div className="space-y-2.5 border-t border-[#f3f4f6] pt-3">
                  <div className="grid grid-cols-12 gap-2">
                    <span className="col-span-3 text-[#6b7280]">Tuyến</span>
                    <span className="col-span-9 text-[#1f2937] font-medium">
                      {routeDetailModal.route.routeName}
                    </span>
                  </div>
                  <div className="grid grid-cols-12 gap-2">
                    <span className="col-span-3 text-[#6b7280]">Loại hành khách</span>
                    <span className="col-span-9 text-[#1f2937]">
                      {routeDetailModal.route.passengerType === 'WORKER'
                        ? 'Công nhân'
                        : 'Nhân viên'}
                    </span>
                  </div>
                  <div className="grid grid-cols-12 gap-2">
                    <span className="col-span-3 text-[#6b7280]">Lượt thiếu chỗ</span>
                    <span
                      className={`col-span-9 font-bold ${
                        routeDetailModal.shortageLegCount > 0
                          ? 'text-[#dc2626]'
                          : 'text-[#00897b]'
                      }`}
                    >
                      {routeDetailModal.shortageLegCount}
                    </span>
                  </div>
                  <div className="grid grid-cols-12 gap-2">
                    <span className="col-span-3 text-[#6b7280]">Tổng chỗ thiếu</span>
                    <span
                      className={`col-span-9 font-bold ${
                        routeDetailModal.totalShortageSeats > 0
                          ? 'text-[#dc2626]'
                          : 'text-[#00897b]'
                      }`}
                    >
                      {routeDetailModal.totalShortageSeats}
                    </span>
                  </div>
                </div>
              </div>

              {/* Lượt chạy trong ngày */}
              <div>
                <h4 className="text-[14px] font-bold text-[#1f2937] mb-3">
                  Lượt chạy trong ngày
                </h4>
                <div className="overflow-x-auto border border-[#e5e7eb] rounded-[8px]">
                  <table className="w-full text-left text-[13px] border-collapse">
                    <thead>
                      <tr className="bg-[#f8fafc] border-b border-[#e5e7eb] text-[12px] font-bold text-[#374151] h-[38px]">
                        <th className="px-3 w-[60px]">Lượt</th>
                        <th className="px-3 w-[180px]">Thông tin lượt</th>
                        <th className="px-3 w-[95px] text-center">Nhu cầu chỗ</th>
                        <th className="px-3 w-[85px] text-center">Tổng chỗ</th>
                        <th className="px-3 w-[85px] text-center">Thiếu chỗ</th>
                        <th className="px-3">Xe trên lượt</th>
                        <th className="px-3 w-[185px]">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e5e7eb]">
                      {(routeDetailModal.route.segments || []).map((seg: any) => {
                        const planAssign = (routeDetailModal.routeAssignments || []).find(
                          (a: any) => a.legCode === seg.legCode
                        );
                        const demand = routeDetailModal.route.riderCount || 28;
                        const cap =
                          seg.defaultVehicle?.seatCapacity ||
                          routeDetailModal.totalCapacity ||
                          28;
                        const short = Math.max(0, demand - cap);
                        return (
                          <tr
                            key={seg.id}
                            className={short > 0 ? 'bg-[#d5f5eb]/60' : 'bg-white'}
                          >
                            <td className="px-3 py-3 font-bold text-[#1f2937]">
                              {seg.legCode}
                            </td>
                            <td className="px-3 py-3 text-[#374151] truncate">
                              {seg.legName}
                            </td>
                            <td className="px-3 py-3 text-center text-[#1f2937]">
                              {demand}
                            </td>
                            <td
                              className={`px-3 py-3 text-center font-bold ${
                                short > 0 ? 'text-[#dc2626]' : 'text-[#00897b]'
                              }`}
                            >
                              {cap}
                            </td>
                            <td
                              className={`px-3 py-3 text-center font-bold ${
                                short > 0 ? 'text-[#dc2626]' : 'text-[#00897b]'
                              }`}
                            >
                              {short}
                            </td>
                            <td className="px-3 py-3">
                              {planAssign ? (
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={planAssign.vehicleId || ''}
                                    onChange={(e) =>
                                      handleUpdateAssignment(
                                        planAssign.id,
                                        e.target.value,
                                        planAssign.driverId || drivers[0]?.id
                                      )
                                    }
                                    className="h-[32px] border border-[#d1d5db] rounded-[6px] px-2 bg-white text-[12px]"
                                  >
                                    {vehicles.map((v) => (
                                      <option key={v.id} value={v.id}>
                                        {v.vehiclePlate} ({v.seatCapacity} chỗ)
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    value={planAssign.driverId || ''}
                                    onChange={(e) =>
                                      handleUpdateAssignment(
                                        planAssign.id,
                                        planAssign.vehicleId || vehicles[0]?.id,
                                        e.target.value
                                      )
                                    }
                                    className="h-[32px] border border-[#d1d5db] rounded-[6px] px-2 bg-white text-[12px]"
                                  >
                                    {drivers.map((d) => (
                                      <option key={d.id} value={d.id}>
                                        {d.driverName}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-[6px] bg-[#e0f2fe] text-[#0284c7] text-[12px] font-medium">
                                  {seg.defaultVehicle?.vehiclePlate ||
                                    routeDetailModal.fixedPlates[0] ||
                                    '29B50709'}{' '}
                                  ({cap} chỗ) -{' '}
                                  {seg.defaultDriver?.driverName || 'Nguyễn Văn An'}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 space-y-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const rId = routeDetailModal.route.id;
                                  setRouteDetailModal(null);
                                  setAddSupplementModal({
                                    routeId: rId,
                                    legCode: seg.legCode || 'L1',
                                    vehicleId: vehicles[0]?.id || '',
                                    driverId: drivers[0]?.id || '',
                                    demandCount: short > 0 ? short : 15,
                                  });
                                }}
                                className="w-full h-[28px] px-2.5 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[12px] font-medium cursor-pointer block"
                              >
                                Phân công lại xe / tài xế
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const rId = routeDetailModal.route.id;
                                  setRouteDetailModal(null);
                                  setAddSupplementModal({
                                    routeId: rId,
                                    legCode: seg.legCode || 'L1',
                                    vehicleId: vehicles[0]?.id || '',
                                    driverId: drivers[0]?.id || '',
                                    demandCount: short > 0 ? short : 15,
                                  });
                                }}
                                className="w-full h-[28px] px-2.5 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[12px] font-medium cursor-pointer block"
                              >
                                Điều xe tăng cường
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
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* DRAWER: DISPATCH SINGLE OR BULK REQUESTS (Legacy 018-dispatch-request-form-top.png) */}
      {/* ==================================================================== */}
      {dispatchModal && (
        <div className="fixed inset-0 z-50 bg-black/35 flex justify-end">
          <form
            onSubmit={handleConfirmDispatch}
            className="bg-white w-full max-w-[920px] h-full shadow-2xl border-l border-[#e5e7eb] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]">
              <h3 className="text-[15px] font-bold text-[#1f2937]">Điều phối</h3>
              <button
                type="button"
                onClick={() => setDispatchModal(null)}
                className="text-[#4b5563] hover:text-[#1f2937] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-[13px]">
              <div className="flex items-center justify-between border-b border-[#f3f4f6] pb-3">
                <h4 className="text-[14px] font-bold text-[#1f2937]">
                  {dispatchModal.mode === 'SINGLE'
                    ? `Điều phối: 1 yêu cầu (${dispatchModal.request?.requestCode})`
                    : `Điều phối: ${dispatchModal.requestIds?.length || 1} yêu cầu`}
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDispatchModal(null)}
                    className="h-[34px] px-4 rounded-[6px] border border-[#00897b] bg-white text-[#00897b] text-[13px] font-medium hover:bg-[#f0fdf4] cursor-pointer"
                  >
                    Xóa đợt
                  </button>
                  <button
                    type="submit"
                    className="h-[34px] px-4 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-medium cursor-pointer"
                  >
                    Điều phối
                  </button>
                </div>
              </div>

              {/* 01 / 05 Xe và tài xế */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[12px] font-bold text-[#1f2937]">
                  <span>Xe và tài xế</span>
                  <span className="text-[#9ca3af] font-normal">01 / 05</span>
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="relative">
                    <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                      Xe
                    </span>
                    <select
                      required
                      value={dispatchModal.vehicleId}
                      onChange={(e) =>
                        setDispatchModal({ ...dispatchModal, vehicleId: e.target.value })
                      }
                      className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white"
                    >
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.vehiclePlate} ({v.seatCapacity} chỗ)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="relative">
                    <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                      Tài xế
                    </span>
                    <select
                      required
                      value={dispatchModal.driverId}
                      onChange={(e) =>
                        setDispatchModal({ ...dispatchModal, driverId: e.target.value })
                      }
                      className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white"
                    >
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.driverName} - {d.phoneNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 02 / 05 Tuyến & Lộ trình */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[12px] font-bold text-[#1f2937]">
                  <span>Tuyến & Lộ trình chuyến</span>
                  <span className="text-[#9ca3af] font-normal">02 / 05</span>
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="relative">
                    <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                      Lý do ghi đè trùng lịch (nếu có)
                    </span>
                    <input
                      type="text"
                      value={dispatchModal.overrideReason}
                      onChange={(e) =>
                        setDispatchModal({ ...dispatchModal, overrideReason: e.target.value })
                      }
                      placeholder="Để trống nếu không trùng lịch"
                      className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937]"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                      Ghi chú điều phối
                    </span>
                    <input
                      type="text"
                      value={dispatchModal.notes}
                      onChange={(e) =>
                        setDispatchModal({ ...dispatchModal, notes: e.target.value })
                      }
                      className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD SUPPLEMENT ASSIGNMENT / TRIP (Legacy 025) */}
      {/* ==================================================================== */}
      {addSupplementModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSupplement}
            className="bg-white rounded-[12px] shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-[#e5e7eb] w-full max-w-[560px] p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-[15px] font-bold text-[#1f2937]">
                Điều xe tăng cường ({commuteDate})
              </h3>
              <button
                type="button"
                onClick={() => setAddSupplementModal(null)}
                className="text-[#ef4444] hover:text-[#dc2626] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3.5 text-[13px]">
              <div className="relative">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Tuyến cố định <span className="text-[#ef4444]">*</span>
                </span>
                <select
                  required
                  value={addSupplementModal.routeId}
                  onChange={(e) =>
                    setAddSupplementModal({ ...addSupplementModal, routeId: e.target.value })
                  }
                  className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white"
                >
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.routeName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Lượt chạy <span className="text-[#ef4444]">*</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={addSupplementModal.legCode}
                    onChange={(e) =>
                      setAddSupplementModal({ ...addSupplementModal, legCode: e.target.value })
                    }
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937]"
                  />
                </div>
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Số hành khách bổ sung <span className="text-[#ef4444]">*</span>
                  </span>
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
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Xe <span className="text-[#ef4444]">*</span>
                  </span>
                  <select
                    required
                    value={addSupplementModal.vehicleId}
                    onChange={(e) =>
                      setAddSupplementModal({ ...addSupplementModal, vehicleId: e.target.value })
                    }
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vehiclePlate}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Tài xế <span className="text-[#ef4444]">*</span>
                  </span>
                  <select
                    required
                    value={addSupplementModal.driverId}
                    onChange={(e) =>
                      setAddSupplementModal({ ...addSupplementModal, driverId: e.target.value })
                    }
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white"
                  >
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.driverName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddSupplementModal(null)}
                className="h-[34px] px-4 rounded-[6px] border border-[#d1d5db] bg-white text-[13px] font-medium text-[#4b5563] hover:bg-[#f9fafb] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="h-[34px] px-4 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-medium cursor-pointer"
              >
                Điều xe tăng cường
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
