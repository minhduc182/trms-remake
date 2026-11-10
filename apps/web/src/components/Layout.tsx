import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  ClipboardList,
  GitBranch,
  Route,
  Bus,
  CarFront,
  FileText,
  CalendarClock,
  Receipt,
  Users,
  History,
  Settings,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Globe,
  Bell,
} from 'lucide-react';
import { FEATURE_CODES } from '@trms/shared';
import {
  TEST_ROLE_PROFILES,
  TestRoleProfile,
  getActiveProfile,
  setActiveUsername,
  logoutUser,
  hasFeature,
  gqlRequest,
} from '../lib/graphql.js';

export interface NavItem {
  path: string;
  label: string;
  group: 'overview' | 'operations' | 'master' | 'reports';
  icon: React.ComponentType<{ className?: string }>;
  requiredFeatures?: string[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    path: '/dashboard',
    label: 'Tổng quan',
    group: 'overview',
    icon: TrendingUp,
    requiredFeatures: [FEATURE_CODES.DASHBOARD_SNAPSHOT, FEATURE_CODES.DASHBOARD_STATS],
  },
  {
    path: '/requests',
    label: 'Điều hành yêu cầu xe',
    group: 'overview',
    icon: ClipboardList,
    requiredFeatures: [
      FEATURE_CODES.REQUEST_LIST,
      FEATURE_CODES.REQUEST_CREATE,
      FEATURE_CODES.REQUEST_APPROVE_DEPARTMENT,
      FEATURE_CODES.REQUEST_APPROVE_GA,
    ],
  },
  {
    path: '/dispatch',
    label: 'Quản lý điều phối',
    group: 'operations',
    icon: GitBranch,
    requiredFeatures: [
      FEATURE_CODES.REQUEST_DISPATCH,
      FEATURE_CODES.COMMUTE_DISPATCH_LIST,
    ],
  },
  {
    path: '/trips',
    label: 'Theo dõi chuyến đi',
    group: 'operations',
    icon: Route,
    requiredFeatures: [FEATURE_CODES.TRIP_LIST, FEATURE_CODES.TRIP_GET],
  },
  {
    path: '/vehicle-ops',
    label: 'Điều hành xe',
    group: 'operations',
    icon: Bus,
    requiredFeatures: [
      FEATURE_CODES.VEHICLE_STATUS_LIST,
      FEATURE_CODES.VEHICLE_TIMELINE,
      FEATURE_CODES.VEHICLE_LIST,
    ],
  },
  {
    path: '/driver',
    label: 'Xác nhận tài xế',
    group: 'operations',
    icon: CarFront,
    requiredFeatures: [
      FEATURE_CODES.DRIVER_JOURNEY_READ,
      FEATURE_CODES.DRIVER_JOURNEY_CONFIRM,
      FEATURE_CODES.TRIP_CONFIRM,
    ],
  },
  {
    path: '/master-data',
    label: 'Quản lý dữ liệu gốc',
    group: 'master',
    icon: FileText,
    requiredFeatures: [
      FEATURE_CODES.POINT_LIST,
      FEATURE_CODES.DRIVER_LIST,
      FEATURE_CODES.VEHICLE_LIST,
      FEATURE_CODES.LEG_DEFINITION_LIST,
      FEATURE_CODES.ROUTE_LIST,
      FEATURE_CODES.EMP_TRANSPORT_LIST,
      FEATURE_CODES.COST_CONFIG_LIST,
    ],
  },
  {
    path: '/shifts',
    label: 'Dữ liệu ca làm',
    group: 'master',
    icon: CalendarClock,
    requiredFeatures: [FEATURE_CODES.SHIFT_LIST, FEATURE_CODES.SHIFT_REGISTRATIONS],
  },
  {
    path: '/cost-reports',
    label: 'Báo cáo chi phí',
    group: 'reports',
    icon: Receipt,
    requiredFeatures: [
      FEATURE_CODES.COST_REPORT_DAILY,
      FEATURE_CODES.COST_REPORT_VEHICLE_BILL,
      FEATURE_CODES.COST_REPORT_MONTHLY_PAYMENT,
    ],
  },
  {
    path: '/etp-reports',
    label: 'Báo cáo hồ sơ sử dụng xe',
    group: 'reports',
    icon: Users,
    requiredFeatures: [FEATURE_CODES.EMP_TRANSPORT_LIST],
  },
  {
    path: '/audit-logs',
    label: 'Nhật ký kiểm tra',
    group: 'reports',
    icon: History,
    requiredFeatures: [FEATURE_CODES.AUDIT_LIST],
  },
  {
    path: '/settings',
    label: 'Cấu hình chung',
    group: 'reports',
    icon: Settings,
    requiredFeatures: [FEATURE_CODES.COST_CONFIG_LIST, FEATURE_CODES.AUDIT_LIST],
  },
];

interface LayoutProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

export function Layout({ currentPath, onNavigate, children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [profile, setProfile] = useState<TestRoleProfile>(() => getActiveProfile());
  const [serverFeatures, setServerFeatures] = useState<string[] | null>(null);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [lang, setLang] = useState<'vi' | 'en' | 'ja'>('vi');
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  const effectiveFeatures = serverFeatures ?? profile.defaultFeatures;

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setRoleDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setCmdOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchMe() {
      try {
        const data = await gqlRequest<{
          me?: {
            username: string;
            fullName: string;
            isAdmin: boolean;
            featureCodes: string[];
          } | null;
        }>(`
          query GetMe {
            me {
              username
              fullName
              isAdmin
              featureCodes
            }
          }
        `);
        if (!cancelled && data.me?.featureCodes) {
          setServerFeatures(data.me.featureCodes);
        }
      } catch {
        if (!cancelled) {
          setServerFeatures(null);
        }
      }
    }
    fetchMe();
    return () => {
      cancelled = true;
    };
  }, [profile.username]);

  const handleSelectRole = (next: TestRoleProfile) => {
    setActiveUsername(next.username);
    setProfile(next);
    setServerFeatures(null);
    setRoleDropdownOpen(false);

    const nextAllowed = NAV_ITEMS.filter((item) =>
      hasFeature(next.defaultFeatures, next.isAdmin, item.requiredFeatures),
    );
    const currentAllowed = nextAllowed.some((item) => currentPath.startsWith(item.path));
    if (!currentAllowed && nextAllowed.length > 0) {
      onNavigate(nextAllowed[0].path);
    }
  };

  const visibleNavItems = NAV_ITEMS.filter((item) =>
    hasFeature(effectiveFeatures, profile.isAdmin, item.requiredFeatures),
  );

  const activeNav =
    NAV_ITEMS.find((item) => currentPath === item.path || currentPath.startsWith(`${item.path}/`)) ||
    visibleNavItems[0] ||
    NAV_ITEMS[0];

  const renderGroup = (groupKey: NavItem['group'], groupTitle: string) => {
    const items = visibleNavItems.filter((i) => i.group === groupKey && i.path !== '/settings');
    if (items.length === 0) return null;

    return (
      <div className="mb-1" key={groupKey}>
        {!collapsed && (
          <div className="flex items-center gap-2 px-2.5 pt-2.5 pb-1.5 text-[11px] text-[#6b7280]">
            <span className="shrink-0">{groupTitle}</span>
            <div className="flex-1 h-[1px] bg-[#e5e7eb]" />
          </div>
        )}
        <div className="space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentPath === item.path || currentPath.startsWith(`${item.path}/`);
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => onNavigate(item.path)}
                data-testid={`nav-${item.path.replace('/', '')}`}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] text-[13px] transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#eefbf6] text-[#00897b] font-semibold'
                    : 'text-[#1f2937] hover:bg-[#f3f4f6] font-normal'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-[#00897b]' : 'text-[#1f2937]'
                  }`}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen overflow-hidden flex bg-white text-[#1f2937] font-sans">
      {/* Sidebar */}
      <aside
        className={`${
          collapsed ? 'w-[60px]' : 'w-[235px]'
        } h-screen shrink-0 bg-white border-r border-[#e5e7eb] flex flex-col justify-between transition-all duration-200 select-none`}
      >
        <div>
          {/* App Brand / Module Switcher (Exact match to Legacy m-menu-bar header) */}
          <div className="h-[56px] px-3 border-b border-[#e5e7eb] flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-[34px] h-[34px] rounded-[8px] border border-[#e5e7eb] bg-white text-[#00897b] flex items-center justify-center shrink-0">
                <Bus className="w-[18px] h-[18px]" />
              </div>
              {!collapsed && (
                <div className="leading-tight truncate">
                  <div className="font-bold text-[13px] text-[#111827]">Vận chuyển</div>
                  <div className="text-[11px] text-[#6b7280]">Chuyển phân hệ</div>
                </div>
              )}
            </div>
            {!collapsed && <ChevronDown className="w-4 h-4 text-[#6b7280] shrink-0" />}
          </div>

          {/* Navigation Menu */}
          <nav className="p-2 overflow-y-auto max-h-[calc(100vh-108px)]">
            {renderGroup('overview', 'Vận chuyển')}
            {renderGroup('operations', 'Vận hành xe')}
            {renderGroup('master', 'Dữ liệu gốc')}
            {renderGroup('reports', 'Báo cáo')}
          </nav>
        </div>

        {/* Collapse Footer */}
        <div className="px-2 py-2.5 border-t border-[#e5e7eb]">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-[13px] text-[#4b5563] hover:text-[#111827] hover:bg-[#f3f4f6] rounded-[8px] transition-colors cursor-pointer"
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4 mx-auto text-[#00897b]" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4 text-[#00897b]" />
                <span>Thu gọn</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Topbar (Exact match to Legacy m-appbar) */}
        <header className="h-[56px] bg-white border-b border-[#e5e7eb] px-6 flex items-center justify-between sticky top-0 z-30">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-[15px]">
            <span className="text-[#6b7280]">Vận chuyển</span>
            <span className="text-[#9ca3af]">/</span>
            <span className="text-[#4b5563]">{activeNav?.label}</span>
          </div>

          {/* Right Controls: Search Ctrl+K + Globe + Bell + User Avatar (with Role Switcher inside) */}
          <div className="flex items-center gap-3.5">
            {/* Search Pill */}
            <button
              type="button"
              onClick={() => {
                setCmdQuery('');
                setCmdOpen(true);
              }}
              className="inline-flex items-center gap-2 h-[34px] px-3 rounded-full bg-[#f3f4f6] hover:bg-[#e5e7eb]/70 text-[13px] text-[#4b5563] cursor-pointer"
            >
              <Search className="w-4 h-4 text-[#00897b]" />
              <span>Tìm kiếm</span>
              <span className="inline-flex items-center gap-1 ml-1">
                <kbd className="px-1.5 py-0.5 text-[10px] font-sans bg-white border border-[#d1d5db] rounded-[4px] text-[#6b7280] shadow-2xs">
                  Ctrl
                </kbd>
                <kbd className="px-1.5 py-0.5 text-[10px] font-sans bg-white border border-[#d1d5db] rounded-[4px] text-[#6b7280] shadow-2xs">
                  K
                </kbd>
              </span>
            </button>

            {/* Language Globe */}
            <div className="relative" ref={langRef}>
              <button
                type="button"
                onClick={() => setLangOpen(!langOpen)}
                className="p-1.5 text-[#00897b] hover:bg-[#f3f4f6] rounded-full cursor-pointer"
                title="Ngôn ngữ"
              >
                <Globe className="w-[18px] h-[18px]" />
              </button>
              {langOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white rounded-[8px] shadow-xl border border-[#e5e7eb] py-1 z-50 text-[13px]">
                  {[
                    { code: 'vi', label: 'Tiếng Việt (VI)' },
                    { code: 'en', label: 'English (EN)' },
                    { code: 'ja', label: '日本語 (JA)' },
                  ].map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => {
                        setLang(item.code as 'vi' | 'en' | 'ja');
                        setLangOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left hover:bg-[#f9fafb] flex items-center justify-between cursor-pointer ${
                        lang === item.code ? 'text-[#00897b] font-semibold bg-[#eefbf6]' : 'text-[#374151]'
                      }`}
                    >
                      <span>{item.label}</span>
                      {lang === item.code && <span>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notification Bell with Badge */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifOpen(!notifOpen)}
                className="p-1.5 text-[#00897b] hover:bg-[#f3f4f6] rounded-full relative cursor-pointer"
                title="Thông báo"
              >
                <Bell className="w-[18px] h-[18px]" />
                <span className="absolute -top-0.5 -right-0.5 px-1 min-w-[16px] h-[16px] rounded-full bg-[#ef4444] text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  5
                </span>
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-[8px] shadow-xl border border-[#e5e7eb] py-2 z-50 text-[13px]">
                  <div className="px-3.5 pb-1.5 border-b border-[#f3f4f6] font-semibold text-[#111827] flex items-center justify-between">
                    <span>Thông báo hệ thống</span>
                    <span className="text-[11px] text-[#00897b]">5 mới</span>
                  </div>
                  <div className="divide-y divide-[#f3f4f6] max-h-72 overflow-y-auto">
                    {[
                      {
                        title: '16 yêu cầu xe đang chờ phê duyệt',
                        sub: 'Nhấn để mở Hàng chờ phê duyệt',
                        path: '/requests',
                      },
                      {
                        title: '153 đơn đang chờ điều phối xe',
                        sub: 'Nhấn để mở Hàng chờ điều phối',
                        path: '/dispatch',
                      },
                      {
                        title: '3 tuyến cố định thiếu ghế ngày vận hành',
                        sub: 'Tuyến C, Tuyến CN02, Tuyến CN04',
                        path: '/dispatch',
                      },
                      {
                        title: 'Chuyến đi chờ tài xế xác nhận',
                        sub: 'Nhấn để mở Theo dõi chuyến đi',
                        path: '/trips',
                      },
                      {
                        title: 'Bảng thanh toán tháng 09/2026 đã tính',
                        sub: 'Nhấn để xem Báo cáo chi phí',
                        path: '/cost-reports',
                      },
                    ].map((n, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setNotifOpen(false);
                          onNavigate(n.path);
                        }}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-[#f9fafb] cursor-pointer block"
                      >
                        <div className="font-medium text-[#1f2937]">{n.title}</div>
                        <div className="text-[11px] text-[#6b7280] mt-0.5">{n.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Avatar with Role Switcher Popover */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                data-testid="role-switcher-trigger"
                onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                className="w-8 h-8 rounded-full bg-[#78350f] text-white flex items-center justify-center relative overflow-hidden border border-[#d1d5db] cursor-pointer"
                title={`Đang đăng nhập: ${profile.label} (${profile.username}) - Nhấn để đổi Role kiểm thử`}
              >
                <span className="text-[10px] font-bold tracking-tighter mt-3 bg-black/40 w-full text-center">
                  {profile.roleCode}
                </span>
              </button>

              {roleDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-[8px] shadow-xl border border-[#e5e7eb] py-1.5 z-50">
                  <div className="px-3.5 py-2 border-b border-[#f3f4f6] flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#6b7280] uppercase">
                      Chuyển tài khoản Kiểm thử
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRoleDropdownOpen(false);
                        onNavigate('/settings');
                      }}
                      className="text-[11px] text-[#00897b] hover:underline font-medium cursor-pointer"
                    >
                      Cấu hình chung
                    </button>
                  </div>
                  {TEST_ROLE_PROFILES.map((item) => {
                    const isSelected = item.username === profile.username;
                    return (
                      <button
                        key={item.username}
                        type="button"
                        data-testid={`role-switch-${item.username}`}
                        onClick={() => handleSelectRole(item)}
                        className={`w-full px-3.5 py-2 text-left flex items-center justify-between hover:bg-[#f9fafb] transition-colors cursor-pointer ${
                          isSelected ? 'bg-[#eefbf6]' : ''
                        }`}
                      >
                        <div>
                          <div className="text-[12px] font-semibold text-[#111827] flex items-center gap-1.5">
                            <span>{item.label}</span>
                            <code className="text-[10px] text-[#6b7280] font-mono">
                              ({item.username})
                            </code>
                          </div>
                          <div className="text-[11px] text-[#6b7280]">
                            {item.isAdmin
                              ? 'Toàn quyền hệ thống (77 mã FR-*)'
                              : `${item.defaultFeatures.length} mã quyền FR-*`}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.badgeColor}`}
                        >
                          {item.roleCode}
                        </span>
                      </button>
                    );
                  })}
                  <div className="border-t border-[#f3f4f6] mt-1 pt-1 px-2">
                    <button
                      type="button"
                      data-testid="logout-button"
                      onClick={() => {
                        setRoleDropdownOpen(false);
                        logoutUser();
                      }}
                      className="w-full px-2.5 py-2 text-left text-[12px] font-semibold text-[#dc2626] hover:bg-[#fef2f2] rounded-[6px] transition-colors cursor-pointer"
                    >
                      Đăng xuất ({profile.username})
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 px-6 pt-4 pb-0 overflow-y-auto overflow-x-hidden bg-white">{children}</main>
      </div>

      {/* Quick Search / Command Palette Modal (Ctrl+K) */}
      {cmdOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-20 p-4"
          onClick={() => setCmdOpen(false)}
        >
          <div
            className="bg-white rounded-[10px] shadow-2xl border border-[#e5e7eb] w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#e5e7eb]">
              <Search className="w-4 h-4 text-[#00897b]" />
              <input
                type="text"
                autoFocus
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                placeholder="Tìm nhanh màn hình, chức năng (VD: điều phối, tuyến xe, chi phí, ca làm)..."
                className="flex-1 text-[13px] text-[#1f2937] focus:outline-none"
              />
              <kbd className="px-1.5 py-0.5 text-[10px] bg-gray-100 border border-gray-300 rounded text-gray-500">
                ESC
              </kbd>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-[#f3f4f6] py-1">
              {visibleNavItems
                .filter((item) =>
                  !cmdQuery.trim()
                    ? true
                    : item.label.toLowerCase().includes(cmdQuery.trim().toLowerCase()) ||
                      item.path.toLowerCase().includes(cmdQuery.trim().toLowerCase())
                )
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => {
                        setCmdOpen(false);
                        onNavigate(item.path);
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-[#eefbf6] flex items-center justify-between text-[13px] text-[#1f2937] cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-2.5 font-medium">
                        <Icon className="w-4 h-4 text-[#00897b]" />
                        <span>{item.label}</span>
                      </span>
                      <span className="text-[11px] text-[#6b7280] font-mono">{item.path}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
