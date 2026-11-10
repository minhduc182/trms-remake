import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Calendar, MoreHorizontal, RefreshCw } from 'lucide-react';
import { gqlRequest } from '../lib/graphql.js';
import { StatusChip } from '../components/legacy-ui.js';

interface DashboardStats {
  totalRequests: number;
  pendingApprovalRequests: number;
  waitingDispatchRequests: number;
  totalTrips: number;
  activeTrips: number;
  completedTrips: number;
  totalVehicles: number;
  availableVehicles: number;
  activeRiders: number;
  totalCostAfterVat: number;
}

interface DashboardTrip {
  id: string;
  tripCode: string;
  businessDate: string;
  tripType: string;
  dispatchType: string;
  status: string;
  vehiclePlateSnapshot?: string | null;
  driverNameSnapshot?: string | null;
  plannedDepartureAt?: string | null;
  passengerCount: number;
}

interface DashboardPageProps {
  onNavigate: (path: string) => void;
}

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatTimeShort(iso?: string | null): string {
  if (!iso) return '—';
  const match = String(iso).match(/T(\d{2}:\d{2})/);
  if (match) return match[1];
  if (/^\d{2}:\d{2}/.test(String(iso))) return String(iso).slice(0, 5);
  return '—';
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [businessDate, setBusinessDate] = useState<string>('');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTrips, setRecentTrips] = useState<DashboardTrip[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async (selectedDate: string) => {
    setLoading(true);
    try {
      const dateArg = selectedDate.trim() ? selectedDate.trim() : undefined;
      const res = await gqlRequest<{
        dashboardStats: DashboardStats;
        trips: DashboardTrip[];
      }>(
        `
        query LoadDashboard($businessDate: String) {
          dashboardStats(businessDate: $businessDate) {
            totalRequests
            pendingApprovalRequests
            waitingDispatchRequests
            totalTrips
            activeTrips
            completedTrips
            totalVehicles
            availableVehicles
            activeRiders
            totalCostAfterVat
          }
          trips(businessDate: $businessDate, limit: 10) {
            id
            tripCode
            businessDate
            tripType
            dispatchType
            status
            vehiclePlateSnapshot
            driverNameSnapshot
            plannedDepartureAt
            passengerCount
          }
        }
      `,
        { businessDate: dateArg },
      );
      setStats(res.dashboardStats ?? null);
      setRecentTrips(res.trips ?? []);
    } catch {
      setStats(null);
      setRecentTrips([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard(businessDate);
  }, [businessDate, loadDashboard]);

  const activeTripsCount = stats?.activeTrips ?? 0;
  const pendingApprovalCount = stats?.pendingApprovalRequests ?? 0;
  const waitingDispatchCount = stats?.waitingDispatchRequests ?? 0;
  const availableVehicleCount = stats?.availableVehicles ?? 0;
  const totalPendingAction = pendingApprovalCount + waitingDispatchCount;

  return (
    <div className="space-y-7 max-w-[1400px]">
      {/* Header & Date Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold text-[#1f2937] leading-tight">Vận chuyển</h1>
          <p className="text-[13px] text-[#6b7280] mt-1">
            Vận hành yêu cầu và xe, xác nhận chuyến đi, quản lý dữ liệu gốc và báo cáo chi phí.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 bg-white border border-[#d1d5db] rounded-[8px] px-3 h-[36px]">
            <Calendar className="w-4 h-4 text-[#6b7280]" />
            <span className="text-[12px] font-medium text-[#6b7280]">Ngày nghiệp vụ:</span>
            <input
              type="date"
              value={businessDate}
              onChange={(e) => setBusinessDate(e.target.value)}
              className="text-[13px] text-[#1f2937] bg-transparent focus:outline-none"
              aria-label="Ngày nghiệp vụ"
            />
          </div>
          <button
            type="button"
            onClick={() => setBusinessDate(getTodayDateString())}
            className={`px-3 h-[36px] rounded-[8px] text-[12px] font-medium border transition-colors cursor-pointer ${
              businessDate === getTodayDateString()
                ? 'bg-[#e0f2f1] text-[#00796b] border-[#80cbc4]'
                : 'bg-white text-[#374151] border-[#d1d5db] hover:bg-[#f9fafb]'
            }`}
          >
            Hôm nay
          </button>
          {businessDate && (
            <button
              type="button"
              onClick={() => setBusinessDate('')}
              className="px-3 h-[36px] rounded-[8px] text-[12px] font-medium bg-white text-[#6b7280] border border-[#d1d5db] hover:bg-[#f9fafb] transition-colors cursor-pointer"
            >
              Tất cả ngày
            </button>
          )}
          <button
            type="button"
            onClick={() => void loadDashboard(businessDate)}
            className="inline-flex items-center gap-1.5 px-3 h-[36px] rounded-[8px] text-[12px] font-medium bg-white text-[#374151] border border-[#d1d5db] hover:bg-[#f9fafb] transition-colors cursor-pointer"
            title="Làm mới số liệu"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* 4 Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div
          onClick={() => onNavigate('/trips')}
          className="bg-white rounded-[12px] border border-[#e5e7eb] p-5 hover:border-[#d1d5db] transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[12px] font-semibold uppercase text-[#6b7280]">
            <span>CHUYẾN ĐANG CHẠY</span>
            <MoreHorizontal className="w-4 h-4 text-[#1f2937]" />
          </div>
          <div className="mt-4 text-[30px] font-bold text-[#1f2937] leading-none">
            {loading ? '...' : activeTripsCount}
          </div>
          <div className="mt-2 text-[12px] text-[#6b7280]">
            Tổng chuyến: {stats?.totalTrips ?? 0} · Hoàn thành: {stats?.completedTrips ?? 0}
          </div>
        </div>

        <div
          onClick={() => onNavigate('/requests')}
          className="bg-white rounded-[12px] border border-[#e5e7eb] p-5 hover:border-[#d1d5db] transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[12px] font-semibold uppercase text-[#6b7280]">
            <span>CHỜ PHÊ DUYỆT</span>
            <MoreHorizontal className="w-4 h-4 text-[#1f2937]" />
          </div>
          <div className="mt-4 text-[30px] font-bold text-[#1f2937] leading-none">
            {loading ? '...' : pendingApprovalCount}
          </div>
          <div className="mt-2 text-[12px] text-[#6b7280]">
            Tổng yêu cầu: {stats?.totalRequests ?? 0}
          </div>
        </div>

        <div
          onClick={() => onNavigate('/dispatch')}
          className="bg-white rounded-[12px] border border-[#e5e7eb] p-5 hover:border-[#d1d5db] transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[12px] font-semibold uppercase text-[#6b7280]">
            <span>CHỜ ĐIỀU PHỐI</span>
            <MoreHorizontal className="w-4 h-4 text-[#1f2937]" />
          </div>
          <div className="mt-4 text-[30px] font-bold text-[#1f2937] leading-none">
            {loading ? '...' : waitingDispatchCount}
          </div>
          <div className="mt-2 text-[12px] text-[#6b7280]">
            Đơn đã duyệt chờ phân xe
          </div>
        </div>

        <div
          onClick={() => onNavigate('/vehicle-ops')}
          className="bg-white rounded-[12px] border border-[#e5e7eb] p-5 hover:border-[#d1d5db] transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[12px] font-semibold uppercase text-[#6b7280]">
            <span>XE SẴN SÀNG</span>
            <MoreHorizontal className="w-4 h-4 text-[#1f2937]" />
          </div>
          <div className="mt-4 text-[30px] font-bold text-[#1f2937] leading-none">
            {loading ? '...' : availableVehicleCount}
          </div>
          <div className="mt-2 text-[12px] text-[#6b7280]">
            Tổng đội xe: {stats?.totalVehicles ?? 0} · ETP: {stats?.activeRiders ?? 0}
          </div>
        </div>
      </div>

      {/* 3 Navigation Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 pt-2">
        {/* Column 1: Nghiệp vụ */}
        <div>
          <h2 className="text-[16px] font-bold text-[#1f2937] mb-2">Nghiệp vụ</h2>
          <div className="divide-y divide-[#f3f4f6] text-[14px]">
            <button
              type="button"
              onClick={() => onNavigate('/requests')}
              className="w-full flex items-center justify-between py-2.5 text-left text-[#374151] hover:text-[#00897b] transition-colors cursor-pointer"
            >
              <div>
                <div className="inline-flex items-center gap-2.5 font-medium">
                  <span>Điều hành yêu cầu xe</span>
                  {totalPendingAction > 0 && (
                    <span className="px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-[#fee2e2] text-[#dc2626]">
                      {totalPendingAction} Chờ xử lý
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-[#6b7280] mt-0.5">
                  Tạo đơn công tác, hàng hóa, tăng ca OT và phê duyệt hai cấp
                </p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#6b7280] shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/dispatch')}
              className="w-full flex items-center justify-between py-2.5 text-left text-[#374151] hover:text-[#00897b] transition-colors cursor-pointer"
            >
              <div>
                <div className="font-medium">Quản lý điều phối</div>
                <p className="text-[12px] text-[#6b7280] mt-0.5">
                  Phân xe cho yêu cầu lẻ, điều phối xe tuyến cố định và kế hoạch ngoài tuyến
                </p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#6b7280] shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/trips')}
              className="w-full flex items-center justify-between py-2.5 text-left text-[#374151] hover:text-[#00897b] transition-colors cursor-pointer"
            >
              <div>
                <div className="font-medium">Theo dõi chuyến đi</div>
                <p className="text-[12px] text-[#6b7280] mt-0.5">
                  Giám sát lộ trình, cập nhật KM thực tế, phí cầu đường và tạo chuyến rỗng
                </p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#6b7280] shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/vehicle-ops')}
              className="w-full flex items-center justify-between py-2.5 text-left text-[#374151] hover:text-[#00897b] transition-colors cursor-pointer"
            >
              <div>
                <div className="font-medium">Điều hành xe</div>
                <p className="text-[12px] text-[#6b7280] mt-0.5">
                  Theo dõi trạng thái xe thời gian thực và hạn mức chuyến/KM trong tháng
                </p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#6b7280] shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/driver')}
              className="w-full flex items-center justify-between py-2.5 text-left text-[#374151] hover:text-[#00897b] transition-colors cursor-pointer"
            >
              <div>
                <div className="font-medium">Xác nhận tài xế</div>
                <p className="text-[12px] text-[#6b7280] mt-0.5">
                  Cổng tài xế xác nhận nhận chuyến, bắt đầu và hoàn thành hành trình
                </p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#6b7280] shrink-0" />
            </button>
          </div>
        </div>

        {/* Column 2: Dữ liệu gốc */}
        <div>
          <h2 className="text-[16px] font-bold text-[#1f2937] mb-2">Dữ liệu gốc</h2>
          <div className="divide-y divide-[#f3f4f6] text-[14px]">
            <button
              type="button"
              onClick={() => onNavigate('/master-data')}
              className="w-full flex items-center justify-between py-2.5 text-left text-[#374151] hover:text-[#00897b] transition-colors cursor-pointer"
            >
              <div>
                <div className="font-medium">Quản lý dữ liệu gốc</div>
                <p className="text-[12px] text-[#6b7280] mt-0.5">
                  Danh mục tuyến cố định, điểm đón trả, hồ sơ xe, tài xế, nhà xe và cấu hình giá
                </p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#6b7280] shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/shifts')}
              className="w-full flex items-center justify-between py-2.5 text-left text-[#374151] hover:text-[#00897b] transition-colors cursor-pointer"
            >
              <div>
                <div className="font-medium">Dữ liệu ca làm</div>
                <p className="text-[12px] text-[#6b7280] mt-0.5">
                  Quản lý danh mục ca làm việc hành chính, ca kíp và khung giờ tăng ca
                </p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#6b7280] shrink-0" />
            </button>
          </div>
        </div>

        {/* Column 3: Báo cáo */}
        <div>
          <h2 className="text-[16px] font-bold text-[#1f2937] mb-2">Báo cáo</h2>
          <div className="divide-y divide-[#f3f4f6] text-[14px]">
            <button
              type="button"
              onClick={() => onNavigate('/cost-reports')}
              className="w-full flex items-center justify-between py-2.5 text-left text-[#374151] hover:text-[#00897b] transition-colors cursor-pointer"
            >
              <div>
                <div className="font-medium">Báo cáo chi phí</div>
                <p className="text-[12px] text-[#6b7280] mt-0.5">
                  Tổng hợp chi phí vận chuyển theo tháng, tính lại chi phí và xuất đối soát
                </p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#6b7280] shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/etp-reports')}
              className="w-full flex items-center justify-between py-2.5 text-left text-[#374151] hover:text-[#00897b] transition-colors cursor-pointer"
            >
              <div>
                <div className="font-medium">Báo cáo hồ sơ sử dụng xe</div>
                <p className="text-[12px] text-[#6b7280] mt-0.5">
                  Quản lý hồ sơ đăng ký xe đưa đón nhân viên (ETP) và biến động theo tuyến
                </p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#6b7280] shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/audit-logs')}
              className="w-full flex items-center justify-between py-2.5 text-left text-[#374151] hover:text-[#00897b] transition-colors cursor-pointer"
            >
              <div>
                <div className="font-medium">Nhật ký kiểm tra</div>
                <p className="text-[12px] text-[#6b7280] mt-0.5">
                  Tra cứu lịch sử thao tác hệ thống, phê duyệt, điều phối và đồng bộ tự động
                </p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#6b7280] shrink-0" />
            </button>
          </div>
        </div>
      </div>

      {/* Recent / Filtered Trips Snapshot */}
      {recentTrips.length > 0 && (
        <div className="bg-white rounded-[12px] border border-[#e5e7eb] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#e5e7eb] flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-bold text-[#1f2937]">
                Chuyến xe {businessDate ? `ngày ${businessDate}` : 'gần đây'}
              </h3>
              <p className="text-[12px] text-[#6b7280]">
                Hiển thị tối đa 10 chuyến mới nhất từ hệ thống điều phối
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/trips')}
              className="text-[12px] font-semibold text-[#00897b] hover:underline cursor-pointer"
            >
              Xem tất cả chuyến đi →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#e5e7eb] bg-[#f9fafb] text-[11px] font-semibold uppercase text-[#6b7280]">
                  <th className="py-2.5 px-4">Mã chuyến</th>
                  <th className="py-2.5 px-4">Ngày</th>
                  <th className="py-2.5 px-4">Loại chuyến</th>
                  <th className="py-2.5 px-4">Biển số / Tài xế</th>
                  <th className="py-2.5 px-4">Giờ xuất phát</th>
                  <th className="py-2.5 px-4 text-right">Số khách</th>
                  <th className="py-2.5 px-4">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6] text-[13px]">
                {recentTrips.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => onNavigate('/trips')}
                    className="hover:bg-[#f9fafb] cursor-pointer"
                  >
                    <td className="py-2.5 px-4 font-medium text-[#111827]">{t.tripCode}</td>
                    <td className="py-2.5 px-4 text-[#4b5563]">{t.businessDate}</td>
                    <td className="py-2.5 px-4 text-[#4b5563]">{t.tripType}</td>
                    <td className="py-2.5 px-4 text-[#374151]">
                      {t.vehiclePlateSnapshot || '—'}{' '}
                      {t.driverNameSnapshot ? `· ${t.driverNameSnapshot}` : ''}
                    </td>
                    <td className="py-2.5 px-4 text-[#4b5563]">
                      {formatTimeShort(t.plannedDepartureAt)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-medium text-[#111827]">
                      {t.passengerCount ?? 0}
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusChip status={t.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
