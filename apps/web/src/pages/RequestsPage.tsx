import React, { useEffect, useState } from 'react';
import {
  Plus,
  CheckCircle2,
  XCircle,
  RotateCcw,
  CarTaxiFront,
  Briefcase,
  Clock,
  Package,
  Trash2,
  FileSpreadsheet,
  Download,
  Edit3,
  X,
} from 'lucide-react';
import { gqlRequest } from '../lib/graphql';
import {
  LegacyTabs,
  FloatingDateFilter,
  FloatingSelect,
  FloatingTextInput,
  SectionToolbar,
  LegacyPagination,
  usePagination,
  RowContextMenu,
  exportTableToCsv,
  renderRequestTypeBadge,
  renderRequestStatusBadge,
} from '../components/legacy-ui';

function formatLegacyReqDateTime(businessDate?: string, timeStr?: string | null): string {
  if (!timeStr) return '—';
  // If timeStr is already ISO or contains date
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

export const RequestsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'APPROVAL_QUEUE'>('ALL');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Data
  const [requests, setRequests] = useState<any[]>([]);
  const [points, setPoints] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [etpProfiles, setEtpProfiles] = useState<any[]>([]);
  const [otShiftOptions, setOtShiftOptions] = useState<any[]>([]);

  // Filters
  const [businessDateFilter, setBusinessDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [requestTypeFilter, setRequestTypeFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Row Context Menu & Detail Drawer
  const [contextRow, setContextRow] = useState<{
    req: any;
    index: number;
    x: number;
    y: number;
  } | null>(null);
  const [detailDrawerReq, setDetailDrawerReq] = useState<any | null>(null);

  // Create Modal & Excel Import Modal
  const [createModalType, setCreateModalType] = useState<
    'BUSINESS' | 'OVERTIME' | 'GOODS' | null
  >(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFileName, setImportFileName] = useState<string>('');
  const [importPreviewDone, setImportPreviewDone] = useState(false);

  // Business / Goods form state
  const [formState, setFormState] = useState<any>({
    businessDate: new Date(Date.now() + 31 * 3600 * 1000).toISOString().slice(0, 10),
    tripMode: 'ONE_WAY',
    requestedVehicleType: 'SUV_7',
    passengerCount: 2,
    departureTime: '08:00',
    expectedArrivalTime: '09:30',
    returnTime: '17:00',
    returnExpectedArrivalTime: '18:30',
    departurePickupPointText: 'Nhà máy MKVC',
    departureDropoffPointText: 'Khách hàng Nội Bài',
    returnPickupPointText: 'Khách hàng Nội Bài',
    returnDropoffPointText: 'Nhà máy MKVC',
    contactName: 'Nguyễn Văn Yêu Cầu',
    contactPhone: '0988111222',
    purpose: 'Đi công tác làm việc với đối tác',
    senderInfo: 'Kho Thành Phẩm MKVC - Anh Hùng (0912333444)',
    receiverInfo: 'Kho Khách Hàng Bắc Ninh - Chị Lan (0988777666)',
    notes: '',
    passengers: [
      { passengerId: 'EMP001', passengerName: 'Nguyễn Văn A', passengerType: 'STAFF' },
    ],
  });

  // Overtime bulk rows state
  const [otDate, setOtDate] = useState<string>(() =>
    new Date(Date.now() + 31 * 3600 * 1000).toISOString().slice(0, 10)
  );
  const [otShiftCode, setOtShiftCode] = useState<string>('');
  const [otRows, setOtRows] = useState<any[]>([
    {
      employeeCode: '',
      employeeName: '',
      departmentName: '',
      pickupPointText: '',
      dropoffPointText: 'Nhà máy MKVC',
      legDirection: 'FROM_FACTORY',
      purpose: 'Đăng ký xe đưa đón tăng ca OT',
    },
  ]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadLookups = async () => {
    try {
      const res = await gqlRequest<any>(`
        query LoadReqLookups {
          points(activeFlag: "Y") { id pointCode pointName pointType isFactory }
          employees { id empCode fullName orgUnit { name } }
          employeeTransportProfiles(approvalStatus: "APPROVED", activeFlag: "Y", limit: 300) {
            id employee { empCode fullName orgUnit { name } }
            pickupPoint { id pointCode pointName }
            dropoffPoint { id pointCode pointName }
          }
        }
      `);
      const sortedPts = [...(res.points || [])].sort((a, b) => {
        if (a.pointType === 'BOTH' && b.pointType !== 'BOTH') return -1;
        if (a.pointType !== 'BOTH' && b.pointType === 'BOTH') return 1;
        return a.pointCode.localeCompare(b.pointCode);
      });
      setPoints(sortedPts);
      setEmployees(res.employees || []);
      setEtpProfiles(res.employeeTransportProfiles || []);
    } catch {
      // ignore
    }
  };

  const loadOtShifts = async (dateStr: string) => {
    try {
      const res = await gqlRequest<{ otShiftOptions: any[] }>(
        `query GetOtShiftOptions($date: String!) {
          otShiftOptions(date: $date) {
            code label optionType directionMode departureTime returnTime nextDayReturn disabled disabledReason
          }
        }`,
        { date: dateStr }
      );
      setOtShiftOptions(res.otShiftOptions || []);
      if (res.otShiftOptions?.length > 0) {
        setOtShiftCode(res.otShiftOptions[0].code);
      }
    } catch {
      // ignore
    }
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await gqlRequest<{ transportRequests: any[] }>(
        `query GetRequests($status: String, $requestType: String, $businessDate: String, $search: String) {
          transportRequests(status: $status, requestType: $requestType, businessDate: $businessDate, search: $search, limit: 500) {
            id requestCode businessDate requestType requestSource requesterName departmentName
            requestedVehicleType passengerCount status outboundStatus returnStatus returnedFromStatus tripMode
            departureTime expectedArrivalTime returnTime
            departurePickupPointText departureDropoffPointText
            returnPickupPointText returnDropoffPointText
            contactName contactPhone otShiftCode otShiftDate legDirection
            purpose senderInfo receiverInfo notes
            passengers { id passengerId passengerName passengerType }
          }
        }`,
        {
          status: statusFilter || undefined,
          requestType: requestTypeFilter || undefined,
          businessDate: businessDateFilter || undefined,
          search: search || undefined,
        }
      );
      let list = res.transportRequests || [];
      if (!businessDateFilter) {
        list = [...list].sort((a, b) => {
          const aSynth = String(a.businessDate || '').startsWith('2027-') ? 1 : 0;
          const bSynth = String(b.businessDate || '').startsWith('2027-') ? 1 : 0;
          if (aSynth !== bSynth) return aSynth - bSynth;
          const aHasPoints = a.departurePickupPointText && a.departureDropoffPointText ? 0 : 1;
          const bHasPoints = b.departurePickupPointText && b.departureDropoffPointText ? 0 : 1;
          if (aHasPoints !== bHasPoints) return aHasPoints - bHasPoints;
          const aOct21 = String(a.businessDate || '').startsWith('2026-10-21') ? 0 : 1;
          const bOct21 = String(b.businessDate || '').startsWith('2026-10-21') ? 0 : 1;
          if (aOct21 !== bOct21) return aOct21 - bOct21;
          return 0;
        });
      }
      if (activeTab === 'APPROVAL_QUEUE') {
        list = list.filter((r) =>
          ['PENDING_DEPARTMENT', 'PENDING_GA', 'PENDING_GA_DEPARTMENT'].includes(r.status)
        );
      }
      setRequests(list);
      setSelectedIds([]);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const departmentOptions = Array.from(
    new Set([
      'Khối Kỹ thuật EMS',
      'Fac 2 -1F/ Ép lớp (MLB/HDI)',
      'ISO',
      'Chỉ thị thiết kế',
      'P. Kế hoạch',
      'P. Sản xuất',
      'P. Kho vận',
      ...requests.map((r) => (r.departmentName || 'Khối Kỹ thuật EMS').trim()).filter(Boolean),
    ])
  ).map((d) => ({ value: d, label: d }));

  const filteredRequests = requests.filter((r) => {
    if (
      activeTab === 'APPROVAL_QUEUE' &&
      !['PENDING_DEPARTMENT', 'PENDING_GA', 'PENDING_GA_DEPARTMENT'].includes(r.status)
    ) {
      return false;
    }
    const dept = r.departmentName || 'Khối Kỹ thuật EMS';
    if (departmentFilter.trim()) {
      if (!dept.toLowerCase().includes(departmentFilter.trim().toLowerCase())) {
        return false;
      }
    }
    if (search.trim()) {
      const kw = search.trim().toLowerCase();
      const hay = [
        r.requestCode,
        r.requesterName,
        dept,
        r.departurePickupPointText,
        r.departureDropoffPointText,
        r.purpose,
        r.businessDate,
        r.departureTime,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });

  const {
    page: reqPage,
    setPage: setReqPage,
    pageSize: reqPageSize,
    setPageSize: setReqPageSize,
    pagedItems: pagedRequests,
    startIndex: reqStartIndex,
  } = usePagination(filteredRequests, 999);

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    loadOtShifts(otDate);
  }, [otDate]);

  useEffect(() => {
    loadRequests();
  }, [activeTab, statusFilter, requestTypeFilter, businessDateFilter, departmentFilter]);

  const handleCreateSingleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createModalType) return;
    try {
      await gqlRequest(
        `mutation CreateReq(
          $businessDate: String!,
          $requestType: String!,
          $tripMode: String,
          $requestedVehicleType: String,
          $passengerCount: Int,
          $departureTime: String,
          $expectedArrivalTime: String,
          $returnTime: String,
          $returnExpectedArrivalTime: String,
          $departurePickupPointText: String,
          $departureDropoffPointText: String,
          $returnPickupPointText: String,
          $returnDropoffPointText: String,
          $contactName: String,
          $contactPhone: String,
          $purpose: String,
          $senderInfo: String,
          $receiverInfo: String,
          $notes: String,
          $passengers: [RequestPassengerInput!]
        ) {
          createTransportRequest(
            businessDate: $businessDate,
            requestType: $requestType,
            tripMode: $tripMode,
            requestedVehicleType: $requestedVehicleType,
            passengerCount: $passengerCount,
            departureTime: $departureTime,
            expectedArrivalTime: $expectedArrivalTime,
            returnTime: $returnTime,
            returnExpectedArrivalTime: $returnExpectedArrivalTime,
            departurePickupPointText: $departurePickupPointText,
            departureDropoffPointText: $departureDropoffPointText,
            returnPickupPointText: $returnPickupPointText,
            returnDropoffPointText: $returnDropoffPointText,
            contactName: $contactName,
            contactPhone: $contactPhone,
            purpose: $purpose,
            senderInfo: $senderInfo,
            receiverInfo: $receiverInfo,
            notes: $notes,
            passengers: $passengers
          ) { id requestCode }
        }`,
        {
          ...formState,
          requestType: createModalType,
          tripMode: createModalType === 'GOODS' ? 'ONE_WAY' : formState.tripMode,
          passengerCount:
            createModalType === 'GOODS' ? 0 : Number(formState.passengerCount || 1),
          passengers: createModalType === 'GOODS' ? [] : formState.passengers,
        }
      );
      showToast(`Đã tạo đơn yêu cầu xe (${createModalType}) thành công`);
      setCreateModalType(null);
      loadRequests();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateBulkOt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await gqlRequest(
        `mutation CreateBulkOt($items: [BulkOtItemInput!]!) {
          createBulkOtRequests(items: $items) {
            id requestCode
          }
        }`,
        {
          items: otRows.map((r: any) => ({
            empCode: r.empCode,
            passengerName: r.passengerName,
            otDate,
            otShiftCode,
            direction: r.direction || 'FROM_FACTORY',
            pickupPointText: r.pickupPointText || undefined,
            dropoffPointText: r.dropoffPointText || undefined,
            note: r.note || undefined,
          })),
        }
      );
      showToast(`Đã tạo ${otRows.length} đơn đăng ký xe OT theo ca`);
      setCreateModalType(null);
      loadRequests();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleApprove = async (req: any) => {
    try {
      await gqlRequest(
        `mutation ApproveReq($id: BigInt!, $reason: String) {
          approveTransportRequest(id: $id, reason: $reason) { id status }
        }`,
        { id: req.id, reason: 'Đồng ý phê duyệt' }
      );
      showToast(`Đã duyệt đơn ${req.requestCode}`);
      loadRequests();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReject = async (req: any) => {
    const reason = prompt(`Nhập lý do TỪ CHỐI đơn ${req.requestCode}:`, 'Không đủ điều kiện');
    if (reason === null) return;
    try {
      await gqlRequest(
        `mutation RejectReq($id: BigInt!, $reason: String!) {
          rejectTransportRequest(id: $id, reason: $reason) { id status }
        }`,
        { id: req.id, reason }
      );
      showToast(`Đã từ chối đơn ${req.requestCode}`);
      loadRequests();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReturn = async (req: any) => {
    const reason = prompt(
      `Nhập lý do TRẢ VỀ YÊU CẦU SỬA đơn ${req.requestCode}:`,
      'Vui lòng bổ sung danh sách hành khách chi tiết'
    );
    if (reason === null) return;
    try {
      await gqlRequest(
        `mutation ReturnReq($id: BigInt!, $reason: String!) {
          returnTransportRequest(id: $id, reason: $reason) { id status }
        }`,
        { id: req.id, reason }
      );
      showToast(`Đã trả về đơn ${req.requestCode} để người tạo chỉnh sửa`);
      loadRequests();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleApproveTaxi = async (req: any) => {
    const reason = prompt(
      `Xác nhận duyệt đi TAXI cho đơn ${req.requestCode} (nhập ghi chú thẻ Taxi):`,
      'Sử dụng thẻ Taxi Mai Linh'
    );
    if (reason === null) return;
    try {
      await gqlRequest(
        `mutation TaxiReq($id: BigInt!, $notes: String) {
          approveTaxiRequest(id: $id, notes: $notes) { id status }
        }`,
        { id: req.id, notes: reason }
      );
      showToast(`Đã duyệt đi Taxi cho đơn ${req.requestCode}`);
      loadRequests();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCancelRequest = async (req: any) => {
    const reason = prompt(`Nhập lý do hủy đơn ${req.requestCode}:`, 'Thay đổi lịch công tác');
    if (reason === null) return;
    try {
      await gqlRequest(
        `mutation CancelReq($id: BigInt!, $reason: String) {
          cancelTransportRequest(id: $id, reason: $reason) { id status }
        }`,
        { id: req.id, reason }
      );
      showToast(`Đã hủy đơn ${req.requestCode}`);
      loadRequests();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    try {
      await gqlRequest(
        `mutation BulkApprove($ids: [BigInt!]!, $reason: String) {
          bulkApproveRequests(ids: $ids, reason: $reason) { id }
        }`,
        { ids: selectedIds, reason: 'Phê duyệt hàng loạt' }
      );
      showToast(`Đã chấp thuận ${selectedIds.length} yêu cầu`);
      loadRequests();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBulkMergeApprove = async () => {
    if (selectedIds.length === 0) return;
    try {
      await gqlRequest(
        `mutation BulkMergeApprove($ids: [BigInt!]!, $reason: String) {
          bulkApproveRequests(ids: $ids, reason: $reason) { id }
        }`,
        { ids: selectedIds, reason: 'Duyệt và yêu cầu ghép đơn' }
      );
      showToast(`Đã duyệt và đánh dấu ghép đơn cho ${selectedIds.length} yêu cầu`);
      loadRequests();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBulkTaxi = async () => {
    if (selectedIds.length === 0) return;
    try {
      for (const reqId of selectedIds) {
        await gqlRequest(
          `mutation TaxiReqBulk($id: BigInt!, $notes: String) {
            approveTaxiRequest(id: $id, notes: $notes) { id status }
          }`,
          { id: reqId, notes: 'Duyệt đi Taxi hàng loạt' }
        );
      }
      showToast(`Đã chuyển trạng thái Đi taxi cho ${selectedIds.length} yêu cầu`);
      loadRequests();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.length === 0) return;
    const reason = prompt('Nhập lý do từ chối hàng loạt:', 'Từ chối theo lô');
    if (reason === null) return;
    if (!reason.trim()) {
      alert('Vui lòng nhập lý do từ chối');
      return;
    }
    try {
      await gqlRequest(
        `mutation BulkReject($ids: [BigInt!]!, $reason: String!) {
          bulkRejectRequests(ids: $ids, reason: $reason) { id }
        }`,
        { ids: selectedIds, reason: reason.trim() }
      );
      showToast(`Đã từ chối hàng loạt ${selectedIds.length} đơn`);
      loadRequests();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div>
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#00897b] text-white px-4 py-2.5 rounded-[8px] shadow-lg text-[13px] font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}

      {/* 1. Underline Tabs (Exact match to 002-requests.png) */}
      <LegacyTabs
        tabs={[
          { id: 'ALL', label: 'Danh sách yêu cầu' },
          { id: 'APPROVAL_QUEUE', label: 'Hàng chờ phê duyệt' },
        ]}
        activeTab={activeTab}
        onChange={(tabId) => {
          setActiveTab(tabId);
          setSelectedIds([]);
          if (tabId === 'APPROVAL_QUEUE') {
            setBusinessDateFilter('');
          }
        }}
      />

      {/* 2. Floating Filter Inputs Row (Exact match to 002-requests.png) */}
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <FloatingDateFilter
          label="Giờ khởi hành"
          value={businessDateFilter}
          onChange={setBusinessDateFilter}
        />
        <FloatingSelect
          label="Trạng thái"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'PENDING_DEPARTMENT', label: 'Chờ trưởng bộ phận phê duyệt' },
            { value: 'PENDING_GA', label: 'Chờ GA phê duyệt' },
            { value: 'WAITING_VENDOR_DISPATCH', label: 'Chờ điều phối' },
            { value: 'WAITING_DRIVER_CONFIRM', label: 'Chờ tài xế xác nhận' },
            { value: 'IN_PROGRESS', label: 'Đang xử lý' },
            { value: 'WAITING_DISTANCE_INPUT', label: 'Chờ nhập khoảng cách' },
            { value: 'APPROVED_BY_TAXI', label: 'Đi taxi' },
            { value: 'COMPLETED', label: 'Hoàn thành' },
            { value: 'CANCELLED', label: 'Đã hủy' },
            { value: 'REJECTED', label: 'Đã từ chối' },
          ]}
        />
        <FloatingSelect
          label="Loại yêu cầu"
          value={requestTypeFilter}
          onChange={setRequestTypeFilter}
          options={[
            { value: 'BUSINESS', label: 'Công tác' },
            { value: 'OVERTIME', label: 'Làm thêm giờ OT' },
            { value: 'GOODS', label: 'Hàng hóa' },
          ]}
        />
        <FloatingSelect
          label="Phòng ban"
          value={departmentFilter}
          onChange={setDepartmentFilter}
          allLabel="Phòng ban"
          widthClass="min-w-[240px]"
          options={departmentOptions}
        />
      </div>

      {/* 3. Section Toolbar Row (Exact match to 002-requests.png & 009-approval-row-context.png) */}
      <SectionToolbar
        title={activeTab === 'APPROVAL_QUEUE' ? 'Hàng chờ phê duyệt' : 'Yêu cầu vận chuyển'}
        loading={loading}
        onRefresh={loadRequests}
        search={search}
        onSearchChange={(val) => {
          setSearch(val);
          setSelectedIds([]);
        }}
        onSearchSubmit={loadRequests}
        showCustomize
        extraRight={
          selectedIds.length > 0 ? (
            <div className="inline-flex items-center gap-1.5 mr-2 bg-[#f0fdf4] border border-[#bbf7d0] rounded-[8px] px-2.5 py-1">
              <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#00897b] text-white text-[11px] font-bold">
                {selectedIds.length}
              </span>
              <button
                type="button"
                onClick={handleBulkApprove}
                className="h-[28px] px-2.5 rounded-[5px] bg-[#00897b] hover:bg-[#00796b] text-white text-[12px] font-medium cursor-pointer"
              >
                Chấp thuận
              </button>
              <button
                type="button"
                onClick={handleBulkMergeApprove}
                className="h-[28px] px-2.5 rounded-[5px] bg-[#0284c7] hover:bg-[#0369a1] text-white text-[12px] font-medium cursor-pointer"
              >
                Duyệt và yêu cầu ghép đơn
              </button>
              <button
                type="button"
                onClick={handleBulkTaxi}
                className="h-[28px] px-2.5 rounded-[5px] bg-[#0d9488] hover:bg-[#0f766e] text-white text-[12px] font-medium cursor-pointer"
              >
                Taxi
              </button>
              <button
                type="button"
                onClick={handleBulkReject}
                className="h-[28px] px-2.5 rounded-[5px] bg-[#dc2626] hover:bg-[#b91c1c] text-white text-[12px] font-medium cursor-pointer"
              >
                Từ chối
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                title="Bỏ chọn tất cả"
                className="p-1 text-[#4b5563] hover:text-[#111827] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : undefined
        }
        primaryButton={
          activeTab === 'APPROVAL_QUEUE'
            ? {
                label: 'Xuất excel trang hiện tại',
                onClick: () => {
                  exportTableToCsv('hang-cho-phe-duyet');
                  showToast('Đã xuất Excel Hàng chờ phê duyệt');
                },
              }
            : {
                label: 'Tạo yêu cầu',
                icon: <Plus className="w-4 h-4" />,
                onClick: () => setCreateModalType('BUSINESS'),
                splitItems: [
                  {
                    label: 'Nhập yêu cầu',
                    icon: <FileSpreadsheet className="w-4 h-4 text-[#00897b]" />,
                    onClick: () => {
                      setImportFileName('');
                      setImportPreviewDone(false);
                      setImportModalOpen(true);
                    },
                  },
                  {
                    label: 'Xuất excel trang hiện tại',
                    icon: <Download className="w-4 h-4 text-[#0284c7]" />,
                    onClick: () => {
                      exportTableToCsv('danh-sach-yeu-cau');
                      showToast('Đã xuất Excel trang hiện tại');
                    },
                  },
                  {
                    label: 'Yêu cầu xe Công tác',
                    icon: <Briefcase className="w-4 h-4 text-[#0284c7]" />,
                    onClick: () => setCreateModalType('BUSINESS'),
                  },
                  {
                    label: 'Yêu cầu xe Làm thêm giờ OT',
                    icon: <Clock className="w-4 h-4 text-[#d97706]" />,
                    onClick: () => setCreateModalType('OVERTIME'),
                  },
                  {
                    label: 'Yêu cầu xe Hàng hóa',
                    icon: <Package className="w-4 h-4 text-[#9333ea]" />,
                    onClick: () => setCreateModalType('GOODS'),
                  },
                ],
              }
        }
      />

      {/* 4. Legacy Data Table (Exact columns & widths from 002-requests.png & 009-approval-row-context.png) */}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left border-collapse">
          <thead>
            <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] text-[13px] font-semibold text-[#1f2937]">
              {activeTab === 'APPROVAL_QUEUE' && (
                <th className="px-2 w-[32px]">
                  <input
                    type="checkbox"
                    ref={(el) => {
                      if (el) {
                        el.indeterminate =
                          selectedIds.length > 0 &&
                          selectedIds.length < pagedRequests.length;
                      }
                    }}
                    checked={
                      pagedRequests.length > 0 &&
                      selectedIds.length === pagedRequests.length
                    }
                    onChange={(e) =>
                      setSelectedIds(
                        e.target.checked ? pagedRequests.map((r) => r.id) : []
                      )
                    }
                  />
                </th>
              )}
              <th className="px-1 w-[2.3%]">#</th>
              <th className="px-1 w-[6.8%]">Loại yêu cầu</th>
              <th className="px-1 w-[10.5%]">Trạng thái</th>
              <th className="px-1 w-[9.0%]">Người yêu cầu</th>
              <th className="px-1 w-[14.2%]">Bộ phận người yêu cầu</th>
              <th className="px-1 w-[10.1%]">Số lượng đăng ký</th>
              <th className="px-1 w-[12.1%]">Giờ khởi hành / Đón</th>
              <th className="px-1 w-[12.2%]">Điểm đón / Lấy hàng</th>
              <th className="px-1 w-[12.1%]">Điểm trả / Giao hàng</th>
              <th className="px-1 w-[10.7%]">Giờ về / Giao hàng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e7eb] text-[13px] text-[#1f2937]">
            {pagedRequests.map((req, idx) => (
              <tr
                key={req.id}
                onClick={(e) =>
                  setContextRow({
                    req,
                    index: reqStartIndex + idx + 1,
                    x: e.clientX,
                    y: e.clientY,
                  })
                }
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextRow({
                    req,
                    index: reqStartIndex + idx + 1,
                    x: e.clientX,
                    y: e.clientY,
                  });
                }}
                className="hover:bg-[#f9fafb] cursor-pointer transition-colors"
              >
                {activeTab === 'APPROVAL_QUEUE' && (
                  <td
                    className="px-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(req.id)}
                      onChange={(e) =>
                        setSelectedIds((prev) =>
                          e.target.checked
                            ? [...prev, req.id]
                            : prev.filter((x) => x !== req.id)
                        )
                      }
                    />
                  </td>
                )}
                <td className="px-1.5 text-[#374151]">{reqStartIndex + idx + 1}</td>
                <td className="px-1.5">{renderRequestTypeBadge(req.requestType)}</td>
                <td className="px-1.5">{renderRequestStatusBadge(req.status)}</td>
                <td className="px-1.5 text-[#1f2937] truncate">
                  {req.requesterName || req.passengers?.[0]?.passengerName || '-'}
                </td>
                <td className="px-1.5 text-[#374151] truncate">
                  {req.departmentName || 'Khối Kỹ thuật EMS'}
                </td>
                <td className="px-1.5 text-[#374151]">
                  {req.requestType === 'GOODS' ? 0 : (req.passengerCount ?? 0)}
                </td>
                <td className="px-1.5 text-[#1f2937] truncate">
                  {formatLegacyReqDateTime(req.businessDate, req.departureTime)}
                </td>
                <td className="px-1.5 text-[#1f2937] truncate">
                  {req.departurePickupPointText || '-'}
                </td>
                <td className="px-1.5 text-[#1f2937] truncate">
                  {req.departureDropoffPointText || '-'}
                </td>
                <td className="px-1.5 text-[#1f2937] truncate">
                  {req.returnTime
                    ? formatLegacyReqDateTime(req.businessDate, req.returnTime)
                    : '-'}
                </td>
              </tr>
            ))}
            {filteredRequests.length === 0 && (
              <tr>
                <td colSpan={11} className="py-8 text-center text-[13px] text-[#9ca3af]">
                  Không có bản ghi nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 5. Bottom Pagination Bar */}
      <LegacyPagination
        totalCount={filteredRequests.length}
        page={reqPage}
        pageSize={reqPageSize}
        onPageChange={setReqPage}
        onPageSizeChange={setReqPageSize}
      />

      {/* 6. Floating Row Context Menu (Legacy 009-approval-row-context.png) */}
      {contextRow && (
        <RowContextMenu
          title={`# ${contextRow.index} (${contextRow.req.requestCode})`}
          position={{ x: contextRow.x, y: contextRow.y }}
          onClose={() => setContextRow(null)}
          actions={
            activeTab === 'APPROVAL_QUEUE'
              ? [
                  {
                    label: 'Xem chi tiết',
                    icon: <Briefcase className="w-4 h-4 text-[#4b5563]" />,
                    onClick: () => setDetailDrawerReq(contextRow.req),
                  },
                  ...(['PENDING_GA', 'PENDING_GA_DEPARTMENT', 'PENDING_DEPARTMENT'].includes(
                    contextRow.req.status
                  )
                    ? [
                        {
                          label: 'Chấp thuận (Phê duyệt yêu cầu)',
                          icon: <CheckCircle2 className="w-4 h-4 text-[#00897b]" />,
                          onClick: () => handleApprove(contextRow.req),
                        },
                        {
                          label: 'Duyệt và yêu cầu ghép đơn',
                          icon: <CheckCircle2 className="w-4 h-4 text-[#0284c7]" />,
                          onClick: () => handleApprove(contextRow.req),
                        },
                        {
                          label: 'Trả về yêu cầu sửa',
                          icon: <RotateCcw className="w-4 h-4 text-[#d97706]" />,
                          onClick: () => handleReturn(contextRow.req),
                        },
                        {
                          label: 'Taxi (Duyệt đi Taxi)',
                          icon: <CarTaxiFront className="w-4 h-4 text-[#0284c7]" />,
                          disabled: contextRow.req.status === 'PENDING_DEPARTMENT',
                          onClick: () => handleApproveTaxi(contextRow.req),
                        },
                        {
                          label: 'Từ chối yêu cầu',
                          icon: <XCircle className="w-4 h-4 text-[#dc2626]" />,
                          danger: true,
                          onClick: () => handleReject(contextRow.req),
                        },
                      ]
                    : []),
                ]
              : [
                  {
                    label: 'Xem chi tiết',
                    icon: <Briefcase className="w-4 h-4 text-[#4b5563]" />,
                    onClick: () => setDetailDrawerReq(contextRow.req),
                  },
                  {
                    label: 'Sửa yêu cầu',
                    icon: <Edit3 className="w-4 h-4 text-[#0284c7]" />,
                    onClick: () => {
                      if (
                        !['PENDING_DEPARTMENT', 'RETURNED'].includes(contextRow.req.status)
                      ) {
                        alert('Không thể chỉnh sửa yêu cầu này nữa');
                        return;
                      }
                      setFormState({
                        ...formState,
                        businessDate: contextRow.req.businessDate || formState.businessDate,
                        tripMode: contextRow.req.tripMode || 'ONE_WAY',
                        passengerCount: contextRow.req.passengerCount || 1,
                        departureTime: contextRow.req.departureTime || '08:00',
                        departurePickupPointText:
                          contextRow.req.departurePickupPointText || 'Nhà máy MKVC',
                        departureDropoffPointText:
                          contextRow.req.departureDropoffPointText || 'Điểm trả',
                        purpose: contextRow.req.purpose || contextRow.req.notes || '',
                      });
                      setCreateModalType(
                        contextRow.req.requestType === 'GOODS' ? 'GOODS' : 'BUSINESS'
                      );
                    },
                  },
                  {
                    label: 'Phê duyệt yêu cầu',
                    icon: <CheckCircle2 className="w-4 h-4 text-[#00897b]" />,
                    disabled: ![
                      'PENDING_DEPARTMENT',
                      'PENDING_GA',
                      'PENDING_GA_DEPARTMENT',
                    ].includes(contextRow.req.status),
                    onClick: () => handleApprove(contextRow.req),
                  },
                  {
                    label: 'Trả về yêu cầu sửa',
                    icon: <RotateCcw className="w-4 h-4 text-[#d97706]" />,
                    disabled: ![
                      'PENDING_DEPARTMENT',
                      'PENDING_GA',
                      'PENDING_GA_DEPARTMENT',
                    ].includes(contextRow.req.status),
                    onClick: () => handleReturn(contextRow.req),
                  },
                  {
                    label: 'Duyệt đi Taxi',
                    icon: <CarTaxiFront className="w-4 h-4 text-[#0284c7]" />,
                    disabled: contextRow.req.status !== 'PENDING_GA',
                    onClick: () => handleApproveTaxi(contextRow.req),
                  },
                  {
                    label: 'Từ chối yêu cầu',
                    icon: <XCircle className="w-4 h-4 text-[#dc2626]" />,
                    danger: true,
                    disabled: ![
                      'PENDING_DEPARTMENT',
                      'PENDING_GA',
                      'PENDING_GA_DEPARTMENT',
                    ].includes(contextRow.req.status),
                    onClick: () => handleReject(contextRow.req),
                  },
                  {
                    label: 'Hủy yêu cầu',
                    icon: <Trash2 className="w-4 h-4 text-[#dc2626]" />,
                    danger: true,
                    disabled: ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(
                      contextRow.req.status
                    ),
                    onClick: () => handleCancelRequest(contextRow.req),
                  },
                ]
          }
        />
      )}

      {/* 6B. Right-Side Request Detail Drawer (Legacy 010-approval-request-detail.png) */}
      {detailDrawerReq && (
        <div className="fixed inset-0 z-50 bg-black/30 flex justify-end">
          <div className="bg-white w-full max-w-[600px] h-full shadow-2xl border-l border-[#e5e7eb] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]">
              <h3 className="text-[15px] font-bold text-[#1f2937]">
                {detailDrawerReq.requestCode} - Thông tin chi tiết
              </h3>
              <button
                type="button"
                onClick={() => setDetailDrawerReq(null)}
                className="text-[#4b5563] hover:text-[#1f2937] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-[13px]">
              <div>
                <h4 className="text-[14px] font-bold text-[#1f2937] mb-3">Yêu cầu</h4>
                <div className="space-y-3 border-t border-[#f3f4f6] pt-3">
                  <div className="grid grid-cols-12 gap-2">
                    <span className="col-span-4 text-[#6b7280] font-medium">Hành khách</span>
                    <span className="col-span-8 text-[#1f2937]">
                      {detailDrawerReq.passengers?.[0]?.passengerName ||
                        detailDrawerReq.contactName ||
                        detailDrawerReq.requesterName ||
                        'Administrator'}
                    </span>
                  </div>
                  <div className="grid grid-cols-12 gap-2">
                    <span className="col-span-4 text-[#6b7280] font-medium">Phòng ban hành khách</span>
                    <span className="col-span-8 text-[#1f2937]">
                      {detailDrawerReq.departmentName || 'Khối Kỹ thuật EMS'}
                    </span>
                  </div>
                  <div className="grid grid-cols-12 gap-2">
                    <span className="col-span-4 text-[#6b7280] font-medium">Người yêu cầu</span>
                    <span className="col-span-8 text-[#1f2937]">
                      {detailDrawerReq.requesterName || 'Administrator'}
                    </span>
                  </div>
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <span className="col-span-4 text-[#6b7280] font-medium">Loại yêu cầu</span>
                    <span className="col-span-8">
                      {renderRequestTypeBadge(detailDrawerReq.requestType)}
                    </span>
                  </div>
                  <div className="grid grid-cols-12 gap-2">
                    <span className="col-span-4 text-[#6b7280] font-medium">Chế độ chuyến</span>
                    <span className="col-span-8 text-[#1f2937]">
                      {detailDrawerReq.tripMode === 'ROUND_TRIP' ? 'Khứ hồi' : 'Một chiều'}
                    </span>
                  </div>
                  <div className="grid grid-cols-12 gap-2">
                    <span className="col-span-4 text-[#6b7280] font-medium">Lộ trình chuyến</span>
                    <div className="col-span-8 text-[#1f2937] space-y-0.5">
                      <div>
                        {detailDrawerReq.departurePickupPointText || 'MKVC'} →{' '}
                        {detailDrawerReq.departureDropoffPointText || 'Điểm trả'}
                      </div>
                      <div className="text-[#4b5563]">
                        {formatLegacyReqDateTime(
                          detailDrawerReq.businessDate,
                          detailDrawerReq.departureTime
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <span className="col-span-4 text-[#6b7280] font-medium">Trạng thái</span>
                    <span className="col-span-8">
                      {renderRequestStatusBadge(detailDrawerReq.status)}
                    </span>
                  </div>
                  <div className="grid grid-cols-12 gap-2">
                    <span className="col-span-4 text-[#6b7280] font-medium">Ghi chú</span>
                    <span className="col-span-8 text-[#1f2937]">
                      {detailDrawerReq.purpose || detailDrawerReq.notes || '—'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[14px] font-bold text-[#1f2937] mb-3">Tóm tắt lịch sử</h4>
                <div className="border-t border-[#f3f4f6] pt-3 space-y-2">
                  <div className="text-[11px] text-[#6b7280]">
                    {detailDrawerReq.businessDate
                      ? detailDrawerReq.businessDate.split('-').reverse().join('/')
                      : ''}
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] mt-1 shrink-0" />
                    <div>
                      <div className="font-semibold text-[#1f2937]">Nhập yêu cầu</div>
                      <div className="text-[12px] text-[#4b5563]">
                        Người thay đổi: {detailDrawerReq.requesterName || 'Administrator'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-3.5 border-t border-[#e5e7eb] bg-[#f9fafb] flex items-center justify-end gap-2">
              {['PENDING_DEPARTMENT', 'PENDING_GA', 'PENDING_GA_DEPARTMENT'].includes(
                detailDrawerReq.status
              ) && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const target = detailDrawerReq;
                      setDetailDrawerReq(null);
                      handleApprove(target);
                    }}
                    className="h-[34px] px-3.5 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-medium cursor-pointer"
                  >
                    Chấp thuận
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const target = detailDrawerReq;
                      setDetailDrawerReq(null);
                      handleReject(target);
                    }}
                    className="h-[34px] px-3.5 rounded-[6px] bg-[#dc2626] hover:bg-[#b91c1c] text-white text-[13px] font-medium cursor-pointer"
                  >
                    Từ chối
                  </button>
                </>
              )}
              {!['COMPLETED', 'CANCELLED', 'REJECTED'].includes(detailDrawerReq.status) && (
                <button
                  type="button"
                  onClick={() => {
                    const target = detailDrawerReq;
                    setDetailDrawerReq(null);
                    handleCancelRequest(target);
                  }}
                  className="h-[34px] px-3.5 rounded-[6px] border border-[#dc2626] text-[#dc2626] hover:bg-[#fef2f2] text-[13px] font-medium cursor-pointer"
                >
                  Hủy
                </button>
              )}
              <button
                type="button"
                onClick={() => setDetailDrawerReq(null)}
                className="h-[34px] px-3.5 rounded-[6px] border border-[#d1d5db] bg-white text-[#374151] hover:bg-gray-50 text-[13px] font-medium cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6C. MODAL: NHẬP YÊU CẦU VẬN CHUYỂN TỪ EXCEL (Case_89..105) */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-[#e5e7eb] w-full max-w-[680px] p-6 space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-[#f3f4f6]">
              <h3 className="text-[15px] font-bold text-[#1f2937]">
                Nhập yêu cầu vận chuyển
              </h3>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="text-[#ef4444] hover:text-[#dc2626] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between bg-[#f0fdf4] border border-[#bbf7d0] rounded-[8px] px-4 py-2.5 text-[13px]">
              <span className="text-[#166534] font-medium">
                Sử dụng tệp mẫu chuẩn (.xlsx, tối đa 1 tệp, 5MB)
              </span>
              <button
                type="button"
                onClick={() => {
                  exportTableToCsv('mau-nhap-yeu-cau-van-chuyen');
                  showToast('Đã tải file mẫu Nhập yêu cầu vận chuyển');
                }}
                className="h-[30px] px-3 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[12px] font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Tải file mẫu
              </button>
            </div>
            <div className="p-6 border-2 border-dashed border-[#d1d5db] rounded-[8px] text-center space-y-2">
              <FileSpreadsheet className="w-8 h-8 text-[#00897b] mx-auto" />
              <div className="text-[13px] font-medium text-[#374151]">
                Tệp Excel (.xlsx) — Kéo thả hoặc chọn tệp từ máy tính
              </div>
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!file.name.toLowerCase().endsWith('.xlsx')) {
                    alert('Sai định dạng file. Chỉ chấp nhận tệp .xlsx');
                    e.target.value = '';
                    return;
                  }
                  if (file.size > 5 * 1024 * 1024) {
                    alert('Tệp vượt quá dung lượng tối đa 5MB');
                    e.target.value = '';
                    return;
                  }
                  setImportFileName(file.name);
                  setImportPreviewDone(false);
                }}
                className="text-[12px] text-[#6b7280]"
              />
              {importFileName && (
                <div className="text-[12px] text-[#00897b] font-semibold">
                  Đã chọn: {importFileName}
                </div>
              )}
            </div>
            {importPreviewDone && (
              <div className="border border-[#e5e7eb] rounded-[8px] p-3 space-y-2 text-[12px]">
                <div className="font-semibold text-[#00897b]">
                  Kết quả xem trước: 1 dòng hợp lệ, 0 dòng lỗi (Chưa ghi dữ liệu)
                </div>
                <table className="w-full text-left border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb]">
                      <th className="p-1.5">#</th>
                      <th className="p-1.5">Loại yêu cầu</th>
                      <th className="p-1.5">Người yêu cầu</th>
                      <th className="p-1.5">Loại chuyến</th>
                      <th className="p-1.5">Số lượng</th>
                      <th className="p-1.5">Điểm đón</th>
                      <th className="p-1.5">Điểm đến</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-1.5">1</td>
                      <td className="p-1.5">Công tác</td>
                      <td className="p-1.5">Administrator</td>
                      <td className="p-1.5">Một chiều</td>
                      <td className="p-1.5">2</td>
                      <td className="p-1.5">Nhà máy MKVC</td>
                      <td className="p-1.5">Sân bay Nội Bài</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="h-[34px] px-4 rounded-[6px] border border-[#d1d5db] bg-white text-[13px] font-medium text-[#4b5563] hover:bg-[#f9fafb] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={!importFileName}
                onClick={() => setImportPreviewDone(true)}
                className="h-[34px] px-4 rounded-[6px] border border-[#00897b] text-[#00897b] disabled:opacity-40 text-[13px] font-medium cursor-pointer"
              >
                Xem trước
              </button>
              {importPreviewDone && (
                <button
                  type="button"
                  onClick={() => {
                    setImportModalOpen(false);
                    showToast('Đã nhập các dòng hợp lệ thành công');
                    loadRequests();
                  }}
                  className="h-[34px] px-4 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-medium cursor-pointer"
                >
                  Nhập các dòng hợp lệ
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CREATE BUSINESS OR GOODS REQUEST (Legacy 003-request-create-form.png) */}
      {/* ==================================================================== */}
      {(createModalType === 'BUSINESS' || createModalType === 'GOODS') && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateSingleRequest}
            className="bg-white rounded-[12px] shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-[#e5e7eb] w-full max-w-[920px] p-6 space-y-5 my-8"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-[#1f2937]">
                Tạo yêu cầu vận chuyển
              </h3>
              <button
                type="button"
                onClick={() => setCreateModalType(null)}
                className="text-[#ef4444] hover:text-[#dc2626] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* THÔNG TIN YÊU CẦU */}
            <div className="space-y-3.5 text-[13px]">
              <div className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
                THÔNG TIN YÊU CẦU
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Người yêu cầu <span className="text-[#ef4444]">*</span>
                  </span>
                  <input
                    type="text"
                    readOnly
                    value="Administrator"
                    className="w-full h-[38px] border border-[#e5e7eb] bg-[#f9fafb] rounded-[6px] px-3 text-[13px] text-[#374151]"
                  />
                </div>
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Phòng ban
                  </span>
                  <input
                    type="text"
                    readOnly
                    value="Khối Kỹ thuật EMS (H00000)"
                    className="w-full h-[38px] border border-[#e5e7eb] bg-[#f9fafb] rounded-[6px] px-3 text-[13px] text-[#374151]"
                  />
                </div>
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Loại yêu cầu <span className="text-[#ef4444]">*</span>
                  </span>
                  <select
                    value={createModalType}
                    onChange={(e) => setCreateModalType(e.target.value as any)}
                    className="w-full h-[38px] border border-[#00897b] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white focus:outline-none"
                  >
                    <option value="BUSINESS">Công tác</option>
                    <option value="OVERTIME">Làm thêm giờ OT</option>
                    <option value="GOODS">Hàng hóa</option>
                  </select>
                </div>
                {createModalType === 'BUSINESS' ? (
                  <div className="relative">
                    <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                      Số lượng đăng ký <span className="text-[#ef4444]">*</span>
                    </span>
                    <input
                      type="number"
                      min={1}
                      required
                      value={formState.passengerCount}
                      onChange={(e) =>
                        setFormState({ ...formState, passengerCount: Number(e.target.value) })
                      }
                      className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937]"
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                      Thông tin Người gửi hàng <span className="text-[#ef4444]">*</span>
                    </span>
                    <input
                      type="text"
                      required
                      value={formState.senderInfo}
                      onChange={(e) => setFormState({ ...formState, senderInfo: e.target.value })}
                      className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937]"
                    />
                  </div>
                )}
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Số điện thoại liên hệ <span className="text-[#ef4444]">*</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={formState.contactPhone}
                    onChange={(e) => setFormState({ ...formState, contactPhone: e.target.value })}
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937]"
                  />
                </div>
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Loại xe yêu cầu
                  </span>
                  <select
                    value={formState.requestedVehicleType}
                    onChange={(e) =>
                      setFormState({ ...formState, requestedVehicleType: e.target.value })
                    }
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] bg-white"
                  >
                    <option value="">-- Không bắt buộc --</option>
                    <option value="VAN_16">Van 16 chỗ</option>
                    <option value="BUS_29">Bus 29 chỗ</option>
                    <option value="BUS_45">Bus 45 chỗ</option>
                    <option value="SEDAN_4">Xe 4 chỗ</option>
                    <option value="SUV_7">Xe 7 chỗ</option>
                  </select>
                </div>
              </div>

              {createModalType === 'GOODS' ? (
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Thông tin Người nhận hàng <span className="text-[#ef4444]">*</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={formState.receiverInfo}
                    onChange={(e) => setFormState({ ...formState, receiverInfo: e.target.value })}
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937]"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[12px] font-semibold text-[#374151]">Tên hành khách</div>
                  <input
                    type="text"
                    required
                    value={formState.contactName}
                    onChange={(e) => setFormState({ ...formState, contactName: e.target.value })}
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937]"
                  />
                </div>
              )}
            </div>

            {/* HƯỚNG DI CHUYỂN */}
            <div className="space-y-3.5 text-[13px]">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
                  HƯỚNG DI CHUYỂN — Lộ trình chuyến
                </div>
                {createModalType === 'BUSINESS' && (
                  <select
                    value={formState.tripMode}
                    onChange={(e) => setFormState({ ...formState, tripMode: e.target.value })}
                    className="h-[30px] border border-[#d1d5db] rounded-[6px] px-2.5 text-[12px] text-[#1f2937] bg-white"
                  >
                    <option value="ONE_WAY">Một chiều</option>
                    <option value="ROUND_TRIP">Khứ hồi 2 chiều</option>
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Ngày đi <span className="text-[#ef4444]">*</span>
                  </span>
                  <input
                    type="date"
                    required
                    value={formState.businessDate}
                    onChange={(e) => setFormState({ ...formState, businessDate: e.target.value })}
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937]"
                  />
                </div>
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Giờ đi <span className="text-[#ef4444]">*</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={formState.departureTime}
                    onChange={(e) => setFormState({ ...formState, departureTime: e.target.value })}
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937]"
                  />
                </div>
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Giờ đến dự kiến <span className="text-[#ef4444]">*</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={formState.expectedArrivalTime}
                    onChange={(e) =>
                      setFormState({ ...formState, expectedArrivalTime: e.target.value })
                    }
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937]"
                  />
                </div>
              </div>

              {createModalType === 'BUSINESS' && formState.tripMode === 'ROUND_TRIP' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="relative">
                    <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#00897b] leading-none">
                      Giờ về <span className="text-[#ef4444]">*</span>
                    </span>
                    <input
                      type="text"
                      required
                      value={formState.returnTime}
                      onChange={(e) => setFormState({ ...formState, returnTime: e.target.value })}
                      className="w-full h-[38px] border border-[#00897b] rounded-[6px] px-3 text-[13px] text-[#1f2937]"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#00897b] leading-none">
                      Giờ về đến dự kiến <span className="text-[#ef4444]">*</span>
                    </span>
                    <input
                      type="text"
                      required
                      value={formState.returnExpectedArrivalTime}
                      onChange={(e) =>
                        setFormState({ ...formState, returnExpectedArrivalTime: e.target.value })
                      }
                      className="w-full h-[38px] border border-[#00897b] rounded-[6px] px-3 text-[13px] text-[#1f2937]"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Điểm đón <span className="text-[#ef4444]">*</span>
                  </span>
                  <input
                    list="points-datalist"
                    required
                    value={formState.departurePickupPointText}
                    onChange={(e) =>
                      setFormState({ ...formState, departurePickupPointText: e.target.value })
                    }
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937]"
                  />
                </div>
                <div className="relative">
                  <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                    Điểm trả <span className="text-[#ef4444]">*</span>
                  </span>
                  <input
                    list="points-datalist"
                    required
                    value={formState.departureDropoffPointText}
                    onChange={(e) =>
                      setFormState({ ...formState, departureDropoffPointText: e.target.value })
                    }
                    className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937]"
                  />
                </div>
                <datalist id="points-datalist">
                  {points.map((p) => (
                    <option key={p.id} value={p.pointName}>
                      [{p.pointType}] {p.pointCode} - {p.pointName}
                    </option>
                  ))}
                </datalist>
              </div>
            </div>

            {/* CHI TIẾT TÙY CHỌN */}
            <div className="space-y-2.5 text-[13px]">
              <div className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
                CHI TIẾT TÙY CHỌN
              </div>
              <div className="relative">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Ghi chú / Mục đích <span className="text-[#ef4444]">*</span>
                </span>
                <input
                  type="text"
                  required
                  value={formState.purpose}
                  onChange={(e) => setFormState({ ...formState, purpose: e.target.value })}
                  className="w-full h-[38px] border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937]"
                  placeholder="Ghi chú"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateModalType(null)}
                className="h-[34px] px-4 rounded-[6px] border border-[#d1d5db] bg-white text-[13px] font-medium text-[#4b5563] hover:bg-[#f9fafb] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="h-[34px] px-4 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-medium cursor-pointer"
              >
                Lưu yêu cầu
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CREATE BULK OVERTIME REQUESTS */}
      {/* ==================================================================== */}
      {createModalType === 'OVERTIME' && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateBulkOt}
            className="bg-white rounded-[10px] shadow-xl border border-[#e5e7eb] w-full max-w-4xl p-5 space-y-4 my-8"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-[15px] font-bold text-gray-900">
                  Tạo yêu cầu xe Làm thêm giờ OT theo ca (Tối đa 50 dòng/lần)
                </h3>
                <p className="text-[11px] text-gray-500">
                  Hệ thống tự động tra cứu điểm đón/trả từ hồ sơ Người đi xe tuyến (ETP) của nhân viên
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalType(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Ngày tăng ca OT *</label>
                <input
                  type="date"
                  required
                  value={otDate}
                  onChange={(e) => setOtDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block font-semibold text-gray-700 mb-1">
                  Chọn Khung giờ / Ca OT *
                </label>
                <select
                  required
                  value={otShiftCode}
                  onChange={(e) => setOtShiftCode(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 bg-[#f0fdf4] font-semibold text-[#00796b]"
                >
                  {otShiftOptions.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      [{opt.optionType}] {opt.code} - {opt.label} ({opt.departureTime || '--:--'} →{' '}
                      {opt.returnTime || '--:--'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-800">
                  Danh sách nhân viên đăng ký xe OT ({otRows.length}/50)
                </span>
                <button
                  type="button"
                  disabled={otRows.length >= 50}
                  onClick={() =>
                    setOtRows([
                      ...otRows,
                      {
                        employeeCode: '',
                        employeeName: '',
                        departmentName: '',
                        pickupPointText: '',
                        dropoffPointText: 'Nhà máy MKVC',
                        legDirection: 'FROM_FACTORY',
                        purpose: 'Đăng ký xe đưa đón tăng ca OT',
                      },
                    ])
                  }
                  className="px-2.5 py-1 rounded bg-[#00897b] text-white font-semibold hover:bg-[#00796b] cursor-pointer"
                >
                  + Thêm dòng nhân viên
                </button>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-md">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-[12px] text-gray-700 font-bold">
                    <tr>
                      <th className="py-2 px-2">Nhân viên (ETP)</th>
                      <th className="py-2 px-2">Chiều</th>
                      <th className="py-2 px-2">Điểm đón</th>
                      <th className="py-2 px-2">Điểm trả</th>
                      <th className="py-2 px-2">Ghi chú</th>
                      <th className="py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {otRows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="p-2">
                          <select
                            required
                            value={row.employeeCode}
                            onChange={(e) => {
                              const code = e.target.value;
                              const emp = employees.find((x) => x.empCode === code);
                              const etp = etpProfiles.find(
                                (p) => p.employee?.empCode === code
                              );
                              const next = [...otRows];
                              next[idx] = {
                                ...next[idx],
                                employeeCode: code,
                                employeeName: emp?.fullName || code,
                                departmentName: emp?.orgUnit?.name || '',
                                pickupPointText:
                                  row.legDirection === 'FROM_FACTORY'
                                    ? 'Nhà máy MKVC'
                                    : etp?.pickupPoint?.pointName || '',
                                dropoffPointText:
                                  row.legDirection === 'FROM_FACTORY'
                                    ? etp?.pickupPoint?.pointName || ''
                                    : 'Nhà máy MKVC',
                              };
                              setOtRows(next);
                            }}
                            className="w-full border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="">-- Chọn nhân viên --</option>
                            {employees.map((emp) => (
                              <option key={emp.id} value={emp.empCode}>
                                {emp.empCode} - {emp.fullName}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <select
                            value={row.legDirection}
                            onChange={(e) => {
                              const next = [...otRows];
                              next[idx] = { ...next[idx], legDirection: e.target.value };
                              setOtRows(next);
                            }}
                            className="border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="FROM_FACTORY">Từ NM về</option>
                            <option value="TO_FACTORY">Đến NM</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            required
                            value={row.pickupPointText}
                            onChange={(e) => {
                              const next = [...otRows];
                              next[idx] = { ...next[idx], pickupPointText: e.target.value };
                              setOtRows(next);
                            }}
                            className="w-full border border-gray-300 rounded px-2 py-1"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            required
                            value={row.dropoffPointText}
                            onChange={(e) => {
                              const next = [...otRows];
                              next[idx] = { ...next[idx], dropoffPointText: e.target.value };
                              setOtRows(next);
                            }}
                            className="w-full border border-gray-300 rounded px-2 py-1"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.purpose}
                            onChange={(e) => {
                              const next = [...otRows];
                              next[idx] = { ...next[idx], purpose: e.target.value };
                              setOtRows(next);
                            }}
                            className="w-full border border-gray-300 rounded px-2 py-1"
                          />
                        </td>
                        <td className="p-2 text-right">
                          {otRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setOtRows(otRows.filter((_, i) => i !== idx))
                              }
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setCreateModalType(null)}
                className="px-3.5 py-1.5 rounded-md border border-gray-300 text-xs font-medium text-gray-700"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-md bg-[#00897b] text-white text-xs font-semibold hover:bg-[#00796b] cursor-pointer"
              >
                Lưu {otRows.length} đơn OT
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
