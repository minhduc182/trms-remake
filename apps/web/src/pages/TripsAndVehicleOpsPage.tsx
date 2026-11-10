import React, { useEffect, useMemo, useState } from 'react';
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
  ArrowRightLeft,
  Eye,
  Trash2,
  Clock,
  MapPin,
  UserCheck,
  Truck,
  FileText,
  History,
  AlertTriangle,
  CornerDownLeft,
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

function formatTripTimeWindow(
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

function formatDateTimeVi(val?: string | null): string {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return val;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function extractTimeHHmm(val?: string | null, fallback = '08:00'): string {
  if (!val) return fallback;
  if (/^\d{2}:\d{2}/.test(val.trim())) return val.trim().slice(0, 5);
  const d = new Date(val);
  if (!Number.isNaN(d.getTime())) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mi}`;
  }
  return fallback;
}

function getTodayIso(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isTripDeadhead(trip: any): boolean {
  if (!trip) return false;
  if (
    trip.tripType === 'DEADHEAD' ||
    trip.tripType === 'EMPTY_RETURN' ||
    trip.dispatchType === 'DEADHEAD' ||
    trip.dispatchType === 'EMPTY_RETURN'
  ) {
    return true;
  }
  if (trip.deadheadKind && trip.deadheadKind !== 'NONE') return true;
  if ((trip.notes || '').toLowerCase().includes('rỗng')) return true;
  return false;
}

function getTripOtHours(trip: any): number | null {
  if (!trip) return null;
  if (trip.otHours !== undefined && trip.otHours !== null) return Number(trip.otHours);
  const factOt = trip.executionFacts?.[0]?.otHours;
  if (factOt !== undefined && factOt !== null) return Number(factOt);
  return null;
}

function renderTripLegBadge(tripLeg?: string | null, tripMode?: string | null) {
  if (tripLeg === 'RETURN') {
    return <PastelBadge label="Chiều về" tone="purple" />;
  }
  if (tripLeg === 'OUTBOUND') {
    return (
      <PastelBadge
        label={tripMode === 'ROUND_TRIP' ? 'Chiều đi (KH)' : 'Chiều đi'}
        tone="sky"
      />
    );
  }
  return <span className="text-[12px] text-[#6b7280]">Một chiều</span>;
}

function renderDeadheadKindLabel(kind?: string | null): string {
  if (!kind || kind === 'NONE') return 'Chạy rỗng tuyến thường';
  if (kind === 'CONNECTOR') return 'Chạy rỗng nối chuyến';
  if (kind === 'BASE_RETURN') return 'Chạy rỗng về bãi GICO';
  return kind;
}

export const TripsAndVehicleOpsPage: React.FC<{ initialView?: 'TRIPS' | 'VEHICLE_OPS' }> = ({
  initialView = 'TRIPS',
}) => {
  const [view, setView] = useState<'TRIPS' | 'VEHICLE_OPS'>(initialView);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Trips filters & state
  const [businessDate, setBusinessDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [tripCategoryFilter, setTripCategoryFilter] = useState<string>('');
  const [passengerTypeFilter, setPassengerTypeFilter] = useState<string>('');
  const [tripLegFilter, setTripLegFilter] = useState<string>('');
  const [deadheadKindFilter, setDeadheadKindFilter] = useState<string>('');
  const [trips, setTrips] = useState<any[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [contextTrip, setContextTrip] = useState<{
    trip: any;
    index: number;
    x: number;
    y: number;
  } | null>(null);

  // Vehicle Ops filters & state
  const [opsBusinessDate, setOpsBusinessDate] = useState<string>('');
  const [opsRouteFilter, setOpsRouteFilter] = useState<string>('');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string>('');
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState<string>('');
  const [vehicleStatuses, setVehicleStatuses] = useState<any[]>([]);
  const [opsTrips, setOpsTrips] = useState<any[]>([]);
  const [selectedVehId, setSelectedVehId] = useState<string | null>(null);

  // Master Lookups
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);

  // Drawers & Modals
  const [tripDetailDrawer, setTripDetailDrawer] = useState<any | null>(null);
  const [tripAuditLogs, setTripAuditLogs] = useState<any[]>([]);
  const [vehOpsDrawer, setVehOpsDrawer] = useState<any | null>(null);
  const [vehDrawerTab, setVehDrawerTab] = useState<'TRIPS' | 'REQUESTS' | 'STATUS'>('TRIPS');
  const [vehAuditLogs, setVehAuditLogs] = useState<any[]>([]);

  // Action Modals
  const [kmModal, setKmModal] = useState<{
    trip: any;
    actualKm: string;
    otHours: string;
    tollFeeAmount: string;
    actualStartAt: string;
    actualEndAt: string;
    overnightNights: string;
    executionNote: string;
    targetStatus: string;
  } | null>(null);

  const [reassignModal, setReassignModal] = useState<{
    trip: any;
    vehicleId: string;
    driverId: string;
    actualKm: string;
    reason: string;
  } | null>(null);

  const [cancelModal, setCancelModal] = useState<{
    trip: any;
    reason: string;
  } | null>(null);

  const [supplementCompletedModal, setSupplementCompletedModal] = useState<{
    businessDate: string;
    tripType: string;
    routeId: string;
    legCode: string;
    tripLeg: string;
    vehicleId: string;
    driverId: string;
    departurePickupPointText: string;
    departureDropoffPointText: string;
    actualStartAt: string;
    actualEndAt: string;
    passengerCount: string;
    startOdometerKm: string;
    endOdometerKm: string;
    actualKm: string;
    otHours: string;
    tollFeeAmount: string;
    overnightNights: string;
    notes: string;
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
          vehicles(activeFlag: "Y") {
            id
            vehiclePlate
            vehicleType
            seatCapacity
            ownershipType
            defaultDriverId
            activeFlag
            vendor { id vendorName }
            defaultDriver { id driverName phoneNumber }
          }
          drivers(activeFlag: "Y") {
            id
            driverName
            phoneNumber
          }
          routes(activeFlag: "Y") {
            id
            routeCode
            routeName
            passengerType
            segments {
              id
              legCode
              legName
              direction
              departureTime
              arrivalTime
              defaultVehicleId
              defaultDriverId
            }
            routeVehicles {
              id
              vehicleId
              isDefault
            }
          }
        }
      `);
      setVehicles(res.vehicles || []);
      setDrivers(res.drivers || []);
      setRoutes(res.routes || []);
    } catch {
      // ignore lookup error
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (view === 'TRIPS') {
        const res = await gqlRequest<{ trips: any[] }>(
          `query LoadTrips(
            $businessDate: String
            $status: String
            $passengerType: String
            $tripLeg: String
            $deadheadKind: String
          ) {
            trips(
              businessDate: $businessDate
              status: $status
              passengerType: $passengerType
              tripLeg: $tripLeg
              deadheadKind: $deadheadKind
              limit: 500
            ) {
              id
              tripCode
              businessDate
              tripType
              dispatchType
              dispatchSource
              status
              vendorId
              routeId
              segmentId
              legCode
              vehicleId
              driverId
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
              deadheadSourceTripId
              pricingScope
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
                segments {
                  id
                  legCode
                  legName
                  direction
                  departureTime
                  arrivalTime
                  segmentPoints {
                    id
                    pointRole
                    stopOrder
                    plannedTime
                    point { id pointCode pointName }
                  }
                }
              }
              vehicle {
                id
                vehiclePlate
                vehicleType
                seatCapacity
                ownershipType
                defaultDriverId
              }
              driver {
                id
                driverName
                phoneNumber
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
                  returnPickupPointText
                  returnDropoffPointText
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
                actualDepartureAt
                actualArrivalAt
                actualPassengerCount
                startOdometerKm
                endOdometerKm
                executionNote
              }
              costRecords {
                id
                costType
                appliedAmount
                amountAfterVat
                description
              }
            }
          }`,
          {
            businessDate: businessDate || undefined,
            status: statusFilter || undefined,
            passengerType: passengerTypeFilter || undefined,
            tripLeg: tripLegFilter || undefined,
            deadheadKind: deadheadKindFilter || undefined,
          }
        );
        const fetchedTrips = res.trips || [];
        setTrips(fetchedTrips);
        if (tripDetailDrawer) {
          const refreshed = fetchedTrips.find(
            (t: any) => String(t.id) === String(tripDetailDrawer.id)
          );
          if (refreshed) setTripDetailDrawer(refreshed);
        }
      } else {
        const res = await gqlRequest<{
          vehicleStatuses: any[];
          vehicles: any[];
          trips: any[];
        }>(
          `query GetVehicleOpsData($status: String, $vehicleType: String, $routeId: BigInt, $businessDate: String) {
            vehicleStatuses(status: $status, vehicleType: $vehicleType, routeId: $routeId) {
              vehicleId
              status
              routeId
              currentTripId
              plannedDepartureAt
              plannedArrivalAt
              lastSyncedAt
              vehicle {
                id
                vehiclePlate
                vehicleType
                seatCapacity
                ownershipType
                defaultDriverId
                activeFlag
                vendor { id vendorName }
                defaultDriver { id driverName phoneNumber }
              }
              route {
                id
                routeCode
                routeName
              }
              currentTrip {
                id
                tripCode
                businessDate
                tripType
                dispatchType
                status
                driverNameSnapshot
                driverPhoneSnapshot
                departurePickupPointText
                departureDropoffPointText
                plannedDepartureAt
                plannedArrivalAt
              }
            }
            vehicles {
              id
              vehiclePlate
              vehicleType
              seatCapacity
              ownershipType
              defaultDriverId
              activeFlag
              vendor { id vendorName }
              defaultDriver { id driverName phoneNumber }
            }
            trips(businessDate: $businessDate, limit: 500) {
              id
              tripCode
              businessDate
              tripType
              dispatchType
              status
              routeId
              legCode
              vehicleId
              driverId
              vehiclePlateSnapshot
              driverNameSnapshot
              driverPhoneSnapshot
              seatCapacitySnapshot
              departurePickupPointText
              departureDropoffPointText
              plannedDepartureAt
              plannedArrivalAt
              passengerCount
              passengerType
              tripMode
              tripLeg
              pairedTripId
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
              route { id routeCode routeName passengerType }
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
                  purpose
                  status
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
                actualDepartureAt
                actualArrivalAt
                executionNote
              }
            }
          }`,
          {
            status: vehicleStatusFilter || undefined,
            vehicleType: vehicleTypeFilter || undefined,
            routeId: opsRouteFilter ? opsRouteFilter : undefined,
            businessDate: opsBusinessDate || undefined,
          }
        );

        const allTrips = res.trips || [];
        setOpsTrips(allTrips);

        const tripsByVehicle = new Map<string, any[]>();
        for (const t of allTrips) {
          if (!t.vehicleId) continue;
          const k = String(t.vehicleId);
          const list = tripsByVehicle.get(k) || [];
          list.push(t);
          tripsByVehicle.set(k, list);
        }

        const vsByVehId = new Map<string, any>();
        for (const vs of res.vehicleStatuses || []) {
          vsByVehId.set(String(vs.vehicleId), vs);
        }

        const allVehicles = res.vehicles || [];
        const mergedRows: any[] = [];

        for (const veh of allVehicles) {
          const vIdStr = String(veh.id);
          const vs = vsByVehId.get(vIdStr);
          // If server-side filter was applied on vehicleStatuses, respect it
          if ((vehicleStatusFilter || opsRouteFilter) && !vs) {
            continue;
          }
          if (vehicleTypeFilter && veh.vehicleType !== vehicleTypeFilter) {
            continue;
          }

          const vehTrips = tripsByVehicle.get(vIdStr) || [];
          const activeTrip =
            vehTrips.find((t) =>
              ['IN_PROGRESS', 'DRIVER_CONFIRMED', 'DISPATCHED', 'WAITING_DRIVER_CONFIRM'].includes(
                t.status
              )
            ) ||
            vs?.currentTrip ||
            vehTrips[0] ||
            null;

          let computedStatus =
            vs?.status || (veh.activeFlag === 'N' ? 'NOT_AVAILABLE' : 'AVAILABLE');
          if (!vs?.status && activeTrip) {
            computedStatus =
              activeTrip.dispatchType === 'FIXED_ROUTE'
                ? 'ON_FIXED_ROUTE'
                : 'ON_SPECIAL_ASSIGNMENT';
          }

          if (vehicleStatusFilter && computedStatus !== vehicleStatusFilter) {
            continue;
          }

          mergedRows.push({
            vehicleId: veh.id,
            status: computedStatus,
            routeId: vs?.routeId || activeTrip?.routeId || null,
            currentTripId: vs?.currentTripId || activeTrip?.id || null,
            plannedDepartureAt: vs?.plannedDepartureAt || activeTrip?.plannedDepartureAt || null,
            plannedArrivalAt: vs?.plannedArrivalAt || activeTrip?.plannedArrivalAt || null,
            lastSyncedAt: vs?.lastSyncedAt || null,
            vehicle: veh,
            route: vs?.route || activeTrip?.route || null,
            latestTrip: activeTrip,
            dayTrips: vehTrips,
          });
        }

        // Also include any vehicleStatuses whose vehicle wasn't in allVehicles
        for (const vs of res.vehicleStatuses || []) {
          const vIdStr = String(vs.vehicleId);
          if (!mergedRows.some((r) => String(r.vehicleId) === vIdStr)) {
            const vehTrips = tripsByVehicle.get(vIdStr) || [];
            mergedRows.push({
              ...vs,
              latestTrip: vs.currentTrip || vehTrips[0] || null,
              dayTrips: vehTrips,
            });
          }
        }

        setVehicleStatuses(mergedRows);
        if (vehOpsDrawer) {
          const refreshedVeh = mergedRows.find(
            (r) => String(r.vehicleId) === String(vehOpsDrawer.vehicleId)
          );
          if (refreshedVeh) setVehOpsDrawer(refreshedVeh);
        }
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
  }, [
    view,
    businessDate,
    statusFilter,
    passengerTypeFilter,
    tripLegFilter,
    deadheadKindFilter,
    opsBusinessDate,
    opsRouteFilter,
    vehicleTypeFilter,
    vehicleStatusFilter,
  ]);

  const loadTripAuditHistory = async (tripId: string) => {
    try {
      const res = await gqlRequest<{ auditLogs: any[] }>(
        `query LoadTripAudits($entityId: String) {
          auditLogs(entityType: "TRIP", entityId: $entityId, limit: 30) {
            id actionType actorName changedAt summaryText
          }
        }`,
        { entityId: String(tripId) }
      );
      setTripAuditLogs(res.auditLogs || []);
    } catch {
      setTripAuditLogs([]);
    }
  };

  const loadVehicleAuditHistory = async (vehicleId: string) => {
    try {
      const res = await gqlRequest<{ auditLogs: any[] }>(
        `query LoadVehicleAudits($entityId: String) {
          auditLogs(entityType: "VEHICLE_STATUS", entityId: $entityId, limit: 30) {
            id actionType actorName changedAt summaryText
          }
        }`,
        { entityId: String(vehicleId) }
      );
      setVehAuditLogs(res.auditLogs || []);
    } catch {
      setVehAuditLogs([]);
    }
  };

  const openTripDetail = (trip: any) => {
    setTripDetailDrawer(trip);
    loadTripAuditHistory(String(trip.id));
  };

  const openVehOpsDetail = (vs: any) => {
    setVehOpsDrawer(vs);
    setVehDrawerTab('TRIPS');
    loadVehicleAuditHistory(String(vs.vehicleId));
  };

  const openKmModalForTrip = (trip: any) => {
    const fact = trip.executionFacts?.[0];
    const currentKm =
      trip.actualKm !== undefined && trip.actualKm !== null
        ? String(trip.actualKm)
        : fact?.actualKm !== undefined && fact?.actualKm !== null
          ? String(fact.actualKm)
          : '';
    const currentOt = getTripOtHours(trip);
    setKmModal({
      trip,
      actualKm: currentKm || '25',
      otHours: currentOt !== null ? String(currentOt) : '0',
      tollFeeAmount:
        trip.tollFeeAmount !== undefined && trip.tollFeeAmount !== null
          ? String(trip.tollFeeAmount)
          : '0',
      actualStartAt: extractTimeHHmm(
        trip.actualStartAt || fact?.actualDepartureAt || trip.plannedDepartureAt,
        '07:30'
      ),
      actualEndAt: extractTimeHHmm(
        trip.actualEndAt || fact?.actualArrivalAt || trip.plannedArrivalAt,
        '08:30'
      ),
      overnightNights: '0',
      executionNote: fact?.executionNote || trip.notes || '',
      targetStatus: trip.status === 'COMPLETED' ? 'COMPLETED' : 'COMPLETED',
    });
  };

  const openReassignModalForTrip = (trip: any) => {
    const defaultVehId = String(trip.vehicleId || vehicles[0]?.id || '');
    const selectedVeh = vehicles.find((v) => String(v.id) === defaultVehId);
    const defaultDrvId = String(
      trip.driverId || selectedVeh?.defaultDriverId || drivers[0]?.id || ''
    );
    setReassignModal({
      trip,
      vehicleId: defaultVehId,
      driverId: defaultDrvId,
      actualKm:
        trip.actualKm !== undefined && trip.actualKm !== null ? String(trip.actualKm) : '',
      reason: trip.overrideReason || 'Điều động đổi xe / tài xế theo thực tế vận hành',
    });
  };

  const openSupplementCompletedModal = () => {
    const firstRoute = routes[0];
    const firstSeg = firstRoute?.segments?.[0];
    const firstVeh = vehicles[0];
    const defaultDrvId =
      firstVeh?.defaultDriverId || firstSeg?.defaultDriverId || drivers[0]?.id || '';
    setSupplementCompletedModal({
      businessDate: businessDate || getTodayIso(),
      tripType: 'COMMUTE',
      routeId: firstRoute ? String(firstRoute.id) : '',
      legCode: firstSeg?.legCode || 'SANG_DON',
      tripLeg: 'OUTBOUND',
      vehicleId: firstVeh ? String(firstVeh.id) : '',
      driverId: String(defaultDrvId),
      departurePickupPointText: firstRoute?.routeName || 'Điểm đón cố định',
      departureDropoffPointText: 'Nhà máy MKVC',
      actualStartAt: '06:30',
      actualEndAt: '07:45',
      passengerCount: '25',
      startOdometerKm: '',
      endOdometerKm: '',
      actualKm: '28.5',
      otHours: '0',
      tollFeeAmount: '0',
      overnightNights: '0',
      notes: 'Bổ sung chuyến đã hoàn thành thực tế',
    });
  };

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

  const handleConfirmCancelTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModal) return;
    if (!cancelModal.reason.trim()) {
      alert('Vui lòng nhập lý do hủy chuyến đi');
      return;
    }
    try {
      await gqlRequest(
        `mutation CancelTrip($id: BigInt!, $reason: String) {
          cancelTrip(id: $id, reason: $reason) { id status }
        }`,
        { id: cancelModal.trip.id, reason: cancelModal.reason.trim() }
      );
      showToast(`Đã hủy chuyến ${cancelModal.trip.tripCode}`);
      setCancelModal(null);
      if (tripDetailDrawer && String(tripDetailDrawer.id) === String(cancelModal.trip.id)) {
        setTripDetailDrawer(null);
      }
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDetachRequest = async (trip: any, requestId: string, requestCode: string) => {
    try {
      const res = await gqlRequest<{ detachRequestsFromTrip: any }>(
        `mutation DetachReq($tripId: BigInt!, $requestIds: [BigInt!]!) {
          detachRequestsFromTrip(tripId: $tripId, requestIds: $requestIds) {
            id status passengerCount
          }
        }`,
        {
          tripId: trip.id,
          requestIds: [requestId],
        }
      );
      showToast(
        `Đã gỡ đơn ${requestCode} khỏi chuyến ${trip.tripCode} (trạng thái chuyến: ${res.detachRequestsFromTrip.status})`
      );
      loadData();
      loadTripAuditHistory(String(trip.id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateEmptyReturnTrip = async (sourceTrip: any) => {
    try {
      const targetRouteId = sourceTrip.routeId || routes[0]?.id;
      const targetVehId = sourceTrip.vehicleId || vehicles[0]?.id;
      const targetDrvId = sourceTrip.driverId || drivers[0]?.id;
      if (!targetRouteId || !targetVehId || !targetDrvId) {
        alert('Thiếu thông tin xe, tài xế hoặc tuyến để tạo chuyến về rỗng');
        return;
      }
      const reversePickup =
        sourceTrip.departureDropoffPointText || sourceTrip.route?.routeName || 'Điểm trả';
      const reverseDropoff = sourceTrip.departurePickupPointText || 'Bãi xe GICO / MKVC';
      const noteText = `[EMPTY_RETURN] Chuyến về rỗng từ ${sourceTrip.tripCode} (${reversePickup} -> ${reverseDropoff})`;

      const res = await gqlRequest<{ createSupplementTrip: any }>(
        `mutation CreateEmptyReturn(
          $businessDate: String!
          $routeId: BigInt!
          $segmentId: BigInt
          $legCode: String!
          $vehicleId: BigInt!
          $driverId: BigInt!
          $passengerCount: Int
          $notes: String
        ) {
          createSupplementTrip(
            businessDate: $businessDate
            routeId: $routeId
            segmentId: $segmentId
            legCode: $legCode
            vehicleId: $vehicleId
            driverId: $driverId
            passengerCount: $passengerCount
            notes: $notes
          ) {
            id
            tripCode
          }
        }`,
        {
          businessDate:
            sourceTrip.businessDate <= getTodayIso() ? sourceTrip.businessDate : getTodayIso(),
          routeId: targetRouteId,
          segmentId: sourceTrip.segmentId || undefined,
          legCode: sourceTrip.legCode || 'VE_RONG',
          vehicleId: targetVehId,
          driverId: targetDrvId,
          passengerCount: 0,
          notes: noteText,
        }
      );
      showToast(
        `Đã tạo chuyến về rỗng ${res.createSupplementTrip.tripCode} từ chuyến ${sourceTrip.tripCode}`
      );
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveActualKm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kmModal) return;
    const kmNum = Number(kmModal.actualKm);
    if (!Number.isFinite(kmNum) || kmNum <= 0) {
      alert('Số KM thực tế phải lớn hơn 0');
      return;
    }
    try {
      await gqlRequest(
        `mutation UpdateKm(
          $id: BigInt!
          $actualKm: Decimal!
          $otHours: Decimal
          $tollFeeAmount: Decimal
          $actualStartAt: String
          $actualEndAt: String
          $overnightNights: Int
          $targetStatus: String
          $executionNote: String
        ) {
          updateTripActualKm(
            id: $id
            actualKm: $actualKm
            otHours: $otHours
            tollFeeAmount: $tollFeeAmount
            actualStartAt: $actualStartAt
            actualEndAt: $actualEndAt
            overnightNights: $overnightNights
            targetStatus: $targetStatus
            executionNote: $executionNote
          ) {
            id
            status
            actualKm
          }
        }`,
        {
          id: kmModal.trip.id,
          actualKm: String(kmNum),
          otHours: kmModal.otHours ? String(kmModal.otHours) : undefined,
          tollFeeAmount:
            kmModal.tollFeeAmount !== '' && Number(kmModal.tollFeeAmount) >= 0
              ? String(kmModal.tollFeeAmount)
              : undefined,
          actualStartAt: kmModal.actualStartAt || undefined,
          actualEndAt: kmModal.actualEndAt || undefined,
          overnightNights:
            kmModal.overnightNights !== '' ? Number(kmModal.overnightNights) : undefined,
          targetStatus: kmModal.targetStatus || undefined,
          executionNote: kmModal.executionNote || undefined,
        }
      );
      showToast(`Đã cập nhật thực tế & KM (${kmNum} km) cho chuyến ${kmModal.trip.tripCode}`);
      setKmModal(null);
      loadData();
      if (tripDetailDrawer) {
        loadTripAuditHistory(String(kmModal.trip.id));
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignModal) return;
    try {
      await gqlRequest(
        `mutation ReassignVeh(
          $id: BigInt!
          $vehicleId: BigInt!
          $driverId: BigInt!
          $actualKm: Decimal
          $reason: String
        ) {
          reassignTripVehicle(
            id: $id
            vehicleId: $vehicleId
            driverId: $driverId
            actualKm: $actualKm
            reason: $reason
          ) {
            id
            vehiclePlateSnapshot
            driverNameSnapshot
          }
        }`,
        {
          id: reassignModal.trip.id,
          vehicleId: reassignModal.vehicleId,
          driverId: reassignModal.driverId,
          actualKm:
            reassignModal.actualKm && Number(reassignModal.actualKm) > 0
              ? String(reassignModal.actualKm)
              : undefined,
          reason: reassignModal.reason || undefined,
        }
      );
      showToast(`Đã đổi xe / tài xế cho chuyến ${reassignModal.trip.tripCode}`);
      setReassignModal(null);
      loadData();
      if (tripDetailDrawer) {
        loadTripAuditHistory(String(reassignModal.trip.id));
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveSupplementCompletedTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplementCompletedModal) return;
    const form = supplementCompletedModal;
    const kmNum = Number(form.actualKm);
    if (!Number.isFinite(kmNum) || kmNum <= 0) {
      alert('Vui lòng nhập Số KM thực tế lớn hơn 0');
      return;
    }
    const targetRouteId = form.routeId || routes[0]?.id;
    if (!targetRouteId || !form.vehicleId || !form.driverId) {
      alert('Vui lòng chọn đầy đủ Tuyến đường, Xe và Tài xế');
      return;
    }

    try {
      const notePrefix =
        form.tripType === 'DEADHEAD'
          ? '[DEADHEAD] Chuyến chạy rỗng bổ sung'
          : `[${form.tripType}/${form.tripLeg}] ${form.departurePickupPointText} -> ${form.departureDropoffPointText}`;
      const combinedNotes = [notePrefix, form.notes.trim()].filter(Boolean).join(' | ');

      const createRes = await gqlRequest<{ createSupplementTrip: any }>(
        `mutation CreateSuppCompleted(
          $businessDate: String!
          $routeId: BigInt!
          $legCode: String!
          $vehicleId: BigInt!
          $driverId: BigInt!
          $passengerCount: Int
          $notes: String
        ) {
          createSupplementTrip(
            businessDate: $businessDate
            routeId: $routeId
            legCode: $legCode
            vehicleId: $vehicleId
            driverId: $driverId
            passengerCount: $passengerCount
            notes: $notes
          ) {
            id
            tripCode
          }
        }`,
        {
          businessDate: form.businessDate <= getTodayIso() ? form.businessDate : getTodayIso(),
          routeId: targetRouteId,
          legCode: form.legCode || 'BO_SUNG',
          vehicleId: form.vehicleId,
          driverId: form.driverId,
          passengerCount: form.tripType === 'DEADHEAD' ? 0 : Number(form.passengerCount || 0),
          notes: combinedNotes,
        }
      );

      const newTripId = createRes.createSupplementTrip.id;
      const newTripCode = createRes.createSupplementTrip.tripCode;

      await gqlRequest(
        `mutation FinalizeSuppTripKm(
          $id: BigInt!
          $actualKm: Decimal!
          $otHours: Decimal
          $tollFeeAmount: Decimal
          $actualStartAt: String
          $actualEndAt: String
          $overnightNights: Int
          $targetStatus: String
          $executionNote: String
        ) {
          updateTripActualKm(
            id: $id
            actualKm: $actualKm
            otHours: $otHours
            tollFeeAmount: $tollFeeAmount
            actualStartAt: $actualStartAt
            actualEndAt: $actualEndAt
            overnightNights: $overnightNights
            targetStatus: $targetStatus
            executionNote: $executionNote
          ) {
            id
            status
          }
        }`,
        {
          id: newTripId,
          actualKm: String(kmNum),
          otHours: form.otHours && Number(form.otHours) > 0 ? String(form.otHours) : undefined,
          tollFeeAmount:
            form.tollFeeAmount && Number(form.tollFeeAmount) > 0
              ? String(form.tollFeeAmount)
              : undefined,
          actualStartAt: form.actualStartAt || undefined,
          actualEndAt: form.actualEndAt || undefined,
          overnightNights:
            form.overnightNights && Number(form.overnightNights) > 0
              ? Number(form.overnightNights)
              : undefined,
          targetStatus: 'COMPLETED',
          executionNote: combinedNotes,
        }
      );

      showToast(`Đã bổ sung chuyến hoàn thành ${newTripCode} (${kmNum} km)`);
      setSupplementCompletedModal(null);
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

  const vehicleTypeMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of vehicles) {
      if (v.vehiclePlate) m.set(v.vehiclePlate, v.vehicleType);
    }
    return m;
  }, [vehicles]);

  const assignedRoutesByVehicle = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const rt of routes) {
      const label = `${rt.routeCode} - ${rt.routeName}`;
      for (const rv of rt.routeVehicles || []) {
        const key = String(rv.vehicleId);
        const list = map.get(key) || [];
        if (!list.includes(label)) list.push(label);
        map.set(key, list);
      }
      for (const seg of rt.segments || []) {
        if (seg.defaultVehicleId) {
          const key = String(seg.defaultVehicleId);
          const list = map.get(key) || [];
          if (!list.includes(label)) list.push(label);
          map.set(key, list);
        }
      }
    }
    return map;
  }, [routes]);

  const filteredTrips = useMemo(() => {
    return trips
      .filter((t) => !businessDate || t.businessDate === businessDate)
      .filter((t) => {
        if (!statusFilter) return true;
        if (statusFilter === 'DISPATCHED') {
          return t.status === 'DISPATCHED' || t.status === 'WAITING_DRIVER_CONFIRM';
        }
        return t.status === statusFilter;
      })
      .filter((t) => {
        if (!tripCategoryFilter) return true;
        const deadhead = isTripDeadhead(t);
        if (tripCategoryFilter === 'FIXED_ROUTE') {
          return t.dispatchType === 'FIXED_ROUTE' || t.tripType === 'FIXED_ROUTE';
        }
        if (tripCategoryFilter === 'SUPPLEMENT') {
          return t.dispatchType === 'SUPPLEMENT' || t.tripType === 'SUPPLEMENT';
        }
        if (tripCategoryFilter === 'DISPATCH') {
          return ['DISPATCH', 'AD_HOC', 'MERGED'].includes(t.dispatchType) && !deadhead;
        }
        if (tripCategoryFilter === 'BUSINESS') {
          return ['BUSINESS', 'BUSINESS_TRIP'].includes(t.tripType);
        }
        if (tripCategoryFilter === 'OT') {
          return ['OT', 'OVERTIME'].includes(t.tripType);
        }
        if (tripCategoryFilter === 'CARGO') {
          return ['CARGO', 'GOODS'].includes(t.tripType);
        }
        if (tripCategoryFilter === 'MIXED') {
          return (
            ['MIXED', 'MERGED'].includes(t.tripType) ||
            (t.requestLinks && t.requestLinks.length > 1)
          );
        }
        if (tripCategoryFilter === 'DEADHEAD') {
          return deadhead;
        }
        if (tripCategoryFilter === 'EMPTY_RETURN') {
          return (
            t.tripType === 'EMPTY_RETURN' ||
            t.deadheadKind === 'BASE_RETURN' ||
            (t.notes || '').includes('EMPTY_RETURN') ||
            (t.notes || '').toLowerCase().includes('về rỗng')
          );
        }
        return true;
      })
      .filter((t) => {
        if (!passengerTypeFilter) return true;
        const pt = t.passengerType || t.route?.passengerType;
        return pt === passengerTypeFilter;
      })
      .filter((t) => {
        if (!tripLegFilter) return true;
        return t.tripLeg === tripLegFilter;
      })
      .filter((t) => {
        if (!deadheadKindFilter) return true;
        return (t.deadheadKind || 'NONE') === deadheadKindFilter;
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
          (t.departureDropoffPointText || '').toLowerCase().includes(kw) ||
          (t.notes || '').toLowerCase().includes(kw)
        );
      });
  }, [
    trips,
    businessDate,
    statusFilter,
    tripCategoryFilter,
    passengerTypeFilter,
    tripLegFilter,
    deadheadKindFilter,
    search,
  ]);

  const filteredVehicleStatuses = useMemo(() => {
    return vehicleStatuses
      .filter((vs) => !vehicleStatusFilter || vs.status === vehicleStatusFilter)
      .filter((vs) => !vehicleTypeFilter || vs.vehicle?.vehicleType === vehicleTypeFilter)
      .filter((vs) => {
        if (!opsRouteFilter) return true;
        if (String(vs.routeId || '') === opsRouteFilter) return true;
        if (
          (vs.dayTrips || []).some((t: any) => String(t.routeId || '') === opsRouteFilter)
        ) {
          return true;
        }
        return false;
      })
      .filter((vs) => {
        if (!search.trim()) return true;
        const kw = search.trim().toLowerCase();
        return (
          (vs.vehicle?.vehiclePlate || '').toLowerCase().includes(kw) ||
          (vs.latestTrip?.driverNameSnapshot || '').toLowerCase().includes(kw) ||
          (vs.vehicle?.defaultDriver?.driverName || '').toLowerCase().includes(kw) ||
          (vs.latestTrip?.route?.routeName || '').toLowerCase().includes(kw) ||
          (vs.latestTrip?.tripCode || '').toLowerCase().includes(kw)
        );
      })
      .sort((a, b) =>
        String(a.vehicle?.vehiclePlate || '').localeCompare(
          String(b.vehicle?.vehiclePlate || '')
        )
      );
  }, [vehicleStatuses, vehicleStatusFilter, vehicleTypeFilter, opsRouteFilter, search]);

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
      {/* VIEW 1: TRIP TRACKING */}
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
              value={tripCategoryFilter}
              onChange={(val) => {
                setTripCategoryFilter(val);
                if (val !== 'DEADHEAD' && val !== 'EMPTY_RETURN') {
                  setDeadheadKindFilter('');
                }
              }}
              options={[
                { value: 'FIXED_ROUTE', label: 'Đưa đón cố định (COMMUTE)' },
                { value: 'SUPPLEMENT', label: 'Tuyến bổ sung (SUPPLEMENT)' },
                { value: 'DISPATCH', label: 'Điều chuyến phát sinh' },
                { value: 'BUSINESS', label: 'Công tác (BUSINESS)' },
                { value: 'OT', label: 'Làm thêm giờ (OT)' },
                { value: 'CARGO', label: 'Chở hàng (CARGO)' },
                { value: 'MIXED', label: 'Chuyến ghép hỗn hợp (MIXED)' },
                { value: 'DEADHEAD', label: 'Chuyến rỗng (DEADHEAD)' },
                { value: 'EMPTY_RETURN', label: 'Chiều về rỗng (EMPTY_RETURN)' },
              ]}
            />
            <FloatingSelect
              label="Chiều khứ hồi"
              value={tripLegFilter}
              onChange={setTripLegFilter}
              options={[
                { value: 'OUTBOUND', label: 'Chiều đi (OUTBOUND)' },
                { value: 'RETURN', label: 'Chiều về (RETURN)' },
              ]}
            />
            {(tripCategoryFilter === 'DEADHEAD' || tripCategoryFilter === 'EMPTY_RETURN') && (
              <FloatingSelect
                label="Loại chuyến rỗng"
                value={deadheadKindFilter}
                onChange={setDeadheadKindFilter}
                options={[
                  { value: 'CONNECTOR', label: 'Chạy rỗng nối chuyến' },
                  { value: 'BASE_RETURN', label: 'Chạy rỗng về bãi GICO' },
                  { value: 'NONE', label: 'Chạy rỗng tuyến thường' },
                ]}
              />
            )}
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

          {/* Quick Category Pills */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {[
              { key: '', label: `Tất cả (${trips.length})` },
              { key: 'FIXED_ROUTE', label: 'Tuyến cố định' },
              { key: 'BUSINESS', label: 'Công tác' },
              { key: 'OT', label: 'Làm thêm giờ' },
              { key: 'CARGO', label: 'Chở hàng' },
              { key: 'DEADHEAD', label: 'Chuyến rỗng (Deadhead)' },
              { key: 'EMPTY_RETURN', label: 'Chiều về rỗng (Empty Return)' },
            ].map((pill) => {
              const active = tripCategoryFilter === pill.key;
              return (
                <button
                  key={pill.key || 'ALL'}
                  type="button"
                  onClick={() => setTripCategoryFilter(pill.key)}
                  className={`h-[28px] px-3 rounded-full text-[12px] font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#00897b] text-white'
                      : 'bg-[#f3f4f6] text-[#4b5563] hover:bg-[#e5e7eb]'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
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
              onClick: openSupplementCompletedModal,
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

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left border-collapse">
              <thead>
                <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] text-[13px] font-semibold text-[#1f2937]">
                  <th className="px-2 w-[3%]"></th>
                  <th className="px-2 w-[3%]">#</th>
                  <th className="px-2 w-[12%]">Loại chuyến đi</th>
                  <th className="px-2 w-[8.5%]">Chiều</th>
                  <th className="px-2 w-[11.5%]">Trạng thái</th>
                  <th className="px-2 w-[17%]">Lộ trình / Điểm đón – Điểm trả</th>
                  <th className="px-2 w-[8%]">Biển số xe</th>
                  <th className="px-2 w-[7.5%]">Loại xe</th>
                  <th className="px-2 w-[9.5%]">Tài xế</th>
                  <th className="px-1.5 w-[11%]">Khung giờ</th>
                  <th className="px-1.5 w-[4.5%]">KM</th>
                  <th className="px-1.5 w-[4.5%]">Hành khách</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb] text-[13px] text-[#1f2937]">
                {tripsPaging.pagedItems.map((trip, idx) => {
                  const isDeadhead = isTripDeadhead(trip);
                  const vt =
                    trip.vehicle?.vehicleType ||
                    vehicleTypeMap.get(trip.vehiclePlateSnapshot) ||
                    (trip.seatCapacitySnapshot === 15 ? 'VAN_16' : 'BUS_29');
                  const rowIndex = (tripsPaging.page - 1) * tripsPaging.pageSize + idx + 1;
                  const paxCount = isDeadhead
                    ? 0
                    : (trip.actualPassengerCount ?? trip.passengerCount ?? 0);
                  return (
                    <tr
                      key={trip.id}
                      onClick={() => {
                        setSelectedTripId(trip.id);
                        openTripDetail(trip);
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
                        className="px-2 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTripId(trip.id);
                          setContextTrip({
                            trip,
                            index: rowIndex,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }}
                      >
                        <input
                          type="radio"
                          name="trip-select"
                          checked={selectedTripId === trip.id}
                          onChange={() => setSelectedTripId(trip.id)}
                        />
                      </td>
                      <td className="px-2 text-[#374151]">{rowIndex}</td>
                      <td className="px-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] font-semibold text-[#0f766e]">
                            {trip.tripCode}
                          </span>
                          <div>{renderTripTypeBadge(trip.dispatchType, isDeadhead)}</div>
                        </div>
                      </td>
                      <td className="px-2">
                        {renderTripLegBadge(trip.tripLeg, trip.tripMode)}
                      </td>
                      <td className="px-2">{renderRequestStatusBadge(trip.status)}</td>
                      <td className="px-2 text-[#1f2937] truncate">
                        {trip.route
                          ? `${trip.route.routeName} ➜`
                          : `${trip.departurePickupPointText || 'Điểm đón'} → ${
                              trip.departureDropoffPointText || 'Điểm trả'
                            }`}
                      </td>
                      <td className="px-2 font-medium text-[#1f2937]">
                        {trip.vehiclePlateSnapshot || trip.vehicle?.vehiclePlate || '—'}
                      </td>
                      <td className="px-2 text-[#374151]">{renderVehicleTypeLabel(vt)}</td>
                      <td className="px-2 text-[#1f2937] truncate">
                        {trip.driverNameSnapshot || trip.driver?.driverName || '—'}
                      </td>
                      <td className="px-1.5 text-[#1f2937] text-[12px]">
                        {formatTripTimeWindow(
                          trip.actualStartAt || trip.plannedDepartureAt,
                          trip.actualEndAt || trip.plannedArrivalAt,
                          trip.businessDate
                        )}
                      </td>
                      <td className="px-1.5 text-[#1f2937] font-medium">
                        {trip.actualKm !== undefined && trip.actualKm !== null
                          ? `${Number(trip.actualKm)}`
                          : '—'}
                      </td>
                      <td className="px-1.5 text-[#1f2937]">{paxCount}</td>
                    </tr>
                  );
                })}
                {filteredTrips.length === 0 && (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-[13px] text-[#9ca3af]">
                      Không có bản ghi chuyến đi nào khớp bộ lọc
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
                  label: 'Xem thông tin chi tiết',
                  icon: <Eye className="w-4 h-4 text-[#4b5563]" />,
                  onClick: () => openTripDetail(contextTrip.trip),
                },
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
                  label: 'Cập nhật thực tế & KM',
                  icon: <Gauge className="w-4 h-4 text-[#d97706]" />,
                  onClick: () => openKmModalForTrip(contextTrip.trip),
                },
                {
                  label: 'Đổi xe / tài xế',
                  icon: <Repeat className="w-4 h-4 text-[#374151]" />,
                  onClick: () => openReassignModalForTrip(contextTrip.trip),
                },
                {
                  label: 'Tạo chuyến về rỗng',
                  icon: <CornerDownLeft className="w-4 h-4 text-[#0284c7]" />,
                  onClick: () => handleCreateEmptyReturnTrip(contextTrip.trip),
                },
                {
                  label: 'Hủy chuyến đi',
                  icon: <XCircle className="w-4 h-4 text-[#dc2626]" />,
                  danger: true,
                  disabled: ['COMPLETED', 'CANCELLED'].includes(contextTrip.trip.status),
                  onClick: () =>
                    setCancelModal({
                      trip: contextTrip.trip,
                      reason: 'Xe gặp sự cố đột xuất / Điều chỉnh kế hoạch',
                    }),
                },
              ]}
            />
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW 2: VEHICLE OPERATION CENTER */}
      {/* ==================================================================== */}
      {view === 'VEHICLE_OPS' && (
        <div>
          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <FloatingDateFilter
              label="Ngày vận hành"
              value={opsBusinessDate}
              onChange={setOpsBusinessDate}
            />
            <FloatingSelect
              label="Tuyến đường"
              value={opsRouteFilter}
              onChange={setOpsRouteFilter}
              options={routes.map((rt) => ({
                value: String(rt.id),
                label: `${rt.routeCode} - ${rt.routeName}`,
              }))}
            />
            <FloatingSelect
              label="Loại xe"
              value={vehicleTypeFilter}
              onChange={setVehicleTypeFilter}
              options={[
                { value: 'BUS_45', label: 'Bus 45 chỗ' },
                { value: 'BUS_29', label: 'Bus 29 chỗ' },
                { value: 'VAN_16', label: 'Van 16 chỗ' },
                { value: 'SUV_7', label: 'SUV 7 chỗ' },
                { value: 'SEDAN_4', label: 'Sedan 4 chỗ' },
                { value: 'TRUCK', label: 'Xe tải chở hàng' },
              ]}
            />
            <FloatingSelect
              label="Trạng thái"
              value={vehicleStatusFilter}
              onChange={setVehicleStatusFilter}
              options={[
                { value: 'ON_FIXED_ROUTE', label: 'Đang chạy tuyến cố định' },
                { value: 'ON_SPECIAL_ASSIGNMENT', label: 'Đã phân công / Điều chuyến' },
                { value: 'AVAILABLE', label: 'Sẵn sàng' },
                { value: 'NOT_AVAILABLE', label: 'Bảo trì / Không khả dụng' },
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

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left border-collapse">
              <thead>
                <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] text-[13px] font-semibold text-[#1f2937]">
                  <th className="px-2 w-[3%]"></th>
                  <th className="px-2 w-[3%]">#</th>
                  <th className="px-2 w-[8.5%]">Biển số</th>
                  <th className="px-2 w-[8.5%]">Loại xe</th>
                  <th className="px-2 w-[13%]">Trạng thái</th>
                  <th className="px-2 w-[11%]">Tài xế</th>
                  <th className="px-2 w-[11.5%]">Điểm bắt đầu</th>
                  <th className="px-2 w-[14.5%]">Điểm kết thúc</th>
                  <th className="px-1.5 w-[14.5%]">Khung giờ</th>
                  <th className="px-1.5 w-[12.5%]">Mã chuyến</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb] text-[13px] text-[#1f2937]">
                {vehPaging.pagedItems.map((vs, idx) => {
                  const rowIndex = (vehPaging.page - 1) * vehPaging.pageSize + idx + 1;
                  const trip = vs.latestTrip;
                  const driverName =
                    trip?.driverNameSnapshot ||
                    vs.vehicle?.defaultDriver?.driverName ||
                    '-';
                  const startPoint =
                    trip?.departurePickupPointText ||
                    trip?.route?.routeName ||
                    vs.route?.routeName ||
                    '-';
                  const endPoint =
                    trip?.departureDropoffPointText || (trip?.route ? 'MKVC' : '-');
                  return (
                    <tr
                      key={vs.vehicleId}
                      onClick={() => {
                        setSelectedVehId(String(vs.vehicleId));
                        openVehOpsDetail(vs);
                      }}
                      className="hover:bg-[#f9fafb] cursor-pointer transition-colors"
                    >
                      <td
                        className="px-2.5 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVehId(String(vs.vehicleId));
                        }}
                      >
                        <input
                          type="radio"
                          name="veh-ops-select"
                          checked={selectedVehId === String(vs.vehicleId)}
                          onChange={() => setSelectedVehId(String(vs.vehicleId))}
                        />
                      </td>
                      <td className="px-2.5 text-[#374151]">{rowIndex}</td>
                      <td className="px-2.5 font-medium text-[#1f2937]">
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
                      <td className="px-2.5 text-[#1f2937] truncate">{driverName}</td>
                      <td className="px-2.5 text-[#374151] truncate">{startPoint}</td>
                      <td className="px-2.5 text-[#374151] truncate">{endPoint}</td>
                      <td className="px-1.5 text-[#1f2937] text-[12px]">
                        {vs.plannedDepartureAt || trip?.plannedDepartureAt
                          ? formatTripTimeWindow(
                              vs.plannedDepartureAt || trip?.plannedDepartureAt,
                              vs.plannedArrivalAt || trip?.plannedArrivalAt,
                              trip?.businessDate || opsBusinessDate
                            )
                          : '-'}
                      </td>
                      <td className="px-1.5 text-[#374151] font-medium">
                        {trip?.tripCode ||
                          (vs.dayTrips?.length ? `${vs.dayTrips.length} chuyến` : '-')}
                      </td>
                    </tr>
                  );
                })}
                {filteredVehicleStatuses.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-[13px] text-[#9ca3af]">
                      Không có dữ liệu vận hành xe khớp bộ lọc
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
      {/* DRAWER 1: TRIP DETAIL DRAWER (8 BLOCKS + ACTIONS) */}
      {/* ==================================================================== */}
      {tripDetailDrawer && (
        <div className="fixed inset-0 z-50 bg-black/35 flex justify-end">
          <div className="bg-white w-full max-w-[780px] h-full shadow-2xl border-l border-[#e5e7eb] flex flex-col">
            {/* BLOCK 1: Header mã chuyến + badge trạng thái + nút chuyển sang chuyến cặp khứ hồi */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb] bg-[#f8fafc]">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-[15px] font-bold text-[#1f2937]">
                  {tripDetailDrawer.tripCode} - Chi tiết chuyến đi
                </h3>
                {renderRequestStatusBadge(tripDetailDrawer.status)}
                {renderTripTypeBadge(
                  tripDetailDrawer.dispatchType,
                  isTripDeadhead(tripDetailDrawer)
                )}
                {tripDetailDrawer.pairedTripId && (
                  <button
                    type="button"
                    onClick={() => {
                      const paired = trips.find(
                        (t) => String(t.id) === String(tripDetailDrawer.pairedTripId)
                      );
                      if (paired) {
                        openTripDetail(paired);
                        showToast(`Đã chuyển sang chuyến cặp khứ hồi ${paired.tripCode}`);
                      } else {
                        showToast(
                          `Mã chuyến cặp khứ hồi ID #${String(tripDetailDrawer.pairedTripId)}`
                        );
                      }
                    }}
                    className="h-[26px] px-2.5 rounded-full bg-[#e0f2fe] text-[#0369a1] text-[11px] font-semibold flex items-center gap-1 hover:bg-[#bae6fd] cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    Chuyển sang chuyến cặp khứ hồi
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setTripDetailDrawer(null)}
                className="text-[#4b5563] hover:text-[#1f2937] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-[13px]">
              {/* BLOCK 2: Thông tin chung & Loại điều phối */}
              <div className="border border-[#e5e7eb] rounded-[8px] p-4 bg-white">
                <h4 className="text-[13px] font-bold text-[#0f766e] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  1. Thông tin chung & Loại điều phối
                </h4>
                <div className="grid grid-cols-2 gap-y-2.5 gap-x-6">
                  <div className="flex justify-between border-b border-[#f3f4f6] pb-1.5">
                    <span className="text-[#6b7280]">Mã chuyến:</span>
                    <span className="font-semibold text-[#1f2937]">
                      {tripDetailDrawer.tripCode}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#f3f4f6] pb-1.5">
                    <span className="text-[#6b7280]">Ngày vận hành:</span>
                    <span className="font-medium text-[#1f2937]">
                      {tripDetailDrawer.businessDate}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#f3f4f6] pb-1.5">
                    <span className="text-[#6b7280]">Loại chuyến đi:</span>
                    <span className="font-medium text-[#1f2937]">
                      {tripDetailDrawer.tripType}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#f3f4f6] pb-1.5">
                    <span className="text-[#6b7280]">Loại điều phối:</span>
                    <span className="font-medium text-[#1f2937]">
                      {tripDetailDrawer.dispatchType === 'FIXED_ROUTE'
                        ? 'Tuyến cố định'
                        : tripDetailDrawer.dispatchType === 'SUPPLEMENT'
                          ? 'Điều bù tuyến'
                          : 'Điều chuyến theo yêu cầu'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#f3f4f6] pb-1.5">
                    <span className="text-[#6b7280]">Chế độ / Chiều chạy:</span>
                    <span>
                      {renderTripLegBadge(
                        tripDetailDrawer.tripLeg,
                        tripDetailDrawer.tripMode
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#f3f4f6] pb-1.5">
                    <span className="text-[#6b7280]">Đối tượng khách:</span>
                    <span>
                      {tripDetailDrawer.passengerType ||
                      tripDetailDrawer.route?.passengerType ? (
                        renderPassengerTypeBadge(
                          tripDetailDrawer.passengerType ||
                            tripDetailDrawer.route?.passengerType
                        )
                      ) : (
                        <span className="text-[#6b7280]">Hỗn hợp / Công tác</span>
                      )}
                    </span>
                  </div>
                  {isTripDeadhead(tripDetailDrawer) && (
                    <div className="col-span-2 flex justify-between bg-[#fef3c7]/50 px-2.5 py-1.5 rounded">
                      <span className="text-[#92400e] font-medium">Phân loại chuyến rỗng:</span>
                      <span className="text-[#92400e] font-semibold">
                        {renderDeadheadKindLabel(tripDetailDrawer.deadheadKind)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* BLOCK 3: Lộ trình & Thời gian kế hoạch vs thực tế */}
              <div className="border border-[#e5e7eb] rounded-[8px] p-4 bg-white">
                <h4 className="text-[13px] font-bold text-[#0f766e] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  2. Lộ trình & Thời gian Kế hoạch vs Thực tế
                </h4>
                <div className="space-y-2.5">
                  <div className="grid grid-cols-12 gap-2">
                    <span className="col-span-4 text-[#6b7280]">Tuyến cố định / Lượt:</span>
                    <span className="col-span-8 font-medium text-[#1f2937]">
                      {tripDetailDrawer.route
                        ? `${tripDetailDrawer.route.routeCode} - ${tripDetailDrawer.route.routeName} (${tripDetailDrawer.legCode || 'Chặng chính'})`
                        : 'Chuyến ngoài tuyến cố định'}
                    </span>
                  </div>
                  <div className="grid grid-cols-12 gap-2">
                    <span className="col-span-4 text-[#6b7280]">Điểm đón → Điểm trả:</span>
                    <span className="col-span-8 font-medium text-[#1f2937]">
                      {tripDetailDrawer.departurePickupPointText ||
                        tripDetailDrawer.route?.routeName ||
                        'Điểm đón'}{' '}
                      → {tripDetailDrawer.departureDropoffPointText || 'Nhà máy MKVC'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#f3f4f6]">
                    <div className="bg-[#f8fafc] p-2.5 rounded-[6px]">
                      <div className="text-[11px] text-[#6b7280] uppercase font-semibold mb-1">
                        Khung giờ kế hoạch
                      </div>
                      <div className="font-semibold text-[#1f2937]">
                        {formatTripTimeWindow(
                          tripDetailDrawer.plannedDepartureAt,
                          tripDetailDrawer.plannedArrivalAt,
                          tripDetailDrawer.businessDate
                        )}
                      </div>
                    </div>
                    <div className="bg-[#f0fdf4] p-2.5 rounded-[6px]">
                      <div className="text-[11px] text-[#0f766e] uppercase font-semibold mb-1">
                        Khung giờ thực tế (Actual)
                      </div>
                      <div className="font-semibold text-[#0f766e]">
                        {tripDetailDrawer.actualStartAt || tripDetailDrawer.actualEndAt
                          ? formatTripTimeWindow(
                              tripDetailDrawer.actualStartAt,
                              tripDetailDrawer.actualEndAt,
                              tripDetailDrawer.businessDate
                            )
                          : 'Chưa ghi nhận giờ thực tế'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOCK 4: Thông tin Xe & Tài xế */}
              <div className="border border-[#e5e7eb] rounded-[8px] p-4 bg-white">
                <h4 className="text-[13px] font-bold text-[#0f766e] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Truck className="w-4 h-4" />
                  3. Thông tin Phương tiện & Tài xế
                </h4>
                <div className="grid grid-cols-2 gap-y-2.5 gap-x-6">
                  <div className="flex justify-between border-b border-[#f3f4f6] pb-1.5">
                    <span className="text-[#6b7280]">Biển kiểm soát:</span>
                    <span className="font-bold text-[#1f2937]">
                      {tripDetailDrawer.vehiclePlateSnapshot ||
                        tripDetailDrawer.vehicle?.vehiclePlate ||
                        '—'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#f3f4f6] pb-1.5">
                    <span className="text-[#6b7280]">Loại xe / Số ghế:</span>
                    <span className="font-medium text-[#1f2937]">
                      {renderVehicleTypeLabel(
                        tripDetailDrawer.vehicle?.vehicleType ||
                          vehicleTypeMap.get(tripDetailDrawer.vehiclePlateSnapshot) ||
                          'BUS_29'
                      )}{' '}
                      ({tripDetailDrawer.seatCapacitySnapshot ?? tripDetailDrawer.vehicle?.seatCapacity ?? 28} chỗ)
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#f3f4f6] pb-1.5">
                    <span className="text-[#6b7280]">Tài xế phụ trách:</span>
                    <span className="font-semibold text-[#1f2937]">
                      {tripDetailDrawer.driverNameSnapshot ||
                        tripDetailDrawer.driver?.driverName ||
                        '—'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#f3f4f6] pb-1.5">
                    <span className="text-[#6b7280]">Số điện thoại tài xế:</span>
                    <span className="font-medium text-[#0284c7]">
                      {tripDetailDrawer.driverPhoneSnapshot ||
                        tripDetailDrawer.driver?.phoneNumber ||
                        '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* BLOCK 5: Chỉ số thực thi & Chi phí */}
              <div className="border border-[#e5e7eb] rounded-[8px] p-4 bg-white">
                <h4 className="text-[13px] font-bold text-[#0f766e] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Gauge className="w-4 h-4" />
                  4. Chỉ số Thực thi & Chi phí phát sinh
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#f8fafc] p-2.5 rounded border border-[#e5e7eb]">
                    <div className="text-[11px] text-[#6b7280]">Quãng đường thực tế</div>
                    <div className="text-[15px] font-bold text-[#0f766e]">
                      {tripDetailDrawer.actualKm !== undefined &&
                      tripDetailDrawer.actualKm !== null
                        ? `${Number(tripDetailDrawer.actualKm)} km`
                        : 'Chưa nhập'}
                    </div>
                  </div>
                  <div className="bg-[#f8fafc] p-2.5 rounded border border-[#e5e7eb]">
                    <div className="text-[11px] text-[#6b7280]">Công-tơ-mét (Đầu → Cuối)</div>
                    <div className="text-[13px] font-semibold text-[#1f2937]">
                      {tripDetailDrawer.startOdometerKm ?? '—'} →{' '}
                      {tripDetailDrawer.endOdometerKm ?? '—'}
                    </div>
                  </div>
                  <div className="bg-[#f8fafc] p-2.5 rounded border border-[#e5e7eb]">
                    <div className="text-[11px] text-[#6b7280]">Số khách (KH / Thực tế)</div>
                    <div className="text-[14px] font-bold text-[#1f2937]">
                      {tripDetailDrawer.passengerCount ?? 0} /{' '}
                      {tripDetailDrawer.actualPassengerCount ??
                        tripDetailDrawer.passengerCount ??
                        0}{' '}
                      khách
                    </div>
                  </div>
                  <div className="bg-[#f8fafc] p-2.5 rounded border border-[#e5e7eb]">
                    <div className="text-[11px] text-[#6b7280]">Giờ làm thêm (OT)</div>
                    <div className="text-[14px] font-semibold text-[#1f2937]">
                      {getTripOtHours(tripDetailDrawer) ?? 0} giờ
                    </div>
                  </div>
                  <div className="bg-[#f8fafc] p-2.5 rounded border border-[#e5e7eb]">
                    <div className="text-[11px] text-[#6b7280]">Phí cầu đường / bến bãi</div>
                    <div className="text-[14px] font-semibold text-[#d97706]">
                      {tripDetailDrawer.tollFeeAmount
                        ? `${Number(tripDetailDrawer.tollFeeAmount).toLocaleString('vi-VN')} đ`
                        : '0 đ'}
                    </div>
                  </div>
                  <div className="bg-[#f8fafc] p-2.5 rounded border border-[#e5e7eb]">
                    <div className="text-[11px] text-[#6b7280]">Bản ghi chi phí</div>
                    <div className="text-[13px] font-semibold text-[#1f2937]">
                      {(tripDetailDrawer.costRecords || []).length} bút toán
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOCK 6: Danh sách Yêu cầu xe liên kết */}
              <div className="border border-[#e5e7eb] rounded-[8px] p-4 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[13px] font-bold text-[#0f766e] uppercase tracking-wide flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4" />
                    5. Yêu cầu xe liên kết ({(tripDetailDrawer.requestLinks || []).length})
                  </h4>
                </div>
                {(tripDetailDrawer.requestLinks || []).length === 0 ? (
                  <div className="text-[12px] text-[#9ca3af] py-3 text-center bg-[#f9fafb] rounded">
                    Chuyến tuyến cố định / không có đơn yêu cầu lẻ gắn kèm
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[12px]">
                      <thead>
                        <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] font-semibold text-[#374151]">
                          <th className="p-2">Mã đơn</th>
                          <th className="p-2">Người yêu cầu / Bộ phận</th>
                          <th className="p-2">Chiều</th>
                          <th className="p-2">Lộ trình / Mục đích</th>
                          <th className="p-2 text-center">Khách</th>
                          <th className="p-2 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e5e7eb]">
                        {(tripDetailDrawer.requestLinks || []).map((link: any) => {
                          const req = link.request;
                          if (!req) return null;
                          return (
                            <tr key={link.id} className="hover:bg-[#f9fafb]">
                              <td className="p-2 font-semibold text-[#0f766e]">
                                {req.requestCode}
                              </td>
                              <td className="p-2">
                                <div className="font-medium text-[#1f2937]">
                                  {req.requesterName}
                                </div>
                                <div className="text-[11px] text-[#6b7280]">
                                  {req.departmentName}
                                </div>
                              </td>
                              <td className="p-2">
                                <PastelBadge
                                  label={link.requestLeg === 'RETURN' ? 'Chiều về' : 'Chiều đi'}
                                  tone={link.requestLeg === 'RETURN' ? 'purple' : 'sky'}
                                />
                              </td>
                              <td className="p-2">
                                <div className="text-[#1f2937]">
                                  {req.departurePickupPointText || 'Điểm đón'} →{' '}
                                  {req.departureDropoffPointText || 'Điểm trả'}
                                </div>
                                {req.purpose && (
                                  <div className="text-[11px] text-[#6b7280]">
                                    Mục đích: {req.purpose}
                                  </div>
                                )}
                              </td>
                              <td className="p-2 text-center font-semibold">
                                {req.passengerCount}
                              </td>
                              <td className="p-2 text-right">
                                {tripDetailDrawer.status !== 'COMPLETED' &&
                                  tripDetailDrawer.status !== 'CANCELLED' && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDetachRequest(
                                          tripDetailDrawer,
                                          String(req.id),
                                          req.requestCode
                                        )
                                      }
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-[#fee2e2] text-[#b91c1c] hover:bg-[#fecaca] cursor-pointer"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      Gỡ đơn
                                    </button>
                                  )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* BLOCK 7: Ghi chú & Lý do điều đè + Lịch sử */}
              <div className="border border-[#e5e7eb] rounded-[8px] p-4 bg-white space-y-3">
                <h4 className="text-[13px] font-bold text-[#0f766e] uppercase tracking-wide flex items-center gap-1.5">
                  <History className="w-4 h-4" />
                  6. Ghi chú, Lý do điều đè & Nhật ký kiểm toán
                </h4>
                <div className="grid grid-cols-1 gap-2 text-[12px]">
                  <div className="bg-[#f8fafc] p-2.5 rounded border border-[#e5e7eb]">
                    <span className="font-semibold text-[#4b5563]">Lý do điều đè / Đổi xe: </span>
                    <span className="text-[#1f2937]">
                      {tripDetailDrawer.overrideReason || 'Không có'}
                    </span>
                  </div>
                  <div className="bg-[#f8fafc] p-2.5 rounded border border-[#e5e7eb]">
                    <span className="font-semibold text-[#4b5563]">Ghi chú chuyến đi: </span>
                    <span className="text-[#1f2937]">{tripDetailDrawer.notes || 'Không có'}</span>
                  </div>
                  {tripDetailDrawer.executionFacts?.[0]?.executionNote && (
                    <div className="bg-[#f0fdf4] p-2.5 rounded border border-[#bbf7d0]">
                      <span className="font-semibold text-[#0f766e]">Ghi chú thực thi: </span>
                      <span className="text-[#1f2937]">
                        {tripDetailDrawer.executionFacts[0].executionNote}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-[#f3f4f6]">
                  <div className="text-[12px] font-semibold text-[#374151] mb-2">
                    Lịch sử tác động ({tripAuditLogs.length})
                  </div>
                  {tripAuditLogs.length === 0 ? (
                    <div className="text-center text-[12px] text-[#9ca3af] py-2">
                      Chưa có nhật ký thay đổi
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                      {tripAuditLogs.map((log: any) => (
                        <div
                          key={log.id}
                          className="flex items-center justify-between text-[12px] bg-[#f9fafb] px-3 py-1.5 rounded"
                        >
                          <div>
                            <span className="font-semibold text-[#0f766e] mr-2">
                              [{log.actionType}]
                            </span>
                            <span className="text-[#1f2937]">{log.summaryText}</span>
                          </div>
                          <span className="text-[11px] text-[#6b7280] whitespace-nowrap ml-2">
                            {log.actorName || 'Hệ thống'} • {formatDateTimeVi(log.changedAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* BLOCK 8: Footer Action Buttons */}
            <div className="px-6 py-3.5 border-t border-[#e5e7eb] bg-[#f8fafc] flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openReassignModalForTrip(tripDetailDrawer)}
                  className="h-[34px] px-3 rounded-[6px] border border-[#00897b] bg-white text-[#00897b] text-[12px] font-semibold hover:bg-[#f0fdf4] flex items-center gap-1.5 cursor-pointer"
                >
                  <Repeat className="w-3.5 h-3.5" />
                  Đổi xe / tài xế
                </button>
                <button
                  type="button"
                  onClick={() => openKmModalForTrip(tripDetailDrawer)}
                  className="h-[34px] px-3 rounded-[6px] bg-[#00897b] text-white text-[12px] font-semibold hover:bg-[#00796b] flex items-center gap-1.5 cursor-pointer"
                >
                  <Gauge className="w-3.5 h-3.5" />
                  Cập nhật thực tế & KM
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateEmptyReturnTrip(tripDetailDrawer)}
                  className="h-[34px] px-3 rounded-[6px] border border-[#0284c7] bg-white text-[#0284c7] text-[12px] font-semibold hover:bg-[#f0f9ff] flex items-center gap-1.5 cursor-pointer"
                >
                  <CornerDownLeft className="w-3.5 h-3.5" />
                  Tạo chuyến về rỗng
                </button>
                {!['COMPLETED', 'CANCELLED'].includes(tripDetailDrawer.status) && (
                  <button
                    type="button"
                    onClick={() =>
                      setCancelModal({
                        trip: tripDetailDrawer,
                        reason: 'Xe gặp sự cố đột xuất / Điều chỉnh kế hoạch',
                      })
                    }
                    className="h-[34px] px-3 rounded-[6px] border border-[#dc2626] bg-white text-[#dc2626] text-[12px] font-semibold hover:bg-[#fef2f2] flex items-center gap-1.5 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Hủy chuyến
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setTripDetailDrawer(null)}
                className="h-[34px] px-4 rounded-[6px] border border-[#d1d5db] bg-white text-[#374151] text-[12px] font-medium hover:bg-[#f3f4f6] cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* DRAWER 2: VEHICLE OPS DETAIL DRAWER (3 TABS) */}
      {/* ==================================================================== */}
      {vehOpsDrawer && (
        <div className="fixed inset-0 z-50 bg-black/35 flex justify-end">
          <div className="bg-white w-full max-w-[760px] h-full shadow-2xl border-l border-[#e5e7eb] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb] bg-[#f8fafc]">
              <div className="flex items-center gap-2.5">
                <h3 className="text-[15px] font-bold text-[#1f2937]">
                  Xe {vehOpsDrawer.vehicle?.vehiclePlate} — Chi tiết điều hành
                </h3>
                {vehOpsDrawer.status === 'ON_FIXED_ROUTE' ? (
                  <PastelBadge label="Trên tuyến cố định" tone="sky" />
                ) : vehOpsDrawer.status === 'ON_SPECIAL_ASSIGNMENT' ? (
                  <PastelBadge label="Đang chạy điều chuyến" tone="amber" />
                ) : vehOpsDrawer.status === 'AVAILABLE' ? (
                  <PastelBadge label="Sẵn sàng" tone="green" />
                ) : (
                  <PastelBadge label="Không khả dụng" tone="gray" />
                )}
              </div>
              <button
                type="button"
                onClick={() => setVehOpsDrawer(null)}
                className="text-[#4b5563] hover:text-[#1f2937] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-[13px]">
              {/* Vehicle Summary Card */}
              <div className="border border-[#e5e7eb] rounded-[8px] p-4 bg-[#f8fafc] grid grid-cols-2 gap-y-2 gap-x-6">
                <div className="flex justify-between">
                  <span className="text-[#6b7280]">Biển kiểm soát:</span>
                  <span className="font-bold text-[#1f2937]">
                    {vehOpsDrawer.vehicle?.vehiclePlate}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b7280]">Loại xe / Số ghế:</span>
                  <span className="font-medium text-[#1f2937]">
                    {renderVehicleTypeLabel(vehOpsDrawer.vehicle?.vehicleType)} (
                    {vehOpsDrawer.vehicle?.seatCapacity ?? 28} chỗ)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b7280]">Tài xế mặc định:</span>
                  <span className="font-semibold text-[#1f2937]">
                    {vehOpsDrawer.vehicle?.defaultDriver?.driverName ||
                      vehOpsDrawer.latestTrip?.driverNameSnapshot ||
                      'Chưa gán'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b7280]">Đơn vị vận tải:</span>
                  <span className="font-medium text-[#1f2937]">
                    {vehOpsDrawer.vehicle?.vendor?.vendorName || 'Nội bộ / GICO'}
                  </span>
                </div>
                <div className="col-span-2 flex justify-between border-t border-[#e5e7eb] pt-2">
                  <span className="text-[#6b7280]">Tuyến cố định được gán:</span>
                  <span className="font-medium text-[#0f766e]">
                    {(
                      assignedRoutesByVehicle.get(String(vehOpsDrawer.vehicleId)) || []
                    ).join('; ') ||
                      vehOpsDrawer.route?.routeName ||
                      'Linh hoạt theo điều phối'}
                  </span>
                </div>
              </div>

              {/* Drawer Tabs */}
              <div className="flex items-center gap-2 border-b border-[#e5e7eb]">
                {[
                  {
                    id: 'TRIPS' as const,
                    label: `1. Các chuyến trong ngày (${(vehOpsDrawer.dayTrips || []).length})`,
                  },
                  {
                    id: 'REQUESTS' as const,
                    label: `2. Đơn yêu cầu liên kết (${(vehOpsDrawer.dayTrips || []).reduce(
                      (acc: number, t: any) => acc + (t.requestLinks?.length || 0),
                      0
                    )})`,
                  },
                  {
                    id: 'STATUS' as const,
                    label: '3. Cập nhật trạng thái & Lịch sử',
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setVehDrawerTab(tab.id)}
                    className={`px-3.5 py-2 text-[13px] font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
                      vehDrawerTab === tab.id
                        ? 'border-[#00897b] text-[#00897b]'
                        : 'border-transparent text-[#6b7280] hover:text-[#1f2937]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* TAB 1: CÁC CHUYẾN TRONG NGÀY */}
              {vehDrawerTab === 'TRIPS' && (
                <div className="space-y-3">
                  {(vehOpsDrawer.dayTrips || []).length === 0 ? (
                    <div className="py-8 text-center text-[#9ca3af] bg-[#f9fafb] rounded-[8px]">
                      Xe không có chuyến chạy nào trong khoảng thời gian đang chọn
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-[#e5e7eb] rounded-[8px]">
                      <table className="w-full text-left border-collapse text-[12px]">
                        <thead>
                          <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] font-semibold text-[#374151]">
                            <th className="p-2.5">Mã chuyến</th>
                            <th className="p-2.5">Khung giờ</th>
                            <th className="p-2.5">Lộ trình</th>
                            <th className="p-2.5">Trạng thái</th>
                            <th className="p-2.5 text-right">KM thực tế</th>
                            <th className="p-2.5 text-right">Chi tiết</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e5e7eb]">
                          {(vehOpsDrawer.dayTrips || []).map((t: any) => (
                            <tr key={t.id} className="hover:bg-[#f9fafb]">
                              <td className="p-2.5 font-semibold text-[#0f766e]">
                                <div>{t.tripCode}</div>
                                <div className="text-[11px] text-[#6b7280]">
                                  {t.businessDate}
                                </div>
                              </td>
                              <td className="p-2.5 text-[#1f2937]">
                                {formatTripTimeWindow(
                                  t.actualStartAt || t.plannedDepartureAt,
                                  t.actualEndAt || t.plannedArrivalAt,
                                  t.businessDate
                                )}
                              </td>
                              <td className="p-2.5 text-[#1f2937]">
                                {t.route
                                  ? `${t.route.routeName} (${t.legCode || 'Chặng'})`
                                  : `${t.departurePickupPointText || 'Điểm đón'} → ${
                                      t.departureDropoffPointText || 'Điểm trả'
                                    }`}
                              </td>
                              <td className="p-2.5">{renderRequestStatusBadge(t.status)}</td>
                              <td className="p-2.5 text-right font-semibold">
                                {t.actualKm != null ? `${Number(t.actualKm)} km` : '—'}
                              </td>
                              <td className="p-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setVehOpsDrawer(null);
                                    openTripDetail(t);
                                  }}
                                  className="px-2.5 py-1 rounded bg-[#e0f2f1] text-[#00695c] font-medium hover:bg-[#b2dfdb] cursor-pointer"
                                >
                                  Mở chuyến
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: ĐƠN YÊU CẦU LIÊN KẾT */}
              {vehDrawerTab === 'REQUESTS' && (
                <div className="space-y-3">
                  {(() => {
                    const linkedReqs: Array<{ tripCode: string; link: any }> = [];
                    for (const t of vehOpsDrawer.dayTrips || []) {
                      for (const l of t.requestLinks || []) {
                        if (l.request) {
                          linkedReqs.push({ tripCode: t.tripCode, link: l });
                        }
                      }
                    }
                    if (linkedReqs.length === 0) {
                      return (
                        <div className="py-8 text-center text-[#9ca3af] bg-[#f9fafb] rounded-[8px]">
                          Không có đơn yêu cầu xe lẻ nào gắn với xe này trong ngày
                        </div>
                      );
                    }
                    return (
                      <div className="overflow-x-auto border border-[#e5e7eb] rounded-[8px]">
                        <table className="w-full text-left border-collapse text-[12px]">
                          <thead>
                            <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] font-semibold text-[#374151]">
                              <th className="p-2.5">Mã đơn</th>
                              <th className="p-2.5">Chuyến phục vụ</th>
                              <th className="p-2.5">Người yêu cầu / Bộ phận</th>
                              <th className="p-2.5">Điểm đón → Điểm trả</th>
                              <th className="p-2.5 text-center">Khách</th>
                              <th className="p-2.5">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#e5e7eb]">
                            {linkedReqs.map(({ tripCode, link }) => (
                              <tr key={link.id} className="hover:bg-[#f9fafb]">
                                <td className="p-2.5 font-semibold text-[#0f766e]">
                                  {link.request.requestCode}
                                </td>
                                <td className="p-2.5 text-[#374151] font-medium">
                                  {tripCode}
                                </td>
                                <td className="p-2.5">
                                  <div className="font-medium text-[#1f2937]">
                                    {link.request.requesterName}
                                  </div>
                                  <div className="text-[11px] text-[#6b7280]">
                                    {link.request.departmentName}
                                  </div>
                                </td>
                                <td className="p-2.5 text-[#1f2937]">
                                  {link.request.departurePickupPointText || 'Điểm đón'} →{' '}
                                  {link.request.departureDropoffPointText || 'Điểm trả'}
                                </td>
                                <td className="p-2.5 text-center font-semibold">
                                  {link.request.passengerCount}
                                </td>
                                <td className="p-2.5">
                                  {renderRequestStatusBadge(link.request.status)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB 3: CẬP NHẬT TRẠNG THÁI XE & LỊCH SỬ */}
              {vehDrawerTab === 'STATUS' && (
                <div className="space-y-4">
                  <div className="border border-[#e5e7eb] rounded-[8px] p-4 bg-white space-y-3">
                    <div className="text-[13px] font-semibold text-[#1f2937]">
                      Đồng bộ & điều hành trạng thái phương tiện
                    </div>
                    <p className="text-[12px] text-[#6b7280]">
                      Trạng thái xe được tự động tính toán từ các chuyến đang chạy (Tuyến cố định /
                      Điều chuyến) và trạng thái hoạt động của xe trong Danh mục.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleSyncVehicleStatus}
                        className="h-[34px] px-3.5 rounded-[6px] bg-[#00897b] text-white text-[12px] font-semibold hover:bg-[#00796b] flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Đồng bộ trạng thái từ lịch trình (Sync)
                      </button>
                      {vehOpsDrawer.latestTrip && (
                        <button
                          type="button"
                          onClick={() => {
                            const t = vehOpsDrawer.latestTrip;
                            setVehOpsDrawer(null);
                            openTripDetail(t);
                          }}
                          className="h-[34px] px-3.5 rounded-[6px] border border-[#00897b] bg-white text-[#00897b] text-[12px] font-semibold hover:bg-[#f0fdf4] flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Xem chuyến hiện tại ({vehOpsDrawer.latestTrip.tripCode})
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="border border-[#e5e7eb] rounded-[8px] p-4 bg-white">
                    <div className="text-[13px] font-semibold text-[#1f2937] mb-2">
                      Nhật ký đồng bộ trạng thái xe ({vehAuditLogs.length})
                    </div>
                    {vehAuditLogs.length === 0 ? (
                      <div className="text-center text-[12px] text-[#9ca3af] py-4">
                        Chưa có biến động trạng thái nào được ghi nhận
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                        {vehAuditLogs.map((log: any) => (
                          <div
                            key={log.id}
                            className="flex items-center justify-between text-[12px] bg-[#f9fafb] px-3 py-1.5 rounded"
                          >
                            <span>{log.summaryText}</span>
                            <span className="text-[11px] text-[#6b7280]">
                              {formatDateTimeVi(log.changedAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 border-t border-[#e5e7eb] bg-[#f8fafc] flex justify-end">
              <button
                type="button"
                onClick={() => setVehOpsDrawer(null)}
                className="h-[34px] px-4 rounded-[6px] border border-[#d1d5db] bg-white text-[#374151] text-[12px] font-medium hover:bg-[#f3f4f6] cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: CẬP NHẬT THỰC TẾ & KM (updateTripActualKm) */}
      {/* ==================================================================== */}
      {kmModal && (
        <div className="fixed inset-0 z-50 bg-black/35 flex justify-end">
          <form
            onSubmit={handleSaveActualKm}
            className="bg-white w-full max-w-[680px] h-full shadow-2xl border-l border-[#e5e7eb] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]">
              <h3 className="text-[15px] font-bold text-[#1f2937]">
                {kmModal.trip.tripCode} - Cập nhật thực tế & KM
              </h3>
              <button
                type="button"
                onClick={() => setKmModal(null)}
                className="text-[#4b5563] hover:text-[#1f2937] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-[13px]">
              <h4 className="text-[14px] font-bold text-[#1f2937]">
                Chỉ số vận hành thực tế
              </h4>
              <div className="grid grid-cols-2 gap-3.5">
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    KM thực tế (* &gt; 0)
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={kmModal.actualKm}
                    onChange={(e) => setKmModal({ ...kmModal, actualKm: e.target.value })}
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937]"
                    placeholder="KM thực tế"
                  />
                </div>
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Số giờ OT phát sinh
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={kmModal.otHours}
                    onChange={(e) => setKmModal({ ...kmModal, otHours: e.target.value })}
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937]"
                  />
                </div>
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Phí cầu đường / bến bãi (VNĐ)
                  </span>
                  <input
                    type="number"
                    step="1000"
                    min="0"
                    value={kmModal.tollFeeAmount}
                    onChange={(e) =>
                      setKmModal({ ...kmModal, tollFeeAmount: e.target.value })
                    }
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937]"
                  />
                </div>
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Số đêm lưu trú (Overnight)
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={kmModal.overnightNights}
                    onChange={(e) =>
                      setKmModal({ ...kmModal, overnightNights: e.target.value })
                    }
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937]"
                  />
                </div>
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Giờ xuất phát thực tế (HH:mm)
                  </span>
                  <input
                    type="time"
                    value={kmModal.actualStartAt}
                    onChange={(e) =>
                      setKmModal({ ...kmModal, actualStartAt: e.target.value })
                    }
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937]"
                  />
                </div>
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Giờ kết thúc thực tế (HH:mm)
                  </span>
                  <input
                    type="time"
                    value={kmModal.actualEndAt}
                    onChange={(e) =>
                      setKmModal({ ...kmModal, actualEndAt: e.target.value })
                    }
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937]"
                  />
                </div>
              </div>
              <div className="relative">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Ghi chú thực thi / Lý do kiểm toán
                </span>
                <textarea
                  rows={3}
                  value={kmModal.executionNote}
                  onChange={(e) =>
                    setKmModal({ ...kmModal, executionNote: e.target.value })
                  }
                  className="w-full border border-[#d1d5db] rounded-[6px] px-3 py-2 text-[13px] text-[#1f2937]"
                  placeholder="Nhập ghi chú thực thi hoặc lý do điều chỉnh KM..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setKmModal(null)}
                  className="h-[34px] px-4 rounded-[6px] border border-[#00897b] bg-white text-[#00897b] text-[13px] font-medium hover:bg-[#f0fdf4] cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="h-[34px] px-4 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-medium cursor-pointer"
                >
                  Lưu thực tế & Hoàn thành chuyến
                </button>
              </div>

              <div className="space-y-2.5 border-t border-[#f3f4f6] pt-4">
                <div className="grid grid-cols-12 gap-2">
                  <span className="col-span-4 text-[#6b7280]">Mã chuyến</span>
                  <span className="col-span-8 font-medium text-[#1f2937]">
                    {kmModal.trip.tripCode}
                  </span>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <span className="col-span-4 text-[#6b7280]">Xe</span>
                  <span className="col-span-8 text-[#1f2937]">
                    {kmModal.trip.vehiclePlateSnapshot || '—'}
                  </span>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <span className="col-span-4 text-[#6b7280]">Tài xế</span>
                  <span className="col-span-8 text-[#1f2937]">
                    {kmModal.trip.driverNameSnapshot || '—'}
                  </span>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: ĐỔI XE / TÀI XẾ (reassignTripVehicle) */}
      {/* ==================================================================== */}
      {reassignModal && (
        <div className="fixed inset-0 z-50 bg-black/35 flex justify-end">
          <form
            onSubmit={handleSaveReassign}
            className="bg-white w-full max-w-[680px] h-full shadow-2xl border-l border-[#e5e7eb] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]">
              <h3 className="text-[15px] font-bold text-[#1f2937]">
                {reassignModal.trip.tripCode} - Phân công lại xe / tài xế
              </h3>
              <button
                type="button"
                onClick={() => setReassignModal(null)}
                className="text-[#4b5563] hover:text-[#1f2937] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-[13px]">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Xe thay thế (*)
                  </span>
                  <select
                    required
                    value={reassignModal.vehicleId}
                    onChange={(e) => {
                      const nextVehId = e.target.value;
                      const foundVeh = vehicles.find((v) => String(v.id) === nextVehId);
                      setReassignModal({
                        ...reassignModal,
                        vehicleId: nextVehId,
                        driverId: foundVeh?.defaultDriverId
                          ? String(foundVeh.defaultDriverId)
                          : reassignModal.driverId,
                      });
                    }}
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
                    Tài xế (*)
                  </span>
                  <select
                    required
                    value={reassignModal.driverId}
                    onChange={(e) =>
                      setReassignModal({ ...reassignModal, driverId: e.target.value })
                    }
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white"
                  >
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.driverName} ({d.phoneNumber})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="relative">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Số KM thực tế (nếu chuyến đã hoàn thành)
                </span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={reassignModal.actualKm}
                  onChange={(e) =>
                    setReassignModal({ ...reassignModal, actualKm: e.target.value })
                  }
                  placeholder="Để trống nếu chưa hoàn thành"
                  className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937]"
                />
              </div>
              <div className="relative">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Lý do đổi xe / tài xế (Bắt buộc để kiểm toán)
                </span>
                <textarea
                  rows={3}
                  required
                  value={reassignModal.reason}
                  onChange={(e) =>
                    setReassignModal({ ...reassignModal, reason: e.target.value })
                  }
                  className="w-full border border-[#d1d5db] rounded-[6px] px-3 py-2 text-[13px] text-[#1f2937]"
                  placeholder="Nhập lý do phân công lại xe / tài xế..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReassignModal(null)}
                  className="h-[34px] px-4 rounded-[6px] border border-[#00897b] bg-white text-[#00897b] text-[13px] font-medium hover:bg-[#f0fdf4] cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="h-[34px] px-4 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-medium cursor-pointer"
                >
                  Phân công lại xe / tài xế
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: XÁC NHẬN HỦY CHUYẾN (Thay thế window.prompt) */}
      {/* ==================================================================== */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmCancelTrip}
            className="bg-white w-full max-w-[500px] rounded-[10px] shadow-2xl border border-[#e5e7eb] overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e7eb] bg-[#fef2f2]">
              <div className="flex items-center gap-2 text-[#b91c1c] font-bold text-[15px]">
                <AlertTriangle className="w-5 h-5" />
                Xác nhận hủy chuyến {cancelModal.trip.tripCode}
              </div>
              <button
                type="button"
                onClick={() => setCancelModal(null)}
                className="text-[#6b7280] hover:text-[#1f2937] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-[13px]">
              <p className="text-[#374151]">
                Khi hủy chuyến đi này, toàn bộ các đơn yêu cầu xe đang gắn kèm sẽ được trả về trạng
                thái <strong>Chờ nhà xe điều phối</strong>.
              </p>
              {cancelModal.trip.pairedTripId && (
                <div className="p-3 rounded-[6px] bg-[#fffbeb] border border-[#fde68a] text-[#92400e] text-[12px]">
                  <strong>Lưu ý khứ hồi:</strong> Chuyến này thuộc cặp khứ hồi. Hủy chuyến này sẽ
                  đồng thời hủy chuyến cặp liên kết.
                </div>
              )}
              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                  Lý do hủy chuyến (*)
                </label>
                <textarea
                  rows={3}
                  required
                  value={cancelModal.reason}
                  onChange={(e) =>
                    setCancelModal({ ...cancelModal, reason: e.target.value })
                  }
                  placeholder="Nhập lý do hủy chuyến..."
                  className="w-full border border-[#d1d5db] rounded-[6px] px-3 py-2 text-[13px]"
                />
              </div>
            </div>
            <div className="px-5 py-3 bg-[#f9fafb] border-t border-[#e5e7eb] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelModal(null)}
                className="h-[34px] px-4 rounded-[6px] border border-[#d1d5db] bg-white text-[#374151] text-[13px] font-medium hover:bg-[#f3f4f6] cursor-pointer"
              >
                Không hủy
              </button>
              <button
                type="submit"
                className="h-[34px] px-4 rounded-[6px] bg-[#dc2626] hover:bg-[#b91c1c] text-white text-[13px] font-semibold cursor-pointer"
              >
                Xác nhận hủy chuyến
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: BỔ SUNG CHUYẾN ĐÃ CHẠY (CompletedTripFormModal) */}
      {/* ==================================================================== */}
      {supplementCompletedModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveSupplementCompletedTrip}
            className="bg-white w-full max-w-[720px] max-h-[90vh] rounded-[10px] shadow-2xl border border-[#e5e7eb] flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb] bg-[#f8fafc]">
              <h3 className="text-[15px] font-bold text-[#1f2937]">
                Bổ sung chuyến đã chạy (Ghi nhận thực tế hoàn thành)
              </h3>
              <button
                type="button"
                onClick={() => setSupplementCompletedModal(null)}
                className="text-[#6b7280] hover:text-[#1f2937] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-[13px]">
              {/* Bước 1: Phân loại & Tuyến */}
              <div>
                <div className="text-[12px] font-bold text-[#0f766e] uppercase mb-2.5">
                  1. Phân loại chuyến & Tuyến đường
                </div>
                <div className="grid grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-[11px] text-[#6b7280] mb-1">
                      Ngày vận hành (*)
                    </label>
                    <input
                      type="date"
                      required
                      max={getTodayIso()}
                      value={supplementCompletedModal.businessDate}
                      onChange={(e) =>
                        setSupplementCompletedModal({
                          ...supplementCompletedModal,
                          businessDate: e.target.value,
                        })
                      }
                      className="w-full h-[36px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6b7280] mb-1">
                      Loại chuyến (*)
                    </label>
                    <select
                      value={supplementCompletedModal.tripType}
                      onChange={(e) =>
                        setSupplementCompletedModal({
                          ...supplementCompletedModal,
                          tripType: e.target.value,
                          passengerCount:
                            e.target.value === 'DEADHEAD'
                              ? '0'
                              : supplementCompletedModal.passengerCount,
                        })
                      }
                      className="w-full h-[36px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px] bg-white"
                    >
                      <option value="COMMUTE">Đưa đón cố định (COMMUTE)</option>
                      <option value="BUSINESS">Công tác (BUSINESS)</option>
                      <option value="OVERTIME">Tăng ca / OT (OVERTIME)</option>
                      <option value="GOODS">Vận chuyển hàng (GOODS)</option>
                      <option value="DEADHEAD">Chuyến chạy rỗng (DEADHEAD)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6b7280] mb-1">
                      Chiều di chuyển (*)
                    </label>
                    <select
                      value={supplementCompletedModal.tripLeg}
                      onChange={(e) =>
                        setSupplementCompletedModal({
                          ...supplementCompletedModal,
                          tripLeg: e.target.value,
                        })
                      }
                      className="w-full h-[36px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px] bg-white"
                    >
                      <option value="OUTBOUND">Chiều đi (OUTBOUND)</option>
                      <option value="RETURN">Chiều về (RETURN)</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] text-[#6b7280] mb-1">
                      Tuyến đường đối chiếu (*)
                    </label>
                    <select
                      required
                      value={supplementCompletedModal.routeId}
                      onChange={(e) => {
                        const rId = e.target.value;
                        const foundRoute = routes.find((r) => String(r.id) === rId);
                        const firstSeg = foundRoute?.segments?.[0];
                        setSupplementCompletedModal({
                          ...supplementCompletedModal,
                          routeId: rId,
                          legCode: firstSeg?.legCode || supplementCompletedModal.legCode,
                          departurePickupPointText:
                            foundRoute?.routeName ||
                            supplementCompletedModal.departurePickupPointText,
                        });
                      }}
                      className="w-full h-[36px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px] bg-white"
                    >
                      {routes.map((rt) => (
                        <option key={rt.id} value={rt.id}>
                          {rt.routeCode} - {rt.routeName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6b7280] mb-1">
                      Mã lượt chạy
                    </label>
                    <input
                      type="text"
                      required
                      value={supplementCompletedModal.legCode}
                      onChange={(e) =>
                        setSupplementCompletedModal({
                          ...supplementCompletedModal,
                          legCode: e.target.value,
                        })
                      }
                      className="w-full h-[36px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px]"
                    />
                  </div>
                </div>
              </div>

              {/* Bước 2: Phương tiện & Tài xế */}
              <div>
                <div className="text-[12px] font-bold text-[#0f766e] uppercase mb-2.5">
                  2. Phương tiện & Tài xế thực hiện
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] text-[#6b7280] mb-1">
                      Chọn xe (*)
                    </label>
                    <select
                      required
                      value={supplementCompletedModal.vehicleId}
                      onChange={(e) => {
                        const vId = e.target.value;
                        const foundVeh = vehicles.find((v) => String(v.id) === vId);
                        setSupplementCompletedModal({
                          ...supplementCompletedModal,
                          vehicleId: vId,
                          driverId: foundVeh?.defaultDriverId
                            ? String(foundVeh.defaultDriverId)
                            : supplementCompletedModal.driverId,
                        });
                      }}
                      className="w-full h-[36px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px] bg-white"
                    >
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.vehiclePlate} ({v.seatCapacity} chỗ)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6b7280] mb-1">
                      Tài xế (*)
                    </label>
                    <select
                      required
                      value={supplementCompletedModal.driverId}
                      onChange={(e) =>
                        setSupplementCompletedModal({
                          ...supplementCompletedModal,
                          driverId: e.target.value,
                        })
                      }
                      className="w-full h-[36px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px] bg-white"
                    >
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.driverName} ({d.phoneNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Bước 3: Lộ trình & Thời gian thực tế */}
              <div>
                <div className="text-[12px] font-bold text-[#0f766e] uppercase mb-2.5">
                  3. Điểm đón / trả & Khung giờ thực tế
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] text-[#6b7280] mb-1">
                      Điểm đón thực tế
                    </label>
                    <input
                      type="text"
                      value={supplementCompletedModal.departurePickupPointText}
                      onChange={(e) =>
                        setSupplementCompletedModal({
                          ...supplementCompletedModal,
                          departurePickupPointText: e.target.value,
                        })
                      }
                      className="w-full h-[36px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6b7280] mb-1">
                      Điểm trả thực tế
                    </label>
                    <input
                      type="text"
                      value={supplementCompletedModal.departureDropoffPointText}
                      onChange={(e) =>
                        setSupplementCompletedModal({
                          ...supplementCompletedModal,
                          departureDropoffPointText: e.target.value,
                        })
                      }
                      className="w-full h-[36px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6b7280] mb-1">
                      Giờ đi thực tế
                    </label>
                    <input
                      type="time"
                      value={supplementCompletedModal.actualStartAt}
                      onChange={(e) =>
                        setSupplementCompletedModal({
                          ...supplementCompletedModal,
                          actualStartAt: e.target.value,
                        })
                      }
                      className="w-full h-[36px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6b7280] mb-1">
                      Giờ đến thực tế
                    </label>
                    <input
                      type="time"
                      value={supplementCompletedModal.actualEndAt}
                      onChange={(e) =>
                        setSupplementCompletedModal({
                          ...supplementCompletedModal,
                          actualEndAt: e.target.value,
                        })
                      }
                      className="w-full h-[36px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px]"
                    />
                  </div>
                </div>
              </div>

              {/* Bước 4: Chỉ số KM, OT & Phí cầu đường */}
              <div>
                <div className="text-[12px] font-bold text-[#0f766e] uppercase mb-2.5">
                  4. Chỉ số KM, Số khách & Chi phí phát sinh
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#6b7280] mb-1">
                      KM thực tế (*)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      value={supplementCompletedModal.actualKm}
                      onChange={(e) =>
                        setSupplementCompletedModal({
                          ...supplementCompletedModal,
                          actualKm: e.target.value,
                        })
                      }
                      className="w-full h-[36px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px] font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6b7280] mb-1">
                      Số khách thực tế
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={supplementCompletedModal.passengerCount}
                      onChange={(e) =>
                        setSupplementCompletedModal({
                          ...supplementCompletedModal,
                          passengerCount: e.target.value,
                        })
                      }
                      className="w-full h-[36px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6b7280] mb-1">
                      Giờ OT
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={supplementCompletedModal.otHours}
                      onChange={(e) =>
                        setSupplementCompletedModal({
                          ...supplementCompletedModal,
                          otHours: e.target.value,
                        })
                      }
                      className="w-full h-[36px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px]"
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
                      value={supplementCompletedModal.tollFeeAmount}
                      onChange={(e) =>
                        setSupplementCompletedModal({
                          ...supplementCompletedModal,
                          tollFeeAmount: e.target.value,
                        })
                      }
                      className="w-full h-[36px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[13px]"
                    />
                  </div>
                </div>
              </div>

              {/* Bước 5: Ghi chú */}
              <div>
                <label className="block text-[11px] text-[#6b7280] mb-1">
                  Ghi chú thực hiện
                </label>
                <textarea
                  rows={2}
                  value={supplementCompletedModal.notes}
                  onChange={(e) =>
                    setSupplementCompletedModal({
                      ...supplementCompletedModal,
                      notes: e.target.value,
                    })
                  }
                  className="w-full border border-[#d1d5db] rounded-[6px] px-3 py-2 text-[13px]"
                  placeholder="Nhập ghi chú bổ sung chuyến đã chạy..."
                />
              </div>
            </div>

            <div className="px-6 py-3.5 bg-[#f8fafc] border-t border-[#e5e7eb] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSupplementCompletedModal(null)}
                className="h-[34px] px-4 rounded-[6px] border border-[#d1d5db] bg-white text-[#374151] text-[13px] font-medium hover:bg-[#f3f4f6] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="h-[34px] px-4 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-semibold cursor-pointer"
              >
                Lưu chuyến hoàn thành
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
