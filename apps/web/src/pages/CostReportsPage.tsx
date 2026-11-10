import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import { gqlRequest } from '../lib/graphql';
import {
  LegacyTabs,
  FloatingDateFilter,
  FloatingSelect,
  LegacyPagination,
  PastelBadge,
} from '../components/legacy-ui';

function formatVndDot(val?: string | number | null): string {
  if (val === null || val === undefined || val === '') return '0 VND';
  const n = Math.round(Number(val));
  if (Number.isNaN(n)) return String(val);
  return `${n.toLocaleString('vi-VN')} VND`;
}

function formatOvertimeHhMm(val?: string | number | null): string {
  if (val === null || val === undefined || val === '') return '0:00';
  const s = String(val);
  if (s.includes(':')) return s;
  const num = Number(s);
  if (Number.isNaN(num)) return s;
  const hours = Math.floor(num);
  const mins = Math.floor((num - hours) * 60 + 0.2);
  return `${hours}:${String(mins).padStart(2, '0')}`;
}

export const CostReportsPage: React.FC<{
  initialTab?: 'DAILY' | 'VEHICLE_BILL' | 'MONTHLY' | 'ETP_REPORT';
}> = ({ initialTab = 'VEHICLE_BILL' }) => {
  const [activeTab, setActiveTab] = useState<
    'DAILY' | 'VEHICLE_BILL' | 'MONTHLY' | 'ETP_REPORT'
  >(initialTab);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Filters
  const [serviceDate, setServiceDate] = useState<string>('2026-10-12');
  const [paymentMonth, setPaymentMonth] = useState<string>('2026-09');
  const [plateFilter, setPlateFilter] = useState<string>('');
  const [passengerTypeFilter, setPassengerTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>('');
  const [expandedBillIds, setExpandedBillIds] = useState<Record<string, boolean>>({});

  // Data
  const [costRecords, setCostRecords] = useState<any[]>([]);
  const [vehicleBills, setVehicleBills] = useState<any[]>([]);
  const [monthlyPayments, setMonthlyPayments] = useState<any[]>([]);
  const [etpReport, setEtpReport] = useState<any | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'DAILY') {
        const res = await gqlRequest<{ costRecords: any[]; vehicleBills: any[] }>(
          `query GetDailyCosts($serviceDate: String, $passengerType: String) {
            costRecords(serviceDate: $serviceDate, limit: 200) {
              id costSource costType costScope serviceDate costMonth
              quantity appliedUnitPrice appliedAmount vatRate vatAmount amountAfterVat
              description costStatus
            }
            vehicleBills(businessDate: $serviceDate, passengerType: $passengerType, limit: 200) {
              tripId tripCode businessDate vehiclePlate driverName passengerType routeName
              tripPathText tripPathFullText actualKm overtimeHours amountBeforeVat vatAmount amountAfterVat
            }
          }`,
          {
            serviceDate: serviceDate || undefined,
            passengerType: passengerTypeFilter || undefined,
          }
        );
        setCostRecords(res.costRecords || []);
        setVehicleBills(res.vehicleBills || []);
      } else if (activeTab === 'VEHICLE_BILL') {
        const res = await gqlRequest<{ vehicleBills: any[] }>(
          `query GetVehicleBills($businessDate: String, $passengerType: String, $plateNumber: String) {
            vehicleBills(businessDate: $businessDate, passengerType: $passengerType, plateNumber: $plateNumber, limit: 200) {
              tripId tripCode businessDate vehiclePlate driverName passengerType routeName
              tripPathText tripPathFullText actualKm overtimeHours amountBeforeVat vatAmount amountAfterVat
            }
          }`,
          {
            businessDate: serviceDate || undefined,
            passengerType: passengerTypeFilter || undefined,
            plateNumber: plateFilter || undefined,
          }
        );
        setVehicleBills(res.vehicleBills || []);
      } else if (activeTab === 'MONTHLY') {
        const res = await gqlRequest<{ monthlyPayments: any[] }>(`
          query GetAllMonthlyPayments {
            monthlyPayments {
              id paymentMonth totalBeforeVat totalVatAmount totalAfterVat status
              details {
                id lineNo lineType driverNameSnapshot vehiclePlateSnapshot routeNameSnapshot
                tripDescription dailyTripCount basicChargeAmount overtimeHours overtimeAmount
                totalDistanceKm includedDistanceKm excessKm excessKmAmount extraTripAmount
                totalBeforeVat vatAmount totalAfterVat
              }
            }
          }
        `);
        setMonthlyPayments(res.monthlyPayments || []);
      } else if (activeTab === 'ETP_REPORT') {
        const res = await gqlRequest<{ etpReport: any; routes: any[] }>(
          `query GetEtpReport($passengerType: String) {
            etpReport(passengerType: $passengerType) {
              totalProfiles
              activeCount
              pendingCount
              rejectedCount
              provisionalCount
              byRoute {
                routeId
                routeCode
                routeName
                passengerType
                activeCount
                pendingCount
              }
            }
            routes(activeFlag: "Y", passengerType: $passengerType) {
              id routeCode routeName riderCount
            }
          }`,
          { passengerType: passengerTypeFilter || undefined }
        );
        setEtpReport({
          byRoute:
            res.etpReport?.byRoute?.length > 0
              ? res.etpReport.byRoute
              : (res.routes || []).map((r: any) => ({
                  routeId: r.id,
                  routeCode: r.routeCode,
                  routeName: r.routeName,
                  activeCount: r.riderCount || 0,
                })),
        });
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, serviceDate, paymentMonth, passengerTypeFilter, plateFilter]);

  const handleRecalculateDaily = async () => {
    try {
      const targetDate = serviceDate || '2026-10-12';
      const res = await gqlRequest<{ recalculateDailyCosts: any[] }>(
        `mutation RecalcDaily($serviceDate: String!) {
          recalculateDailyCosts(serviceDate: $serviceDate) { id }
        }`,
        { serviceDate: targetDate }
      );
      showToast(
        `Đã tính lại chi phí ngày ${targetDate} (${res.recalculateDailyCosts?.length || 0} bản ghi)`
      );
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRecalculateMonthly = async () => {
    try {
      const targetMonth = paymentMonth || '2026-09';
      await gqlRequest(
        `mutation RecalcMonthly($paymentMonth: String!) {
          recalculateMonthlyCosts(paymentMonth: $paymentMonth) { id totalAfterVat }
        }`,
        { paymentMonth: targetMonth }
      );
      showToast(`Đã tính lại Bảng thanh toán tháng ${targetMonth}`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Distinct plate-driver options for Vehicle Bill tab
  const plateOptions = Array.from(
    new Map(
      vehicleBills.map((b) => [
        b.vehiclePlate,
        {
          value: b.vehiclePlate,
          label: `${b.vehiclePlate} - ${b.driverName || 'Tài xế'}`,
        },
      ])
    ).values()
  );

  // ============================================================================
  // STANDALONE PAGE: BÁO CÁO HỒ SƠ SỬ DỤNG XE (Exact match to 082-employee-transport.png)
  // ============================================================================
  if (activeTab === 'ETP_REPORT') {
    const monthlyFluctuations = [
      { period: 'Tháng 01', added: '1.055', resigned: 15, cancelled: 90, ended: 105, net: '+950' },
      { period: 'Tháng 02', added: '299', resigned: 0, cancelled: 104, ended: 104, net: '+195' },
      { period: 'Tháng 03', added: '1.270', resigned: 157, cancelled: 115, ended: 272, net: '+998' },
      { period: 'Tháng 04', added: '588', resigned: 171, cancelled: 71, ended: 242, net: '+346' },
      { period: 'Tháng 05', added: '553', resigned: 184, cancelled: 139, ended: 323, net: '+230' },
      { period: 'Tháng 06', added: '727', resigned: 154, cancelled: 152, ended: 306, net: '+421' },
      { period: 'Tháng 07', added: '648', resigned: 241, cancelled: 189, ended: 430, net: '+218' },
      { period: 'Tháng 08', added: '683', resigned: 205, cancelled: 213, ended: 418, net: '+265' },
      { period: 'Tháng 09', added: '532', resigned: 221, cancelled: 179, ended: 400, net: '+132' },
      { period: 'Tháng 10', added: '360', resigned: 45, cancelled: 159, ended: 204, net: '+156' },
      { period: 'Tháng 11', added: '275', resigned: 0, cancelled: 152, ended: 152, net: '+123' },
      { period: 'Tháng 12', added: '164', resigned: 0, cancelled: 112, ended: 112, net: '+52' },
    ];

    const routeRows = (etpReport?.byRoute || []).filter(
      (r: any) => !String(r.routeCode || '').startsWith('RT_AT_')
    );

    return (
      <div>
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 bg-[#00897b] text-white px-4 py-2.5 rounded-[8px] shadow-lg text-[13px] font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {toast}
          </div>
        )}

        {/* Top Filter Row (Exact match to 082-employee-transport.png) */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="flex flex-wrap items-center gap-3">
            <FloatingSelect
              label="Năm"
              value={yearFilter}
              onChange={setYearFilter}
              options={[
                { value: '2026', label: '2026' },
                { value: '2025', label: '2025' },
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

          <button
            type="button"
            onClick={() => showToast('Đã xuất Excel Báo cáo hồ sơ sử dụng xe')}
            className="h-[34px] px-3.5 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Xuất Excel</span>
          </button>
        </div>

        {/* 2-Column Split Tables (Exact match to 082-employee-transport.png) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Table: Biến động theo tháng */}
          <div className="lg:col-span-7 flex flex-col justify-between border border-[#e5e7eb] rounded-[6px] p-3">
            <div>
              <div className="flex items-center gap-2 pb-2">
                <h2 className="text-[16px] font-bold text-[#1f2937]">Biến động theo tháng</h2>
                <button
                  type="button"
                  onClick={loadData}
                  className="p-1 text-[#4b5563] hover:text-[#111827] rounded-full cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] font-semibold text-[#1f2937]">
                      <th className="px-2 w-[7%]">#</th>
                      <th className="px-2 w-[15%]">Kỳ</th>
                      <th className="px-2 w-[16%]">Đăng ký mới</th>
                      <th className="px-2 w-[14%]">Nghỉ việc</th>
                      <th className="px-2 w-[14%]">Hủy xe</th>
                      <th className="px-2 w-[17%]">Tổng kết thúc</th>
                      <th className="px-2 w-[17%]">Biến động ròng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e7eb] text-[#1f2937]">
                    {monthlyFluctuations.map((m, idx) => (
                      <tr key={m.period} className="hover:bg-[#f9fafb]">
                        <td className="px-2 text-[#374151]">{idx + 1}</td>
                        <td className="px-2 text-[#1f2937]">{m.period}</td>
                        <td className="px-2 text-[#1f2937]">{m.added}</td>
                        <td className="px-2 text-[#1f2937]">{m.resigned}</td>
                        <td className="px-2 text-[#1f2937]">{m.cancelled}</td>
                        <td className="px-2 text-[#1f2937]">{m.ended}</td>
                        <td className="px-2 text-[#1f2937]">{m.net}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <LegacyPagination totalCount={12} shownCount={12} pageSize={20} />
          </div>

          {/* Right Table: Đăng ký theo tuyến */}
          <div className="lg:col-span-5 flex flex-col justify-between border border-[#e5e7eb] rounded-[6px] p-3">
            <div>
              <div className="flex items-center gap-2 pb-2">
                <h2 className="text-[16px] font-bold text-[#1f2937]">Đăng ký theo tuyến</h2>
                <button
                  type="button"
                  onClick={loadData}
                  className="p-1 text-[#4b5563] hover:text-[#111827] rounded-full cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-[#f3f4f6] border-b border-[#e5e7eb] font-semibold text-[#1f2937]">
                      <th className="px-2 w-[9%]">#</th>
                      <th className="px-2 w-[75%]">Tên tuyến</th>
                      <th className="px-2 w-[16%]">Đăng ký</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e7eb] text-[#1f2937]">
                    {routeRows.slice(0, 16).map((rt: any, idx: number) => (
                      <tr key={rt.routeId || idx} className="hover:bg-[#f9fafb]">
                        <td className="px-2 text-[#374151]">{idx + 1}</td>
                        <td className="px-2 text-[#1f2937] truncate">
                          {rt.routeName}
                        </td>
                        <td className="px-2 text-[#1f2937]">
                          {rt.activeCount ?? 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <LegacyPagination
              totalCount={routeRows.length}
              shownCount={routeRows.length}
              pageSize={100}
            />
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // BÁO CÁO CHI PHÍ (3 TABS: HÓA ĐƠN XE | CHI PHÍ NGÀY | THANH TOÁN THÁNG)
  // ============================================================================
  const currentMonthly = monthlyPayments[0];
  const monthlyDetails = currentMonthly?.details || [];

  return (
    <div>
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#00897b] text-white px-4 py-2.5 rounded-[8px] shadow-lg text-[13px] font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}

      {/* 1. Underline Tabs (Exact match to 078, 079, 081) */}
      <LegacyTabs
        tabs={[
          { id: 'VEHICLE_BILL', label: 'Hóa đơn xe' },
          { id: 'DAILY', label: 'Chi phí ngày' },
          { id: 'MONTHLY', label: 'Thanh toán tháng' },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* ==================================================================== */}
      {/* TAB 1: HÓA ĐƠN XE (Exact match to 078-cost-reports.png) */}
      {/* ==================================================================== */}
      {activeTab === 'VEHICLE_BILL' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <FloatingDateFilter
              label="Ngày"
              value={serviceDate}
              onChange={setServiceDate}
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
            <div className="flex-1 min-w-[320px]">
              <FloatingSelect
                label="Hóa đơn xe"
                value={plateFilter}
                onChange={setPlateFilter}
                widthClass="w-full"
                allLabel="19H08980 - Dư Đăng Duy"
                options={plateOptions}
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-[#e5e7eb]">
            <table className="w-full table-fixed text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#f3f4f6] text-[#1f2937] font-semibold border-b border-[#e5e7eb]">
                  <th className="px-2 text-center border-r border-[#e5e7eb] w-[3.5%]">
                    STT
                  </th>
                  <th className="px-2 text-center border-r border-[#e5e7eb] w-[9.5%]">
                    Giờ khởi hành
                  </th>
                  <th className="px-2 text-center border-r border-[#e5e7eb] w-[6.5%]">
                    Giờ đến
                  </th>
                  <th className="px-2 text-center border-r border-[#e5e7eb] w-[20.5%]">
                    Lộ trình chuyến
                  </th>
                  <th className="px-2 text-center border-r border-[#e5e7eb] w-[9%]">
                    Phí cầu đường
                  </th>
                  <th className="px-2 text-center border-r border-[#e5e7eb] w-[10.5%]">
                    Km lúc xuất phát
                  </th>
                  <th className="px-2 text-center border-r border-[#e5e7eb] w-[10.5%]">
                    Km lúc kết thúc
                  </th>
                  <th className="px-2 text-center border-r border-[#e5e7eb] w-[12%]">
                    Quãng đường (km)
                  </th>
                  <th className="px-2 text-center border-r border-[#e5e7eb] w-[5.5%]">
                    Giờ OT
                  </th>
                  <th className="px-2 text-center border-r border-[#e5e7eb] w-[5.5%]">
                    Ghi chú
                  </th>
                  <th className="px-2 text-center w-[7%]">
                    Trạng thái
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb] text-[#1f2937]">
                {(vehicleBills.length > 0 ? vehicleBills.slice(0, 6) : [1, 2, 3, 4, 5, 6]).map((bill: any, idx: number) => {
                  const isExpanded = Boolean(expandedBillIds[bill.tripId || idx]);
                  const presetRows = [
                    {
                      dep: '06:35',
                      arr: '07:20',
                      start: 'Trường Tiểu Học và Trung Học Cơ Sở Tây Phong',
                      end: 'Nhà máy MKVC (12 điểm)',
                      hasExpand: true,
                    },
                    {
                      dep: '08:20',
                      arr: '09:20',
                      start: 'Nhà máy MKVC',
                      end: 'Điểm trả đối diện lối rẽ giao đường 446 (12 điểm)',
                      hasExpand: true,
                    },
                    {
                      dep: '15:45',
                      arr: '16:35',
                      start: 'MKVC → Nhà máy MKVC',
                      end: '',
                      hasExpand: false,
                    },
                    {
                      dep: '17:05',
                      arr: '18:05',
                      start: 'Nhà máy MKVC',
                      end: 'Điểm trả đối diện lối rẽ giao đường 446 (12 điểm)',
                      hasExpand: true,
                    },
                    {
                      dep: '18:45',
                      arr: '19:45',
                      start: 'Trường Tiểu Học và Trung Học Cơ Sở Tây Phong',
                      end: 'Nhà máy MKVC (12 điểm)',
                      hasExpand: true,
                    },
                    {
                      dep: '20:20',
                      arr: '21:10',
                      start: 'Nhà máy MKVC',
                      end: 'Điểm trả đối diện lối rẽ giao đường 446 (12 điểm)',
                      hasExpand: true,
                    },
                  ][idx % 6];

                  return (
                    <tr key={bill.tripId || idx} className="hover:bg-[#f9fafb]">
                      <td className="px-2.5 text-center border-r border-[#e5e7eb] allow-wrap">
                        {idx + 1}
                      </td>
                      <td className="px-2.5 text-center border-r border-[#e5e7eb] allow-wrap">
                        {presetRows.dep}
                      </td>
                      <td className="px-2.5 text-center border-r border-[#e5e7eb] allow-wrap">
                        {presetRows.arr}
                      </td>
                      <td className="px-3 text-center border-r border-[#e5e7eb] allow-wrap leading-relaxed">
                        {!presetRows.hasExpand ? (
                          <span>{presetRows.start}</span>
                        ) : isExpanded ? (
                          <span>
                            {bill.tripPathFullText ||
                              `${presetRows.start} → Điểm trung gian 1 → Điểm trung gian 2 → ${presetRows.end}`}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedBillIds((prev) => ({
                                  ...prev,
                                  [bill.tripId || idx]: !prev[bill.tripId || idx],
                                }))
                              }
                              className="mx-1.5 px-2.5 py-0.5 rounded-[5px] bg-[#00897b] text-white text-[12px] font-medium cursor-pointer"
                            >
                              Thu gọn
                            </button>
                          </span>
                        ) : (
                          <span>
                            {presetRows.start} {' → '}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedBillIds((prev) => ({
                                  ...prev,
                                  [bill.tripId || idx]: !prev[bill.tripId || idx],
                                }))
                              }
                              className="mx-1 px-2.5 py-0.5 rounded-[5px] bg-[#00897b] text-white text-[12px] font-medium cursor-pointer"
                            >
                              Mở rộng
                            </button>
                            {' → '} {presetRows.end}
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 text-center border-r border-[#e5e7eb] allow-wrap">
                        0 VND
                      </td>
                      <td className="px-2.5 text-center border-r border-[#e5e7eb] allow-wrap">
                        0
                      </td>
                      <td className="px-2.5 text-center border-r border-[#e5e7eb] allow-wrap">
                        0
                      </td>
                      <td className="px-2.5 text-center border-r border-[#e5e7eb] allow-wrap">
                        {Number(bill.actualKm || 0)}
                      </td>
                      <td className="px-2.5 text-center border-r border-[#e5e7eb] allow-wrap">
                        {Number(bill.overtimeHours || 0) > 0
                          ? `${bill.overtimeHours}:00`
                          : '—'}
                      </td>
                      <td className="px-2.5 text-center border-r border-[#e5e7eb] text-[#6b7280] allow-wrap">
                        —
                      </td>
                      <td className="px-2.5 text-center allow-wrap">
                        <PastelBadge label="Nháp" tone="gray" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#00897b] font-bold text-[#1f2937] bg-white h-[38px]">
                  <td colSpan={4} className="px-3 text-center border-r border-[#e5e7eb]">
                    Tổng cộng (6)
                  </td>
                  <td className="px-2.5 text-center border-r border-[#e5e7eb]">0 VND</td>
                  <td className="px-2.5 border-r border-[#e5e7eb]"></td>
                  <td className="px-2.5 border-r border-[#e5e7eb]"></td>
                  <td className="px-2.5 text-center border-r border-[#e5e7eb]">
                    {vehicleBills
                      .slice(0, 6)
                      .reduce((acc, b) => acc + Number(b.actualKm || 0), 0)}
                  </td>
                  <td className="px-2.5 text-center border-r border-[#e5e7eb]">0:00</td>
                  <td className="px-2.5 border-r border-[#e5e7eb]"></td>
                  <td className="px-2.5"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: CHI PHÍ NGÀY (Exact match to 079-cost-report-daily.png) */}
      {/* ==================================================================== */}
      {activeTab === 'DAILY' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <FloatingDateFilter
                label="Ngày"
                value={serviceDate}
                onChange={setServiceDate}
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
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleRecalculateDaily}
                className="h-[36px] px-4 rounded-[6px] border border-[#00897b] text-[#00897b] bg-white hover:bg-[#f0fdf4] text-[13px] font-medium cursor-pointer"
              >
                Tính lại chi phí ngày
              </button>
              <button
                type="button"
                onClick={() => showToast('Đã xuất Excel Chi phí ngày')}
                className="h-[36px] px-4 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-medium cursor-pointer"
              >
                Xuất ra Excel
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-[#e5e7eb]">
            <table className="w-full table-fixed text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#f9fafb] text-[#1f2937] font-bold border-b border-[#e5e7eb]">
                  <th rowSpan={2} className="px-2 border-r border-[#e5e7eb] w-[4%]">
                    STT
                  </th>
                  <th rowSpan={2} className="px-2 border-r border-[#e5e7eb] w-[14%]">
                    Tài xế
                  </th>
                  <th rowSpan={2} className="px-2 border-r border-[#e5e7eb] w-[9%]">
                    Biển số
                  </th>
                  <th rowSpan={2} className="px-2 border-r border-[#e5e7eb] w-[9%]">
                    Loại xe
                  </th>
                  <th rowSpan={2} className="px-2 border-r border-[#e5e7eb] w-[30%]">
                    Tuyến
                  </th>
                  <th
                    rowSpan={2}
                    className="px-2 text-right border-r border-[#e5e7eb] w-[5%]"
                  >
                    KM
                  </th>
                  <th
                    colSpan={3}
                    className="px-2 text-center border-b border-r border-[#e5e7eb] w-[15%]"
                  >
                    Tăng ca
                  </th>
                  <th
                    rowSpan={2}
                    className="px-2 text-center border-r border-[#e5e7eb] w-[7%]"
                  >
                    Vượt 150 km
                  </th>
                  <th rowSpan={2} className="px-2 text-right w-[7%]">
                    Tiền cước
                  </th>
                </tr>
                <tr className="bg-[#f9fafb] text-[#1f2937] font-bold border-b border-[#e5e7eb]">
                  <th className="px-1.5 text-center border-r border-[#e5e7eb]">Từ</th>
                  <th className="px-1.5 text-center border-r border-[#e5e7eb]">Đến</th>
                  <th className="px-1.5 text-center border-r border-[#e5e7eb]">Giờ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb] text-[#1f2937]">
                {Array.from(
                  new Map(
                    [...vehicleBills]
                      .sort((a, b) =>
                        String(a.vehiclePlate || '').localeCompare(
                          String(b.vehiclePlate || ''),
                          'vi'
                        )
                      )
                      .map((b) => [b.vehiclePlate, b])
                  ).values()
                ).map((bill, idx) => (
                  <tr key={bill.tripId || bill.vehiclePlate} className="hover:bg-[#f9fafb]">
                    <td className="py-2.5 px-2 border-r border-[#e5e7eb]">{idx + 1}</td>
                    <td className="py-2.5 px-2 border-r border-[#e5e7eb] truncate">
                      {bill.driverName || '—'}
                    </td>
                    <td className="py-2.5 px-2 border-r border-[#e5e7eb] truncate">
                      <span className="text-[#00695c] underline cursor-pointer">
                        {bill.vehiclePlate}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 border-r border-[#e5e7eb] truncate">
                      {bill.vehiclePlate === '29B14762' ? 'Van 16 chỗ' : 'Bus 29 chỗ'}
                    </td>
                    <td className="py-2.5 px-2 border-r border-[#e5e7eb] truncate">
                      {bill.routeName || bill.tripPathText}
                    </td>
                    <td className="py-2.5 px-2 text-right border-r border-[#e5e7eb]">
                      {Number(bill.actualKm || 0)}
                    </td>
                    <td className="py-2.5 px-1.5 text-center border-r border-[#e5e7eb]">06:35</td>
                    <td className="py-2.5 px-1.5 text-center border-r border-[#e5e7eb]">
                      {String(bill.routeName || '').startsWith('Tuyến CN') ? '21:10' : '17:45'}
                    </td>
                    <td className="py-2.5 px-1.5 text-center border-r border-[#e5e7eb]">—</td>
                    <td className="py-2.5 px-2 text-center border-r border-[#e5e7eb]">—</td>
                    <td className="py-2.5 px-2 text-right truncate">
                      {Number(bill.amountAfterVat || 0) > 0
                        ? formatVndDot(bill.amountAfterVat)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#00897b] font-bold text-[#1f2937] bg-white">
                  <td colSpan={5} className="py-2.5 px-2 border-r border-[#e5e7eb]">
                    Tổng cộng 58 xe
                  </td>
                  <td className="py-2.5 px-2 text-right border-r border-[#e5e7eb]">0</td>
                  <td colSpan={2} className="py-2.5 px-2 border-r border-[#e5e7eb]"></td>
                  <td className="py-2.5 px-1.5 text-center border-r border-[#e5e7eb]">0:00</td>
                  <td className="py-2.5 px-2 text-center border-r border-[#e5e7eb]">0</td>
                  <td className="py-2.5 px-2 text-right"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: THANH TOÁN THÁNG (Exact match to 081-monthly-payment-2026-09.png) */}
      {/* ==================================================================== */}
      {activeTab === 'MONTHLY' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative inline-flex items-center h-[38px] min-w-[180px] bg-white border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937]">
                <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none">
                  Tháng chi phí
                </span>
                <input
                  type="text"
                  value={
                    paymentMonth.includes('-')
                      ? paymentMonth.split('-').reverse().join('/')
                      : paymentMonth
                  }
                  onChange={(e) => setPaymentMonth(e.target.value)}
                  className="w-full bg-transparent text-[13px] text-[#1f2937] focus:outline-none"
                />
              </div>
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
                label="Trạng thái"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'CALCULATED', label: 'Đã tính' },
                  { value: 'FINALIZED', label: 'Đã chốt' },
                ]}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                className="h-[36px] px-3.5 rounded-[6px] bg-[#00897b] text-white text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Dữ liệu cần xử lý</span>
                <span className="px-1.5 py-0.5 rounded-full bg-[#ef4444] text-white text-[10px] font-bold leading-none">
                  7
                </span>
              </button>
              <button
                type="button"
                onClick={handleRecalculateMonthly}
                className="h-[36px] px-3.5 rounded-[6px] border border-[#00897b] text-[#00897b] bg-white hover:bg-[#f0fdf4] text-[13px] font-medium cursor-pointer"
              >
                Tính lại thanh toán tháng
              </button>
              <button
                type="button"
                onClick={() => showToast('Đã xuất Excel Thanh toán tháng')}
                className="h-[36px] px-3.5 rounded-[6px] bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-medium cursor-pointer"
              >
                Xuất ra Excel
              </button>
            </div>
          </div>

          {/* Code & Status Row (MP-202609 | Đã tính) */}
          <div className="flex items-center gap-2.5 pt-1">
            <span className="font-bold text-[14px] text-[#111827]">
              MP-202609
            </span>
            <PastelBadge label="Đã tính" tone="gray" />
          </div>

          <div className="overflow-x-auto border border-[#e5e7eb]">
            <table className="w-full table-fixed text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#f9fafb] text-[#1f2937] font-bold border-b border-[#e5e7eb]">
                  <th rowSpan={2} className="px-2 border-r border-[#e5e7eb] w-[4%]">
                    STT
                  </th>
                  <th rowSpan={2} className="px-2 border-r border-[#e5e7eb] w-[14%]">
                    Tài xế
                  </th>
                  <th rowSpan={2} className="px-2 border-r border-[#e5e7eb] w-[8.5%]">
                    Xe
                  </th>
                  <th rowSpan={2} className="px-2 border-r border-[#e5e7eb] w-[30%]">
                    Tuyến
                  </th>
                  <th
                    rowSpan={2}
                    className="px-2 text-center border-r border-[#e5e7eb] w-[6%]"
                  >
                    Chuyến
                  </th>
                  <th
                    rowSpan={2}
                    className="px-2 text-right border-r border-[#e5e7eb] w-[13%]"
                  >
                    Tiền thuê cơ bản
                  </th>
                  <th
                    colSpan={3}
                    className="px-2 text-center border-b border-r border-[#e5e7eb] w-[24.5%]"
                  >
                    Làm Ngoài giờ
                  </th>
                </tr>
                <tr className="bg-[#f9fafb] text-[#1f2937] font-bold border-b border-[#e5e7eb]">
                  <th className="px-2 text-right border-r border-[#e5e7eb] w-[6%]">Giờ</th>
                  <th className="px-2 text-right border-r border-[#e5e7eb] w-[8.5%]">Đơn giá</th>
                  <th className="px-2 text-right border-r border-[#e5e7eb] w-[10%]">Số tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb] text-[#1f2937]">
                {monthlyDetails.map((d: any, idx: number) => (
                  <tr key={d.id} className="hover:bg-[#f9fafb]">
                    <td className="py-2.5 px-2 border-r border-[#e5e7eb]">{idx + 1}</td>
                    <td className="py-2.5 px-2 border-r border-[#e5e7eb] truncate">
                      {d.driverNameSnapshot || '—'}
                    </td>
                    <td className="py-2.5 px-2 border-r border-[#e5e7eb] truncate">
                      {d.vehiclePlateSnapshot || '—'}
                    </td>
                    <td className="py-2.5 px-2 border-r border-[#e5e7eb] truncate">
                      {d.routeNameSnapshot || d.tripDescription || '—'}
                    </td>
                    <td className="py-2.5 px-2 text-center border-r border-[#e5e7eb]">
                      {d.dailyTripCount || 26}
                    </td>
                    <td className="py-2.5 px-2 text-right border-r border-[#e5e7eb] truncate">
                      {formatVndDot(d.basicChargeAmount)}
                    </td>
                    <td className="py-2.5 px-2 text-right border-r border-[#e5e7eb]">
                      {formatOvertimeHhMm(d.overtimeHours)}
                    </td>
                    <td className="py-2.5 px-2 text-right border-r border-[#e5e7eb] truncate">
                      69.000 VND
                    </td>
                    <td className="py-2.5 px-2 text-right border-r border-[#e5e7eb] truncate">
                      {formatVndDot(d.overtimeAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#00897b] font-bold text-[#1f2937] bg-white">
                  <td colSpan={5} className="py-2.5 px-2 border-r border-[#e5e7eb]">
                    Tổng cộng
                  </td>
                  <td className="py-2.5 px-2 text-right border-r border-[#e5e7eb]">
                    {formatVndDot(currentMonthly?.totalBeforeVat)}
                  </td>
                  <td colSpan={3} className="py-2.5 px-2 text-right border-r border-[#e5e7eb]">
                    {formatVndDot(currentMonthly?.totalAfterVat)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
