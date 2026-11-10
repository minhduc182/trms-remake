import React, { useEffect, useState } from 'react';
import {
  MapPin,
  UserCheck,
  Bus,
  GitBranch,
  Route as RouteIcon,
  Users,
  DollarSign,
  Plus,
  Search,
  Edit3,
  Trash2,
  Power,
  CheckCircle2,
  XCircle,
  History,
  FileSpreadsheet,
  RefreshCw,
  AlertCircle,
  X,
} from 'lucide-react';
import { gqlRequest, formatVnd } from '../lib/graphql';
import {
  LegacyTabs,
  FloatingSelect,
  SectionToolbar,
  LegacyPagination,
  PastelBadge,
  RowContextMenu,
  renderPassengerTypeBadge,
  renderVehicleTypeLabel,
} from '../components/legacy-ui';

type MasterTab =
  | 'POINTS'
  | 'DRIVERS'
  | 'VEHICLES'
  | 'LEGS'
  | 'ROUTES'
  | 'ETP'
  | 'COST_CONFIGS';

const VEHICLE_CAPACITY_MAP: Record<string, number> = {
  VAN_16: 15,
  BUS_29: 28,
  BUS_45: 44,
};

export const MasterDataPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MasterTab>('POINTS');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Shared lookup lists
  const [points, setPoints] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [legs, setLegs] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [etpProfiles, setEtpProfiles] = useState<any[]>([]);
  const [costConfigs, setCostConfigs] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [pointTypesFilter, setPointTypesFilter] = useState<string[]>([]);
  const [activeFlagFilter, setActiveFlagFilter] = useState<string>('');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string>('');
  const [passengerTypeFilter, setPassengerTypeFilter] = useState<string>('');
  const [runDaysFilter, setRunDaysFilter] = useState<string>('');
  const [etpStatusFilter, setEtpStatusFilter] = useState<string>('');
  const [costTypeFilter, setCostTypeFilter] = useState<string>('');

  // Modals
  const [pointModal, setPointModal] = useState<any | null>(null);
  const [driverModal, setDriverModal] = useState<any | null>(null);
  const [vehicleModal, setVehicleModal] = useState<any | null>(null);
  const [legModal, setLegModal] = useState<any | null>(null);
  const [routeModal, setRouteModal] = useState<any | null>(null);
  const [etpCreateModal, setEtpCreateModal] = useState<any | null>(null);
  const [etpDeactivateModal, setEtpDeactivateModal] = useState<any | null>(null);
  const [etpHistoryModal, setEtpHistoryModal] = useState<{
    employee: any;
    registrations: any[];
  } | null>(null);
  const [etpImportModal, setEtpImportModal] = useState<boolean>(false);
  const [costConfigModal, setCostConfigModal] = useState<any | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadAllLookups = async () => {
    try {
      const data = await gqlRequest<any>(`
        query LoadMasterLookups {
          vendors { id vendorCode vendorName }
          users { id username fullName }
          employees { id empCode fullName orgUnit { name } }
          shifts(transportFlag: "Y") { id shiftCode shiftName startTime endTime }
        }
      `);
      setVendors(data.vendors || []);
      setUsers(data.users || []);
      setEmployees(data.employees || []);
      setShifts(data.shifts || []);
    } catch {
      // ignore if user role doesn't have user list scope
    }
  };

  const loadTabData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'POINTS') {
        const res = await gqlRequest<{ points: any[] }>(
          `query GetPoints($search: String, $pointTypes: [String!], $activeFlag: String) {
            points(search: $search, pointTypes: $pointTypes, activeFlag: $activeFlag) {
              id pointCode pointName pointType districtName address isFactory activeFlag segmentUsageCount
            }
          }`,
          {
            search: search || undefined,
            pointTypes: pointTypesFilter.length > 0 ? pointTypesFilter : undefined,
            activeFlag: activeFlagFilter || undefined,
          }
        );
        const sortedPts = [...(res.points || [])].sort((a, b) => {
          const ac = String(a.pointCode || '');
          const bc = String(b.pointCode || '');
          const aTest = ac.startsWith('MC_') || ac.startsWith('PT_') || ac.includes('@') ? 1 : 0;
          const bTest = bc.startsWith('MC_') || bc.startsWith('PT_') || bc.includes('@') ? 1 : 0;
          if (aTest !== bTest) return aTest - bTest;
          return ac.localeCompare(bc);
        });
        setPoints(sortedPts);
      } else if (activeTab === 'DRIVERS') {
        const res = await gqlRequest<{ drivers: any[] }>(
          `query GetDrivers($search: String, $activeFlag: String) {
            drivers(search: $search, activeFlag: $activeFlag) {
              id driverName phoneNumber shortAddress fullAddress identityUserId activeFlag segmentUsageCount
              user { id username fullName }
            }
          }`,
          { search: search || undefined, activeFlag: activeFlagFilter || undefined }
        );
        setDrivers(res.drivers);
      } else if (activeTab === 'VEHICLES') {
        const res = await gqlRequest<{ vehicles: any[] }>(
          `query GetVehicles($search: String, $vehicleTypes: [String!], $activeFlag: String) {
            vehicles(search: $search, vehicleTypes: $vehicleTypes, activeFlag: $activeFlag) {
              id vehicleCode vehiclePlate vendorId vehicleType seatCapacity ownershipType
              commutePackageMode dailyTripQuota monthlyKmQuota activeFlag segmentUsageCount
              vendor { id vendorCode vendorName }
            }
          }`,
          {
            search: search || undefined,
            vehicleTypes: vehicleTypeFilter ? [vehicleTypeFilter] : undefined,
            activeFlag: activeFlagFilter || undefined,
          }
        );
        setVehicles(res.vehicles);
      } else if (activeTab === 'LEGS') {
        const res = await gqlRequest<{ legDefinitions: any[] }>(
          `query GetLegs($passengerType: String, $search: String) {
            legDefinitions(passengerType: $passengerType, search: $search) {
              id legCode legName passengerType displayOrder direction isDeadhead activeFlag segmentUsageCount
            }
          }`,
          {
            passengerType: passengerTypeFilter || undefined,
            search: search || undefined,
          }
        );
        setLegs(res.legDefinitions);
      } else if (activeTab === 'ROUTES') {
        const res = await gqlRequest<any>(
          `query GetRoutesAndRefs($passengerType: String, $runDays: String, $search: String) {
            routes(passengerType: $passengerType, runDays: $runDays, search: $search) {
              id routeCode routeName routeClass passengerType runDays activeFlag
              vendor { id vendorName }
              routeVehicles {
                id vehicleId driverId displayOrder
                vehicle { id vehiclePlate seatCapacity }
                driver { id driverName phoneNumber }
              }
              segments {
                id legDefinitionId legCode legName direction departureTime arrivalTime
                defaultVehicleId defaultDriverId sequenceOrder activeFlag
                defaultVehicle { id vehiclePlate }
                defaultDriver { id driverName }
                segmentPoints { id pointId pointRole stopOrder point { id pointCode pointName } }
                segmentShifts { id shiftId shift { id shiftCode shiftName } }
              }
            }
            points(activeFlag: "Y") { id pointCode pointName pointType isFactory }
            vehicles(activeFlag: "Y") { id vehiclePlate vehicleType seatCapacity }
            drivers(activeFlag: "Y") { id driverName phoneNumber }
            legDefinitions { id legCode legName passengerType direction isDeadhead }
          }`,
          {
            passengerType: passengerTypeFilter || undefined,
            runDays: runDaysFilter || undefined,
            search: search || undefined,
          }
        );
        setRoutes(res.routes || []);
        setPoints(res.points || []);
        setVehicles(res.vehicles || []);
        setDrivers(res.drivers || []);
        setLegs(res.legDefinitions || []);
      } else if (activeTab === 'ETP') {
        const res = await gqlRequest<any>(
          `query GetEtpList($passengerType: String, $approvalStatus: String, $activeFlag: String, $search: String) {
            employeeTransportProfiles(
              passengerType: $passengerType,
              approvalStatus: $approvalStatus,
              activeFlag: $activeFlag,
              search: $search,
              limit: 200
            ) {
              id employeeId routeId pickupPointId dropoffPointId effectiveFrom effectiveTo
              activeFlag approvalStatus rejectReason isProvisional provTempCode provFullName createDate
              employee { id empCode fullName orgUnit { name } }
              route { id routeCode routeName passengerType }
              pickupPoint { id pointCode pointName }
              dropoffPoint { id pointCode pointName }
            }
            routes(activeFlag: "Y") {
              id routeCode routeName passengerType
            }
            points(activeFlag: "Y") { id pointCode pointName pointType }
          }`,
          {
            passengerType: passengerTypeFilter || undefined,
            approvalStatus: etpStatusFilter || undefined,
            activeFlag: activeFlagFilter || undefined,
            search: search || undefined,
          }
        );
        setEtpProfiles(res.employeeTransportProfiles || []);
        setRoutes(res.routes || []);
        setPoints(res.points || []);
      } else if (activeTab === 'COST_CONFIGS') {
        const res = await gqlRequest<{ costConfigs: any[] }>(
          `query GetCostConfigs($configType: String, $passengerType: String, $vehicleType: String) {
            costConfigs(configType: $configType, passengerType: $passengerType, vehicleType: $vehicleType) {
              id versionCode configType passengerType vehicleType pricingScope currencyCode
              effectiveFrom effectiveTo activeFlag
              rules {
                id ruleCode rateType dayType minDistanceKm maxDistanceKm dailyTripCount
                includedDistanceKm unitPrice priceUnit description activeFlag
              }
            }
          }`,
          {
            configType: costTypeFilter || undefined,
            passengerType: passengerTypeFilter || undefined,
            vehicleType: vehicleTypeFilter || undefined,
          }
        );
        setCostConfigs(res.costConfigs || []);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi tải dữ liệu gốc');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllLookups();
  }, []);

  useEffect(() => {
    loadTabData();
  }, [
    activeTab,
    pointTypesFilter,
    activeFlagFilter,
    vehicleTypeFilter,
    passengerTypeFilter,
    runDaysFilter,
    etpStatusFilter,
    costTypeFilter,
  ]);

  // ============================================================================
  // HANDLERS: TAB 1 - POINTS
  // ============================================================================
  const handleSavePoint = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (pointModal.id) {
        await gqlRequest(
          `mutation UpdatePoint($id: BigInt!, $pointName: String, $pointType: String, $districtName: String, $address: String, $isFactory: String, $activeFlag: String) {
            updatePoint(id: $id, pointName: $pointName, pointType: $pointType, districtName: $districtName, address: $address, isFactory: $isFactory, activeFlag: $activeFlag) { id }
          }`,
          pointModal
        );
        showToast('Đã cập nhật điểm đón/trả thành công');
      } else {
        await gqlRequest(
          `mutation CreatePoint($pointCode: String!, $pointName: String!, $pointType: String!, $districtName: String, $address: String, $isFactory: String) {
            createPoint(pointCode: $pointCode, pointName: $pointName, pointType: $pointType, districtName: $districtName, address: $address, isFactory: $isFactory) { id }
          }`,
          pointModal
        );
        showToast('Đã tạo điểm đón/trả mới thành công');
      }
      setPointModal(null);
      loadTabData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTogglePointActive = async (pt: any) => {
    try {
      const nextFlag = pt.activeFlag === 'Y' ? 'N' : 'Y';
      await gqlRequest(
        `mutation TogglePoint($id: BigInt!, $activeFlag: String) {
          updatePoint(id: $id, activeFlag: $activeFlag) { id }
        }`,
        { id: pt.id, activeFlag: nextFlag }
      );
      showToast(`Đã ${nextFlag === 'Y' ? 'bật' : 'tắt'} hoạt động điểm ${pt.pointCode}`);
      loadTabData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeletePoint = async (pt: any) => {
    if (!confirm(`Xác nhận xóa điểm đón/trả ${pt.pointCode} - ${pt.pointName}?`)) return;
    try {
      await gqlRequest(`mutation DelPoint($id: BigInt!) { deletePoint(id: $id) { id } }`, {
        id: pt.id,
      });
      showToast(`Đã xóa điểm ${pt.pointCode}`);
      loadTabData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ============================================================================
  // HANDLERS: TAB 2 - DRIVERS
  // ============================================================================
  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (driverModal.id) {
        await gqlRequest(
          `mutation UpdateDriver($id: BigInt!, $driverName: String, $phoneNumber: String, $shortAddress: String, $fullAddress: String, $accountMode: String, $identityUserId: BigInt, $username: String, $password: String, $activeFlag: String) {
            updateDriver(id: $id, driverName: $driverName, phoneNumber: $phoneNumber, shortAddress: $shortAddress, fullAddress: $fullAddress, accountMode: $accountMode, identityUserId: $identityUserId, username: $username, password: $password, activeFlag: $activeFlag) { id }
          }`,
          {
            ...driverModal,
            identityUserId: driverModal.identityUserId || undefined,
            username: driverModal.newUsername || driverModal.username || undefined,
            password: driverModal.newPassword || driverModal.password || undefined,
          }
        );
        showToast('Đã cập nhật thông tin tài xế');
      } else {
        await gqlRequest(
          `mutation CreateDriver($driverName: String!, $phoneNumber: String!, $shortAddress: String, $fullAddress: String, $accountMode: String, $identityUserId: BigInt, $username: String, $password: String) {
            createDriver(driverName: $driverName, phoneNumber: $phoneNumber, shortAddress: $shortAddress, fullAddress: $fullAddress, accountMode: $accountMode, identityUserId: $identityUserId, username: $username, password: $password) { id }
          }`,
          {
            ...driverModal,
            identityUserId: driverModal.identityUserId || undefined,
            username: driverModal.newUsername || driverModal.username || undefined,
            password: driverModal.newPassword || driverModal.password || undefined,
          }
        );
        showToast('Đã thêm tài xế mới');
      }
      setDriverModal(null);
      loadTabData();
      loadAllLookups();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteDriver = async (drv: any) => {
    if (!confirm(`Xác nhận xóa tài xế ${drv.driverName}?`)) return;
    try {
      await gqlRequest(`mutation DelDrv($id: BigInt!) { deleteDriver(id: $id) { id } }`, {
        id: drv.id,
      });
      showToast(`Đã xóa tài xế ${drv.driverName}`);
      loadTabData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ============================================================================
  // HANDLERS: TAB 3 - VEHICLES
  // ============================================================================
  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...vehicleModal,
        vendorId: vehicleModal.vendorId || undefined,
        dailyTripQuota:
          vehicleModal.commutePackageMode === 'BY_SEGMENT' && vehicleModal.dailyTripQuota
            ? Number(vehicleModal.dailyTripQuota)
            : undefined,
        monthlyKmQuota:
          vehicleModal.commutePackageMode === 'BY_SEGMENT' && vehicleModal.monthlyKmQuota
            ? String(vehicleModal.monthlyKmQuota)
            : undefined,
      };
      if (vehicleModal.id) {
        await gqlRequest(
          `mutation UpdateVehicle($id: BigInt!, $vehiclePlate: String, $vendorId: BigInt, $vehicleType: String, $ownershipType: String, $commutePackageMode: String, $dailyTripQuota: Int, $monthlyKmQuota: Decimal, $activeFlag: String) {
            updateVehicle(id: $id, vehiclePlate: $vehiclePlate, vendorId: $vendorId, vehicleType: $vehicleType, ownershipType: $ownershipType, commutePackageMode: $commutePackageMode, dailyTripQuota: $dailyTripQuota, monthlyKmQuota: $monthlyKmQuota, activeFlag: $activeFlag) { id }
          }`,
          payload
        );
        showToast('Đã cập nhật thông tin xe');
      } else {
        await gqlRequest(
          `mutation CreateVehicle($vehiclePlate: String!, $vendorId: BigInt, $vehicleType: String!, $ownershipType: String!, $commutePackageMode: String, $dailyTripQuota: Int, $monthlyKmQuota: Decimal) {
            createVehicle(vehiclePlate: $vehiclePlate, vendorId: $vendorId, vehicleType: $vehicleType, ownershipType: $ownershipType, commutePackageMode: $commutePackageMode, dailyTripQuota: $dailyTripQuota, monthlyKmQuota: $monthlyKmQuota) { id }
          }`,
          payload
        );
        showToast('Đã thêm xe mới');
      }
      setVehicleModal(null);
      loadTabData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteVehicle = async (v: any) => {
    if (!confirm(`Xác nhận xóa xe ${v.vehiclePlate}?`)) return;
    try {
      await gqlRequest(`mutation DelVeh($id: BigInt!) { deleteVehicle(id: $id) { id } }`, {
        id: v.id,
      });
      showToast(`Đã xóa xe ${v.vehiclePlate}`);
      loadTabData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ============================================================================
  // HANDLERS: TAB 4 - LEGS
  // ============================================================================
  const handleSaveLeg = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...legModal,
        displayOrder: Number(legModal.displayOrder || 1),
        direction: legModal.isDeadhead === 'Y' ? 'TO_FACTORY' : legModal.direction,
      };
      if (legModal.id) {
        await gqlRequest(
          `mutation UpdateLeg($id: BigInt!, $legCode: String, $legName: String, $passengerType: String, $displayOrder: Int, $direction: String, $isDeadhead: String, $activeFlag: String) {
            updateLegDefinition(id: $id, legCode: $legCode, legName: $legName, passengerType: $passengerType, displayOrder: $displayOrder, direction: $direction, isDeadhead: $isDeadhead, activeFlag: $activeFlag) { id }
          }`,
          payload
        );
        showToast('Đã cập nhật lượt chạy');
      } else {
        await gqlRequest(
          `mutation CreateLeg($legCode: String!, $legName: String!, $passengerType: String!, $displayOrder: Int, $direction: String!, $isDeadhead: String) {
            createLegDefinition(legCode: $legCode, legName: $legName, passengerType: $passengerType, displayOrder: $displayOrder, direction: $direction, isDeadhead: $isDeadhead) { id }
          }`,
          payload
        );
        showToast('Đã tạo lượt chạy mới');
      }
      setLegModal(null);
      loadTabData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteLeg = async (leg: any) => {
    if (!confirm(`Xác nhận xóa lượt chạy ${leg.legCode}?`)) return;
    try {
      await gqlRequest(
        `mutation DelLeg($id: BigInt!) { deleteLegDefinition(id: $id) { id } }`,
        { id: leg.id }
      );
      showToast(`Đã xóa lượt chạy ${leg.legCode}`);
      loadTabData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ============================================================================
  // HANDLERS: TAB 5 - ROUTES
  // ============================================================================
  const handleSaveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...routeModal,
        runDays: routeModal.passengerType === 'WORKER' ? 'MON_SUN' : routeModal.runDays,
        routeVehicles:
          routeModal.passengerType === 'WORKER' ? routeModal.routeVehicles || [] : [],
        segments: (routeModal.segments || []).map((s: any, idx: number) => ({
          legDefinitionId: s.legDefinitionId || undefined,
          legCode: s.legCode || `LEG_${idx + 1}`,
          legName: s.legName || s.legCode || `Chặng ${idx + 1}`,
          direction: s.direction || 'TO_FACTORY',
          departureTime: s.departureTime || '06:30',
          arrivalTime: s.arrivalTime || '07:30',
          defaultVehicleId: s.defaultVehicleId || undefined,
          defaultDriverId: s.defaultDriverId || undefined,
          sequenceOrder: idx + 1,
          pickupPointIds: s.pickupPointIds || [],
          dropoffPointIds: s.dropoffPointIds || [],
          shiftIds: s.shiftIds || [],
        })),
      };

      if (routeModal.id) {
        await gqlRequest(
          `mutation UpdateRoute($id: BigInt!, $routeName: String, $passengerType: String, $runDays: String, $activeFlag: String, $routeVehicles: [RouteVehicleInput!], $segments: [RouteSegmentInput!]) {
            updateRoute(id: $id, routeName: $routeName, passengerType: $passengerType, runDays: $runDays, activeFlag: $activeFlag, routeVehicles: $routeVehicles, segments: $segments) { id }
          }`,
          payload
        );
        showToast('Đã cập nhật tuyến và danh sách chặng');
      } else {
        await gqlRequest(
          `mutation CreateRoute($routeCode: String!, $routeName: String!, $passengerType: String!, $runDays: String, $routeVehicles: [RouteVehicleInput!], $segments: [RouteSegmentInput!]) {
            createRoute(routeCode: $routeCode, routeName: $routeName, passengerType: $passengerType, runDays: $runDays, routeVehicles: $routeVehicles, segments: $segments) { id }
          }`,
          payload
        );
        showToast('Đã tạo tuyến xe cố định mới');
      }
      setRouteModal(null);
      loadTabData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ============================================================================
  // HANDLERS: TAB 6 - ETP
  // ============================================================================
  const handleCreateEtp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await gqlRequest(
        `mutation CreateEtp($employeeId: BigInt!, $routeId: BigInt!, $pickupPointId: BigInt!, $dropoffPointId: BigInt, $effectiveFrom: String!, $effectiveTo: String) {
          createEtpRegistration(employeeId: $employeeId, routeId: $routeId, pickupPointId: $pickupPointId, dropoffPointId: $dropoffPointId, effectiveFrom: $effectiveFrom, effectiveTo: $effectiveTo) { id }
        }`,
        {
          ...etpCreateModal,
          dropoffPointId: etpCreateModal.dropoffPointId || undefined,
          effectiveTo: etpCreateModal.effectiveTo || undefined,
        }
      );
      showToast('Đã thêm đăng ký người đi xe tuyến');
      setEtpCreateModal(null);
      loadTabData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleApproveEtp = async (etp: any) => {
    try {
      await gqlRequest(
        `mutation ApproveEtp($id: BigInt!) { approveEtpRegistration(id: $id) { id } }`,
        { id: etp.id }
      );
      showToast('Đã phê duyệt đăng ký đi xe tuyến');
      loadTabData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRejectEtp = async (etp: any) => {
    const reason = prompt('Nhập lý do từ chối đăng ký đi xe tuyến:', 'Sai tuyến hoặc điểm đón');
    if (reason === null) return;
    try {
      await gqlRequest(
        `mutation RejectEtp($id: BigInt!, $reason: String!) { rejectEtpRegistration(id: $id, reason: $reason) { id } }`,
        { id: etp.id, reason }
      );
      showToast('Đã từ chối đăng ký');
      loadTabData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeactivateEtp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await gqlRequest(
        `mutation DeactivateEtp($id: BigInt!, $effectiveTo: String!) {
          deactivateEtpRegistration(id: $id, effectiveTo: $effectiveTo) { id }
        }`,
        { id: etpDeactivateModal.id, effectiveTo: etpDeactivateModal.effectiveTo }
      );
      showToast('Đã ngừng sử dụng xe tuyến');
      setEtpDeactivateModal(null);
      loadTabData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openEtpHistory = async (etp: any) => {
    if (!etp.employeeId) return;
    try {
      const res = await gqlRequest<{ employeeTransportRegistrations: any[] }>(
        `query GetEmpHistory($employeeId: BigInt!) {
          employeeTransportRegistrations(employeeId: $employeeId) {
            id employeeId routeId pickupPointId dropoffPointId effectiveFrom effectiveTo
            activeFlag approvalStatus rejectReason
            route { id routeCode routeName }
            pickupPoint { id pointCode pointName }
            dropoffPoint { id pointCode pointName }
          }
        }`,
        { employeeId: etp.employeeId }
      );
      setEtpHistoryModal({
        employee: etp.employee,
        registrations: res.employeeTransportRegistrations || [],
      });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteFutureEtp = async (regId: string) => {
    if (!confirm('Xác nhận xóa kỳ đăng ký tương lai này?')) return;
    try {
      await gqlRequest(
        `mutation DelFuture($id: BigInt!) { deleteFutureEtpRegistration(id: $id) { id } }`,
        { id: regId }
      );
      showToast('Đã xóa đăng ký tương lai');
      if (etpHistoryModal?.employee) {
        openEtpHistory({ employeeId: etpHistoryModal.employee.id, employee: etpHistoryModal.employee });
      }
      loadTabData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ============================================================================
  // HANDLERS: TAB 7 - COST CONFIGS
  // ============================================================================
  const handleSaveCostConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await gqlRequest(
        `mutation UpsertCostConfig(
          $versionCode: String!,
          $configType: String!,
          $passengerType: String!,
          $vehicleType: String!,
          $pricingScope: String,
          $effectiveFrom: String!,
          $effectiveTo: String,
          $rules: [CostConfigRuleInput!]!
        ) {
          upsertCostConfig(
            versionCode: $versionCode,
            configType: $configType,
            passengerType: $passengerType,
            vehicleType: $vehicleType,
            pricingScope: $pricingScope,
            effectiveFrom: $effectiveFrom,
            effectiveTo: $effectiveTo,
            rules: $rules
          ) { id }
        }`,
        {
          ...costConfigModal,
          effectiveTo: costConfigModal.effectiveTo || undefined,
          pricingScope:
            costConfigModal.configType === 'EXTRA' && costConfigModal.passengerType === 'WORKER'
              ? costConfigModal.pricingScope || 'STANDARD'
              : undefined,
        }
      );
      showToast('Đã lưu phiên bản cấu hình chi phí');
      setCostConfigModal(null);
      loadTabData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const [etpRouteFilter, setEtpRouteFilter] = useState<string>('');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: {
      label: string;
      icon?: React.ReactNode;
      onClick: () => void;
      danger?: boolean;
      disabled?: boolean;
    }[];
  } | null>(null);

  const tabs: { id: MasterTab; label: string; testId: string }[] = [
    { id: 'POINTS', label: 'Điểm đón', testId: 'master-tab-POINTS' },
    { id: 'DRIVERS', label: 'Tài xế', testId: 'master-tab-DRIVERS' },
    { id: 'VEHICLES', label: 'Xe', testId: 'master-tab-VEHICLES' },
    { id: 'LEGS', label: 'Lượt chạy', testId: 'master-tab-LEGS' },
    { id: 'ROUTES', label: 'Tuyến xe', testId: 'master-tab-ROUTES' },
    { id: 'ETP', label: 'Người đi xe tuyến', testId: 'master-tab-ETP' },
    { id: 'COST_CONFIGS', label: 'Cấu hình chi phí', testId: 'master-tab-COST_CONFIGS' },
  ];

  const openRouteEditModal = (rt: any) => {
    setRouteModal({
      id: rt.id,
      routeCode: rt.routeCode,
      routeName: rt.routeName,
      routeClass: rt.routeClass,
      passengerType: rt.passengerType,
      runDays: rt.runDays,
      activeFlag: rt.activeFlag,
      routeVehicles: (rt.routeVehicles || []).map((rv: any) => ({
        vehicleId: rv.vehicleId,
        driverId: rv.driverId || '',
      })),
      segments: (rt.segments || []).map((s: any) => ({
        legDefinitionId: s.legDefinitionId || '',
        legCode: s.legCode,
        legName: s.legName || '',
        direction: s.direction,
        departureTime: s.departureTime || '06:30',
        arrivalTime: s.arrivalTime || '07:30',
        defaultVehicleId: s.defaultVehicleId || '',
        defaultDriverId: s.defaultDriverId || '',
        pickupPointIds: (s.segmentPoints || [])
          .filter((sp: any) => sp.pointRole === 'PICKUP')
          .map((sp: any) => sp.pointId),
        dropoffPointIds: (s.segmentPoints || [])
          .filter((sp: any) => sp.pointRole === 'DROPOFF')
          .map((sp: any) => sp.pointId),
        shiftIds: (s.segmentShifts || []).map((ss: any) => ss.shiftId),
      })),
    });
  };

  const renderRunDaysLabel = (runDays?: string) => {
    if (runDays === 'MON_FRI' || runDays === '31') return 'Thứ Hai đến Thứ Sáu';
    if (runDays === 'MON_SAT' || runDays === '63') return 'Thứ Hai đến Thứ Bảy';
    if (runDays === 'SAT_ONLY' || runDays === '32') return 'Chỉ Thứ Bảy';
    if (runDays === 'MON_SUN' || runDays === '127') return 'Thứ Hai đến Chủ nhật';
    return runDays || 'Thứ Hai đến Thứ Bảy';
  };

  return (
    <div className="bg-white">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#00897b] text-white px-4 py-2.5 rounded-md shadow-lg text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}

      {/* 7 Underline Tabs Navigation (046-master-data.png) */}
      <LegacyTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={(id) => {
          setActiveTab(id as MasterTab);
          setSearch('');
        }}
      />

      {/* Contextual Floating Filters per Tab */}
      {activeTab === 'LEGS' && (
        <div className="flex flex-wrap items-center gap-3 pt-4 pb-1">
          <FloatingSelect
            label="Loại hành khách"
            value={passengerTypeFilter}
            onChange={(val) => setPassengerTypeFilter(val)}
            options={[
              { value: 'STAFF', label: 'Nhân viên' },
              { value: 'WORKER', label: 'Công nhân' },
            ]}
          />
        </div>
      )}

      {activeTab === 'ROUTES' && (
        <div className="flex flex-wrap items-center gap-3 pt-4 pb-1">
          <FloatingSelect
            label="Loại hành khách"
            value={passengerTypeFilter}
            onChange={(val) => setPassengerTypeFilter(val)}
            options={[
              { value: 'STAFF', label: 'Nhân viên' },
              { value: 'WORKER', label: 'Công nhân' },
            ]}
          />
          <FloatingSelect
            label="Ngày có kế hoạch xe"
            value={runDaysFilter}
            onChange={(val) => setRunDaysFilter(val)}
            options={[
              { value: 'MON_FRI', label: 'Thứ Hai đến Thứ Sáu' },
              { value: 'MON_SAT', label: 'Thứ Hai đến Thứ Bảy' },
              { value: 'SAT_ONLY', label: 'Chỉ Thứ Bảy' },
              { value: 'MON_SUN', label: 'Thứ Hai đến Chủ nhật' },
            ]}
          />
        </div>
      )}

      {activeTab === 'ETP' && (
        <div className="flex flex-wrap items-center gap-3 pt-4 pb-1">
          <FloatingSelect
            label="Loại hành khách"
            value={passengerTypeFilter}
            onChange={(val) => setPassengerTypeFilter(val)}
            options={[
              { value: 'STAFF', label: 'Nhân viên' },
              { value: 'WORKER', label: 'Công nhân' },
            ]}
          />
          <FloatingSelect
            label="Trạng thái phê duyệt"
            value={etpStatusFilter}
            onChange={(val) => setEtpStatusFilter(val)}
            options={[
              { value: 'PENDING', label: 'Đang chờ phê duyệt' },
              { value: 'APPROVED', label: 'Đã phê duyệt' },
              { value: 'REJECTED', label: 'Từ chối' },
            ]}
          />
          <FloatingSelect
            label="Trạng thái hoạt động"
            value={activeFlagFilter}
            onChange={(val) => setActiveFlagFilter(val)}
            options={[
              { value: 'Y', label: 'Hoạt động' },
              { value: 'N', label: 'Không hoạt động' },
            ]}
          />
        </div>
      )}

      {activeTab === 'COST_CONFIGS' && (
        <div className="flex flex-wrap items-center gap-3 pt-4 pb-1">
          <FloatingSelect
            label="Loại"
            value={costTypeFilter}
            onChange={(val) => setCostTypeFilter(val)}
            options={[
              { value: 'COMMUTE', label: 'Đưa đón' },
              { value: 'EXTRA', label: 'Tăng cường' },
            ]}
          />
          <FloatingSelect
            label="Hành khách"
            value={passengerTypeFilter}
            onChange={(val) => setPassengerTypeFilter(val)}
            options={[
              { value: 'STAFF', label: 'Nhân viên' },
              { value: 'WORKER', label: 'Công nhân' },
            ]}
          />
          <FloatingSelect
            label="Xe"
            value={vehicleTypeFilter}
            onChange={(val) => setVehicleTypeFilter(val)}
            options={[
              { value: 'SEDAN_4', label: 'Xe 4 chỗ' },
              { value: 'SUV_7', label: 'Xe 7 chỗ' },
              { value: 'VAN_16', label: 'Xe 16 chỗ' },
              { value: 'BUS_29', label: 'Xe 29 chỗ' },
              { value: 'BUS_45', label: 'Xe 45 chỗ' },
            ]}
          />
        </div>
      )}

      {/* Section Toolbar per Tab */}
      {activeTab === 'POINTS' && (
        <SectionToolbar
          title="Điểm đón / trả"
          onRefresh={loadTabData}
          loading={loading}
          searchValue={search}
          onSearchChange={setSearch}
          showFilterButton
          primaryAction={{
            label: 'Thêm điểm đón/trả',
            hasDropdown: true,
            onClick: () =>
              setPointModal({
                pointCode: '',
                pointName: '',
                pointType: 'PICKUP',
                districtName: '',
                address: '',
                isFactory: 'N',
              }),
          }}
        />
      )}

      {activeTab === 'DRIVERS' && (
        <SectionToolbar
          title="Tài xế"
          onRefresh={loadTabData}
          loading={loading}
          searchValue={search}
          onSearchChange={setSearch}
          primaryAction={{
            label: 'Thêm tài xế',
            hasDropdown: true,
            onClick: () =>
              setDriverModal({
                driverName: '',
                phoneNumber: '',
                shortAddress: '',
                fullAddress: '',
                accountMode: 'NONE',
                identityUserId: '',
                newUsername: '',
                newPassword: '',
              }),
          }}
        />
      )}

      {activeTab === 'VEHICLES' && (
        <SectionToolbar
          title="Xe"
          onRefresh={loadTabData}
          loading={loading}
          searchValue={search}
          onSearchChange={setSearch}
          primaryAction={{
            label: 'Thêm xe',
            hasDropdown: true,
            onClick: () =>
              setVehicleModal({
                vehiclePlate: '',
                vendorId: vendors[0]?.id || '',
                vehicleType: 'BUS_29',
                seatCapacity: 28,
                ownershipType: 'OUTSOURCED',
                commutePackageMode: 'BY_ROUTE',
                dailyTripQuota: 2,
                monthlyKmQuota: '1500',
              }),
          }}
        />
      )}

      {activeTab === 'LEGS' && (
        <SectionToolbar
          title="Lượt chạy"
          onRefresh={loadTabData}
          loading={loading}
          searchValue={search}
          onSearchChange={setSearch}
          showFilterButton
          primaryAction={{
            label: 'Thêm lượt',
            hasDropdown: true,
            onClick: () =>
              setLegModal({
                legCode: '',
                legName: '',
                passengerType: 'STAFF',
                displayOrder: 1,
                direction: 'TO_FACTORY',
                isDeadhead: 'N',
              }),
          }}
        />
      )}

      {activeTab === 'ROUTES' && (
        <SectionToolbar
          title="Tuyến xe"
          onRefresh={loadTabData}
          loading={loading}
          searchValue={search}
          onSearchChange={setSearch}
          showFilterButton
          primaryAction={{
            label: 'Thêm tuyến',
            hasDropdown: false,
            onClick: () =>
              setRouteModal({
                routeCode: '',
                routeName: '',
                routeClass: 'FIXED_ROUTE',
                passengerType: 'STAFF',
                runDays: 'MON_SAT',
                routeVehicles: [],
                segments: [],
              }),
          }}
        />
      )}

      {activeTab === 'ETP' && (
        <SectionToolbar
          title="Người đi xe tuyến"
          onRefresh={loadTabData}
          loading={loading}
          searchValue={search}
          onSearchChange={setSearch}
          showFilterButton
          extraActions={
            <button
              onClick={() => setEtpImportModal(true)}
              className="h-[34px] px-3 rounded-md border border-[#d1d5db] bg-white text-[13px] font-medium text-[#374151] hover:bg-gray-50 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#00897b]" />
              Nhập Excel
            </button>
          }
          primaryAction={{
            label: 'Thêm người đi xe tuyến',
            hasDropdown: true,
            onClick: () =>
              setEtpCreateModal({
                employeeId: employees[0]?.id || '',
                routeId: routes[0]?.id || '',
                pickupPointId: points[0]?.id || '',
                dropoffPointId: '',
                effectiveFrom: new Date(Date.now() + 31 * 3600 * 1000)
                  .toISOString()
                  .slice(0, 10),
                effectiveTo: '',
              }),
          }}
        />
      )}

      {activeTab === 'COST_CONFIGS' && (
        <SectionToolbar
          title="Cấu hình chi phí"
          onRefresh={loadTabData}
          loading={loading}
          searchValue={search}
          onSearchChange={setSearch}
          showFilterButton
          primaryAction={{
            label: 'Tạo phiên bản',
            hasDropdown: true,
            onClick: () =>
              setCostConfigModal({
                versionCode: `VER-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
                configType: 'COMMUTE',
                passengerType: 'STAFF',
                vehicleType: 'BUS_29',
                pricingScope: 'STANDARD',
                effectiveFrom: new Date().toISOString().slice(0, 10),
                effectiveTo: '',
                rules: [
                  {
                    ruleCode: 'MONTHLY_BASE',
                    rateType: 'MONTHLY_PACKAGE',
                    dayType: 'WEEKDAY',
                    dailyTripCount: 2,
                    includedDistanceKm: '1500',
                    unitPrice: '26000000',
                    priceUnit: 'VND/MONTH',
                    description: 'Trọn gói tháng tiêu chuẩn',
                  },
                ],
              }),
          }}
        />
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-md text-xs flex items-center gap-2 mb-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 1: POINTS TABLE (046-master-data.png) */}
      {/* ==================================================================== */}
      {activeTab === 'POINTS' && (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] text-[#1f2937] font-semibold">
                  <th className="px-2.5 w-[4%]">#</th>
                  <th className="px-2.5 w-[8.5%]">Mã điểm</th>
                  <th className="px-2.5 w-[19.5%]">Tên điểm</th>
                  <th className="px-2.5 w-[13.5%]">Quận/huyện</th>
                  <th className="px-2.5 w-[26.5%]">Địa chỉ</th>
                  <th className="px-2.5 w-[7%]">Loại</th>
                  <th className="px-2.5 w-[10.5%]">Số lượng chặng</th>
                  <th className="px-2.5 w-[10.5%]">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb]">
                {points.map((pt, idx) => (
                  <tr
                    key={pt.id}
                    onClick={(e) =>
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        items: [
                          {
                            label: 'Sửa',
                            icon: <Edit3 className="w-3.5 h-3.5" />,
                            onClick: () => setPointModal({ ...pt }),
                          },
                          {
                            label: 'Bật/tắt hoạt động',
                            icon: <Power className="w-3.5 h-3.5" />,
                            onClick: () => handleTogglePointActive(pt),
                          },
                          {
                            label: 'Xóa',
                            icon: <Trash2 className="w-3.5 h-3.5" />,
                            danger: true,
                            disabled: pt.segmentUsageCount > 0,
                            onClick: () => handleDeletePoint(pt),
                          },
                        ],
                      })
                    }
                    className="hover:bg-[#f9fafb] cursor-pointer transition-colors"
                  >
                    <td className="px-2.5 text-[#374151]">{idx + 1}</td>
                    <td className="px-2.5 text-[#1f2937] truncate">{pt.pointCode}</td>
                    <td className="px-2.5 text-[#1f2937] truncate">{pt.pointName}</td>
                    <td className="px-2.5 text-[#374151] truncate">{pt.districtName || ''}</td>
                    <td className="px-2.5 text-[#374151] truncate">{pt.address || ''}</td>
                    <td className="px-2.5">
                      {pt.pointType === 'BOTH' ? (
                        <PastelBadge variant="purple">Cả hai</PastelBadge>
                      ) : pt.pointType === 'PICKUP' ? (
                        <PastelBadge variant="green">Đón</PastelBadge>
                      ) : (
                        <PastelBadge variant="orange">Trả</PastelBadge>
                      )}
                    </td>
                    <td className="px-2.5 text-[#1f2937]">{pt.segmentUsageCount ?? 0}</td>
                    <td className="px-2.5">
                      {pt.activeFlag === 'Y' ? (
                        <PastelBadge variant="green">Hoạt động</PastelBadge>
                      ) : (
                        <PastelBadge variant="gray">Không hoạt động</PastelBadge>
                      )}
                    </td>
                  </tr>
                ))}
                {points.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-gray-400">
                      Không có dữ liệu điểm đón/trả
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <LegacyPagination totalItems={points.length} />
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: DRIVERS TABLE (051-driver-management.png) */}
      {/* ==================================================================== */}
      {activeTab === 'DRIVERS' && (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] text-[#1f2937] font-semibold">
                  <th className="px-2.5 w-[4.5%]">#</th>
                  <th className="px-2.5 w-[16%]">Họ tên</th>
                  <th className="px-2.5 w-[15%]">Tài khoản đăng nhập</th>
                  <th className="px-2.5 w-[12%]">Số điện thoại</th>
                  <th className="px-2.5 w-[15%]">Địa chỉ ngắn</th>
                  <th className="px-2.5 w-[26.5%]">Địa chỉ đầy đủ</th>
                  <th className="px-2.5 w-[11%]">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb]">
                {drivers.map((drv, idx) => (
                  <tr
                    key={drv.id}
                    onClick={(e) =>
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        items: [
                          {
                            label: 'Chỉnh sửa tài xế',
                            icon: <Edit3 className="w-3.5 h-3.5" />,
                            onClick: () =>
                              setDriverModal({
                                ...drv,
                                accountMode: drv.identityUserId ? 'LINK_EXISTING' : 'NONE',
                                identityUserId: drv.identityUserId || '',
                                newUsername: '',
                                newPassword: '',
                              }),
                          },
                          {
                            label: 'Xóa tài xế',
                            icon: <Trash2 className="w-3.5 h-3.5" />,
                            danger: true,
                            disabled: drv.segmentUsageCount > 0,
                            onClick: () => handleDeleteDriver(drv),
                          },
                        ],
                      })
                    }
                    className="hover:bg-[#f9fafb] cursor-pointer transition-colors"
                  >
                    <td className="px-2.5 text-[#374151]">{idx + 1}</td>
                    <td className="px-2.5 text-[#1f2937] truncate">{drv.driverName}</td>
                    <td className="px-2.5">
                      {drv.user || drv.identityUserId ? (
                        <PastelBadge variant="green">Đã liên kết</PastelBadge>
                      ) : (
                        <PastelBadge variant="gray">Chưa liên kết</PastelBadge>
                      )}
                    </td>
                    <td className="px-2.5 text-[#374151] truncate">{drv.phoneNumber}</td>
                    <td className="px-2.5 text-[#374151] truncate">{drv.shortAddress || '—'}</td>
                    <td className="px-2.5 text-[#374151] truncate">
                      {drv.fullAddress || drv.shortAddress || '—'}
                    </td>
                    <td className="px-2.5">
                      {drv.activeFlag === 'Y' ? (
                        <PastelBadge variant="green">Hoạt động</PastelBadge>
                      ) : (
                        <PastelBadge variant="gray">Không hoạt động</PastelBadge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <LegacyPagination totalItems={drivers.length} />
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: VEHICLES TABLE (053-vehicle-management.png) */}
      {/* ==================================================================== */}
      {activeTab === 'VEHICLES' && (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] text-[#1f2937] font-semibold">
                  <th className="px-2.5 w-[4%]">#</th>
                  <th className="px-2.5 w-[10%]">Biển số</th>
                  <th className="px-2.5 w-[16%]">Nhà cung cấp</th>
                  <th className="px-2.5 w-[10%]">Loại xe</th>
                  <th className="px-2.5 w-[7%]">Số ghế</th>
                  <th className="px-2.5 w-[10%]">Loại sở hữu</th>
                  <th className="px-2.5 w-[13%]">Tiền thuê cơ bản</th>
                  <th className="px-2.5 w-[10%]">Số chuyến/ngày</th>
                  <th className="px-2.5 w-[10%]">Km tối đa</th>
                  <th className="px-2.5 w-[10%]">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb]">
                {vehicles.map((v, idx) => (
                  <tr
                    key={v.id}
                    onClick={(e) =>
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        items: [
                          {
                            label: 'Chỉnh sửa xe',
                            icon: <Edit3 className="w-3.5 h-3.5" />,
                            onClick: () => setVehicleModal({ ...v }),
                          },
                          {
                            label: 'Xóa xe',
                            icon: <Trash2 className="w-3.5 h-3.5" />,
                            danger: true,
                            disabled: v.segmentUsageCount > 0,
                            onClick: () => handleDeleteVehicle(v),
                          },
                        ],
                      })
                    }
                    className="hover:bg-[#f9fafb] cursor-pointer transition-colors"
                  >
                    <td className="px-2.5 text-[#374151]">{idx + 1}</td>
                    <td className="px-2.5 text-[#1f2937] truncate">{v.vehiclePlate}</td>
                    <td className="px-2.5 text-[#374151] truncate">
                      {v.vendor?.vendorName || 'Công ty TNHH MTV Dịch Vụ Vận Tải Bảo Lâm'}
                    </td>
                    <td className="px-2.5 text-[#374151] truncate">
                      {renderVehicleTypeLabel(v.vehicleType)}
                    </td>
                    <td className="px-2.5 text-[#374151]">{v.seatCapacity}</td>
                    <td className="px-2.5">
                      <PastelBadge variant={v.ownershipType === 'COMPANY' ? 'blue' : 'yellow'}>
                        {v.ownershipType === 'COMPANY' ? 'Nội bộ' : 'Thuê ngoài'}
                      </PastelBadge>
                    </td>
                    <td className="px-2.5 text-[#374151] truncate">
                      {v.commutePackageMode === 'BY_SEGMENT'
                        ? 'Theo số chặng'
                        : 'Giá thuê cơ bản'}
                    </td>
                    <td className="px-2.5 text-[#374151] truncate">
                      {v.commutePackageMode === 'BY_SEGMENT' && v.dailyTripQuota
                        ? `${v.dailyTripQuota} chuyến`
                        : '—'}
                    </td>
                    <td className="px-2.5 text-[#374151] truncate">
                      {v.commutePackageMode === 'BY_SEGMENT' && v.monthlyKmQuota
                        ? `Tối đa ${v.monthlyKmQuota} km`
                        : '—'}
                    </td>
                    <td className="px-2.5">
                      {v.activeFlag === 'Y' ? (
                        <PastelBadge variant="green">Hoạt động</PastelBadge>
                      ) : (
                        <PastelBadge variant="gray">Không hoạt động</PastelBadge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <LegacyPagination totalItems={vehicles.length} />
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: LEG DEFINITIONS TABLE (054-legs-management.png) */}
      {/* ==================================================================== */}
      {activeTab === 'LEGS' && (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] text-[#1f2937] font-semibold">
                  <th className="px-2.5 w-[4.5%]">#</th>
                  <th className="px-2.5 w-[10%]">Lượt chạy</th>
                  <th className="px-2.5 w-[27.5%]">Tên lượt</th>
                  <th className="px-2.5 w-[13%]">Loại hành khách</th>
                  <th className="px-2.5 w-[11%]">Thứ tự hiển thị</th>
                  <th className="px-2.5 w-[13%]">Hướng</th>
                  <th className="px-2.5 w-[10%]">Chạy rỗng</th>
                  <th className="px-2.5 w-[11%]">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb]">
                {legs.map((leg, idx) => (
                  <tr
                    key={leg.id}
                    onClick={(e) =>
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        items: [
                          {
                            label: 'Chỉnh sửa lượt chạy',
                            icon: <Edit3 className="w-3.5 h-3.5" />,
                            onClick: () => setLegModal({ ...leg }),
                          },
                          {
                            label: 'Xóa lượt chạy',
                            icon: <Trash2 className="w-3.5 h-3.5" />,
                            danger: true,
                            disabled: leg.segmentUsageCount > 0,
                            onClick: () => handleDeleteLeg(leg),
                          },
                        ],
                      })
                    }
                    className="hover:bg-[#f9fafb] cursor-pointer transition-colors"
                  >
                    <td className="px-2.5 text-[#374151]">{idx + 1}</td>
                    <td className="px-2.5 text-[#1f2937] truncate">{leg.legCode}</td>
                    <td className="px-2.5 text-[#374151] truncate">{leg.legName}</td>
                    <td className="px-2.5">{renderPassengerTypeBadge(leg.passengerType)}</td>
                    <td className="px-2.5 text-[#374151]">{leg.displayOrder}</td>
                    <td className="px-2.5">
                      <PastelBadge variant={leg.direction === 'TO_FACTORY' ? 'blue' : 'yellow'}>
                        {leg.direction === 'TO_FACTORY' ? 'Đón đến công ty' : 'Trả về'}
                      </PastelBadge>
                    </td>
                    <td className="px-2.5 text-[#6b7280]">
                      {leg.isDeadhead === 'Y' ? <PastelBadge variant="purple">Có</PastelBadge> : '—'}
                    </td>
                    <td className="px-2.5">
                      <PastelBadge variant="green">Hoạt động</PastelBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <LegacyPagination totalItems={legs.length} />
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: ROUTES TABLE (054-route-list.png) */}
      {/* ==================================================================== */}
      {activeTab === 'ROUTES' && (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] text-[#1f2937] font-semibold">
                  <th className="px-2.5 w-[4.5%]">#</th>
                  <th className="px-2.5 w-[40.5%]">Tên tuyến</th>
                  <th className="px-2.5 w-[13%]">Loại hành khách</th>
                  <th className="px-2.5 w-[13%]">Loại tuyến</th>
                  <th className="px-2.5 w-[16%]">Ngày có kế hoạch xe</th>
                  <th className="px-2.5 w-[13%]">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb]">
                {routes.map((rt, idx) => (
                  <tr
                    key={rt.id}
                    onClick={() => openRouteEditModal(rt)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        items: [
                          {
                            label: 'Sửa',
                            icon: <Edit3 className="w-3.5 h-3.5" />,
                            onClick: () => openRouteEditModal(rt),
                          },
                        ],
                      });
                    }}
                    className="hover:bg-[#f9fafb] cursor-pointer transition-colors"
                  >
                    <td className="px-2.5 text-[#374151]">{idx + 1}</td>
                    <td className="px-2.5 text-[#1f2937] truncate">{rt.routeName}</td>
                    <td className="px-2.5">
                      {renderPassengerTypeBadge(rt.passengerType)}
                    </td>
                    <td className="px-2.5">
                      <PastelBadge variant="green">Tuyến cố định</PastelBadge>
                    </td>
                    <td className="px-2.5 text-[#374151] truncate">
                      {renderRunDaysLabel(rt.runDays)}
                    </td>
                    <td className="px-2.5">
                      {rt.activeFlag === 'Y' ? (
                        <PastelBadge variant="green">Hoạt động</PastelBadge>
                      ) : (
                        <PastelBadge variant="gray">Không hoạt động</PastelBadge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <LegacyPagination totalItems={routes.length} />
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 6: ETP TABLE (062-master-data-route-workers-list-context.png) */}
      {/* ==================================================================== */}
      {activeTab === 'ETP' && (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] text-[#1f2937] font-semibold">
                  <th className="px-2 w-[3%] text-center">
                    <input type="checkbox" className="rounded border-gray-300" />
                  </th>
                  <th className="px-2 w-[3.5%]">#</th>
                  <th className="px-2 w-[7.5%]">Mã nhân viên</th>
                  <th className="px-2 w-[11%]">Tên nhân viên</th>
                  <th className="px-2 w-[13%]">Phòng ban</th>
                  <th className="px-2 w-[9.5%]">Trạng thái hoạt động</th>
                  <th className="px-2 w-[15.5%]">Tuyến đang hoạt động</th>
                  <th className="px-2 w-[8.5%]">Loại hành khách</th>
                  <th className="px-2 w-[10%]">Trạng thái phê duyệt</th>
                  <th className="px-2 w-[8.5%]">Yêu cầu bởi</th>
                  <th className="px-2 w-[10%]">Thời điểm yêu cầu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb]">
                {etpProfiles
                  .filter((etp) => !etpRouteFilter || etp.route?.id === etpRouteFilter)
                  .map((etp, idx) => (
                    <tr
                      key={etp.id}
                      onClick={(e) =>
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          items: [
                            ...(etp.approvalStatus === 'PENDING'
                              ? [
                                  {
                                    label: 'Chấp thuận',
                                    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
                                    onClick: () => handleApproveEtp(etp),
                                  },
                                  {
                                    label: 'Từ chối',
                                    icon: <XCircle className="w-3.5 h-3.5 text-red-600" />,
                                    danger: true,
                                    onClick: () => handleRejectEtp(etp),
                                  },
                                ]
                              : []),
                            ...(etp.approvalStatus === 'APPROVED' && etp.activeFlag === 'Y'
                              ? [
                                  {
                                    label: 'Ngừng sử dụng xe',
                                    icon: <Power className="w-3.5 h-3.5 text-amber-600" />,
                                    onClick: () =>
                                      setEtpDeactivateModal({
                                        id: etp.id,
                                        empName: etp.employee?.fullName || etp.provFullName,
                                        effectiveFrom: etp.effectiveFrom,
                                        effectiveTo: new Date().toISOString().slice(0, 10),
                                      }),
                                  },
                                ]
                              : []),
                            {
                              label: 'Lịch sử đăng ký',
                              icon: <History className="w-3.5 h-3.5" />,
                              onClick: () => openEtpHistory(etp),
                            },
                          ],
                        })
                      }
                      className="hover:bg-[#f9fafb] cursor-pointer transition-colors"
                    >
                      <td className="px-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className="rounded border-gray-300" />
                      </td>
                      <td className="px-2 text-[#374151]">{idx + 1}</td>
                      <td className="px-2 text-[#374151] truncate">
                        {etp.employee?.empCode || etp.provTempCode || '—'}
                      </td>
                      <td className="px-2 text-[#1f2937] truncate">
                        {etp.employee?.fullName || etp.provFullName}
                      </td>
                      <td className="px-2 text-[#374151] truncate">
                        {etp.employee?.orgUnit?.name || '—'}
                      </td>
                      <td className="px-2">
                        {etp.activeFlag === 'Y' ? (
                          <PastelBadge variant="green">Hoạt động</PastelBadge>
                        ) : (
                          <PastelBadge variant="red">Không hoạt động</PastelBadge>
                        )}
                      </td>
                      <td className="px-2 text-[#374151] truncate">{etp.route?.routeName || '—'}</td>
                      <td className="px-2">
                        {renderPassengerTypeBadge(etp.route?.passengerType || 'WORKER')}
                      </td>
                      <td className="px-2">
                        {etp.approvalStatus === 'APPROVED' ? (
                          <PastelBadge variant="green">Đã phê duyệt</PastelBadge>
                        ) : etp.approvalStatus === 'REJECTED' ? (
                          <PastelBadge variant="red">Từ chối</PastelBadge>
                        ) : (
                          <PastelBadge variant="yellow">Đang chờ phê duyệt</PastelBadge>
                        )}
                      </td>
                      <td className="px-2 text-[#374151] truncate">
                        {etp.approvalStatus === 'PENDING' ? 'testDepartment' : '—'}
                      </td>
                      <td className="px-2 text-[#374151] truncate">
                        {etp.effectiveFrom || '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <LegacyPagination totalItems={etpProfiles.length} />
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 7: COST CONFIGS TABLE (067-cost-config.png) */}
      {/* ==================================================================== */}
      {activeTab === 'COST_CONFIGS' && (
        <div>
          <div className="overflow-x-auto border-t border-[#e5e7eb]">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#f9fafb] border-b border-[#e5e7eb] text-[#374151] font-semibold">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Phiên bản</th>
                  <th className="py-2.5 px-3">Loại</th>
                  <th className="py-2.5 px-3">Hành khách</th>
                  <th className="py-2.5 px-3">Phạm vi tính giá</th>
                  <th className="py-2.5 px-3">Xe</th>
                  <th className="py-2.5 px-3 text-center">Quy tắc</th>
                  <th className="py-2.5 px-3">Giá chính</th>
                  <th className="py-2.5 px-3">Hạn mức KM / tháng</th>
                  <th className="py-2.5 px-3">Đơn giá KM vượt</th>
                  <th className="py-2.5 px-3">Giá OT / giờ</th>
                  <th className="py-2.5 px-3">Giá lưu đêm</th>
                  <th className="py-2.5 px-3">Áp dụng từ</th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6]">
                {costConfigs.map((cfg, idx) => {
                  const rules: any[] = cfg.rules || [];
                  const mainRule =
                    rules.find(
                      (r) =>
                        r.rateType === 'MONTHLY_PACKAGE' ||
                        r.rateType === 'TRIP_FIXED' ||
                        r.rateType === 'PER_KM'
                    ) || rules[0];
                  const overKmRule = rules.find((r) => r.rateType === 'EXCESS_KM');
                  const otHourRule = rules.find((r) => r.rateType === 'OT_HOUR');
                  const overnightRule = rules.find((r) => r.rateType === 'OVERNIGHT');

                  return (
                    <tr
                      key={cfg.id}
                      onClick={(e) =>
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          items: [
                            {
                              label: 'Tạo phiên bản mới từ cấu hình này',
                              icon: <Plus className="w-3.5 h-3.5" />,
                              onClick: () =>
                                setCostConfigModal({
                                  versionCode: `${cfg.versionCode}-COPY`,
                                  configType: cfg.configType,
                                  passengerType: cfg.passengerType,
                                  vehicleType: cfg.vehicleType,
                                  pricingScope: cfg.pricingScope || 'STANDARD',
                                  effectiveFrom: new Date().toISOString().slice(0, 10),
                                  effectiveTo: '',
                                  rules: (cfg.rules || []).map((r: any) => ({
                                    ruleCode: r.ruleCode,
                                    rateType: r.rateType,
                                    dayType: r.dayType || 'WEEKDAY',
                                    dailyTripCount: r.dailyTripCount || 2,
                                    includedDistanceKm: r.includedDistanceKm || '',
                                    unitPrice: r.unitPrice || '0',
                                    priceUnit: r.priceUnit || 'VND/TRIP',
                                    description: r.description || '',
                                  })),
                                }),
                            },
                          ],
                        })
                      }
                      className="hover:bg-[#f9fafb] cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3 text-center text-[#6b7280]">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-medium text-[#111827]">{cfg.versionCode}</td>
                      <td className="py-2.5 px-3">
                        {cfg.configType === 'COMMUTE' ? (
                          <PastelBadge variant="purple">Đưa đón</PastelBadge>
                        ) : (
                          <PastelBadge variant="blue">Tăng cường</PastelBadge>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {renderPassengerTypeBadge(cfg.passengerType)}
                      </td>
                      <td className="py-2.5 px-3">
                        {cfg.pricingScope === 'PROVINCE_SURCHARGE' ? (
                          <PastelBadge variant="yellow">Phụ phí đi tỉnh</PastelBadge>
                        ) : cfg.configType === 'EXTRA' ? (
                          <PastelBadge variant="blue">Bảng giá chuẩn</PastelBadge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[#374151]">
                        {renderVehicleTypeLabel(cfg.vehicleType)}
                      </td>
                      <td className="py-2.5 px-3 text-center text-[#374151]">{rules.length}</td>
                      <td className="py-2.5 px-3 text-[#111827]">
                        {mainRule
                          ? `${formatVnd(mainRule.unitPrice)} / ${
                              mainRule.rateType === 'MONTHLY_PACKAGE'
                                ? 'tháng'
                                : mainRule.rateType === 'PER_KM'
                                  ? 'km'
                                  : 'chuyến'
                            }`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-[#374151]">
                        {mainRule?.includedDistanceKm
                          ? `${Number(mainRule.includedDistanceKm).toLocaleString('vi-VN')} km`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-[#374151]">
                        {overKmRule ? `${formatVnd(overKmRule.unitPrice)} / km` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-[#374151]">
                        {otHourRule ? `${formatVnd(otHourRule.unitPrice)} / giờ` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-[#374151]">
                        {overnightRule ? `${formatVnd(overnightRule.unitPrice)} / đêm` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-[#374151]">{cfg.effectiveFrom}</td>
                      <td className="py-2.5 px-3">
                        <PastelBadge variant="green">Hoạt động</PastelBadge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <LegacyPagination totalItems={costConfigs.length} />
        </div>
      )}

      {contextMenu && (
        <RowContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: ADD / EDIT POINT */}
      {/* ==================================================================== */}
      {pointModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSavePoint}
            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {pointModal.id ? 'Cập nhật điểm đón/trả' : 'Thêm điểm đón/trả mới'}
              </h3>
              <button
                type="button"
                onClick={() => setPointModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mã điểm *</label>
                <input
                  type="text"
                  required
                  disabled={Boolean(pointModal.id)}
                  value={pointModal.pointCode}
                  onChange={(e) =>
                    setPointModal({ ...pointModal, pointCode: e.target.value.toUpperCase() })
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 disabled:bg-slate-100"
                  placeholder="VD: PT_CAUGIAY"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên điểm đón/trả *</label>
                <input
                  type="text"
                  required
                  value={pointModal.pointName}
                  onChange={(e) => setPointModal({ ...pointModal, pointName: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  placeholder="VD: BigC Thăng Long"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Loại điểm *</label>
                  <select
                    value={pointModal.pointType}
                    onChange={(e) => setPointModal({ ...pointModal, pointType: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  >
                    <option value="PICKUP">Điểm đón (PICKUP)</option>
                    <option value="DROPOFF">Điểm trả (DROPOFF)</option>
                    <option value="BOTH">Đón & Trả (BOTH)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Là nhà máy?</label>
                  <select
                    value={pointModal.isFactory || 'N'}
                    onChange={(e) => setPointModal({ ...pointModal, isFactory: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  >
                    <option value="N">Không</option>
                    <option value="Y">Là Nhà máy MKVC</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quận / Huyện</label>
                <input
                  type="text"
                  value={pointModal.districtName || ''}
                  onChange={(e) => setPointModal({ ...pointModal, districtName: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Địa chỉ chi tiết</label>
                <input
                  type="text"
                  value={pointModal.address || ''}
                  onChange={(e) => setPointModal({ ...pointModal, address: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPointModal(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer"
              >
                Lưu điểm đón/trả
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: ADD / EDIT DRIVER (3 ACCOUNT MODES) */}
      {/* ==================================================================== */}
      {driverModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveDriver}
            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {driverModal.id ? 'Cập nhật tài xế' : 'Thêm tài xế mới'}
              </h3>
              <button
                type="button"
                onClick={() => setDriverModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Họ tên tài xế *</label>
                <input
                  type="text"
                  required
                  value={driverModal.driverName}
                  onChange={(e) => setDriverModal({ ...driverModal, driverName: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Số điện thoại *</label>
                <input
                  type="text"
                  required
                  value={driverModal.phoneNumber}
                  onChange={(e) => setDriverModal({ ...driverModal, phoneNumber: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Địa chỉ ngắn</label>
                <input
                  type="text"
                  value={driverModal.shortAddress || ''}
                  onChange={(e) => setDriverModal({ ...driverModal, shortAddress: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Chế độ tài khoản đăng nhập (3 chế độ chuẩn Tester)
                </label>
                <select
                  value={driverModal.accountMode || 'NONE'}
                  onChange={(e) => setDriverModal({ ...driverModal, accountMode: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 font-medium"
                >
                  <option value="NONE">1. Không sử dụng tài khoản (NONE)</option>
                  <option value="LINK_EXISTING">2. Liên kết tài khoản sẵn có (LINK_EXISTING)</option>
                  <option value="CREATE_NEW">3. Tạo tài khoản mới (CREATE_NEW)</option>
                </select>
              </div>

              {driverModal.accountMode === 'LINK_EXISTING' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Chọn tài khoản người dùng *
                  </label>
                  <select
                    required
                    value={driverModal.identityUserId || ''}
                    onChange={(e) =>
                      setDriverModal({ ...driverModal, identityUserId: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  >
                    <option value="">-- Chọn tài khoản --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username} - {u.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {driverModal.accountMode === 'CREATE_NEW' && (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-blue-50/60 border border-blue-200">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Username mới *</label>
                    <input
                      type="text"
                      required
                      value={driverModal.newUsername || ''}
                      onChange={(e) =>
                        setDriverModal({ ...driverModal, newUsername: e.target.value })
                      }
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Mật khẩu *</label>
                    <input
                      type="password"
                      required
                      value={driverModal.newPassword || ''}
                      onChange={(e) =>
                        setDriverModal({ ...driverModal, newPassword: e.target.value })
                      }
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDriverModal(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer"
              >
                Lưu tài xế
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: ADD / EDIT VEHICLE (AUTO CAPACITY & BY_SEGMENT QUOTAS) */}
      {/* ==================================================================== */}
      {vehicleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveVehicle}
            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {vehicleModal.id ? 'Cập nhật xe' : 'Thêm xe mới'}
              </h3>
              <button
                type="button"
                onClick={() => setVehicleModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Biển số xe *</label>
                <input
                  type="text"
                  required
                  value={vehicleModal.vehiclePlate}
                  onChange={(e) =>
                    setVehicleModal({
                      ...vehicleModal,
                      vehiclePlate: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono"
                  placeholder="VD: 29B-123.45"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Loại xe *</label>
                  <select
                    value={vehicleModal.vehicleType}
                    onChange={(e) => {
                      const vt = e.target.value;
                      setVehicleModal({
                        ...vehicleModal,
                        vehicleType: vt,
                        seatCapacity: VEHICLE_CAPACITY_MAP[vt] ?? 28,
                      });
                    }}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  >
                    <option value="VAN_16">Xe 16 chỗ (VAN_16)</option>
                    <option value="BUS_29">Xe 29 chỗ (BUS_29)</option>
                    <option value="BUS_45">Xe 45 chỗ (BUS_45)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Số ghế chở khách (Tự điền)
                  </label>
                  <input
                    type="number"
                    readOnly
                    value={
                      VEHICLE_CAPACITY_MAP[vehicleModal.vehicleType] ??
                      vehicleModal.seatCapacity ??
                      28
                    }
                    className="w-full border border-slate-200 bg-slate-100 rounded-lg px-3 py-2 font-bold text-blue-700"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Phương thức tính cước xe tuyến
                </label>
                <select
                  value={vehicleModal.commutePackageMode || 'BY_ROUTE'}
                  onChange={(e) =>
                    setVehicleModal({ ...vehicleModal, commutePackageMode: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                >
                  <option value="BY_ROUTE">Trọn gói theo tuyến (BY_ROUTE)</option>
                  <option value="BY_SEGMENT">Theo số lượt & định mức KM (BY_SEGMENT)</option>
                </select>
              </div>

              {vehicleModal.commutePackageMode === 'BY_SEGMENT' && (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <div>
                    <label className="block font-semibold text-amber-900 mb-1">
                      Số lượt / ngày *
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={vehicleModal.dailyTripQuota || ''}
                      onChange={(e) =>
                        setVehicleModal({ ...vehicleModal, dailyTripQuota: e.target.value })
                      }
                      className="w-full border border-amber-300 rounded-lg px-2.5 py-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-amber-900 mb-1">
                      KM tối đa / tháng *
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={vehicleModal.monthlyKmQuota || ''}
                      onChange={(e) =>
                        setVehicleModal({ ...vehicleModal, monthlyKmQuota: e.target.value })
                      }
                      className="w-full border border-amber-300 rounded-lg px-2.5 py-1.5 bg-white"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setVehicleModal(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer"
              >
                Lưu thông tin xe
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: ADD / EDIT LEG DEFINITION (DEADHEAD LOCKS TO_FACTORY) */}
      {/* ==================================================================== */}
      {legModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveLeg}
            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {legModal.id ? 'Cập nhật lượt chạy' : 'Thêm lượt chạy mới'}
              </h3>
              <button
                type="button"
                onClick={() => setLegModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mã lượt *</label>
                  <input
                    type="text"
                    required
                    value={legModal.legCode}
                    onChange={(e) =>
                      setLegModal({ ...legModal, legCode: e.target.value.toUpperCase() })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono"
                    placeholder="VD: SANG_DON"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Thứ tự hiển thị</label>
                  <input
                    type="number"
                    value={legModal.displayOrder}
                    onChange={(e) => setLegModal({ ...legModal, displayOrder: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên lượt chạy *</label>
                <input
                  type="text"
                  required
                  value={legModal.legName}
                  onChange={(e) => setLegModal({ ...legModal, legName: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  placeholder="VD: Đón ca sáng"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Loại hành khách *
                  </label>
                  <select
                    value={legModal.passengerType}
                    onChange={(e) => setLegModal({ ...legModal, passengerType: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  >
                    <option value="STAFF">Nhân viên (STAFF)</option>
                    <option value="WORKER">Công nhân (WORKER)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Chạy rỗng (Deadhead)
                  </label>
                  <select
                    value={legModal.isDeadhead}
                    onChange={(e) => {
                      const deadhead = e.target.value;
                      setLegModal({
                        ...legModal,
                        isDeadhead: deadhead,
                        direction: deadhead === 'Y' ? 'TO_FACTORY' : legModal.direction,
                      });
                    }}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  >
                    <option value="N">Không (Chở khách)</option>
                    <option value="Y">Có (Chạy rỗng)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Hướng di chuyển {legModal.isDeadhead === 'Y' && '(Tự khóa Đến nhà máy khi chạy rỗng)'}
                </label>
                <select
                  disabled={legModal.isDeadhead === 'Y'}
                  value={legModal.isDeadhead === 'Y' ? 'TO_FACTORY' : legModal.direction}
                  onChange={(e) => setLegModal({ ...legModal, direction: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 disabled:bg-slate-100"
                >
                  <option value="TO_FACTORY">Đến nhà máy (TO_FACTORY)</option>
                  <option value="FROM_FACTORY">Từ nhà máy về (FROM_FACTORY)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setLegModal(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer"
              >
                Lưu lượt chạy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 5: ADD / EDIT ROUTE + SEGMENTS + WORKER VEHICLES */}
      {/* ==================================================================== */}
      {routeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveRoute}
            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-3xl p-5 space-y-4 my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {routeModal.id ? 'Cập nhật Tuyến & Chặng' : 'Thêm Tuyến xe cố định mới'}
              </h3>
              <button
                type="button"
                onClick={() => setRouteModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mã tuyến *</label>
                <input
                  type="text"
                  required
                  disabled={Boolean(routeModal.id)}
                  value={routeModal.routeCode}
                  onChange={(e) =>
                    setRouteModal({ ...routeModal, routeCode: e.target.value.toUpperCase() })
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono disabled:bg-slate-100"
                  placeholder="VD: RT_HN_01"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Tên tuyến *</label>
                <input
                  type="text"
                  required
                  value={routeModal.routeName}
                  onChange={(e) => setRouteModal({ ...routeModal, routeName: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  placeholder="VD: Tuyến Cầu Giấy - Nhà máy MKVC"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Loại hành khách *</label>
                <select
                  value={routeModal.passengerType}
                  onChange={(e) => {
                    const pt = e.target.value;
                    setRouteModal({
                      ...routeModal,
                      passengerType: pt,
                      runDays: pt === 'WORKER' ? 'MON_SUN' : routeModal.runDays,
                    });
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                >
                  <option value="STAFF">Nhân viên (STAFF)</option>
                  <option value="WORKER">Công nhân (WORKER)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ngày có kế hoạch xe
                </label>
                <select
                  disabled={routeModal.passengerType === 'WORKER'}
                  value={
                    routeModal.passengerType === 'WORKER' ? 'MON_SUN' : routeModal.runDays
                  }
                  onChange={(e) => setRouteModal({ ...routeModal, runDays: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 disabled:bg-slate-100"
                >
                  <option value="MON_FRI">Thứ 2 - Thứ 6 (MON_FRI)</option>
                  <option value="MON_SAT">Thứ 2 - Thứ 7 (MON_SAT)</option>
                  <option value="MON_SUN">Cả tuần (MON_SUN)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phân loại tuyến</label>
                <input
                  type="text"
                  readOnly
                  value="FIXED_ROUTE (Cố định)"
                  className="w-full border border-slate-200 bg-slate-100 rounded-lg px-3 py-2 text-slate-600"
                />
              </div>
            </div>

            {/* Worker Route Vehicles Block */}
            {routeModal.passengerType === 'WORKER' && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900">
                    Xe chạy chuyến này (Dành cho tuyến Công nhân)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setRouteModal({
                        ...routeModal,
                        routeVehicles: [
                          ...(routeModal.routeVehicles || []),
                          { vehicleId: vehicles[0]?.id || '', driverId: drivers[0]?.id || '' },
                        ],
                      })
                    }
                    className="px-2.5 py-1 rounded bg-amber-600 text-white font-semibold hover:bg-amber-700 cursor-pointer"
                  >
                    + Thêm xe vào tuyến
                  </button>
                </div>
                {(routeModal.routeVehicles || []).map((rv: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <select
                        value={rv.vehicleId}
                        onChange={(e) => {
                          const next = [...routeModal.routeVehicles];
                          next[idx] = { ...next[idx], vehicleId: e.target.value };
                          setRouteModal({ ...routeModal, routeVehicles: next });
                        }}
                        className="w-full border border-amber-300 rounded px-2 py-1.5 bg-white"
                      >
                        <option value="">-- Chọn xe --</option>
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.vehiclePlate} ({v.seatCapacity} ghế)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-6">
                      <select
                        value={rv.driverId || ''}
                        onChange={(e) => {
                          const next = [...routeModal.routeVehicles];
                          next[idx] = { ...next[idx], driverId: e.target.value };
                          setRouteModal({ ...routeModal, routeVehicles: next });
                        }}
                        className="w-full border border-amber-300 rounded px-2 py-1.5 bg-white"
                      >
                        <option value="">-- Chọn tài xế --</option>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.driverName} ({d.phoneNumber})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          const next = routeModal.routeVehicles.filter(
                            (_: any, i: number) => i !== idx
                          );
                          setRouteModal({ ...routeModal, routeVehicles: next });
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Route Segments Builder */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">
                  Danh sách Chặng / Lượt của tuyến ({routeModal.segments?.length || 0})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setRouteModal({
                      ...routeModal,
                      segments: [
                        ...(routeModal.segments || []),
                        {
                          legCode: `SANG_${(routeModal.segments?.length || 0) + 1}`,
                          legName: 'Chặng đón sáng',
                          direction: 'TO_FACTORY',
                          departureTime: '06:30',
                          arrivalTime: '07:30',
                          defaultVehicleId: vehicles[0]?.id || '',
                          defaultDriverId: drivers[0]?.id || '',
                          pickupPointIds: points[0] ? [points[0].id] : [],
                          dropoffPointIds: points[1] ? [points[1].id] : [],
                          shiftIds: shifts[0] ? [shifts[0].id] : [],
                        },
                      ],
                    })
                  }
                  className="px-2.5 py-1 rounded bg-slate-900 text-white font-semibold hover:bg-slate-800 cursor-pointer"
                >
                  + Thêm chặng
                </button>
              </div>

              {(routeModal.segments || []).map((seg: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2"
                >
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <input
                      type="text"
                      placeholder="Mã lượt"
                      value={seg.legCode}
                      onChange={(e) => {
                        const next = [...routeModal.segments];
                        next[idx] = { ...next[idx], legCode: e.target.value };
                        setRouteModal({ ...routeModal, segments: next });
                      }}
                      className="border border-slate-300 rounded px-2 py-1 bg-white font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Tên chặng"
                      value={seg.legName}
                      onChange={(e) => {
                        const next = [...routeModal.segments];
                        next[idx] = { ...next[idx], legName: e.target.value };
                        setRouteModal({ ...routeModal, segments: next });
                      }}
                      className="border border-slate-300 rounded px-2 py-1 bg-white"
                    />
                    <select
                      value={seg.direction}
                      onChange={(e) => {
                        const next = [...routeModal.segments];
                        next[idx] = { ...next[idx], direction: e.target.value };
                        setRouteModal({ ...routeModal, segments: next });
                      }}
                      className="border border-slate-300 rounded px-2 py-1 bg-white"
                    >
                      <option value="TO_FACTORY">Đến nhà máy</option>
                      <option value="FROM_FACTORY">Từ nhà máy</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Giờ đi (06:30)"
                      value={seg.departureTime}
                      onChange={(e) => {
                        const next = [...routeModal.segments];
                        next[idx] = { ...next[idx], departureTime: e.target.value };
                        setRouteModal({ ...routeModal, segments: next });
                      }}
                      className="border border-slate-300 rounded px-2 py-1 bg-white font-mono"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="Giờ đến (07:30)"
                        value={seg.arrivalTime}
                        onChange={(e) => {
                          const next = [...routeModal.segments];
                          next[idx] = { ...next[idx], arrivalTime: e.target.value };
                          setRouteModal({ ...routeModal, segments: next });
                        }}
                        className="w-full border border-slate-300 rounded px-2 py-1 bg-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = routeModal.segments.filter(
                            (_: any, i: number) => i !== idx
                          );
                          setRouteModal({ ...routeModal, segments: next });
                        }}
                        className="text-red-600 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRouteModal(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer"
              >
                Lưu Tuyến & Chặng
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 6A: ADD ETP REGISTRATION */}
      {/* ==================================================================== */}
      {etpCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateEtp}
            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Đăng ký người đi xe tuyến cố định
              </h3>
              <button
                type="button"
                onClick={() => setEtpCreateModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nhân viên *</label>
                <select
                  required
                  value={etpCreateModal.employeeId}
                  onChange={(e) =>
                    setEtpCreateModal({ ...etpCreateModal, employeeId: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.empCode} - {emp.fullName} ({emp.orgUnit?.name || 'MKVC'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tuyến cố định *</label>
                <select
                  required
                  value={etpCreateModal.routeId}
                  onChange={(e) =>
                    setEtpCreateModal({ ...etpCreateModal, routeId: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                >
                  <option value="">-- Chọn tuyến --</option>
                  {routes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.routeCode} - {rt.routeName} ({rt.passengerType})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Điểm đón *</label>
                  <select
                    required
                    value={etpCreateModal.pickupPointId}
                    onChange={(e) =>
                      setEtpCreateModal({ ...etpCreateModal, pickupPointId: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  >
                    <option value="">-- Chọn điểm đón --</option>
                    {points.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.pointCode} - {p.pointName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Điểm trả</label>
                  <select
                    value={etpCreateModal.dropoffPointId || ''}
                    onChange={(e) =>
                      setEtpCreateModal({ ...etpCreateModal, dropoffPointId: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  >
                    <option value="">-- Mặc định theo tuyến --</option>
                    {points.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.pointCode} - {p.pointName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Hiệu lực từ ngày *
                  </label>
                  <input
                    type="date"
                    required
                    value={etpCreateModal.effectiveFrom}
                    onChange={(e) =>
                      setEtpCreateModal({ ...etpCreateModal, effectiveFrom: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Đến ngày</label>
                  <input
                    type="date"
                    value={etpCreateModal.effectiveTo || ''}
                    onChange={(e) =>
                      setEtpCreateModal({ ...etpCreateModal, effectiveTo: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEtpCreateModal(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer"
              >
                Lưu đăng ký
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 6B: DEACTIVATE ETP ("NGỪNG SỬ DỤNG XE") */}
      {/* ==================================================================== */}
      {etpDeactivateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleDeactivateEtp}
            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm p-5 space-y-4"
          >
            <h3 className="text-sm font-bold text-slate-900">
              Ngừng sử dụng xe tuyến: {etpDeactivateModal.empName}
            </h3>
            <div className="text-xs space-y-2">
              <p className="text-slate-600">
                Ngày bắt đầu hiện tại: <b>{etpDeactivateModal.effectiveFrom}</b>
              </p>
              <label className="block font-semibold text-slate-700">
                Chọn ngày kết thúc hiệu lực *
              </label>
              <input
                type="date"
                required
                value={etpDeactivateModal.effectiveTo}
                onChange={(e) =>
                  setEtpDeactivateModal({ ...etpDeactivateModal, effectiveTo: e.target.value })
                }
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEtpDeactivateModal(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold cursor-pointer"
              >
                Xác nhận ngừng
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 6C: ETP HISTORY & REACTIVATE */}
      {/* ==================================================================== */}
      {etpHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Lịch sử đăng ký xe tuyến: {etpHistoryModal.employee?.empCode} -{' '}
                  {etpHistoryModal.employee?.fullName}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Hỗ trợ Kích hoạt lại kỳ mới hoặc Xóa đăng ký tương lai chưa tới hạn
                </p>
              </div>
              <button
                onClick={() => setEtpHistoryModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] text-slate-600 uppercase">
                  <tr>
                    <th className="py-2 px-3">Tuyến</th>
                    <th className="py-2 px-3">Điểm đón</th>
                    <th className="py-2 px-3">Từ ngày → Đến ngày</th>
                    <th className="py-2 px-3">Trạng thái</th>
                    <th className="py-2 px-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {etpHistoryModal.registrations.map((reg) => {
                    const isFuture =
                      reg.effectiveFrom > new Date().toISOString().slice(0, 10);
                    return (
                      <tr key={reg.id}>
                        <td className="py-2 px-3 font-semibold">{reg.route?.routeCode}</td>
                        <td className="py-2 px-3">{reg.pickupPoint?.pointName}</td>
                        <td className="py-2 px-3 font-mono">
                          {reg.effectiveFrom} → {reg.effectiveTo || 'Vô thời hạn'}
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-semibold">{reg.approvalStatus}</span> (
                          {reg.activeFlag})
                        </td>
                        <td className="py-2 px-3 text-right space-x-1">
                          <button
                            onClick={() => {
                              setEtpHistoryModal(null);
                              setEtpCreateModal({
                                employeeId: reg.employeeId,
                                routeId: reg.routeId,
                                pickupPointId: reg.pickupPointId,
                                dropoffPointId: reg.dropoffPointId || '',
                                effectiveFrom: new Date(Date.now() + 31 * 3600 * 1000)
                                  .toISOString()
                                  .slice(0, 10),
                                effectiveTo: '',
                              });
                            }}
                            className="px-2 py-1 rounded bg-blue-50 text-blue-700 font-medium text-[11px] cursor-pointer"
                          >
                            Kích hoạt lại
                          </button>
                          {isFuture && (
                            <button
                              onClick={() => handleDeleteFutureEtp(reg.id)}
                              className="px-2 py-1 rounded bg-red-50 text-red-700 font-medium text-[11px] cursor-pointer"
                            >
                              Xóa kỳ tương lai
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
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 6D: EXCEL IMPORT PREVIEW */}
      {/* ==================================================================== */}
      {etpImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Import danh sách Người đi xe tuyến từ Excel
              </h3>
              <button
                onClick={() => setEtpImportModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl text-center space-y-2">
              <FileSpreadsheet className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="text-xs font-medium text-slate-700">
                Chọn file Excel (.xlsx) theo mẫu TRMS_ETP_Template.xlsx
              </p>
              <input type="file" accept=".xlsx,.xls,.csv" className="text-xs text-slate-500" />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEtpImportModal(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 cursor-pointer"
              >
                Hủy Import (Giữ nguyên dữ liệu)
              </button>
              <button
                onClick={() => {
                  setEtpImportModal(false);
                  showToast('Đã kiểm tra file Excel hợp lệ');
                }}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
              >
                Xác nhận Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 7: CREATE COST CONFIG VERSION */}
      {/* ==================================================================== */}
      {costConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveCostConfig}
            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Tạo phiên bản Cấu hình chi phí mới
              </h3>
              <button
                type="button"
                onClick={() => setCostConfigModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mã Version *</label>
                  <input
                    type="text"
                    required
                    value={costConfigModal.versionCode}
                    onChange={(e) =>
                      setCostConfigModal({
                        ...costConfigModal,
                        versionCode: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nhóm chi phí *</label>
                  <select
                    value={costConfigModal.configType}
                    onChange={(e) =>
                      setCostConfigModal({ ...costConfigModal, configType: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  >
                    <option value="COMMUTE">Xe tuyến cố định (COMMUTE)</option>
                    <option value="EXTRA">Phát sinh / Điều chuyến (EXTRA)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Loại hành khách *
                  </label>
                  <select
                    value={costConfigModal.passengerType}
                    onChange={(e) =>
                      setCostConfigModal({ ...costConfigModal, passengerType: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  >
                    <option value="STAFF">Nhân viên (STAFF)</option>
                    <option value="WORKER">Công nhân (WORKER)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Loại xe *</label>
                  <select
                    value={costConfigModal.vehicleType}
                    onChange={(e) =>
                      setCostConfigModal({ ...costConfigModal, vehicleType: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  >
                    <option value="SEDAN_4">SEDAN_4</option>
                    <option value="SUV_7">SUV_7</option>
                    <option value="VAN_16">VAN_16</option>
                    <option value="BUS_29">BUS_29</option>
                    <option value="BUS_45">BUS_45</option>
                  </select>
                </div>
              </div>

              {costConfigModal.configType === 'EXTRA' &&
                costConfigModal.passengerType === 'WORKER' && (
                  <div>
                    <label className="block font-semibold text-amber-800 mb-1">
                      Phạm vi áp dụng (Pricing Scope cho EXTRA + WORKER) *
                    </label>
                    <select
                      value={costConfigModal.pricingScope || 'STANDARD'}
                      onChange={(e) =>
                        setCostConfigModal({ ...costConfigModal, pricingScope: e.target.value })
                      }
                      className="w-full border border-amber-300 bg-amber-50 rounded-lg px-3 py-2"
                    >
                      <option value="STANDARD">Tiêu chuẩn (STANDARD)</option>
                      <option value="HOA_BINH">Khu vực Hòa Bình (HOA_BINH)</option>
                    </select>
                  </div>
                )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Hiệu lực từ ngày *
                  </label>
                  <input
                    type="date"
                    required
                    value={costConfigModal.effectiveFrom}
                    onChange={(e) =>
                      setCostConfigModal({ ...costConfigModal, effectiveFrom: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Đơn giá cơ bản (VND) *
                  </label>
                  <input
                    type="number"
                    required
                    value={costConfigModal.rules[0]?.unitPrice || '26000000'}
                    onChange={(e) => {
                      const nextRules = [...costConfigModal.rules];
                      nextRules[0] = { ...nextRules[0], unitPrice: e.target.value };
                      setCostConfigModal({ ...costConfigModal, rules: nextRules });
                    }}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCostConfigModal(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer"
              >
                Lưu Version mới
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
