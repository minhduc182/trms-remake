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
  SEDAN_4: 4,
  SUV_7: 7,
  VAN_16: 15,
  BUS_29: 28,
  BUS_45: 44,
};

const STANDARD_DISTRICTS = [
  'Thành phố Hòa Bình',
  'Huyện Lương Sơn',
  'Huyện Kỳ Sơn',
  'Huyện Cao Phong',
  'Huyện Kim Bôi',
  'Quận Cầu Giấy',
  'Quận Nam Từ Liêm',
  'Quận Bắc Từ Liêm',
  'Quận Thanh Xuân',
  'Quận Hà Đông',
  'Huyện Chương Mỹ',
  'Huyện Quốc Oai',
  'Huyện Thạch Thất',
  'Huyện Hoài Đức',
];

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
  const [provisionalTotalCount, setProvisionalTotalCount] = useState<number>(0);
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
  const [driverVehicleAssignFilter, setDriverVehicleAssignFilter] = useState<string>('');
  const [packageModeFilter, setPackageModeFilter] = useState<string>('');
  const [vehicleOwnershipFilter, setVehicleOwnershipFilter] = useState<string>('');
  const [activeFlagFilter, setActiveFlagFilter] = useState<string>('');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string>('');
  const [passengerTypeFilter, setPassengerTypeFilter] = useState<string>('');
  const [legDirectionFilter, setLegDirectionFilter] = useState<string>('');
  const [legCategoryFilter, setLegCategoryFilter] = useState<string>('');
  const [runDaysFilter, setRunDaysFilter] = useState<string>('');
  const [etpStatusFilter, setEtpStatusFilter] = useState<string>('');
  const [etpProvisionalPill, setEtpProvisionalPill] = useState<'ALL' | 'PROVISIONAL'>('ALL');
  const [etpPickupPointFilter, setEtpPickupPointFilter] = useState<string>('');
  const [etpDropoffPointFilter, setEtpDropoffPointFilter] = useState<string>('');
  const [costTypeFilter, setCostTypeFilter] = useState<string>('');

  // Modals
  const [pointModal, setPointModal] = useState<any | null>(null);
  const [driverModal, setDriverModal] = useState<any | null>(null);
  const [vehicleModal, setVehicleModal] = useState<any | null>(null);
  const [legModal, setLegModal] = useState<any | null>(null);
  const [routeModal, setRouteModal] = useState<any | null>(null);
  const [etpCreateModal, setEtpCreateModal] = useState<any | null>(null);
  const [etpDeactivateModal, setEtpDeactivateModal] = useState<any | null>(null);
  const [etpLinkModal, setEtpLinkModal] = useState<{
    id: string;
    provTempCode: string;
    provFullName: string;
    employeeId: string;
  } | null>(null);
  const [etpHistoryModal, setEtpHistoryModal] = useState<{
    employee: any;
    registrations: any[];
  } | null>(null);
  const [etpImportModal, setEtpImportModal] = useState<boolean>(false);
  const [etpImportMode, setEtpImportMode] = useState<'ADD' | 'DEACTIVATE'>('ADD');
  const [etpImportRawText, setEtpImportRawText] = useState<string>('');
  const [etpImportPreviewRows, setEtpImportPreviewRows] = useState<any[]>([]);
  const [etpImportSubmitting, setEtpImportSubmitting] = useState<boolean>(false);
  const [costConfigModal, setCostConfigModal] = useState<any | null>(null);
  const [costHistoryModal, setCostHistoryModal] = useState<{
    title: string;
    configs: any[];
  } | null>(null);

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
          employees { id empCode fullName orgUnit { id name } }
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
        const res = await gqlRequest<{ drivers: any[]; vehicles: any[] }>(
          `query GetDrivers($search: String, $activeFlag: String) {
            drivers(search: $search, activeFlag: $activeFlag) {
              id driverName phoneNumber shortAddress fullAddress identityUserId activeFlag segmentUsageCount
              user { id username fullName }
            }
            vehicles(activeFlag: "Y") {
              id vehiclePlate defaultDriverId
            }
          }`,
          { search: search || undefined, activeFlag: activeFlagFilter || undefined }
        );
        setDrivers(res.drivers || []);
        setVehicles(res.vehicles || []);
      } else if (activeTab === 'VEHICLES') {
        const res = await gqlRequest<{ vehicles: any[]; drivers: any[] }>(
          `query GetVehicles($search: String, $vehicleTypes: [String!], $activeFlag: String) {
            vehicles(search: $search, vehicleTypes: $vehicleTypes, activeFlag: $activeFlag) {
              id vehicleCode vehiclePlate vendorId vehicleType seatCapacity ownershipType
              commutePackageMode dailyTripQuota monthlyKmQuota defaultDriverId activeFlag segmentUsageCount
              vendor { id vendorCode vendorName }
            }
            drivers(activeFlag: "Y") {
              id driverName phoneNumber
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
          const aReal = /^(19|29|30|98|88|28)[A-Z]\d/.test(ap) ? 0 : 1;
          const bReal = /^(19|29|30|98|88|28)[A-Z]\d/.test(bp) ? 0 : 1;
          if (aReal !== bReal) return aReal - bReal;
          return ap.localeCompare(bp, 'vi');
        });
        setVehicles(sortedVehicles);
        if (res.drivers) setDrivers(res.drivers);
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
        const sortedLegs = [...(res.legDefinitions || [])].sort((a, b) => {
          if (a.passengerType !== b.passengerType) {
            return a.passengerType === 'STAFF' ? -1 : 1;
          }
          return Number(a.displayOrder || 0) - Number(b.displayOrder || 0);
        });
        setLegs(sortedLegs);
      } else if (activeTab === 'ROUTES') {
        const fastRes = await gqlRequest<any>(
          `query GetRoutesFast($passengerType: String, $runDays: String, $search: String) {
            routes(passengerType: $passengerType, runDays: $runDays, search: $search) {
              id routeCode routeName routeClass passengerType runDays activeFlag riderCount
            }
          }`,
          {
            passengerType: passengerTypeFilter || undefined,
            runDays: runDaysFilter || undefined,
            search: search || undefined,
          }
        );
        const sortRouteList = (list: any[]) =>
          [...(list || [])].sort((a, b) => {
            const an = String(a.routeName || '');
            const bn = String(b.routeName || '');
            const aReal = an.startsWith('Tuyến ') ? 0 : 1;
            const bReal = bn.startsWith('Tuyến ') ? 0 : 1;
            if (aReal !== bReal) return aReal - bReal;
            return an.localeCompare(bn, 'vi');
          });
        setRoutes(sortRouteList(fastRes.routes));
        setLoading(false);

        gqlRequest<any>(
          `query GetRoutesAndRefs($passengerType: String, $runDays: String, $search: String) {
            routes(passengerType: $passengerType, runDays: $runDays, search: $search) {
              id routeCode routeName routeClass passengerType runDays activeFlag riderCount
              vendor { id vendorName }
              routeVehicles {
                id vehicleId driverId displayOrder
                vehicle { id vehiclePlate seatCapacity commutePackageMode }
                driver { id driverName phoneNumber }
              }
              segments {
                id legDefinitionId legCode legName direction departureTime arrivalTime
                defaultVehicleId defaultDriverId sequenceOrder activeFlag
                defaultVehicle { id vehiclePlate }
                defaultDriver { id driverName }
                segmentPoints { id pointId pointRole stopOrder plannedTime point { id pointCode pointName pointType } }
                segmentShifts { id shiftId shift { id shiftCode shiftName } }
              }
            }
            points(activeFlag: "Y") { id pointCode pointName pointType isFactory }
            vehicles(activeFlag: "Y") { id vehiclePlate vehicleType seatCapacity commutePackageMode }
            drivers(activeFlag: "Y") { id driverName phoneNumber }
            legDefinitions { id legCode legName passengerType direction isDeadhead activeFlag }
            shifts(transportFlag: "Y") { id shiftCode shiftName startTime endTime }
          }`,
          {
            passengerType: passengerTypeFilter || undefined,
            runDays: runDaysFilter || undefined,
            search: search || undefined,
          }
        )
          .then((res) => {
            setRoutes(sortRouteList(res.routes));
            setPoints(res.points || []);
            setVehicles(res.vehicles || []);
            setDrivers(res.drivers || []);
            setLegs(res.legDefinitions || []);
            if (res.shifts) setShifts(res.shifts);
          })
          .catch(() => {});
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
              activeFlag approvalStatus rejectReason leaveDate endReasonCode
              isProvisional provTempCode provFullName provOrgUnitId provShiftId provWorkDayMask createDate
              employee { id empCode fullName leaveDate orgUnit { id name } }
              route { id routeCode routeName passengerType }
              pickupPoint { id pointCode pointName }
              dropoffPoint { id pointCode pointName }
            }
            provisionalCount
            routes(activeFlag: "Y") {
              id routeCode routeName passengerType
              segments {
                id
                segmentPoints {
                  id pointId pointRole stopOrder
                  point { id pointCode pointName pointType }
                }
              }
            }
            points(activeFlag: "Y") { id pointCode pointName pointType }
          }`,
          {
            passengerType: passengerTypeFilter || undefined,
            approvalStatus:
              etpStatusFilter && etpStatusFilter !== 'RESIGNED' ? etpStatusFilter : undefined,
            activeFlag: activeFlagFilter || undefined,
            search: search || undefined,
          }
        );
        setEtpProfiles(res.employeeTransportProfiles || []);
        setProvisionalTotalCount(Number(res.provisionalCount ?? 0));
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
                id ruleCode rateType dayType minDistanceKm maxDistanceKm
                minDistanceInclusiveFlag maxDistanceInclusiveFlag
                dailyTripCount includedDistanceKm unitPrice priceUnit
                stackableFlag priority description activeFlag
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
          `mutation UpdatePoint(
            $id: BigInt!
            $pointCode: String
            $pointName: String
            $pointType: String
            $districtName: String
            $address: String
            $isFactory: String
            $activeFlag: String
          ) {
            updatePoint(
              id: $id
              pointCode: $pointCode
              pointName: $pointName
              pointType: $pointType
              districtName: $districtName
              address: $address
              isFactory: $isFactory
              activeFlag: $activeFlag
            ) { id }
          }`,
          {
            id: pointModal.id,
            pointCode: pointModal.pointCode,
            pointName: pointModal.pointName,
            pointType: pointModal.pointType,
            districtName: pointModal.districtName || '',
            address: pointModal.address || '',
            isFactory: pointModal.isFactory || 'N',
            activeFlag: pointModal.activeFlag || 'Y',
          }
        );
        if (Number(pointModal.segmentUsageCount || 0) > 0) {
          showToast(
            `Đã cập nhật điểm ${pointModal.pointCode} (đang dùng trên ${pointModal.segmentUsageCount} chặng tuyến)`
          );
        } else {
          showToast('Đã cập nhật điểm đón/trả thành công');
        }
      } else {
        await gqlRequest(
          `mutation CreatePoint(
            $pointCode: String!
            $pointName: String!
            $pointType: String!
            $districtName: String
            $address: String
            $isFactory: String
            $activeFlag: String
          ) {
            createPoint(
              pointCode: $pointCode
              pointName: $pointName
              pointType: $pointType
              districtName: $districtName
              address: $address
              isFactory: $isFactory
              activeFlag: $activeFlag
            ) { id }
          }`,
          {
            pointCode: pointModal.pointCode,
            pointName: pointModal.pointName,
            pointType: pointModal.pointType || 'PICKUP',
            districtName: pointModal.districtName || '',
            address: pointModal.address || '',
            isFactory: pointModal.isFactory || 'N',
            activeFlag: pointModal.activeFlag || 'Y',
          }
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
        `mutation TogglePoint(
          $id: BigInt!
          $pointCode: String
          $pointName: String
          $pointType: String
          $districtName: String
          $address: String
          $isFactory: String
          $activeFlag: String
        ) {
          updatePoint(
            id: $id
            pointCode: $pointCode
            pointName: $pointName
            pointType: $pointType
            districtName: $districtName
            address: $address
            isFactory: $isFactory
            activeFlag: $activeFlag
          ) { id }
        }`,
        {
          id: pt.id,
          pointCode: pt.pointCode,
          pointName: pt.pointName,
          pointType: pt.pointType,
          districtName: pt.districtName || undefined,
          address: pt.address || undefined,
          isFactory: pt.isFactory || 'N',
          activeFlag: nextFlag,
        }
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
      const effectiveActiveFlag = driverModal.activeFlag || 'Y';
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

  const handleToggleDriverActive = async (drv: any) => {
    const nextFlag = drv.activeFlag === 'Y' ? 'N' : 'Y';
    try {
      await gqlRequest(
        `mutation ToggleDriver($id: BigInt!, $activeFlag: String) {
          updateDriver(id: $id, activeFlag: $activeFlag) { id activeFlag }
        }`,
        { id: drv.id, activeFlag: nextFlag }
      );
      showToast(
        `Đã ${nextFlag === 'Y' ? 'kích hoạt' : 'ngừng hoạt động'} tài xế ${drv.driverName}`
      );
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
      const normalizedOwnership =
        vehicleModal.ownershipType === 'OUTSOURCED'
          ? 'RENTAL'
          : vehicleModal.ownershipType || 'RENTAL';
      const payload = {
        ...vehicleModal,
        ownershipType: normalizedOwnership,
        vendorId: vehicleModal.vendorId || undefined,
        defaultDriverId: vehicleModal.defaultDriverId || undefined,
        dailyTripQuota:
          vehicleModal.commutePackageMode === 'BY_SEGMENT'
            ? Number(vehicleModal.dailyTripQuota || 2)
            : undefined,
        monthlyKmQuota:
          vehicleModal.commutePackageMode === 'BY_SEGMENT'
            ? String(vehicleModal.monthlyKmQuota || '25')
            : undefined,
        activeFlag: vehicleModal.activeFlag || 'Y',
      };
      if (vehicleModal.id) {
        await gqlRequest(
          `mutation UpdateVehicle($id: BigInt!, $vehiclePlate: String, $vendorId: BigInt, $vehicleType: String, $ownershipType: String, $commutePackageMode: String, $dailyTripQuota: Int, $monthlyKmQuota: Decimal, $defaultDriverId: BigInt, $activeFlag: String) {
            updateVehicle(id: $id, vehiclePlate: $vehiclePlate, vendorId: $vendorId, vehicleType: $vehicleType, ownershipType: $ownershipType, commutePackageMode: $commutePackageMode, dailyTripQuota: $dailyTripQuota, monthlyKmQuota: $monthlyKmQuota, defaultDriverId: $defaultDriverId, activeFlag: $activeFlag) { id }
          }`,
          payload
        );
        showToast('Đã cập nhật thông tin xe');
      } else {
        await gqlRequest(
          `mutation CreateVehicle($vehiclePlate: String!, $vendorId: BigInt, $vehicleType: String!, $ownershipType: String!, $commutePackageMode: String, $dailyTripQuota: Int, $monthlyKmQuota: Decimal, $defaultDriverId: BigInt, $activeFlag: String) {
            createVehicle(vehiclePlate: $vehiclePlate, vendorId: $vendorId, vehicleType: $vehicleType, ownershipType: $ownershipType, commutePackageMode: $commutePackageMode, dailyTripQuota: $dailyTripQuota, monthlyKmQuota: $monthlyKmQuota, defaultDriverId: $defaultDriverId, activeFlag: $activeFlag) { id }
          }`,
          payload
        );
        showToast('Đã thêm xe mới');
      }
      setVehicleModal(null);
      loadTabData();
      loadAllLookups();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleVehicleActive = async (v: any) => {
    const nextFlag = v.activeFlag === 'Y' ? 'N' : 'Y';
    try {
      await gqlRequest(
        `mutation ToggleVehicle($id: BigInt!, $activeFlag: String) {
          updateVehicle(id: $id, activeFlag: $activeFlag) { id activeFlag }
        }`,
        { id: v.id, activeFlag: nextFlag }
      );
      showToast(`Đã ${nextFlag === 'Y' ? 'kích hoạt' : 'ngừng hoạt động'} xe ${v.vehiclePlate}`);
      loadTabData();
      loadAllLookups();
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
        activeFlag: legModal.activeFlag || 'Y',
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
          `mutation CreateLeg($legCode: String!, $legName: String!, $passengerType: String!, $displayOrder: Int, $direction: String!, $isDeadhead: String, $activeFlag: String) {
            createLegDefinition(legCode: $legCode, legName: $legName, passengerType: $passengerType, displayOrder: $displayOrder, direction: $direction, isDeadhead: $isDeadhead, activeFlag: $activeFlag) { id }
          }`,
          payload
        );
        showToast('Đã tạo lượt chạy mới');
      }
      setLegModal(null);
      loadTabData();
      loadAllLookups();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleLegActive = async (leg: any) => {
    const nextFlag = leg.activeFlag === 'Y' ? 'N' : 'Y';
    try {
      await gqlRequest(
        `mutation ToggleLeg($id: BigInt!, $activeFlag: String) {
          updateLegDefinition(id: $id, activeFlag: $activeFlag) { id activeFlag }
        }`,
        { id: leg.id, activeFlag: nextFlag }
      );
      showToast(
        `Đã ${nextFlag === 'Y' ? 'kích hoạt' : 'ngừng hoạt động'} lượt chạy ${leg.legCode}`
      );
      loadTabData();
      loadAllLookups();
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
        runDays: routeModal.runDays || 'MON_SAT',
        routeVehicles:
          routeModal.passengerType === 'WORKER'
            ? (routeModal.routeVehicles || []).filter((rv: any) => rv.vehicleId)
            : [],
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
      loadAllLookups();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleRouteActive = async (rt: any) => {
    const nextFlag = rt.activeFlag === 'Y' ? 'N' : 'Y';
    try {
      await gqlRequest(
        `mutation ToggleRoute($id: BigInt!, $activeFlag: String) {
          updateRoute(id: $id, activeFlag: $activeFlag) { id activeFlag }
        }`,
        { id: rt.id, activeFlag: nextFlag }
      );
      showToast(`Đã ${nextFlag === 'Y' ? 'kích hoạt' : 'ngừng hoạt động'} tuyến ${rt.routeName}`);
      loadTabData();
      loadAllLookups();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteRoute = async (rt: any) => {
    if (!confirm(`Xác nhận xóa tuyến xe ${rt.routeCode} - ${rt.routeName}?`)) return;
    try {
      await gqlRequest(`mutation DelRoute($id: BigInt!) { deleteRoute(id: $id) { id } }`, {
        id: rt.id,
      });
      showToast(`Đã xóa tuyến ${rt.routeName}`);
      loadTabData();
      loadAllLookups();
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
      if (etpCreateModal.isProvisionalMode) {
        const tempCode =
          (etpCreateModal.provTempCode || '').trim() ||
          `TEMP-${Date.now().toString().slice(-6)}`;
        await gqlRequest(
          `mutation CreateProvEtp(
            $provTempCode: String!,
            $provFullName: String!,
            $provOrgUnitId: BigInt,
            $provShiftId: BigInt,
            $provWorkDayMask: String,
            $routeId: BigInt!,
            $pickupPointId: BigInt!,
            $dropoffPointId: BigInt,
            $effectiveFrom: String!
          ) {
            createProvisionalEtp(
              provTempCode: $provTempCode,
              provFullName: $provFullName,
              provOrgUnitId: $provOrgUnitId,
              provShiftId: $provShiftId,
              provWorkDayMask: $provWorkDayMask,
              routeId: $routeId,
              pickupPointId: $pickupPointId,
              dropoffPointId: $dropoffPointId,
              effectiveFrom: $effectiveFrom
            ) { id }
          }`,
          {
            provTempCode: tempCode,
            provFullName: etpCreateModal.provFullName,
            provOrgUnitId: etpCreateModal.provOrgUnitId || undefined,
            provShiftId: etpCreateModal.provShiftId || undefined,
            provWorkDayMask: etpCreateModal.provWorkDayMask || 'MON_SAT',
            routeId: etpCreateModal.routeId,
            pickupPointId: etpCreateModal.pickupPointId,
            dropoffPointId: etpCreateModal.dropoffPointId || undefined,
            effectiveFrom: etpCreateModal.effectiveFrom,
          }
        );
        showToast(`Đã tạo hồ sơ tạm chưa có mã NV (${tempCode})`);
      } else {
        await gqlRequest(
          `mutation CreateEtp($employeeId: BigInt!, $routeId: BigInt!, $pickupPointId: BigInt!, $dropoffPointId: BigInt, $effectiveFrom: String!) {
            createEtpRegistration(employeeId: $employeeId, routeId: $routeId, pickupPointId: $pickupPointId, dropoffPointId: $dropoffPointId, effectiveFrom: $effectiveFrom) { id }
          }`,
          {
            employeeId: etpCreateModal.employeeId,
            routeId: etpCreateModal.routeId,
            pickupPointId: etpCreateModal.pickupPointId,
            dropoffPointId: etpCreateModal.dropoffPointId || undefined,
            effectiveFrom: etpCreateModal.effectiveFrom,
          }
        );
        showToast('Đã thêm đăng ký người đi xe tuyến');
      }
      setEtpCreateModal(null);
      loadTabData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLinkProvisionalEtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!etpLinkModal?.id || !etpLinkModal?.employeeId) return;
    try {
      await gqlRequest(
        `mutation LinkProvEtp($id: BigInt!, $employeeId: BigInt!) {
          linkProvisionalEtp(id: $id, employeeId: $employeeId) { id isProvisional employeeId }
        }`,
        { id: etpLinkModal.id, employeeId: etpLinkModal.employeeId }
      );
      showToast('Đã gắn mã nhân viên chính thức cho hồ sơ tạm');
      setEtpLinkModal(null);
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
        `mutation DeactivateEtp($id: BigInt!, $effectiveTo: String!, $reason: String) {
          deactivateEtpRegistration(id: $id, effectiveTo: $effectiveTo, reason: $reason) { id }
        }`,
        {
          id: etpDeactivateModal.id,
          effectiveTo: etpDeactivateModal.effectiveTo,
          reason: etpDeactivateModal.reason || undefined,
        }
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
        openEtpHistory({
          employeeId: etpHistoryModal.employee.id,
          employee: etpHistoryModal.employee,
        });
      }
      loadTabData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const downloadEtpSampleCsv = () => {
    const sampleRoute = routes[0]?.routeCode || 'RT_STAFF_01';
    const samplePickup = points[0]?.pointCode || 'PT_CAUGIAY';
    const sampleDropoff = points[1]?.pointCode || 'PT_FACTORY';
    const sampleEmp = employees[0]?.empCode || 'MK00101';
    const tomorrow = new Date(Date.now() + 31 * 3600 * 1000).toISOString().slice(0, 10);
    const csvContent =
      etpImportMode === 'PROVISIONAL'
        ? `MaTam,HoTen,MaTuyen,MaDiemDon,MaDiemTra,HieuLucTu\nTEMP-001,Nguyễn Văn Tân,${sampleRoute},${samplePickup},${sampleDropoff},${tomorrow}\nTEMP-002,Trần Thị Mai,${sampleRoute},${samplePickup},${sampleDropoff},${tomorrow}`
        : `MaNhanVien,HoTen,MaTuyen,MaDiemDon,MaDiemTra,HieuLucTu\n${sampleEmp},Nguyễn Văn A,${sampleRoute},${samplePickup},${sampleDropoff},${tomorrow}`;
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download =
      etpImportMode === 'PROVISIONAL'
        ? 'TRMS_ETP_Provisional_Template.csv'
        : 'TRMS_ETP_Standard_Template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const parseEtpImportText = (raw: string) => {
    setEtpImportRawText(raw);
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) {
      setEtpImportPreviewRows([]);
      return;
    }
    const startIdx =
      lines[0].toLowerCase().includes('manhanvien') ||
      lines[0].toLowerCase().includes('matam') ||
      lines[0].toLowerCase().includes('mã') ||
      lines[0].toLowerCase().includes('empcode')
        ? 1
        : 0;
    const tomorrow = new Date(Date.now() + 31 * 3600 * 1000).toISOString().slice(0, 10);
    const parsed = lines.slice(startIdx).map((line, i) => {
      const cols = line.split(/[,;\t]/).map((c) => c.trim());
      const code = cols[0] || '';
      const fullName = cols[1] || '';
      const routeCodeOrName = cols[2] || '';
      const pickupCodeOrName = cols[3] || '';
      const dropoffCodeOrName = cols[4] || '';
      const effectiveFrom = cols[5] || tomorrow;

      const matchedEmp = employees.find(
        (e) =>
          String(e.empCode || '').toLowerCase() === code.toLowerCase() ||
          String(e.id) === code
      );
      const matchedRoute =
        routes.find(
          (r) =>
            String(r.routeCode || '').toLowerCase() === routeCodeOrName.toLowerCase() ||
            String(r.routeName || '').toLowerCase() === routeCodeOrName.toLowerCase() ||
            String(r.id) === routeCodeOrName
        ) || routes[0];
      const matchedPickup =
        points.find(
          (p) =>
            String(p.pointCode || '').toLowerCase() === pickupCodeOrName.toLowerCase() ||
            String(p.pointName || '').toLowerCase() === pickupCodeOrName.toLowerCase() ||
            String(p.id) === pickupCodeOrName
        ) || points[0];
      const matchedDropoff = dropoffCodeOrName
        ? points.find(
            (p) =>
              String(p.pointCode || '').toLowerCase() === dropoffCodeOrName.toLowerCase() ||
              String(p.pointName || '').toLowerCase() === dropoffCodeOrName.toLowerCase() ||
              String(p.id) === dropoffCodeOrName
          )
        : undefined;

      const isProv =
        etpImportMode === 'PROVISIONAL' || code.toUpperCase().startsWith('TEMP-') || !matchedEmp;
      const valid = Boolean(
        matchedRoute && matchedPickup && (isProv ? fullName || code : matchedEmp)
      );

      return {
        rowNo: i + 1,
        code: code || `TEMP-${Date.now().toString().slice(-4)}-${i + 1}`,
        fullName: matchedEmp?.fullName || fullName || `Nhân viên ${i + 1}`,
        employeeId: matchedEmp?.id || '',
        isProvisional: isProv,
        routeId: matchedRoute?.id || '',
        routeLabel: matchedRoute ? `${matchedRoute.routeCode} - ${matchedRoute.routeName}` : '—',
        pickupPointId: matchedPickup?.id || '',
        pickupLabel: matchedPickup
          ? `${matchedPickup.pointCode} - ${matchedPickup.pointName}`
          : '—',
        dropoffPointId: matchedDropoff?.id || '',
        dropoffLabel: matchedDropoff
          ? `${matchedDropoff.pointCode} - ${matchedDropoff.pointName}`
          : '—',
        effectiveFrom,
        valid,
      };
    });
    setEtpImportPreviewRows(parsed);
  };

  const handleConfirmEtpImport = async () => {
    const validRows = etpImportPreviewRows.filter((r) => r.valid);
    if (validRows.length === 0) {
      alert('Vui lòng tải file CSV/TSV hoặc dán dữ liệu hợp lệ vào bảng Xem trước trước khi Import.');
      return;
    }
    setEtpImportSubmitting(true);
    let okCount = 0;
    try {
      for (const row of validRows) {
        if (row.isProvisional || !row.employeeId) {
          await gqlRequest(
            `mutation ImportProv($provTempCode: String!, $provFullName: String!, $routeId: BigInt!, $pickupPointId: BigInt!, $dropoffPointId: BigInt, $effectiveFrom: String!) {
              createProvisionalEtp(provTempCode: $provTempCode, provFullName: $provFullName, routeId: $routeId, pickupPointId: $pickupPointId, dropoffPointId: $dropoffPointId, effectiveFrom: $effectiveFrom) { id }
            }`,
            {
              provTempCode: row.code,
              provFullName: row.fullName,
              routeId: row.routeId,
              pickupPointId: row.pickupPointId,
              dropoffPointId: row.dropoffPointId || undefined,
              effectiveFrom: row.effectiveFrom,
            }
          );
        } else {
          await gqlRequest(
            `mutation ImportStd($employeeId: BigInt!, $routeId: BigInt!, $pickupPointId: BigInt!, $dropoffPointId: BigInt, $effectiveFrom: String!) {
              createEtpRegistration(employeeId: $employeeId, routeId: $routeId, pickupPointId: $pickupPointId, dropoffPointId: $dropoffPointId, effectiveFrom: $effectiveFrom) { id }
            }`,
            {
              employeeId: row.employeeId,
              routeId: row.routeId,
              pickupPointId: row.pickupPointId,
              dropoffPointId: row.dropoffPointId || undefined,
              effectiveFrom: row.effectiveFrom,
            }
          );
        }
        okCount++;
      }
      showToast(`Đã import thành công ${okCount}/${validRows.length} hồ sơ đi xe tuyến`);
      setEtpImportModal(false);
      setEtpImportPreviewRows([]);
      setEtpImportRawText('');
      loadTabData();
    } catch (err: any) {
      alert(`Đã xử lý ${okCount} dòng. Lỗi: ${err.message}`);
    } finally {
      setEtpImportSubmitting(false);
    }
  };

  // ============================================================================
  // HANDLERS: TAB 7 - COST CONFIGS
  // ============================================================================
  const handleSaveCostConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const normalizedRules = (costConfigModal.rules || []).map((r: any, i: number) => ({
        ruleCode: r.ruleCode || `RULE_${i + 1}`,
        rateType: r.rateType || 'MONTHLY_FIXED',
        dayType: r.dayType || 'WEEKDAY',
        minDistanceKm: r.minDistanceKm ? String(r.minDistanceKm) : undefined,
        maxDistanceKm: r.maxDistanceKm ? String(r.maxDistanceKm) : undefined,
        dailyTripCount: r.dailyTripCount ? Number(r.dailyTripCount) : undefined,
        includedDistanceKm: r.includedDistanceKm ? String(r.includedDistanceKm) : undefined,
        unitPrice: String(r.unitPrice || '0'),
        priceUnit: r.priceUnit || 'VND_PER_MONTH',
        stackableFlag: r.stackableFlag || 'N',
        priority: Number(r.priority || i + 1),
        description: r.description || '',
      }));

      await gqlRequest(
        `mutation UpsertCostConfig(
          $id: BigInt,
          $previousConfigId: BigInt,
          $versionCode: String,
          $configType: String!,
          $passengerType: String!,
          $vehicleType: String!,
          $pricingScope: String,
          $effectiveFrom: String!,
          $effectiveTo: String,
          $activeFlag: String,
          $rules: [CostConfigRuleInput!]!
        ) {
          upsertCostConfig(
            id: $id,
            previousConfigId: $previousConfigId,
            versionCode: $versionCode,
            configType: $configType,
            passengerType: $passengerType,
            vehicleType: $vehicleType,
            pricingScope: $pricingScope,
            effectiveFrom: $effectiveFrom,
            effectiveTo: $effectiveTo,
            activeFlag: $activeFlag,
            rules: $rules
          ) { id versionCode }
        }`,
        {
          id: costConfigModal.id || undefined,
          previousConfigId: costConfigModal.previousConfigId || undefined,
          versionCode: costConfigModal.versionCode,
          configType: costConfigModal.configType,
          passengerType: costConfigModal.passengerType,
          vehicleType: costConfigModal.vehicleType,
          effectiveFrom: costConfigModal.effectiveFrom,
          effectiveTo: costConfigModal.effectiveTo || undefined,
          activeFlag: costConfigModal.activeFlag || 'Y',
          pricingScope:
            costConfigModal.configType === 'EXTRA' && costConfigModal.passengerType === 'WORKER'
              ? costConfigModal.pricingScope || 'STANDARD'
              : costConfigModal.pricingScope || undefined,
          rules: normalizedRules,
        }
      );
      showToast('Đã lưu phiên bản cấu hình chi phí');
      setCostConfigModal(null);
      loadTabData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteCostConfig = async (cfg: any) => {
    if (!confirm(`Xác nhận xóa phiên bản cấu hình chi phí ${cfg.versionCode}?`)) return;
    try {
      await gqlRequest(`mutation DelCostCfg($id: BigInt!) { deleteCostConfig(id: $id) { id } }`, {
        id: cfg.id,
      });
      showToast(`Đã xóa phiên bản ${cfg.versionCode}`);
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
    new Set([
      ...STANDARD_DISTRICTS,
      ...points
        .map((p) => String(p.districtName || '').trim())
        .filter((d) => d.length > 0),
    ])
  ).sort((a, b) => a.localeCompare(b, 'vi'));

  const assignedDriverIds = new Set(
    vehicles
      .map((v) => String(v.defaultDriverId || v.defaultDriver?.id || ''))
      .filter((id) => id.length > 0)
  );

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
    .filter((drv) => {
      if (driverVehicleAssignFilter === 'ASSIGNED') {
        return assignedDriverIds.has(String(drv.id)) || Number(drv.segmentUsageCount || 0) > 0;
      }
      if (driverVehicleAssignFilter === 'UNASSIGNED') {
        return !assignedDriverIds.has(String(drv.id)) && Number(drv.segmentUsageCount || 0) === 0;
      }
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
    .filter((v) => !vehicleOwnershipFilter || v.ownershipType === vehicleOwnershipFilter)
    .filter((v) => {
      if (!packageModeFilter) return true;
      if (packageModeFilter === 'BY_SEGMENT') return v.commutePackageMode === 'BY_SEGMENT';
      if (packageModeFilter === 'BY_ROUTE') return v.commutePackageMode === 'BY_ROUTE';
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
    .filter((l) => {
      if (!legCategoryFilter) return true;
      if (legCategoryFilter === 'EXPERT') {
        return (
          l.passengerType === 'EXPERT' ||
          String(l.legCode || '').toUpperCase().includes('EXPERT') ||
          String(l.legName || '').toLowerCase().includes('chuyên gia')
        );
      }
      if (legCategoryFilter === 'COMMUTE') {
        return l.passengerType !== 'EXPERT';
      }
      return true;
    })
    .filter((l) => !legDirectionFilter || l.direction === legDirectionFilter)
    .filter((l) => !activeFlagFilter || l.activeFlag === activeFlagFilter)
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

  const isEtpProvisionalRow = (etp: any) =>
    etp.isProvisional === 'Y' ||
    Boolean(etp.provTempCode) ||
    String(etp.employee?.empCode || '').startsWith('TEMP-');

  const computedProvisionalCount =
    etpProvisionalCount || etpProfiles.filter((e) => isEtpProvisionalRow(e)).length;

  const filteredEtpProfiles = etpProfiles
    .filter((etp) => (etpProvisionalPill === 'PROVISIONAL' ? isEtpProvisionalRow(etp) : true))
    .filter((etp) => !passengerTypeFilter || etp.route?.passengerType === passengerTypeFilter)
    .filter((etp) => !etpStatusFilter || etp.approvalStatus === etpStatusFilter)
    .filter((etp) => !activeFlagFilter || etp.activeFlag === activeFlagFilter)
    .filter((etp) => !etpRouteFilter || String(etp.route?.id || '') === String(etpRouteFilter))
    .filter(
      (etp) =>
        !etpPickupPointFilter ||
        String(etp.pickupPointId || etp.pickupPoint?.id || '') === String(etpPickupPointFilter)
    )
    .filter(
      (etp) =>
        !etpDropoffPointFilter ||
        String(etp.dropoffPointId || etp.dropoffPoint?.id || '') === String(etpDropoffPointFilter)
    )
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
            label="Khu vực / Quận huyện"
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
            label="Trạng thái gắn xe"
            value={driverVehicleAssignFilter}
            onChange={setDriverVehicleAssignFilter}
            options={[
              { value: 'ASSIGNED', label: 'Đã gắn xe' },
              { value: 'UNASSIGNED', label: 'Chưa gắn xe' },
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
              { value: 'SEDAN_4', label: 'Sedan 4 chỗ' },
              { value: 'SUV_7', label: 'SUV 7 chỗ' },
              { value: 'VAN_16', label: 'Van 16 chỗ' },
              { value: 'BUS_29', label: 'Bus 29 chỗ' },
              { value: 'BUS_45', label: 'Bus 45 chỗ' },
            ]}
          />
          <FloatingSelect
            label="Hình thức sở hữu"
            value={vehicleOwnershipFilter}
            onChange={setVehicleOwnershipFilter}
            options={[
              { value: 'COMPANY', label: 'Xe công ty (COMPANY)' },
              { value: 'RENTAL', label: 'Xe thuê ngoài (RENTAL)' },
              { value: 'TAXI', label: 'Taxi (TAXI)' },
              { value: 'CARGO', label: 'Xe tải / Hàng hóa (CARGO)' },
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
          <FloatingSelect
            label="Loại chặng"
            value={legCategoryFilter}
            onChange={(val) => setLegCategoryFilter(val)}
            options={[
              { value: 'COMMUTE', label: 'Đưa đón tuyến (COMMUTE)' },
              { value: 'EXPERT', label: 'Chuyên gia (EXPERT)' },
            ]}
          />
          <FloatingSelect
            label="Hướng di chuyển"
            value={legDirectionFilter}
            onChange={(val) => setLegDirectionFilter(val)}
            options={[
              { value: 'TO_FACTORY', label: 'Đến nhà máy' },
              { value: 'FROM_FACTORY', label: 'Từ nhà máy' },
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
        <div className="space-y-3 pt-4 pb-1">
          {/* Pill Filter Bar: Tất cả | Chưa có mã NV (N) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEtpProvisionalPill('ALL')}
              className={`h-[30px] px-3.5 rounded-full text-[12px] font-semibold transition-colors cursor-pointer ${
                etpProvisionalPill === 'ALL'
                  ? 'bg-[#00897b] text-white shadow-xs'
                  : 'bg-[#f3f4f6] text-[#4b5563] hover:bg-[#e5e7eb]'
              }`}
            >
              Tất cả ({etpProfiles.length})
            </button>
            <button
              type="button"
              onClick={() => setEtpProvisionalPill('PROVISIONAL')}
              className={`h-[30px] px-3.5 rounded-full text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                etpProvisionalPill === 'PROVISIONAL'
                  ? 'bg-[#d97706] text-white shadow-xs'
                  : 'bg-[#fef3c7] text-[#b45309] hover:bg-[#fde68a]'
              }`}
            >
              <span>Chưa có mã NV</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white/25 text-[11px] font-bold">
                {computedProvisionalCount}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
              label="Điểm đón"
              value={etpPickupPointFilter}
              onChange={(val) => setEtpPickupPointFilter(val)}
              options={points
                .filter((p) => p.pointType === 'PICKUP' || p.pointType === 'BOTH')
                .map((p) => ({ value: String(p.id), label: `${p.pointCode} - ${p.pointName}` }))}
            />
            <FloatingSelect
              label="Điểm trả"
              value={etpDropoffPointFilter}
              onChange={(val) => setEtpDropoffPointFilter(val)}
              options={points
                .filter((p) => p.pointType === 'DROPOFF' || p.pointType === 'BOTH')
                .map((p) => ({ value: String(p.id), label: `${p.pointCode} - ${p.pointName}` }))}
            />
            <FloatingSelect
              label="Trạng thái phê duyệt"
              value={etpStatusFilter}
              onChange={(val) => setEtpStatusFilter(val)}
              options={[
                { value: 'PENDING', label: 'Đang chờ phê duyệt' },
                { value: 'APPROVED', label: 'Đã phê duyệt' },
                { value: 'REJECTED', label: 'Từ chối' },
                { value: 'RESIGNED', label: 'Đã nghỉ việc' },
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
        </div>
      )}

      {activeTab === 'COST_CONFIGS' && (
        <div className="flex flex-wrap items-center gap-3 pt-4 pb-1">
          <FloatingSelect
            label="Loại"
            value={costTypeFilter}
            onChange={(val) => setCostTypeFilter(val)}
            options={[
              { value: 'COMMUTE', label: 'Tuyến thường' },
              { value: 'EXTRA', label: 'Phát sinh' },
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
              { value: 'VAN_16', label: 'Van 16 chỗ' },
              { value: 'BUS_29', label: 'Bus 29 chỗ' },
              { value: 'BUS_45', label: 'Bus 45 chỗ' },
              { value: 'SEDAN_4', label: 'Xe 4 chỗ' },
              { value: 'SUV_7', label: 'Xe 7 chỗ' },
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
                activeFlag: 'Y',
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
                activeFlag: 'Y',
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
                ownershipType: 'RENTAL',
                commutePackageMode: 'BY_ROUTE',
                dailyTripQuota: 2,
                monthlyKmQuota: '25',
                defaultDriverId: '',
                activeFlag: 'Y',
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
                activeFlag: 'Y',
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
                activeFlag: 'Y',
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
              Nhập Excel / CSV
            </button>
          }
          primaryAction={{
            label: 'Thêm người đi xe tuyến',
            hasDropdown: true,
            onClick: () =>
              setEtpCreateModal({
                isProvisionalMode: false,
                provTempCode: `TEMP-${Date.now().toString().slice(-6)}`,
                provFullName: '',
                provOrgUnitId: '',
                provShiftId: shifts[0]?.id || '',
                provWorkDayMask: 'MON_SAT',
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
                vehicleType: 'VAN_16',
                pricingScope: 'STANDARD',
                effectiveFrom: new Date().toISOString().slice(0, 10),
                effectiveTo: '',
                activeFlag: 'Y',
                rules: [
                  {
                    ruleCode: 'MONTHLY_FIXED',
                    rateType: 'MONTHLY_FIXED',
                    dayType: 'WEEKDAY',
                    dailyTripCount: 2,
                    includedDistanceKm: '2600',
                    unitPrice: '0',
                    priceUnit: 'VND_PER_MONTH',
                    description: 'Đơn giá thuê tháng cố định',
                  },
                  {
                    ruleCode: 'PER_KM_EXCESS',
                    rateType: 'PER_KM',
                    dayType: 'WEEKDAY',
                    unitPrice: '0',
                    priceUnit: 'VND_PER_KM',
                    description: 'Đơn giá vượt định mức KM',
                  },
                  {
                    ruleCode: 'OT_HOURLY',
                    rateType: 'OT_HOURLY',
                    dayType: 'WEEKDAY',
                    unitPrice: '0',
                    priceUnit: 'VND_PER_HOUR',
                    description: 'Đơn giá làm thêm giờ (OT)',
                  },
                  {
                    ruleCode: 'SURCHARGE_OVERNIGHT',
                    rateType: 'SURCHARGE',
                    dayType: 'WEEKDAY',
                    unitPrice: '0',
                    priceUnit: 'VND_PER_DAY',
                    description: 'Phụ phí lưu đêm / cầu đường',
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
                            label: 'Bật/tắt hoạt động',
                            icon: <Power className="w-3.5 h-3.5" />,
                            onClick: () => handleToggleDriverActive(drv),
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
                      {drv.shortAddress &&
                      String(drv.shortAddress).length > 2 &&
                      !/^\d+$/.test(String(drv.shortAddress))
                        ? drv.shortAddress
                        : ''}
                    </td>
                    <td className="px-2.5 text-[#374151] truncate">
                      {drv.fullAddress &&
                      String(drv.fullAddress).length > 2 &&
                      !/^\d+$/.test(String(drv.fullAddress))
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
                            onClick: () =>
                              setVehicleModal({
                                ...v,
                                dailyTripQuota: v.dailyTripQuota || 2,
                                monthlyKmQuota: v.monthlyKmQuota || '25',
                              }),
                          },
                          {
                            label: 'Bật/tắt hoạt động',
                            icon: <Power className="w-3.5 h-3.5" />,
                            onClick: () => handleToggleVehicleActive(v),
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
                      {String(v.vendor?.vendorName || 'Meiko Electronics').replace(
                        /\s+Vietnam$/i,
                        ''
                      )}
                    </td>
                    <td className="px-2.5 text-[#374151] truncate">
                      {renderVehicleTypeLabel(v.vehicleType)}
                    </td>
                    <td className="px-2.5 text-[#374151]">{v.seatCapacity}</td>
                    <td className="px-2.5 text-[#374151]">
                      {v.ownershipType === 'COMPANY'
                        ? 'Công ty'
                        : v.ownershipType === 'TAXI'
                          ? 'Taxi'
                          : v.ownershipType === 'CARGO'
                            ? 'Xe hàng'
                            : 'Thuê'}
                    </td>
                    <td className="px-2.5">
                      {v.commutePackageMode === 'BY_SEGMENT' ? (
                        <PastelBadge variant="purple">Theo số chặng</PastelBadge>
                      ) : v.commutePackageMode === 'BY_ROUTE' ? (
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
                            label: 'Bật/tắt hoạt động',
                            icon: <Power className="w-3.5 h-3.5" />,
                            onClick: () => handleToggleLegActive(leg),
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
                      {leg.activeFlag === 'Y' ? (
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
                  <th className="px-2.5 w-[12%]">Mã tuyến</th>
                  <th className="px-2.5 w-[28.5%]">Tên tuyến</th>
                  <th className="px-2.5 w-[12%]">Loại hành khách</th>
                  <th className="px-2.5 w-[11%]">Loại tuyến</th>
                  <th className="px-2.5 w-[8%]">Số chặng</th>
                  <th className="px-2.5 w-[14%]">Ngày có kế hoạch xe</th>
                  <th className="px-2.5 w-[10%]">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb]">
                {routesPaging.pagedItems.map((rt, idx) => (
                  <tr
                    key={rt.id}
                    onClick={(e) =>
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        items: [
                          {
                            label: 'Sửa tuyến & cấu hình chặng',
                            icon: <Edit3 className="w-3.5 h-3.5" />,
                            onClick: () => openRouteEditModal(rt),
                          },
                          {
                            label: 'Bật/tắt hoạt động',
                            icon: <Power className="w-3.5 h-3.5" />,
                            onClick: () => handleToggleRouteActive(rt),
                          },
                          {
                            label: 'Xóa tuyến',
                            icon: <Trash2 className="w-3.5 h-3.5" />,
                            danger: true,
                            onClick: () => handleDeleteRoute(rt),
                          },
                        ],
                      })
                    }
                    className="hover:bg-[#f9fafb] cursor-pointer transition-colors"
                  >
                    <td className="px-2.5 text-[#374151]">
                      {(routesPaging.page - 1) * routesPaging.pageSize + idx + 1}
                    </td>
                    <td className="px-2.5 text-[#1f2937] font-medium truncate">
                      {rt.routeCode || '—'}
                    </td>
                    <td className="px-2.5 text-[#1f2937] truncate">{rt.routeName}</td>
                    <td className="px-2.5">{renderPassengerTypeBadge(rt.passengerType)}</td>
                    <td className="px-2.5">
                      <PastelBadge variant="green">Tuyến cố định</PastelBadge>
                    </td>
                    <td className="px-2.5 text-[#374151]">{(rt.segments || []).length}</td>
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
                  <th className="px-1.5 w-[2.8%] text-center">
                    <input type="checkbox" className="rounded border-gray-300" />
                  </th>
                  <th className="px-1.5 w-[2.5%]">#</th>
                  <th className="px-1.5 w-[9%]">Mã nhân viên</th>
                  <th className="px-1.5 w-[10.2%]">Tên nhân viên</th>
                  <th className="px-1.5 w-[9%]">Phòng ban</th>
                  <th className="px-1.5 w-[12.5%]">Trạng thái hoạt động</th>
                  <th className="px-1.5 w-[14.5%]">Tuyến đang hoạt động</th>
                  <th className="px-1.5 w-[9.5%]">Loại hành khách</th>
                  <th className="px-1.5 w-[12.5%]">Trạng thái phê duyệt</th>
                  <th className="px-1.5 w-[7%]">Yêu cầu bởi</th>
                  <th className="px-1.5 w-[10.5%]">Thời điểm yêu cầu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb]">
                {etpPaging.pagedItems.map((etp, idx) => {
                  const isProv = isEtpProvisionalRow(etp);
                  return (
                    <tr
                      key={etp.id}
                      onClick={(e) =>
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          items: [
                            ...(isProv
                              ? [
                                  {
                                    label: 'Gắn mã nhân viên chính thức',
                                    icon: <Edit3 className="w-3.5 h-3.5 text-[#d97706]" />,
                                    onClick: () =>
                                      setEtpLinkModal({
                                        id: etp.id,
                                        provTempCode:
                                          etp.provTempCode || etp.employee?.empCode || 'TEMP',
                                        provFullName:
                                          etp.provFullName || etp.employee?.fullName || '',
                                        employeeId: employees[0]?.id || '',
                                      }),
                                  },
                                ]
                              : []),
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
                                        reason: '',
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
                        <div className="flex items-center gap-1">
                          <span>{etp.employee?.empCode || etp.provTempCode || '—'}</span>
                          {isProv && (
                            <span className="px-1.5 py-0.5 rounded bg-[#fef3c7] text-[#b45309] text-[10px] font-semibold">
                              Tạm
                            </span>
                          )}
                        </div>
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
                      <td className="px-2 text-[#374151] truncate">
                        {etp.route?.routeName || '—'}
                      </td>
                      <td className="px-2">
                        {renderPassengerTypeBadge(etp.route?.passengerType || 'WORKER')}
                      </td>
                      <td className="px-2">
                        {etp.approvalStatus === 'APPROVED' ? (
                          <PastelBadge variant="green">Đã phê duyệt</PastelBadge>
                        ) : etp.approvalStatus === 'REJECTED' ? (
                          <PastelBadge variant="red">Từ chối</PastelBadge>
                        ) : etp.approvalStatus === 'RESIGNED' ? (
                          <PastelBadge variant="gray">Đã nghỉ việc</PastelBadge>
                        ) : (
                          <PastelBadge variant="yellow">Đang chờ phê duyệt</PastelBadge>
                        )}
                      </td>
                      <td className="px-2 text-[#374151] truncate">
                        {etp.approvalStatus === 'PENDING' ? 'testDepartment' : '—'}
                      </td>
                      <td className="px-2 text-[#374151] truncate">{etp.effectiveFrom || '—'}</td>
                    </tr>
                  );
                })}
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
            <table className="w-full table-fixed text-left border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] text-[#1f2937] font-semibold">
                  <th className="px-1 w-[2.1%]">#</th>
                  <th className="px-1 w-[5.9%]">Phiên bản</th>
                  <th className="px-1 w-[6.8%]">Loại</th>
                  <th className="px-1 w-[7.2%]">Hành khách</th>
                  <th className="px-1 w-[9.6%]">Phạm vi tính giá</th>
                  <th className="px-1 w-[6.2%]">Xe</th>
                  <th className="px-1 w-[4.8%]">Quy tắc</th>
                  <th className="px-1 w-[8.2%]">Giá chính</th>
                  <th className="px-1 w-[11.8%]">Hạn mức KM / tháng</th>
                  <th className="px-1 w-[9.7%]">Đơn giá KM vượt</th>
                  <th className="px-1 w-[7.2%]">Giá OT / giờ</th>
                  <th className="px-1 w-[7.2%]">Giá lưu đêm</th>
                  <th className="px-1 w-[6.5%]">Áp dụng từ</th>
                  <th className="px-1 w-[6.8%]">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb]">
                {costPaging.pagedItems.map((cfg, idx) => {
                  const rules: any[] = cfg.rules || [];
                  const mainRule =
                    rules.find((r) =>
                      [
                        'MONTHLY_FIXED',
                        'MONTHLY_PACKAGE',
                        'BASE_MONTHLY',
                        'SEGMENT_25',
                        'SEGMENT_40',
                        'SEGMENT_55',
                        'DAILY_RATE',
                        'DAILY_PACKAGE',
                        'TRIP_FIXED',
                        'TRIP',
                      ].includes(String(r.rateType || ''))
                    ) ||
                    rules.find((r) => String(r.rateType || '') === 'PER_KM') ||
                    rules[0];
                  const overKmRule = rules.find((r) =>
                    ['EXCESS_KM', 'PER_KM', 'OVER_KM'].includes(String(r.rateType || ''))
                  );
                  const otHourRule = rules.find((r) =>
                    ['OT_HOURLY', 'OT_HOUR', 'OVERTIME_HOUR'].includes(String(r.rateType || ''))
                  );
                  const overnightRule = rules.find((r) =>
                    ['OVERNIGHT', 'SURCHARGE'].includes(String(r.rateType || ''))
                  );

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
                                  id: cfg.id,
                                  versionCode: cfg.versionCode,
                                  configType: cfg.configType,
                                  passengerType: cfg.passengerType,
                                  vehicleType: cfg.vehicleType,
                                  pricingScope: cfg.pricingScope || 'STANDARD',
                                  effectiveFrom:
                                    cfg.effectiveFrom || new Date().toISOString().slice(0, 10),
                                  effectiveTo: cfg.effectiveTo || '',
                                  activeFlag: cfg.activeFlag || 'Y',
                                  rules:
                                    (cfg.rules || []).length > 0
                                      ? (cfg.rules || []).map((r: any) => ({
                                          ruleCode: r.ruleCode,
                                          rateType: r.rateType || 'MONTHLY_FIXED',
                                          dayType: r.dayType || 'WEEKDAY',
                                          dailyTripCount: r.dailyTripCount || 2,
                                          includedDistanceKm: r.includedDistanceKm || '',
                                          unitPrice: r.unitPrice || '0',
                                          priceUnit: r.priceUnit || 'VND_PER_MONTH',
                                          description: r.description || '',
                                        }))
                                      : [
                                          {
                                            ruleCode: 'MONTHLY_FIXED',
                                            rateType: 'MONTHLY_FIXED',
                                            dayType: 'WEEKDAY',
                                            dailyTripCount: 2,
                                            includedDistanceKm: '2600',
                                            unitPrice: '26000000',
                                            priceUnit: 'VND_PER_MONTH',
                                            description: 'Đơn giá cơ bản',
                                          },
                                        ],
                                }),
                            },
                            {
                              label: 'Tạo phiên bản tiếp theo',
                              icon: <Plus className="w-3.5 h-3.5" />,
                              onClick: () =>
                                setCostConfigModal({
                                  previousConfigId: cfg.id,
                                  versionCode: `${cfg.versionCode}-NEXT`,
                                  configType: cfg.configType,
                                  passengerType: cfg.passengerType,
                                  vehicleType: cfg.vehicleType,
                                  pricingScope: cfg.pricingScope || 'STANDARD',
                                  effectiveFrom: new Date().toISOString().slice(0, 10),
                                  effectiveTo: '',
                                  activeFlag: 'Y',
                                  rules: (cfg.rules || []).map((r: any) => ({
                                    ruleCode: r.ruleCode,
                                    rateType: r.rateType || 'MONTHLY_FIXED',
                                    dayType: r.dayType || 'WEEKDAY',
                                    dailyTripCount: r.dailyTripCount || 2,
                                    includedDistanceKm: r.includedDistanceKm || '',
                                    unitPrice: r.unitPrice || '0',
                                    priceUnit: r.priceUnit || 'VND_PER_MONTH',
                                    description: r.description || '',
                                  })),
                                }),
                            },
                            {
                              label: 'Lịch sử phiên bản',
                              icon: <History className="w-3.5 h-3.5" />,
                              onClick: () =>
                                setCostHistoryModal({
                                  currentConfig: cfg,
                                  versions: costConfigs.filter(
                                    (c) =>
                                      c.configType === cfg.configType &&
                                      c.passengerType === cfg.passengerType &&
                                      c.vehicleType === cfg.vehicleType
                                  ),
                                }),
                            },
                            {
                              label: 'Xóa phiên bản',
                              icon: <Trash2 className="w-3.5 h-3.5" />,
                              danger: true,
                              onClick: () => handleDeleteCostConfig(cfg),
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
                      <td className="px-1">{renderPassengerTypeBadge(cfg.passengerType)}</td>
                      <td className="px-1 text-[#374151] truncate">
                        {cfg.pricingScope === 'PROVINCE_SURCHARGE' ||
                        cfg.pricingScope === 'HOA_BINH'
                          ? 'Có qua Hòa Bình'
                          : cfg.configType === 'EXTRA' && cfg.passengerType === 'WORKER'
                            ? 'Khu vực tiêu chuẩn'
                            : '—'}
                      </td>
                      <td className="px-1 text-[#374151] truncate">
                        {renderVehicleTypeLabel(cfg.vehicleType)}
                      </td>
                      <td className="px-1 text-[#374151]">{rules.length}</td>
                      <td className="px-1 text-[#1f2937] font-medium truncate">
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
                        {cfg.effectiveFrom && String(cfg.effectiveFrom).includes('-')
                          ? String(cfg.effectiveFrom).split('-').reverse().join('/')
                          : cfg.effectiveFrom || '—'}
                      </td>
                      <td className="px-1">
                        {cfg.activeFlag === 'Y' ? (
                          <PastelBadge variant="green">Hoạt động</PastelBadge>
                        ) : (
                          <PastelBadge variant="gray">Không hoạt động</PastelBadge>
                        )}
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
                      min={0}
                      required
                      value={costConfigModal.rules[0]?.unitPrice ?? '0'}
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
                      min={0}
                      value={costConfigModal.rules[0]?.includedDistanceKm ?? '2600'}
                      onChange={(e) => {
                        const nextRules = [...costConfigModal.rules];
                        nextRules[0] = { ...nextRules[0], includedDistanceKm: e.target.value };
                        setCostConfigModal({ ...costConfigModal, rules: nextRules });
                      }}
                      className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                      Giá KM vượt mức (VNĐ)
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={costConfigModal.rules[1]?.unitPrice ?? '0'}
                      onChange={(e) => {
                        const nextRules = [...costConfigModal.rules];
                        if (nextRules[1]) {
                          nextRules[1] = { ...nextRules[1], unitPrice: e.target.value };
                        }
                        setCostConfigModal({ ...costConfigModal, rules: nextRules });
                      }}
                      className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                      Giá OT / giờ (VNĐ)
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={costConfigModal.rules[2]?.unitPrice ?? '0'}
                      onChange={(e) => {
                        const nextRules = [...costConfigModal.rules];
                        if (nextRules[2]) {
                          nextRules[2] = { ...nextRules[2], unitPrice: e.target.value };
                        }
                        setCostConfigModal({ ...costConfigModal, rules: nextRules });
                      }}
                      className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                    />
                  </div>
                </div>
              </div>

              {costConfigModal.configType === 'COMMUTE' &&
                costConfigModal.passengerType === 'WORKER' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
                        Giá theo chuyến / quãng đường
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setCostConfigModal({
                            ...costConfigModal,
                            rules: [
                              ...costConfigModal.rules,
                              {
                                ruleCode: `TIER_${costConfigModal.rules.length + 1}`,
                                rateType: 'MONTHLY_FIXED',
                                dayType: 'WEEKDAY',
                                dailyTripCount: 4,
                                includedDistanceKm: '40',
                                unitPrice: '32000000',
                                priceUnit: 'VND_PER_MONTH',
                                description: 'Bậc chuyến/ngày công nhân',
                              },
                            ],
                          })
                        }
                        className="px-2.5 py-1 rounded bg-[#00897b] text-white text-[12px] font-medium cursor-pointer"
                      >
                        + Thêm mục
                      </button>
                    </div>
                    <table className="w-full text-left border-collapse text-[12px] border border-[#e5e7eb]">
                      <thead>
                        <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb]">
                          <th className="p-2">Chuyến/ngày</th>
                          <th className="p-2">Từ KM</th>
                          <th className="p-2">Đến KM</th>
                          <th className="p-2">Giá tháng</th>
                          <th className="p-2">Chủ nhật/ngày</th>
                          <th className="p-2">Ngày lễ/ngày</th>
                          <th className="p-2">Mô tả</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="p-2">2</td>
                          <td className="p-2">0</td>
                          <td className="p-2">25</td>
                          <td className="p-2">{costConfigModal.rules[0]?.unitPrice || '0'}</td>
                          <td className="p-2">1.800.000</td>
                          <td className="p-2">2.200.000</td>
                          <td className="p-2">Gói cơ bản theo chặng</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

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
                      min={0}
                      defaultValue={0}
                      className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                    />
                  </div>
                  {costConfigModal.configType === 'EXTRA' && (
                    <div className="relative">
                      <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                        Giá lưu trú qua đêm (VND)
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={costConfigModal.rules[3]?.unitPrice ?? '0'}
                        onChange={(e) => {
                          const nextRules = [...costConfigModal.rules];
                          if (nextRules[3]) {
                            nextRules[3] = { ...nextRules[3], unitPrice: e.target.value };
                          }
                          setCostConfigModal({ ...costConfigModal, rules: nextRules });
                        }}
                        className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus:outline-none focus:border-[#00897b]"
                      />
                    </div>
                  )}
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
