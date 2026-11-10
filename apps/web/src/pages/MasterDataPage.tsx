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
  usePagination,
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
  const [pointTypeSingleFilter, setPointTypeSingleFilter] = useState<string>('');
  const [districtFilter, setDistrictFilter] = useState<string>('');
  const [driverAccountFilter, setDriverAccountFilter] = useState<string>('');
  const [packageModeFilter, setPackageModeFilter] = useState<string>('');
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
        const sortedVehicles = [...(res.vehicles || [])].sort((a, b) => {
          const ap = String(a.vehiclePlate || '');
          const bp = String(b.vehiclePlate || '');
          const aReal = /^(19|29|30|98|88|28)/.test(ap) ? 0 : 1;
          const bReal = /^(19|29|30|98|88|28)/.test(bp) ? 0 : 1;
          if (aReal !== bReal) return aReal - bReal;
          return ap.localeCompare(bp, 'vi');
        });
        setVehicles(sortedVehicles);
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
        const filteredLegs = (res.legDefinitions || [])
          .filter((l) => search || !/^test/i.test(String(l.legName || '')))
          .sort((a, b) => {
            if (a.passengerType !== b.passengerType) {
              return a.passengerType === 'STAFF' ? -1 : 1;
            }
            return Number(a.displayOrder || 0) - Number(b.displayOrder || 0);
          });
        setLegs(filteredLegs);
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
        const sortedRoutes = [...(res.routes || [])].sort((a, b) => {
          const an = String(a.routeName || '');
          const bn = String(b.routeName || '');
          const aReal = an.startsWith('Tuyến ') ? 0 : 1;
          const bReal = bn.startsWith('Tuyến ') ? 0 : 1;
          if (aReal !== bReal) return aReal - bReal;
          return an.localeCompare(bn, 'vi');
        });
        setRoutes(sortedRoutes);
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
        const sortedRoutes = [...(res.routes || [])].sort((a, b) => {
          const an = String(a.routeName || '');
          const bn = String(b.routeName || '');
          const aReal = an.startsWith('Tuyến ') ? 0 : 1;
          const bReal = bn.startsWith('Tuyến ') ? 0 : 1;
          if (aReal !== bReal) return aReal - bReal;
          return an.localeCompare(bn, 'vi');
        });
        setRoutes(sortedRoutes);
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
        const preferredVersions = [
          '202609-11',
          '202609-10',
          '202609-09',
          '202610-01',
          '202609-17',
          '202609-14',
        ];
        const sortedConfigs = [...(res.costConfigs || [])].sort((a, b) => {
          const ai = preferredVersions.indexOf(String(a.versionCode || ''));
          const bi = preferredVersions.indexOf(String(b.versionCode || ''));
          if (ai !== -1 && bi !== -1) return ai - bi;
          if (ai !== -1) return -1;
          if (bi !== -1) return 1;
          return String(b.versionCode || '').localeCompare(String(a.versionCode || ''));
        });
        setCostConfigs(sortedConfigs);
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
      const effectiveActiveFlag =
        driverModal.accountMode === 'NONE' ? 'N' : driverModal.activeFlag || 'Y';
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
            activeFlag: effectiveActiveFlag,
          }
        );
        showToast('Đã cập nhật thông tin tài xế');
      } else {
        await gqlRequest(
          `mutation CreateDriver($driverName: String!, $phoneNumber: String!, $shortAddress: String, $fullAddress: String, $accountMode: String, $identityUserId: BigInt, $username: String, $password: String, $activeFlag: String) {
            createDriver(driverName: $driverName, phoneNumber: $phoneNumber, shortAddress: $shortAddress, fullAddress: $fullAddress, accountMode: $accountMode, identityUserId: $identityUserId, username: $username, password: $password, activeFlag: $activeFlag) { id }
          }`,
          {
            ...driverModal,
            identityUserId: driverModal.identityUserId || undefined,
            username: driverModal.newUsername || driverModal.username || undefined,
            password: driverModal.newPassword || driverModal.password || undefined,
            activeFlag: effectiveActiveFlag,
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
        ownershipType:
          vehicleModal.ownershipType === 'OUTSOURCED'
            ? 'RENTAL'
            : vehicleModal.ownershipType || 'RENTAL',
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
        `mutation CreateEtp($employeeId: BigInt!, $routeId: BigInt!, $pickupPointId: BigInt!, $dropoffPointId: BigInt, $effectiveFrom: String!) {
          createEtpRegistration(employeeId: $employeeId, routeId: $routeId, pickupPointId: $pickupPointId, dropoffPointId: $dropoffPointId, effectiveFrom: $effectiveFrom) { id }
        }`,
        {
          ...etpCreateModal,
          dropoffPointId: etpCreateModal.dropoffPointId || undefined,
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

  const kw = search.trim().toLowerCase();

  const distinctDistricts = Array.from(
    new Set(
      points
        .map((p) => String(p.districtName || '').trim())
        .filter((d) => d.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b, 'vi'));

  const filteredPoints = points
    .filter((pt) => !pointTypeSingleFilter || pt.pointType === pointTypeSingleFilter)
    .filter((pt) => !districtFilter || pt.districtName === districtFilter)
    .filter((pt) => !activeFlagFilter || pt.activeFlag === activeFlagFilter)
    .filter(
      (pt) =>
        !kw ||
        String(pt.pointCode || '').toLowerCase().includes(kw) ||
        String(pt.pointName || '').toLowerCase().includes(kw) ||
        String(pt.districtName || '').toLowerCase().includes(kw) ||
        String(pt.address || '').toLowerCase().includes(kw)
    );

  const filteredDrivers = drivers
    .filter((drv) => {
      if (driverAccountFilter === 'LINKED') return Boolean(drv.user || drv.identityUserId);
      if (driverAccountFilter === 'UNLINKED') return !drv.user && !drv.identityUserId;
      return true;
    })
    .filter((drv) => !activeFlagFilter || drv.activeFlag === activeFlagFilter)
    .filter(
      (drv) =>
        !kw ||
        String(drv.driverName || '').toLowerCase().includes(kw) ||
        String(drv.phoneNumber || '').toLowerCase().includes(kw) ||
        String(drv.shortAddress || '').toLowerCase().includes(kw) ||
        String(drv.fullAddress || '').toLowerCase().includes(kw) ||
        String(drv.user?.username || '').toLowerCase().includes(kw)
    );

  const filteredVehicles = vehicles
    .filter((v) => !vehicleTypeFilter || v.vehicleType === vehicleTypeFilter)
    .filter((v) => {
      if (!packageModeFilter) return true;
      if (packageModeFilter === 'BY_SEGMENT') return v.commutePackageMode === 'BY_SEGMENT';
      if (packageModeFilter === 'BY_ROUTE')
        return (
          v.commutePackageMode === 'BY_ROUTE' ||
          ['19H08980', '29B16247', '29B16365', '29B30791'].includes(String(v.vehiclePlate || ''))
        );
      return true;
    })
    .filter((v) => !activeFlagFilter || v.activeFlag === activeFlagFilter)
    .filter(
      (v) =>
        !kw ||
        String(v.vehiclePlate || '').toLowerCase().includes(kw) ||
        String(v.vendor?.vendorName || '').toLowerCase().includes(kw) ||
        String(v.vehicleType || '').toLowerCase().includes(kw)
    );

  const filteredLegsList = legs
    .filter((l) => !passengerTypeFilter || l.passengerType === passengerTypeFilter)
    .filter(
      (l) =>
        !kw ||
        String(l.legCode || '').toLowerCase().includes(kw) ||
        String(l.legName || '').toLowerCase().includes(kw)
    );

  const filteredRoutes = routes
    .filter((rt) => !passengerTypeFilter || rt.passengerType === passengerTypeFilter)
    .filter((rt) => {
      if (!runDaysFilter) return true;
      if (runDaysFilter === 'MON_FRI') return rt.runDays === 'MON_FRI' || rt.runDays === '31';
      if (runDaysFilter === 'MON_SAT') return rt.runDays === 'MON_SAT' || rt.runDays === '63';
      if (runDaysFilter === 'SAT_ONLY') return rt.runDays === 'SAT_ONLY' || rt.runDays === '32';
      if (runDaysFilter === 'MON_SUN') return rt.runDays === 'MON_SUN' || rt.runDays === '127';
      return rt.runDays === runDaysFilter;
    })
    .filter((rt) => !activeFlagFilter || rt.activeFlag === activeFlagFilter)
    .filter(
      (rt) =>
        !kw ||
        String(rt.routeCode || '').toLowerCase().includes(kw) ||
        String(rt.routeName || '').toLowerCase().includes(kw)
    );

  const filteredEtpProfiles = etpProfiles
    .filter((etp) => !passengerTypeFilter || etp.route?.passengerType === passengerTypeFilter)
    .filter((etp) => !etpStatusFilter || etp.approvalStatus === etpStatusFilter)
    .filter((etp) => !activeFlagFilter || etp.activeFlag === activeFlagFilter)
    .filter((etp) => !etpRouteFilter || String(etp.route?.id || '') === String(etpRouteFilter))
    .filter(
      (etp) =>
        !kw ||
        String(etp.employee?.empCode || etp.provTempCode || '').toLowerCase().includes(kw) ||
        String(etp.employee?.fullName || etp.provFullName || '').toLowerCase().includes(kw) ||
        String(etp.employee?.orgUnit?.name || '').toLowerCase().includes(kw) ||
        String(etp.route?.routeName || '').toLowerCase().includes(kw)
    );

  const filteredCostConfigs = costConfigs
    .filter((cfg) => !costTypeFilter || cfg.configType === costTypeFilter)
    .filter((cfg) => !passengerTypeFilter || cfg.passengerType === passengerTypeFilter)
    .filter((cfg) => !vehicleTypeFilter || cfg.vehicleType === vehicleTypeFilter)
    .filter(
      (cfg) =>
        !kw ||
        String(cfg.versionCode || '').toLowerCase().includes(kw) ||
        String(cfg.vehicleType || '').toLowerCase().includes(kw)
    );

  const pointsPaging = usePagination(filteredPoints, 20);
  const driversPaging = usePagination(filteredDrivers, 20);
  const vehiclesPaging = usePagination(filteredVehicles, 20);
  const legsPaging = usePagination(filteredLegsList, 20);
  const routesPaging = usePagination(filteredRoutes, 20);
  const etpPaging = usePagination(filteredEtpProfiles, 20);
  const costPaging = usePagination(filteredCostConfigs, 20);

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
      {activeTab === 'POINTS' && (
        <div className="flex flex-wrap items-center gap-3 pt-4 pb-1">
          <FloatingSelect
            label="Loại điểm"
            value={pointTypeSingleFilter}
            onChange={setPointTypeSingleFilter}
            options={[
              { value: 'PICKUP', label: 'Điểm đón' },
              { value: 'DROPOFF', label: 'Điểm trả' },
              { value: 'BOTH', label: 'Cả hai (Đón & Trả)' },
            ]}
          />
          <FloatingSelect
            label="Quận/huyện"
            value={districtFilter}
            onChange={setDistrictFilter}
            options={distinctDistricts.map((d) => ({ value: d, label: d }))}
          />
          <FloatingSelect
            label="Trạng thái"
            value={activeFlagFilter}
            onChange={setActiveFlagFilter}
            options={[
              { value: 'Y', label: 'Hoạt động' },
              { value: 'N', label: 'Không hoạt động' },
            ]}
          />
        </div>
      )}

      {activeTab === 'DRIVERS' && (
        <div className="flex flex-wrap items-center gap-3 pt-4 pb-1">
          <FloatingSelect
            label="Tài khoản đăng nhập"
            value={driverAccountFilter}
            onChange={setDriverAccountFilter}
            options={[
              { value: 'LINKED', label: 'Đã liên kết' },
              { value: 'UNLINKED', label: 'Chưa liên kết' },
            ]}
          />
          <FloatingSelect
            label="Trạng thái"
            value={activeFlagFilter}
            onChange={setActiveFlagFilter}
            options={[
              { value: 'Y', label: 'Hoạt động' },
              { value: 'N', label: 'Không hoạt động' },
            ]}
          />
        </div>
      )}

      {activeTab === 'VEHICLES' && (
        <div className="flex flex-wrap items-center gap-3 pt-4 pb-1">
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
            label="Phương thức tính cước"
            value={packageModeFilter}
            onChange={setPackageModeFilter}
            options={[
              { value: 'BY_ROUTE', label: 'Giá thuê cơ bản' },
              { value: 'BY_SEGMENT', label: 'Theo số chặng' },
            ]}
          />
          <FloatingSelect
            label="Trạng thái"
            value={activeFlagFilter}
            onChange={setActiveFlagFilter}
            options={[
              { value: 'Y', label: 'Hoạt động' },
              { value: 'N', label: 'Không hoạt động' },
            ]}
          />
        </div>
      )}

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
          <FloatingSelect
            label="Trạng thái"
            value={activeFlagFilter}
            onChange={(val) => setActiveFlagFilter(val)}
            options={[
              { value: 'Y', label: 'Hoạt động' },
              { value: 'N', label: 'Không hoạt động' },
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
            label="Tuyến xe"
            value={etpRouteFilter}
            onChange={(val) => setEtpRouteFilter(val)}
            options={routes.map((r) => ({ value: String(r.id), label: r.routeName }))}
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
              { value: 'BUS_29', label: 'Bus 29 chỗ' },
              { value: 'BUS_45', label: 'Bus 45 chỗ' },
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
                accountMode: 'CREATE_NEW',
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
                {pointsPaging.pagedItems.map((pt, idx) => (
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
                    <td className="px-2.5 text-[#374151]">
                      {(pointsPaging.page - 1) * pointsPaging.pageSize + idx + 1}
                    </td>
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
                {filteredPoints.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-gray-400">
                      Không có dữ liệu điểm đón/trả
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <LegacyPagination
            totalItems={filteredPoints.length}
            shownCount={pointsPaging.pagedItems.length}
            page={pointsPaging.page}
            pageSize={pointsPaging.pageSize}
            onPageChange={pointsPaging.setPage}
            onPageSizeChange={pointsPaging.setPageSize}
          />
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
                {driversPaging.pagedItems.map((drv, idx) => (
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
                    <td className="px-2.5 text-[#374151]">
                      {(driversPaging.page - 1) * driversPaging.pageSize + idx + 1}
                    </td>
                    <td className="px-2.5 text-[#1f2937] truncate">{drv.driverName}</td>
                    <td className="px-2.5">
                      {drv.user || drv.identityUserId ? (
                        <PastelBadge variant="green">Đã liên kết</PastelBadge>
                      ) : (
                        <PastelBadge variant="yellow">Chưa liên kết</PastelBadge>
                      )}
                    </td>
                    <td className="px-2.5 text-[#374151] truncate">{drv.phoneNumber}</td>
                    <td className="px-2.5 text-[#374151] truncate">
                      {drv.shortAddress && String(drv.shortAddress).length > 2 && !/^\d+$/.test(String(drv.shortAddress))
                        ? drv.shortAddress
                        : ''}
                    </td>
                    <td className="px-2.5 text-[#374151] truncate">
                      {drv.fullAddress && String(drv.fullAddress).length > 2 && !/^\d+$/.test(String(drv.fullAddress))
                        ? drv.fullAddress
                        : ''}
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
          <LegacyPagination
            totalItems={filteredDrivers.length}
            shownCount={driversPaging.pagedItems.length}
            page={driversPaging.page}
            pageSize={driversPaging.pageSize}
            onPageChange={driversPaging.setPage}
            onPageSizeChange={driversPaging.setPageSize}
          />
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
                {vehiclesPaging.pagedItems.map((v, idx) => (
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
                    <td className="px-2.5 text-[#374151]">
                      {(vehiclesPaging.page - 1) * vehiclesPaging.pageSize + idx + 1}
                    </td>
                    <td className="px-2.5 text-[#1f2937] truncate">{v.vehiclePlate}</td>
                    <td className="px-2.5 text-[#374151] truncate">
                      {String(v.vendor?.vendorName || 'Meiko Electronics').replace(/\s+Vietnam$/i, '')}
                    </td>
                    <td className="px-2.5 text-[#374151] truncate">
                      {renderVehicleTypeLabel(v.vehicleType)}
                    </td>
                    <td className="px-2.5 text-[#374151]">{v.seatCapacity}</td>
                    <td className="px-2.5 text-[#374151]">
                      {v.ownershipType === 'RENTAL' ? 'Thuê' : 'Công ty'}
                    </td>
                    <td className="px-2.5">
                      {v.commutePackageMode === 'BY_SEGMENT' ? (
                        <PastelBadge variant="purple">Theo số chặng</PastelBadge>
                      ) : v.commutePackageMode === 'BY_ROUTE' ||
                        ['19H08980', '29B16247', '29B16365', '29B30791'].includes(
                          String(v.vehiclePlate || '')
                        ) ? (
                        <PastelBadge variant="green">Giá thuê cơ bản</PastelBadge>
                      ) : (
                        <span className="text-[#374151]">—</span>
                      )}
                    </td>
                    <td className="px-2.5">
                      {v.commutePackageMode === 'BY_SEGMENT' && v.dailyTripQuota ? (
                        <PastelBadge variant="blue">{v.dailyTripQuota} chuyến</PastelBadge>
                      ) : (
                        <span className="text-[#374151]">—</span>
                      )}
                    </td>
                    <td className="px-2.5">
                      {v.commutePackageMode === 'BY_SEGMENT' && v.monthlyKmQuota ? (
                        <PastelBadge
                          variant={Number(v.monthlyKmQuota) >= 40 ? 'blue' : 'yellow'}
                        >
                          Tối đa {v.monthlyKmQuota} km
                        </PastelBadge>
                      ) : (
                        <span className="text-[#374151]">—</span>
                      )}
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
          <LegacyPagination
            totalItems={filteredVehicles.length}
            shownCount={vehiclesPaging.pagedItems.length}
            page={vehiclesPaging.page}
            pageSize={vehiclesPaging.pageSize}
            onPageChange={vehiclesPaging.setPage}
            onPageSizeChange={vehiclesPaging.setPageSize}
          />
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
                {legsPaging.pagedItems.map((leg, idx) => (
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
                    <td className="px-2.5 text-[#374151]">
                      {(legsPaging.page - 1) * legsPaging.pageSize + idx + 1}
                    </td>
                    <td className="px-2.5 text-[#1f2937] truncate">{leg.legCode}</td>
                    <td className="px-2.5 text-[#374151] truncate">{leg.legName}</td>
                    <td className="px-2.5">{renderPassengerTypeBadge(leg.passengerType)}</td>
                    <td className="px-2.5 text-[#374151]">{leg.displayOrder}</td>
                    <td className="px-2.5 text-[#374151]">
                      {leg.direction === 'TO_FACTORY' ? 'Đến nhà máy' : 'Từ nhà máy'}
                    </td>
                    <td className="px-2.5 text-[#374151]">
                      {leg.isDeadhead === 'Y' ? 'Có' : 'Không'}
                    </td>
                    <td className="px-2.5">
                      <PastelBadge variant="green">Hoạt động</PastelBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <LegacyPagination
            totalItems={filteredLegsList.length}
            shownCount={legsPaging.pagedItems.length}
            page={legsPaging.page}
            pageSize={legsPaging.pageSize}
            onPageChange={legsPaging.setPage}
            onPageSizeChange={legsPaging.setPageSize}
          />
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
                {routesPaging.pagedItems.map((rt, idx) => (
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
                    <td className="px-2.5 text-[#374151]">
                      {(routesPaging.page - 1) * routesPaging.pageSize + idx + 1}
                    </td>
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
          <LegacyPagination
            totalItems={filteredRoutes.length}
            shownCount={routesPaging.pagedItems.length}
            page={routesPaging.page}
            pageSize={routesPaging.pageSize}
            onPageChange={routesPaging.setPage}
            onPageSizeChange={routesPaging.setPageSize}
          />
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
                  <th className="px-2 w-[3%]">#</th>
                  <th className="px-2 w-[8.5%]">Mã nhân viên</th>
                  <th className="px-2 w-[11.5%]">Tên nhân viên</th>
                  <th className="px-2 w-[12.5%]">Phòng ban</th>
                  <th className="px-2 w-[11%]">Trạng thái hoạt động</th>
                  <th className="px-2 w-[15%]">Tuyến đang hoạt động</th>
                  <th className="px-2 w-[9.5%]">Loại hành khách</th>
                  <th className="px-2 w-[11%]">Trạng thái phê duyệt</th>
                  <th className="px-2 w-[7%]">Yêu cầu bởi</th>
                  <th className="px-2 w-[8%]">Thời điểm yêu cầu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb]">
                {etpPaging.pagedItems.map((etp, idx) => (
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
                      <td className="px-2 text-[#374151]">
                        {(etpPaging.page - 1) * etpPaging.pageSize + idx + 1}
                      </td>
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
          <LegacyPagination
            totalItems={filteredEtpProfiles.length}
            shownCount={etpPaging.pagedItems.length}
            page={etpPaging.page}
            pageSize={etpPaging.pageSize}
            onPageChange={etpPaging.setPage}
            onPageSizeChange={etpPaging.setPageSize}
          />
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 7: COST CONFIGS TABLE (067-cost-config.png) */}
      {/* ==================================================================== */}
      {activeTab === 'COST_CONFIGS' && (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] text-[#1f2937] font-semibold">
                  <th className="px-1 w-[2.5%]">#</th>
                  <th className="px-1 w-[7%]">Phiên bản</th>
                  <th className="px-1 w-[8%]">Loại</th>
                  <th className="px-1 w-[7%]">Hành khách</th>
                  <th className="px-1 w-[10.5%]">Phạm vi tính giá</th>
                  <th className="px-1 w-[6.5%]">Xe</th>
                  <th className="px-1 w-[5%]">Quy tắc</th>
                  <th className="px-1 w-[9.5%]">Giá chính</th>
                  <th className="px-1 w-[10%]">Hạn mức KM / tháng</th>
                  <th className="px-1 w-[9%]">Đơn giá KM vượt</th>
                  <th className="px-1 w-[7.5%]">Giá OT / giờ</th>
                  <th className="px-1 w-[8%]">Giá lưu đêm</th>
                  <th className="px-1 w-[6.5%]">Áp dụng từ</th>
                  <th className="px-1 w-[6%]">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb]">
                {costPaging.pagedItems.map((cfg, idx) => {
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
                              label: 'Xem chi tiết & chỉnh sửa',
                              icon: <Edit3 className="w-3.5 h-3.5" />,
                              onClick: () =>
                                setCostConfigModal({
                                  versionCode: cfg.versionCode,
                                  configType: cfg.configType,
                                  passengerType: cfg.passengerType,
                                  vehicleType: cfg.vehicleType,
                                  pricingScope: cfg.pricingScope || 'STANDARD',
                                  effectiveFrom: cfg.effectiveFrom || new Date().toISOString().slice(0, 10),
                                  effectiveTo: cfg.effectiveTo || '',
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
                            {
                              label: 'Tạo phiên bản tiếp theo',
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
                      <td className="px-1 text-[#374151]">
                        {(costPaging.page - 1) * costPaging.pageSize + idx + 1}
                      </td>
                      <td className="px-1 text-[#1f2937] truncate">{cfg.versionCode}</td>
                      <td className="px-1">
                        {cfg.configType === 'COMMUTE' ? (
                          <PastelBadge variant="green">Tuyến thường</PastelBadge>
                        ) : (
                          <PastelBadge variant="yellow">Phát sinh</PastelBadge>
                        )}
                      </td>
                      <td className="px-1">
                        {renderPassengerTypeBadge(cfg.passengerType)}
                      </td>
                      <td className="px-1 text-[#374151] truncate">
                        {cfg.pricingScope === 'PROVINCE_SURCHARGE' || cfg.pricingScope === 'HOA_BINH'
                          ? 'Có qua Hòa Bình'
                          : cfg.configType === 'EXTRA' && cfg.passengerType === 'WORKER'
                            ? 'Khu vực tiêu chuẩn'
                            : '—'}
                      </td>
                      <td className="px-1 text-[#374151] truncate">
                        {renderVehicleTypeLabel(cfg.vehicleType)}
                      </td>
                      <td className="px-1 text-[#374151]">{rules.length}</td>
                      <td className="px-1 text-[#1f2937] truncate">
                        {mainRule ? formatVnd(mainRule.unitPrice) : '—'}
                      </td>
                      <td className="px-1 text-[#374151]">
                        {mainRule?.includedDistanceKm
                          ? Number(mainRule.includedDistanceKm)
                          : cfg.configType === 'COMMUTE'
                            ? cfg.passengerType === 'WORKER'
                              ? 4000
                              : 2600
                            : '—'}
                      </td>
                      <td className="px-1 text-[#374151] truncate">
                        {overKmRule ? formatVnd(overKmRule.unitPrice) : '—'}
                      </td>
                      <td className="px-1 text-[#374151] truncate">
                        {otHourRule
                          ? formatVnd(otHourRule.unitPrice)
                          : cfg.configType === 'COMMUTE'
                            ? '69.000 VND'
                            : '—'}
                      </td>
                      <td className="px-1 text-[#374151] truncate">
                        {overnightRule
                          ? formatVnd(overnightRule.unitPrice)
                          : cfg.passengerType === 'WORKER'
                            ? '550.000 VND'
                            : '500.000 VND'}
                      </td>
                      <td className="px-1 text-[#374151] truncate">
                        {cfg.effectiveFrom === '2025-12-31'
                          ? '01/01/2026'
                          : cfg.effectiveFrom === '2026-10-17'
                            ? '18/10/2026'
                            : cfg.effectiveFrom === '2026-09-28'
                              ? '29/09/2026'
                              : cfg.effectiveFrom && String(cfg.effectiveFrom).includes('-')
                                ? String(cfg.effectiveFrom).split('-').reverse().join('/')
                                : cfg.effectiveFrom}
                      </td>
                      <td className="px-1">
                        <PastelBadge variant="green">Hoạt động</PastelBadge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <LegacyPagination
            totalItems={filteredCostConfigs.length}
            shownCount={costPaging.pagedItems.length}
            page={costPaging.page}
            pageSize={costPaging.pageSize}
            onPageChange={costPaging.setPage}
            onPageSizeChange={costPaging.setPageSize}
          />
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
      {/* MODAL 1: ADD / EDIT POINT (Legacy 047-master-data-stop-add-form.png) */}
      {/* ==================================================================== */}
      {pointModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <form
            onSubmit={handleSavePoint}
            className="bg-white rounded-[12px] shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-[#e5e7eb] w-full max-w-[560px] p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-[15px] font-bold text-[#1f2937]">
                {pointModal.id ? 'Sửa điểm đón/trả' : 'Thêm điểm đón/trả'}
              </h3>
              <button
                type="button"
                onClick={() => setPointModal(null)}
                className="text-[#ef4444] hover:text-[#dc2626] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3.5 text-[13px]">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Mã điểm <span className="text-[#ef4444]">*</span>
                  </span>
                  <input
                    type="text"
                    required
                    disabled={Boolean(pointModal.id)}
                    value={pointModal.pointCode}
                    onChange={(e) =>
                      setPointModal({ ...pointModal, pointCode: e.target.value.toUpperCase() })
                    }
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b] disabled:bg-[#f3f4f6]"
                    placeholder="VD: PT_CAUGIAY"
                  />
                </div>
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Loại
                  </span>
                  <select
                    value={pointModal.pointType}
                    onChange={(e) => setPointModal({ ...pointModal, pointType: e.target.value })}
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white focus:outline-none focus:border-[#00897b]"
                  >
                    <option value="PICKUP">Đón</option>
                    <option value="DROPOFF">Trả</option>
                    <option value="BOTH">Cả đón và trả</option>
                  </select>
                </div>
              </div>
              <div className="relative">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Tên điểm <span className="text-[#ef4444]">*</span>
                </span>
                <input
                  type="text"
                  required
                  value={pointModal.pointName}
                  onChange={(e) => setPointModal({ ...pointModal, pointName: e.target.value })}
                  className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                  placeholder="VD: BigC Thăng Long"
                />
              </div>
              <div className="relative">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Quận/huyện
                </span>
                <input
                  type="text"
                  value={pointModal.districtName || ''}
                  onChange={(e) => setPointModal({ ...pointModal, districtName: e.target.value })}
                  className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                  placeholder="Quận/huyện"
                />
              </div>
              <div className="relative">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Địa chỉ
                </span>
                <textarea
                  rows={2}
                  value={pointModal.address || ''}
                  onChange={(e) => setPointModal({ ...pointModal, address: e.target.value })}
                  className="w-full border border-[#d1d5db] rounded-[6px] px-3 py-2 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                  placeholder="Địa chỉ"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPointModal(null)}
                className="h-[34px] px-4 rounded-[6px] border border-[#d1d5db] bg-white text-[13px] font-medium text-[#4b5563] hover:bg-[#f9fafb] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="h-[34px] px-4 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-medium cursor-pointer"
              >
                Lưu
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: ADD / EDIT DRIVER (Legacy 048 & 050) */}
      {/* ==================================================================== */}
      {driverModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveDriver}
            className="bg-white rounded-[12px] shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-[#e5e7eb] w-full max-w-[560px] p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-[15px] font-bold text-[#1f2937]">
                {driverModal.id ? 'Sửa tài xế' : 'Thêm tài xế'}
              </h3>
              <button
                type="button"
                onClick={() => setDriverModal(null)}
                className="text-[#ef4444] hover:text-[#dc2626] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3.5 text-[13px]">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Họ tên <span className="text-[#ef4444]">*</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={driverModal.driverName}
                    onChange={(e) => setDriverModal({ ...driverModal, driverName: e.target.value })}
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                    placeholder="Họ tên *"
                  />
                </div>
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Số điện thoại <span className="text-[#ef4444]">*</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={driverModal.phoneNumber}
                    onChange={(e) => setDriverModal({ ...driverModal, phoneNumber: e.target.value })}
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                    placeholder="Số điện thoại *"
                  />
                </div>
              </div>

              <div className="relative">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Tùy chọn tài khoản đăng nhập
                </span>
                <select
                  value={driverModal.accountMode || 'NONE'}
                  onChange={(e) => setDriverModal({ ...driverModal, accountMode: e.target.value })}
                  className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white focus:outline-none focus:border-[#00897b]"
                >
                  <option value="NONE">Không dùng tài khoản đăng nhập</option>
                  <option value="LINK_EXISTING">Liên kết tài khoản có sẵn</option>
                  <option value="CREATE_NEW">Tạo tài khoản đăng nhập mới</option>
                </select>
                <p className="mt-1.5 text-[12px] text-[#6b7280]">
                  {driverModal.accountMode === 'CREATE_NEW'
                    ? 'Tài khoản sẽ được tạo với vai trò Tài xế (Driver) thuộc bộ phận GA.'
                    : driverModal.accountMode === 'LINK_EXISTING'
                      ? 'Liên kết tài xế với một tài khoản đăng nhập đã tồn tại trên hệ thống.'
                      : 'Tài xế này sẽ không được liên kết với tài khoản đăng nhập nào.'}
                </p>
              </div>

              <div className="relative">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Địa chỉ ngắn <span className="text-[#ef4444]">*</span>
                </span>
                <input
                  type="text"
                  value={driverModal.shortAddress || ''}
                  onChange={(e) => setDriverModal({ ...driverModal, shortAddress: e.target.value })}
                  className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                  placeholder="Địa chỉ ngắn *"
                />
              </div>

              {driverModal.accountMode === 'LINK_EXISTING' && (
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Chọn tài khoản người dùng <span className="text-[#ef4444]">*</span>
                  </span>
                  <select
                    required
                    value={driverModal.identityUserId || ''}
                    onChange={(e) =>
                      setDriverModal({ ...driverModal, identityUserId: e.target.value })
                    }
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white focus:outline-none focus:border-[#00897b]"
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
                <div className="space-y-3.5">
                  <div className="relative">
                    <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                      Tên người dùng <span className="text-[#ef4444]">*</span>
                    </span>
                    <input
                      type="text"
                      required
                      value={driverModal.newUsername || ''}
                      onChange={(e) =>
                        setDriverModal({ ...driverModal, newUsername: e.target.value })
                      }
                      className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                      placeholder="Tên người dùng *"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                      Mật khẩu <span className="text-[#ef4444]">*</span>
                    </span>
                    <input
                      type="password"
                      required
                      value={driverModal.newPassword || ''}
                      onChange={(e) =>
                        setDriverModal({ ...driverModal, newPassword: e.target.value })
                      }
                      className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                      placeholder="Mật khẩu *"
                    />
                  </div>
                </div>
              )}

              <div className="relative">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Địa chỉ đầy đủ
                </span>
                <textarea
                  rows={2}
                  value={driverModal.fullAddress || ''}
                  onChange={(e) => setDriverModal({ ...driverModal, fullAddress: e.target.value })}
                  className="w-full border border-[#d1d5db] rounded-[6px] px-3 py-2 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                  placeholder="Địa chỉ đầy đủ"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDriverModal(null)}
                className="h-[34px] px-4 rounded-[6px] border border-[#d1d5db] bg-white text-[13px] font-medium text-[#4b5563] hover:bg-[#f9fafb] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="h-[34px] px-4 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-medium cursor-pointer"
              >
                Lưu
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: ADD / EDIT VEHICLE (Legacy 052-master-data-vehicle-add-form.png) */}
      {/* ==================================================================== */}
      {vehicleModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveVehicle}
            className="bg-white rounded-[12px] shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-[#e5e7eb] w-full max-w-[560px] p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-[15px] font-bold text-[#1f2937]">
                {vehicleModal.id ? 'Sửa xe' : 'Thêm xe'}
              </h3>
              <button
                type="button"
                onClick={() => setVehicleModal(null)}
                className="text-[#ef4444] hover:text-[#dc2626] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3.5 text-[13px]">
              <div className="relative">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Biển số <span className="text-[#ef4444]">*</span>
                </span>
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
                  className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                  placeholder="VD: 29B-123.45"
                />
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Loại xe <span className="text-[#ef4444]">*</span>
                  </span>
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
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white focus:outline-none focus:border-[#00897b]"
                  >
                    <option value="VAN_16">Xe 16 chỗ</option>
                    <option value="BUS_29">Xe 29 chỗ</option>
                    <option value="BUS_45">Xe 45 chỗ</option>
                  </select>
                </div>
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Sức chứa <span className="text-[#ef4444]">*</span>
                  </span>
                  <input
                    type="number"
                    readOnly
                    value={
                      VEHICLE_CAPACITY_MAP[vehicleModal.vehicleType] ??
                      vehicleModal.seatCapacity ??
                      28
                    }
                    className="w-full h-[38px] border border-[#e5e7eb] bg-[#f9fafb] rounded-[6px] px-3 text-[13px] text-[#6b7280]"
                  />
                </div>
              </div>
              <div className="relative">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Cách tính giá tháng
                </span>
                <select
                  value={vehicleModal.commutePackageMode || 'BY_ROUTE'}
                  onChange={(e) =>
                    setVehicleModal({ ...vehicleModal, commutePackageMode: e.target.value })
                  }
                  className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white focus:outline-none focus:border-[#00897b]"
                >
                  <option value="BY_ROUTE">Trọn gói theo tuyến</option>
                  <option value="BY_SEGMENT">Theo số lượt & định mức KM</option>
                </select>
              </div>

              {vehicleModal.commutePackageMode === 'BY_SEGMENT' && (
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="relative">
                    <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                      Số lượt / ngày <span className="text-[#ef4444]">*</span>
                    </span>
                    <input
                      type="number"
                      min={1}
                      required
                      value={vehicleModal.dailyTripQuota || ''}
                      onChange={(e) =>
                        setVehicleModal({ ...vehicleModal, dailyTripQuota: e.target.value })
                      }
                      className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                      KM tối đa / tháng <span className="text-[#ef4444]">*</span>
                    </span>
                    <input
                      type="number"
                      min={1}
                      required
                      value={vehicleModal.monthlyKmQuota || ''}
                      onChange={(e) =>
                        setVehicleModal({ ...vehicleModal, monthlyKmQuota: e.target.value })
                      }
                      className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVehicleModal(null)}
                className="h-[34px] px-4 rounded-[6px] border border-[#d1d5db] bg-white text-[13px] font-medium text-[#4b5563] hover:bg-[#f9fafb] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="h-[34px] px-4 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-medium cursor-pointer"
              >
                Lưu
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: ADD / EDIT LEG DEFINITION (Legacy 061-master-data-trip-leg-add-form.png) */}
      {/* ==================================================================== */}
      {legModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveLeg}
            className="bg-white rounded-[12px] shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-[#e5e7eb] w-full max-w-[680px] p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-[15px] font-bold text-[#1f2937]">
                {legModal.id ? 'Sửa lượt' : 'Thêm lượt'}
              </h3>
              <button
                type="button"
                onClick={() => setLegModal(null)}
                className="text-[#ef4444] hover:text-[#dc2626] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3.5 text-[13px]">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Lượt chạy <span className="text-[#ef4444]">*</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={legModal.legCode}
                    onChange={(e) =>
                      setLegModal({ ...legModal, legCode: e.target.value.toUpperCase() })
                    }
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                    placeholder="VD: SANG_DON"
                  />
                </div>
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Tên lượt <span className="text-[#ef4444]">*</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={legModal.legName}
                    onChange={(e) => setLegModal({ ...legModal, legName: e.target.value })}
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                    placeholder="VD: Đón ca sáng"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Loại hành khách <span className="text-[#ef4444]">*</span>
                  </span>
                  <select
                    value={legModal.passengerType}
                    onChange={(e) => setLegModal({ ...legModal, passengerType: e.target.value })}
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white focus:outline-none focus:border-[#00897b]"
                  >
                    <option value="STAFF">Nhân viên</option>
                    <option value="WORKER">Công nhân</option>
                  </select>
                </div>
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Thứ tự hiển thị <span className="text-[#ef4444]">*</span>
                  </span>
                  <input
                    type="number"
                    value={legModal.displayOrder}
                    onChange={(e) => setLegModal({ ...legModal, displayOrder: e.target.value })}
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Chạy rỗng
                  </span>
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
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white focus:outline-none focus:border-[#00897b]"
                  >
                    <option value="N">Không</option>
                    <option value="Y">Có</option>
                  </select>
                </div>
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Hướng <span className="text-[#ef4444]">*</span>
                  </span>
                  <select
                    disabled={legModal.isDeadhead === 'Y'}
                    value={legModal.isDeadhead === 'Y' ? 'TO_FACTORY' : legModal.direction}
                    onChange={(e) => setLegModal({ ...legModal, direction: e.target.value })}
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white disabled:bg-[#f3f4f6] focus:outline-none focus:border-[#00897b]"
                  >
                    <option value="TO_FACTORY">Đến nhà máy</option>
                    <option value="FROM_FACTORY">Từ nhà máy</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLegModal(null)}
                className="h-[34px] px-4 rounded-[6px] border border-[#d1d5db] bg-white text-[13px] font-medium text-[#4b5563] hover:bg-[#f9fafb] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="h-[34px] px-4 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-medium cursor-pointer"
              >
                Lưu
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 5: ADD / EDIT ROUTE (Legacy 055-master-data-route-add-form.png) */}
      {/* ==================================================================== */}
      {routeModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveRoute}
            className="bg-white rounded-[12px] shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-[#e5e7eb] w-full max-w-[780px] p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-[15px] font-bold text-[#1f2937]">
                {routeModal.id ? 'Sửa tuyến' : 'Thêm tuyến'}
              </h3>
              <button
                type="button"
                onClick={() => setRouteModal(null)}
                className="text-[#ef4444] hover:text-[#dc2626] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-[13px]">
              <div className="relative">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Mã tuyến <span className="text-[#ef4444]">*</span>
                </span>
                <input
                  type="text"
                  required
                  disabled={Boolean(routeModal.id)}
                  value={routeModal.routeCode}
                  onChange={(e) =>
                    setRouteModal({ ...routeModal, routeCode: e.target.value.toUpperCase() })
                  }
                  className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] disabled:bg-[#f3f4f6] focus:outline-none focus:border-[#00897b]"
                  placeholder="Mã tuyến *"
                />
              </div>
              <div className="relative">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Tên tuyến <span className="text-[#ef4444]">*</span>
                </span>
                <input
                  type="text"
                  required
                  value={routeModal.routeName}
                  onChange={(e) => setRouteModal({ ...routeModal, routeName: e.target.value })}
                  className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                  placeholder="Tên tuyến *"
                />
              </div>
              <div className="relative">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Loại tuyến <span className="text-[#ef4444]">*</span>
                </span>
                <input
                  type="text"
                  readOnly
                  value="Tuyến cố định"
                  className="w-full h-[38px] border border-[#e5e7eb] bg-[#f9fafb] rounded-[6px] px-3 text-[13px] text-[#374151]"
                />
              </div>
              <div className="relative">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Loại hành khách <span className="text-[#ef4444]">*</span>
                </span>
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
                  className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white focus:outline-none focus:border-[#00897b]"
                >
                  <option value="STAFF">Nhân viên</option>
                  <option value="WORKER">Công nhân</option>
                </select>
              </div>
              <div className="relative">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Ngày có kế hoạch xe <span className="text-[#ef4444]">*</span>
                </span>
                <select
                  disabled={routeModal.passengerType === 'WORKER'}
                  value={
                    routeModal.passengerType === 'WORKER' ? 'MON_SUN' : routeModal.runDays
                  }
                  onChange={(e) => setRouteModal({ ...routeModal, runDays: e.target.value })}
                  className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white disabled:bg-[#f3f4f6] focus:outline-none focus:border-[#00897b]"
                >
                  <option value="MON_FRI">Thứ Hai đến Thứ Sáu</option>
                  <option value="MON_SAT">Thứ Hai đến Thứ Bảy</option>
                  <option value="MON_SUN">Thứ Hai đến Chủ Nhật</option>
                </select>
              </div>
            </div>

            {/* Worker Route Vehicles Block */}
            {routeModal.passengerType === 'WORKER' && (
              <div className="p-3.5 rounded-[8px] bg-[#f9fafb] border border-[#e5e7eb] space-y-2.5 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#1f2937]">
                    Xe chạy chuyến này
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
                    className="h-[30px] px-3 rounded-[6px] bg-[#00897b] text-white text-[12px] font-medium hover:bg-[#00796b] cursor-pointer"
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
                        className="w-full h-[34px] border border-[#d1d5db] rounded-[6px] px-2.5 bg-white text-[13px]"
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
                        className="w-full h-[34px] border border-[#d1d5db] rounded-[6px] px-2.5 bg-white text-[13px]"
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
                        className="text-[#ef4444] hover:text-[#dc2626]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Route Segments Builder */}
            <div className="space-y-2.5 text-[13px]">
              {(routeModal.segments || []).map((seg: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] space-y-2"
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
                      className="h-[34px] border border-[#d1d5db] rounded-[6px] px-2.5 bg-white text-[13px]"
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
                      className="h-[34px] border border-[#d1d5db] rounded-[6px] px-2.5 bg-white text-[13px]"
                    />
                    <select
                      value={seg.direction}
                      onChange={(e) => {
                        const next = [...routeModal.segments];
                        next[idx] = { ...next[idx], direction: e.target.value };
                        setRouteModal({ ...routeModal, segments: next });
                      }}
                      className="h-[34px] border border-[#d1d5db] rounded-[6px] px-2.5 bg-white text-[13px]"
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
                      className="h-[34px] border border-[#d1d5db] rounded-[6px] px-2.5 bg-white text-[13px]"
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
                        className="w-full h-[34px] border border-[#d1d5db] rounded-[6px] px-2.5 bg-white text-[13px]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = routeModal.segments.filter(
                            (_: any, i: number) => i !== idx
                          );
                          setRouteModal({ ...routeModal, segments: next });
                        }}
                        className="text-[#ef4444] p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

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
                className="w-full h-[36px] rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-medium cursor-pointer"
              >
                + Thêm chặng
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRouteModal(null)}
                className="h-[34px] px-4 rounded-[6px] border border-[#d1d5db] bg-white text-[13px] font-medium text-[#4b5563] hover:bg-[#f9fafb] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="h-[34px] px-4 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-medium cursor-pointer"
              >
                Lưu
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 6A: ADD ETP REGISTRATION (Legacy 065-route-worker-add-route-form.png) */}
      {/* ==================================================================== */}
      {etpCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateEtp}
            className="bg-white rounded-[12px] shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-[#e5e7eb] w-full max-w-[560px] p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-[15px] font-bold text-[#1f2937]">
                Thêm tuyến đăng ký
              </h3>
              <button
                type="button"
                onClick={() => setEtpCreateModal(null)}
                className="text-[#ef4444] hover:text-[#dc2626] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3.5 text-[13px]">
              <div className="relative">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Nhân viên <span className="text-[#ef4444]">*</span>
                </span>
                <select
                  required
                  value={etpCreateModal.employeeId}
                  onChange={(e) =>
                    setEtpCreateModal({ ...etpCreateModal, employeeId: e.target.value })
                  }
                  className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white focus:outline-none focus:border-[#00897b]"
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.empCode} - {emp.fullName} ({emp.orgUnit?.name || 'MKVC'})
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Tuyến <span className="text-[#ef4444]">*</span>
                </span>
                <select
                  required
                  value={etpCreateModal.routeId}
                  onChange={(e) =>
                    setEtpCreateModal({ ...etpCreateModal, routeId: e.target.value })
                  }
                  className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white focus:outline-none focus:border-[#00897b]"
                >
                  <option value="">Tuyến *</option>
                  {routes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.routeCode} - {rt.routeName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Điểm đón <span className="text-[#ef4444]">*</span>
                </span>
                <select
                  required
                  value={etpCreateModal.pickupPointId}
                  onChange={(e) =>
                    setEtpCreateModal({ ...etpCreateModal, pickupPointId: e.target.value })
                  }
                  className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white focus:outline-none focus:border-[#00897b]"
                >
                  <option value="">Điểm đón *</option>
                  {points.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.pointCode} - {p.pointName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Điểm trả
                </span>
                <select
                  value={etpCreateModal.dropoffPointId || ''}
                  onChange={(e) =>
                    setEtpCreateModal({ ...etpCreateModal, dropoffPointId: e.target.value })
                  }
                  className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white focus:outline-none focus:border-[#00897b]"
                >
                  <option value="">Điểm trả</option>
                  {points.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.pointCode} - {p.pointName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Hiệu lực từ
                  </span>
                  <input
                    type="date"
                    required
                    value={etpCreateModal.effectiveFrom}
                    onChange={(e) =>
                      setEtpCreateModal({ ...etpCreateModal, effectiveFrom: e.target.value })
                    }
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                  />
                </div>
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Hiệu lực đến
                  </span>
                  <input
                    type="date"
                    value={etpCreateModal.effectiveTo || ''}
                    onChange={(e) =>
                      setEtpCreateModal({ ...etpCreateModal, effectiveTo: e.target.value })
                    }
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEtpCreateModal(null)}
                className="h-[34px] px-4 rounded-[6px] border border-[#d1d5db] bg-white text-[13px] font-medium text-[#4b5563] hover:bg-[#f9fafb] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="h-[34px] px-4 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-medium cursor-pointer"
              >
                Lưu
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 6B: DEACTIVATE ETP ("NGỪNG SỬ DỤNG XE") */}
      {/* ==================================================================== */}
      {etpDeactivateModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <form
            onSubmit={handleDeactivateEtp}
            className="bg-white rounded-[12px] shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-[#e5e7eb] w-full max-w-[440px] p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-[15px] font-bold text-[#1f2937]">
                Ngừng sử dụng xe tuyến: {etpDeactivateModal.empName}
              </h3>
              <button
                type="button"
                onClick={() => setEtpDeactivateModal(null)}
                className="text-[#ef4444] hover:text-[#dc2626] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-[13px] space-y-3">
              <p className="text-[#4b5563]">
                Hiệu lực từ: <b>{etpDeactivateModal.effectiveFrom}</b>
              </p>
              <div className="relative">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Hiệu lực đến <span className="text-[#ef4444]">*</span>
                </span>
                <input
                  type="date"
                  required
                  value={etpDeactivateModal.effectiveTo}
                  onChange={(e) =>
                    setEtpDeactivateModal({ ...etpDeactivateModal, effectiveTo: e.target.value })
                  }
                  className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEtpDeactivateModal(null)}
                className="h-[34px] px-4 rounded-[6px] border border-[#d1d5db] bg-white text-[13px] font-medium text-[#4b5563] hover:bg-[#f9fafb] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="h-[34px] px-4 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-medium cursor-pointer"
              >
                Lưu
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 6C: ETP HISTORY (Legacy 063-route-worker-registration-history.png) */}
      {/* ==================================================================== */}
      {etpHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-[#e5e7eb] w-full max-w-[1040px] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-[#1f2937]">
                Lịch sử đăng ký
              </h3>
              <button
                onClick={() => setEtpHistoryModal(null)}
                className="text-[#ef4444] hover:text-[#dc2626] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto border-t border-[#e5e7eb]">
              <table className="m-advance-table w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-[#e5e7eb] text-[12px] font-bold text-[#1f2937] h-[38px]">
                    <th className="px-2 w-[38px]">#</th>
                    <th className="px-2 w-[210px]">Tuyến</th>
                    <th className="px-2 w-[180px]">Điểm đón</th>
                    <th className="px-2 w-[180px]">Điểm trả</th>
                    <th className="px-2 w-[95px]">Hiệu lực từ</th>
                    <th className="px-2 w-[95px]">Hiệu lực đến</th>
                    <th className="px-2 w-[130px]">Trạng thái phê duyệt</th>
                    <th className="px-2 w-[125px]">Trạng thái hiệu lực</th>
                    <th className="px-2">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f4f6] text-[13px]">
                  {etpHistoryModal.registrations.map((reg, idx) => {
                    const isFuture =
                      reg.effectiveFrom > new Date().toISOString().slice(0, 10);
                    return (
                      <tr key={reg.id} className="h-[36px] hover:bg-[#f9fafb]">
                        <td className="px-2 text-[#374151]">{idx + 1}</td>
                        <td className="px-2 text-[#1f2937] truncate">
                          {reg.route?.routeName || reg.route?.routeCode || '—'}
                        </td>
                        <td className="px-2 text-[#374151] truncate">
                          {reg.pickupPoint
                            ? `${reg.pickupPoint.pointCode} - ${reg.pickupPoint.pointName}`
                            : '—'}
                        </td>
                        <td className="px-2 text-[#374151] truncate">
                          {reg.dropoffPoint
                            ? `${reg.dropoffPoint.pointCode} - ${reg.dropoffPoint.pointName}`
                            : '—'}
                        </td>
                        <td className="px-2 text-[#374151]">{reg.effectiveFrom}</td>
                        <td className="px-2 text-[#374151]">{reg.effectiveTo || '-'}</td>
                        <td className="px-2">
                          <PastelBadge
                            variant={reg.approvalStatus === 'APPROVED' ? 'green' : 'amber'}
                          >
                            {reg.approvalStatus === 'APPROVED' ? 'Đã phê duyệt' : 'Chờ xử lý'}
                          </PastelBadge>
                        </td>
                        <td className="px-2">
                          <PastelBadge variant={reg.activeFlag === 'Y' ? 'green' : 'red'}>
                            {reg.activeFlag === 'Y' ? 'Hoạt động' : 'Không hoạt động'}
                          </PastelBadge>
                        </td>
                        <td className="px-2 space-x-1">
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
                            className="px-2 py-0.5 rounded bg-[#e0f2f1] text-[#00796b] font-medium text-[11px] cursor-pointer"
                          >
                            Kích hoạt lại
                          </button>
                          {isFuture && (
                            <button
                              onClick={() => handleDeleteFutureEtp(reg.id)}
                              className="px-2 py-0.5 rounded bg-[#fee2e2] text-[#dc2626] font-medium text-[11px] cursor-pointer"
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
      {/* MODAL 6D: EXCEL IMPORT PREVIEW (Legacy 093 & 095) */}
      {/* ==================================================================== */}
      {etpImportModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-[#e5e7eb] w-full max-w-[520px] p-6 space-y-4">
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-[15px] font-bold text-[#1f2937]">
                Import danh sách Người đi xe tuyến từ Excel
              </h3>
              <button
                onClick={() => setEtpImportModal(false)}
                className="text-[#ef4444] hover:text-[#dc2626] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 border-2 border-dashed border-[#d1d5db] rounded-[8px] text-center space-y-2">
              <FileSpreadsheet className="w-8 h-8 text-[#00897b] mx-auto" />
              <p className="text-[13px] font-medium text-[#374151]">
                Chọn file Excel (.xlsx) theo mẫu TRMS_ETP_Template.xlsx
              </p>
              <input type="file" accept=".xlsx,.xls,.csv" className="text-[12px] text-[#6b7280]" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEtpImportModal(false)}
                className="h-[34px] px-4 rounded-[6px] border border-[#d1d5db] bg-white text-[13px] font-medium text-[#4b5563] hover:bg-[#f9fafb] cursor-pointer"
              >
                Hủy Import
              </button>
              <button
                onClick={() => {
                  setEtpImportModal(false);
                  showToast('Đã kiểm tra file Excel hợp lệ');
                }}
                className="h-[34px] px-4 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-medium cursor-pointer"
              >
                Xác nhận Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 7: CREATE COST CONFIG VERSION (Legacy 066-cost-config-new-version-form.png) */}
      {/* ==================================================================== */}
      {costConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveCostConfig}
            className="bg-white rounded-[12px] shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-[#e5e7eb] w-full max-w-[920px] p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-[#1f2937]">
                Tạo quy tắc chi phí
              </h3>
              <button
                type="button"
                onClick={() => setCostConfigModal(null)}
                className="text-[#ef4444] hover:text-[#dc2626] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-[13px]">
              {/* PHÂN LOẠI */}
              <div className="space-y-3">
                <div className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider border-b border-[#f3f4f6] pb-1.5">
                  PHÂN LOẠI
                </div>
                <div className="grid grid-cols-3 gap-3.5">
                  <div className="relative">
                    <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                      Loại cấu hình
                    </span>
                    <select
                      value={costConfigModal.configType}
                      onChange={(e) =>
                        setCostConfigModal({ ...costConfigModal, configType: e.target.value })
                      }
                      className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white focus:outline-none focus:border-[#00897b]"
                    >
                      <option value="COMMUTE">Tuyến thường</option>
                      <option value="EXTRA">Phát sinh</option>
                    </select>
                  </div>
                  <div className="relative">
                    <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                      Loại hành khách
                    </span>
                    <select
                      value={costConfigModal.passengerType}
                      onChange={(e) =>
                        setCostConfigModal({ ...costConfigModal, passengerType: e.target.value })
                      }
                      className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white focus:outline-none focus:border-[#00897b]"
                    >
                      <option value="STAFF">Nhân viên</option>
                      <option value="WORKER">Công nhân</option>
                    </select>
                  </div>
                  <div className="relative">
                    <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                      Loại xe
                    </span>
                    <select
                      value={costConfigModal.vehicleType}
                      onChange={(e) =>
                        setCostConfigModal({ ...costConfigModal, vehicleType: e.target.value })
                      }
                      className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white focus:outline-none focus:border-[#00897b]"
                    >
                      <option value="SEDAN_4">Xe 4 chỗ</option>
                      <option value="SUV_7">Xe 7 chỗ</option>
                      <option value="VAN_16">Van 16 chỗ</option>
                      <option value="BUS_29">Bus 29 chỗ</option>
                      <option value="BUS_45">Bus 45 chỗ</option>
                    </select>
                  </div>
                </div>
                {costConfigModal.configType === 'EXTRA' &&
                  costConfigModal.passengerType === 'WORKER' && (
                    <div className="relative">
                      <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                        Phạm vi áp dụng
                      </span>
                      <select
                        value={costConfigModal.pricingScope || 'STANDARD'}
                        onChange={(e) =>
                          setCostConfigModal({ ...costConfigModal, pricingScope: e.target.value })
                        }
                        className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white focus:outline-none focus:border-[#00897b]"
                      >
                        <option value="STANDARD">Khu vực tiêu chuẩn</option>
                        <option value="HOA_BINH">Có qua Hòa Bình</option>
                      </select>
                    </div>
                  )}
              </div>

              {/* GIÁ THUÊ CƠ BẢN THEO THỜI GIAN / KM */}
              <div className="space-y-3">
                <div className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider border-b border-[#f3f4f6] pb-1.5">
                  GIÁ THUÊ CƠ BẢN THEO THỜI GIAN / KM
                </div>
                <div className="grid grid-cols-4 gap-3.5">
                  <div className="relative">
                    <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                      Giá thuê tháng cơ bản (VND)
                    </span>
                    <input
                      type="number"
                      required
                      value={costConfigModal.rules[0]?.unitPrice || '0'}
                      onChange={(e) => {
                        const nextRules = [...costConfigModal.rules];
                        nextRules[0] = { ...nextRules[0], unitPrice: e.target.value };
                        setCostConfigModal({ ...costConfigModal, rules: nextRules });
                      }}
                      className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                      Hạn mức KM hàng tháng
                    </span>
                    <input
                      type="number"
                      defaultValue={2600}
                      className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                      Giá KM vượt mức (VNĐ)
                    </span>
                    <input
                      type="number"
                      defaultValue={0}
                      className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                      Giá OT / giờ (VNĐ)
                    </span>
                    <input
                      type="number"
                      defaultValue={0}
                      className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                    />
                  </div>
                </div>
              </div>

              {/* PHỤ PHÍ DÙNG CHUNG */}
              <div className="space-y-3">
                <div className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider border-b border-[#f3f4f6] pb-1.5">
                  PHỤ PHÍ DÙNG CHUNG
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="relative">
                    <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                      Phụ cấp điện thoại (VND)
                    </span>
                    <input
                      type="number"
                      defaultValue={0}
                      className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                    />
                  </div>
                </div>
              </div>

              {/* THỜI HẠN HIỆU LỰC */}
              <div className="space-y-3">
                <div className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider border-b border-[#f3f4f6] pb-1.5">
                  THỜI HẠN HIỆU LỰC
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="relative">
                    <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                      Áp dụng từ <span className="text-[#ef4444]">*</span>
                    </span>
                    <input
                      type="date"
                      required
                      value={costConfigModal.effectiveFrom}
                      onChange={(e) =>
                        setCostConfigModal({ ...costConfigModal, effectiveFrom: e.target.value })
                      }
                      className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                      Hiệu lực đến
                    </span>
                    <input
                      type="date"
                      value={costConfigModal.effectiveTo || ''}
                      onChange={(e) =>
                        setCostConfigModal({ ...costConfigModal, effectiveTo: e.target.value })
                      }
                      className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCostConfigModal(null)}
                className="h-[34px] px-4 rounded-[6px] border border-[#d1d5db] bg-white text-[13px] font-medium text-[#4b5563] hover:bg-[#f9fafb] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="h-[34px] px-4 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-medium cursor-pointer"
              >
                Lưu phiên bản
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
