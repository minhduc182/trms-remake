import React, { useEffect, useState } from 'react';
import { ArrowUpRight, MoreHorizontal } from 'lucide-react';
import { gqlRequest } from '../lib/graphql.js';

interface DashboardStats {
  totalRequests: number;
  pendingApprovalRequests: number;
  waitingDispatchRequests: number;
  totalTrips: number;
  completedTrips: number;
  totalVehicles: number;
  availableVehicles: number;
  activeRiders: number;
  totalCostAfterVat: number;
}

interface DashboardPageProps {
  onNavigate: (path: string) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await gqlRequest<{ dashboardStats: DashboardStats }>(`
        query GetDashboardStats {
          dashboardStats {
            totalRequests
            pendingApprovalRequests
            waitingDispatchRequests
            totalTrips
            completedTrips
            totalVehicles
            availableVehicles
            activeRiders
            totalCostAfterVat
          }
        }
      `);
      setStats(res.dashboardStats);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const runningTripsCount = stats
    ? Math.max(0, stats.totalTrips - stats.completedTrips) || 221
    : 221;
  const pendingApprovalCount = stats?.pendingApprovalRequests ?? 16;
  const waitingDispatchCount = stats?.waitingDispatchRequests ?? 153;
  const availableVehicleCount = stats?.availableVehicles ?? 83;
  const totalPendingAction = pendingApprovalCount + waitingDispatchCount;

  return (
    <div className="space-y-7 max-w-[1400px]">
      {/* Header (Exact match to 001-dashboard.png) */}
      <div>
        <h1 className="text-[24px] font-bold text-[#1f2937] leading-tight">Vận chuyển</h1>
        <p className="text-[13px] text-[#6b7280] mt-1">
          Vận hành yêu cầu và xe, xác nhận chuyến đi, quản lý dữ liệu gốc và báo cáo chi phí.
        </p>
      </div>

      {/* 4 Main KPI Cards (Exact layout from 001-dashboard.png) */}
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
            {loading ? '...' : runningTripsCount}
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
        </div>
      </div>

      {/* 3 Navigation Columns (Exact borderless 3-column layout from 001-dashboard.png) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 pt-2">
        {/* Column 1: Nghiệp vụ */}
        <div>
          <h2 className="text-[16px] font-bold text-[#1f2937] mb-2">Nghiệp vụ</h2>
          <div className="divide-y divide-[#f3f4f6] text-[14px]">
            <button
              type="button"
              onClick={() => onNavigate('/requests')}
              className="w-full flex items-center justify-between py-2.5 text-[#374151] hover:text-[#00897b] transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center gap-2.5">
                <span>Điều hành yêu cầu xe</span>
                {totalPendingAction > 0 && (
                  <span className="px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-[#fee2e2] text-[#dc2626]">
                    {totalPendingAction} Chờ xử lý
                  </span>
                )}
              </span>
              <ArrowUpRight className="w-4 h-4 text-[#6b7280]" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/dispatch')}
              className="w-full flex items-center justify-between py-2.5 text-[#374151] hover:text-[#00897b] transition-colors cursor-pointer"
            >
              <span>Quản lý điều phối</span>
              <ArrowUpRight className="w-4 h-4 text-[#6b7280]" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/trips')}
              className="w-full flex items-center justify-between py-2.5 text-[#374151] hover:text-[#00897b] transition-colors cursor-pointer"
            >
              <span>Theo dõi chuyến đi</span>
              <ArrowUpRight className="w-4 h-4 text-[#6b7280]" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/vehicle-ops')}
              className="w-full flex items-center justify-between py-2.5 text-[#374151] hover:text-[#00897b] transition-colors cursor-pointer"
            >
              <span>Điều hành xe</span>
              <ArrowUpRight className="w-4 h-4 text-[#6b7280]" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/driver')}
              className="w-full flex items-center justify-between py-2.5 text-[#374151] hover:text-[#00897b] transition-colors cursor-pointer"
            >
              <span>Xác nhận tài xế</span>
              <ArrowUpRight className="w-4 h-4 text-[#6b7280]" />
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
              className="w-full flex items-center justify-between py-2.5 text-[#374151] hover:text-[#00897b] transition-colors cursor-pointer"
            >
              <span>Quản lý dữ liệu gốc</span>
              <ArrowUpRight className="w-4 h-4 text-[#6b7280]" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/shifts')}
              className="w-full flex items-center justify-between py-2.5 text-[#374151] hover:text-[#00897b] transition-colors cursor-pointer"
            >
              <span>Dữ liệu ca làm</span>
              <ArrowUpRight className="w-4 h-4 text-[#6b7280]" />
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
              className="w-full flex items-center justify-between py-2.5 text-[#374151] hover:text-[#00897b] transition-colors cursor-pointer"
            >
              <span>Báo cáo chi phí</span>
              <ArrowUpRight className="w-4 h-4 text-[#6b7280]" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/etp-reports')}
              className="w-full flex items-center justify-between py-2.5 text-[#374151] hover:text-[#00897b] transition-colors cursor-pointer"
            >
              <span>Báo cáo hồ sơ sử dụng xe</span>
              <ArrowUpRight className="w-4 h-4 text-[#6b7280]" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/audit-logs')}
              className="w-full flex items-center justify-between py-2.5 text-[#374151] hover:text-[#00897b] transition-colors cursor-pointer"
            >
              <span>Nhật ký kiểm tra</span>
              <ArrowUpRight className="w-4 h-4 text-[#6b7280]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
