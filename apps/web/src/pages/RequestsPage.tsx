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
  RowContextMenu,
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

  // Row Context Menu
  const [contextRow, setContextRow] = useState<{
    req: any;
    index: number;
    x: number;
    y: number;
  } | null>(null);

  // Create Modal
  const [createModalType, setCreateModalType] = useState<
    'BUSINESS' | 'OVERTIME' | 'GOODS' | null
  >(null);

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
      if (departmentFilter.trim()) {
        const kw = departmentFilter.trim().toLowerCase();
        list = list.filter((r) => (r.departmentName || '').toLowerCase().includes(kw));
      }
      setRequests(list);
      setSelectedIds([]);
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
      showToast(`Đã phê duyệt hàng loạt ${selectedIds.length} đơn`);
      loadRequests();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.length === 0) return;
    const reason = prompt('Nhập lý do từ chối hàng loạt:', 'Từ chối theo lô');
    if (reason === null) return;
    try {
      await gqlRequest(
        `mutation BulkReject($ids: [BigInt!]!, $reason: String!) {
          bulkRejectRequests(ids: $ids, reason: $reason) { id }
        }`,
        { ids: selectedIds, reason }
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
        onChange={setActiveTab}
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
            { value: 'PENDING_DEPARTMENT', label: 'Đang chờ phê duyệt (Bộ phận)' },
            { value: 'PENDING_GA', label: 'Đang chờ phê duyệt (GA)' },
            { value: 'WAITING_VENDOR_DISPATCH', label: 'Chờ điều phối' },
            { value: 'WAITING_DRIVER_CONFIRM', label: 'Chờ tài xế xác nhận' },
            { value: 'IN_PROGRESS', label: 'Đang chạy' },
            { value: 'COMPLETED', label: 'Hoàn thành' },
            { value: 'APPROVED_BY_TAXI', label: 'Duyệt đi Taxi' },
            { value: 'RETURNED', label: 'Trả về sửa' },
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
          options={[
            { value: 'Khối Kỹ thuật EMS', label: 'Khối Kỹ thuật EMS' },
            { value: 'Chỉ thị thiết kế', label: 'Chỉ thị thiết kế' },
            { value: 'P. Kế hoạch', label: 'P. Kế hoạch' },
            { value: 'P. Sản xuất', label: 'P. Sản xuất' },
            { value: 'P. Kho vận', label: 'P. Kho vận' },
          ]}
        />
      </div>

      {/* 3. Section Toolbar Row (Exact match to 002-requests.png) */}
      <SectionToolbar
        title="Yêu cầu vận chuyển"
        loading={loading}
        onRefresh={loadRequests}
        search={search}
        onSearchChange={setSearch}
        onSearchSubmit={loadRequests}
        showCustomize
        extraRight={
          selectedIds.length > 0 ? (
            <div className="inline-flex items-center gap-1.5 mr-2">
              <button
                type="button"
                onClick={handleBulkApprove}
                className="h-[34px] px-3 rounded-[6px] bg-[#00897b] text-white text-[12px] font-medium cursor-pointer"
              >
                Phê duyệt ({selectedIds.length})
              </button>
              <button
                type="button"
                onClick={handleBulkReject}
                className="h-[34px] px-3 rounded-[6px] bg-[#dc2626] text-white text-[12px] font-medium cursor-pointer"
              >
                Từ chối ({selectedIds.length})
              </button>
            </div>
          ) : undefined
        }
        primaryButton={{
          label: 'Tạo yêu cầu',
          icon: <Plus className="w-4 h-4" />,
          onClick: () => setCreateModalType('BUSINESS'),
          splitItems: [
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
        }}
      />

      {/* 4. Legacy Data Table (Exact columns & widths from 002-requests.png) */}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left border-collapse">
          <thead>
            <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] text-[13px] font-semibold text-[#1f2937]">
              {activeTab === 'APPROVAL_QUEUE' && (
                <th className="px-2 w-[36px]">
                  <input
                    type="checkbox"
                    checked={requests.length > 0 && selectedIds.length === requests.length}
                    onChange={(e) =>
                      setSelectedIds(e.target.checked ? requests.map((r) => r.id) : [])
                    }
                  />
                </th>
              )}
              <th className="px-1.5 w-[3.5%]">#</th>
              <th className="px-1.5 w-[7.5%]">Loại yêu cầu</th>
              <th className="px-1.5 w-[10.5%]">Trạng thái</th>
              <th className="px-1.5 w-[8.5%]">Người yêu cầu</th>
              <th className="px-1.5 w-[14.5%]">Bộ phận người yêu cầu</th>
              <th className="px-1.5 w-[9.5%]">Số lượng đăng ký</th>
              <th className="px-1.5 w-[11.5%]">Giờ khởi hành / Đón</th>
              <th className="px-1.5 w-[11.5%]">Điểm đón / Lấy hàng</th>
              <th className="px-1.5 w-[11.5%]">Điểm trả / Giao hàng</th>
              <th className="px-1.5 w-[11.5%]">Giờ về / Giao hàng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e7eb] text-[13px] text-[#1f2937]">
            {requests.map((req, idx) => (
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
                <td className="px-1.5 text-[#374151]">{idx + 1}</td>
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
            {requests.length === 0 && (
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
      <LegacyPagination totalCount={requests.length} />

      {/* 6. Floating Row Context Menu */}
      {contextRow && (
        <RowContextMenu
          title={`# ${contextRow.index} (${contextRow.req.requestCode})`}
          position={{ x: contextRow.x, y: contextRow.y }}
          onClose={() => setContextRow(null)}
          actions={[
            {
              label: 'Chấp thuận / Phê duyệt',
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
          ]}
        />
      )}

      {/* ==================================================================== */}
      {/* MODAL: CREATE BUSINESS OR GOODS REQUEST */}
      {/* ==================================================================== */}
      {(createModalType === 'BUSINESS' || createModalType === 'GOODS') && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateSingleRequest}
            className="bg-white rounded-[10px] shadow-xl border border-[#e5e7eb] w-full max-w-2xl p-5 space-y-4 my-8"
          >
            <div className="flex items-center justify-between border-b border-[#f3f4f6] pb-3">
              <h3 className="text-[15px] font-bold text-[#111827]">
                {createModalType === 'BUSINESS'
                  ? 'Tạo yêu cầu xe Công tác'
                  : 'Tạo yêu cầu xe Vận chuyển hàng hóa'}
              </h3>
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
                <label className="block font-semibold text-gray-700 mb-1">Ngày sử dụng *</label>
                <input
                  type="date"
                  required
                  value={formState.businessDate}
                  onChange={(e) => setFormState({ ...formState, businessDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              {createModalType === 'BUSINESS' && (
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Loại hành trình</label>
                  <select
                    value={formState.tripMode}
                    onChange={(e) => setFormState({ ...formState, tripMode: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="ONE_WAY">Một chiều (ONE_WAY)</option>
                    <option value="ROUND_TRIP">Khứ hồi 2 chiều (ROUND_TRIP)</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Loại xe đề xuất</label>
                <select
                  value={formState.requestedVehicleType}
                  onChange={(e) =>
                    setFormState({ ...formState, requestedVehicleType: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="SEDAN_4">Xe 4 chỗ (SEDAN_4)</option>
                  <option value="SUV_7">Xe 7 chỗ (SUV_7)</option>
                  <option value="VAN_16">Xe 16 chỗ (VAN_16)</option>
                  <option value="BUS_29">Xe 29 chỗ (BUS_29)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Giờ xuất phát *</label>
                <input
                  type="text"
                  required
                  value={formState.departureTime}
                  onChange={(e) => setFormState({ ...formState, departureTime: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Giờ đến dự kiến *</label>
                <input
                  type="text"
                  required
                  value={formState.expectedArrivalTime}
                  onChange={(e) =>
                    setFormState({ ...formState, expectedArrivalTime: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono"
                />
              </div>
              {createModalType === 'BUSINESS' && formState.tripMode === 'ROUND_TRIP' && (
                <>
                  <div>
                    <label className="block font-semibold text-[#00897b] mb-1">Giờ về *</label>
                    <input
                      type="text"
                      required
                      value={formState.returnTime}
                      onChange={(e) => setFormState({ ...formState, returnTime: e.target.value })}
                      className="w-full border border-[#00897b] rounded-md px-3 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#00897b] mb-1">
                      Giờ về đến dự kiến *
                    </label>
                    <input
                      type="text"
                      required
                      value={formState.returnExpectedArrivalTime}
                      onChange={(e) =>
                        setFormState({ ...formState, returnExpectedArrivalTime: e.target.value })
                      }
                      className="w-full border border-[#00897b] rounded-md px-3 py-2 font-mono"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Điểm đón *</label>
                <input
                  list="points-datalist"
                  required
                  value={formState.departurePickupPointText}
                  onChange={(e) =>
                    setFormState({ ...formState, departurePickupPointText: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Điểm đến / trả *</label>
                <input
                  list="points-datalist"
                  required
                  value={formState.departureDropoffPointText}
                  onChange={(e) =>
                    setFormState({ ...formState, departureDropoffPointText: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
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

            {createModalType === 'GOODS' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-md bg-amber-50 border border-amber-200 text-xs">
                <div>
                  <label className="block font-semibold text-amber-900 mb-1">
                    Thông tin Người gửi hàng *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.senderInfo}
                    onChange={(e) => setFormState({ ...formState, senderInfo: e.target.value })}
                    className="w-full border border-amber-300 rounded-md px-3 py-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-amber-900 mb-1">
                    Thông tin Người nhận hàng *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.receiverInfo}
                    onChange={(e) => setFormState({ ...formState, receiverInfo: e.target.value })}
                    className="w-full border border-amber-300 rounded-md px-3 py-2 bg-white"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Số lượng hành khách *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={formState.passengerCount}
                    onChange={(e) =>
                      setFormState({ ...formState, passengerCount: Number(e.target.value) })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Người liên hệ đoàn *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.contactName}
                    onChange={(e) => setFormState({ ...formState, contactName: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">SĐT liên hệ *</label>
                  <input
                    type="text"
                    required
                    value={formState.contactPhone}
                    onChange={(e) => setFormState({ ...formState, contactPhone: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono"
                  />
                </div>
              </div>
            )}

            <div className="text-xs">
              <label className="block font-semibold text-gray-700 mb-1">Mục đích chi tiết *</label>
              <input
                type="text"
                required
                value={formState.purpose}
                onChange={(e) => setFormState({ ...formState, purpose: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
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
                Gửi yêu cầu
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
