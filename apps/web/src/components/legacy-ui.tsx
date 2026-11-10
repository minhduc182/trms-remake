import React, { useState, useRef, useEffect } from 'react';
import {
  RefreshCw,
  Search,
  Settings,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  Plus,
} from 'lucide-react';

// ============================================================================
// 1. UNDERLINE TABS (Exact match to m-tabs in Legacy TRMS)
// ============================================================================
export interface LegacyTabItem<T extends string = string> {
  id: T;
  label: string;
  testId?: string;
}

export function LegacyTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: LegacyTabItem<T>[];
  activeTab: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="border-b border-[#e5e7eb] mb-4 flex items-center gap-6 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            data-testid={tab.testId || `tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`pb-2.5 text-[13px] whitespace-nowrap transition-colors border-b-2 -mb-[1px] cursor-pointer ${
              isActive
                ? 'border-[#00897b] text-[#00897b] font-semibold'
                : 'border-transparent text-[#6b7280] hover:text-[#111827] font-normal'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// 2. FLOATING LABEL FILTERS (Exact match to m-select / m-date-picker / m-input)
// ============================================================================
export function FloatingSelect({
  label,
  value,
  onChange,
  options,
  allLabel = 'Tất cả',
  widthClass = 'min-w-[180px]',
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  allLabel?: string;
  widthClass?: string;
}) {
  return (
    <div
      className={`relative inline-flex items-center h-[38px] ${widthClass} bg-white border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus-within:border-[#00897b]`}
    >
      <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none select-none">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-[13px] text-[#1f2937] focus:outline-none appearance-none pr-6 cursor-pointer"
      >
        <option value="">{allLabel}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onChange('')}
        className="absolute right-2.5 text-[#374151] hover:text-[#111827] cursor-pointer"
        title="Xóa lọc"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function FloatingDateFilter({
  label,
  value,
  onChange,
  widthClass = 'min-w-[180px]',
  floatingAlways = false,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  widthClass?: string;
  floatingAlways?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const showFloating = floatingAlways || Boolean(value);

  const formattedDisplay = value
    ? value.includes('-') && value.split('-').length === 3
      ? `${value.split('-')[2]}/${value.split('-')[1]}/${value.split('-')[0]}`
      : value
    : '';

  return (
    <div
      onClick={() => inputRef.current?.showPicker?.()}
      className={`relative inline-flex items-center justify-between h-[38px] ${widthClass} bg-white border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus-within:border-[#00897b] cursor-pointer`}
    >
      {showFloating && (
        <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none select-none">
          {label}
        </span>
      )}
      <span className={value ? 'text-[#1f2937]' : 'text-[#6b7280]'}>
        {value ? formattedDisplay : label}
      </span>
      <div className="flex items-center gap-1">
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="text-[#6b7280] hover:text-[#111827] p-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        <Calendar className="w-4 h-4 text-[#374151]" />
      </div>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
      />
    </div>
  );
}

export function FloatingTextInput({
  label,
  value,
  onChange,
  widthClass = 'min-w-[200px]',
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  widthClass?: string;
}) {
  return (
    <div
      className={`relative inline-flex items-center h-[38px] ${widthClass} bg-white border border-[#d1d5db] rounded-[6px] px-3 text-[13px] text-[#1f2937] focus-within:border-[#00897b]`}
    >
      {value && (
        <span className="absolute -top-2 left-2.5 bg-white px-1 text-[11px] text-[#6b7280] leading-none select-none">
          {label}
        </span>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        className="w-full bg-transparent text-[13px] text-[#1f2937] placeholder:text-[#6b7280] focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-[#6b7280] hover:text-[#111827] ml-1"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// 3. SECTION TOOLBAR ROW (Title + Refresh on left, Search + Customize + Filter + Action on right)
// ============================================================================
export interface SplitActionItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

export function exportTableToCsv(title = 'trms-export', containerEl?: HTMLElement | null) {
  const root = containerEl || document.querySelector('main') || document.body;
  const table = root.querySelector('table');
  if (!table) return;
  const rows = Array.from(table.querySelectorAll('tr'));
  const csvLines = rows.map((tr) => {
    const cells = Array.from(tr.querySelectorAll('th, td'));
    return cells
      .map((cell) => {
        const text = (cell.textContent || '').replace(/\s+/g, ' ').trim();
        return `"${text.replace(/"/g, '""')}"`;
      })
      .join(',');
  });
  const csvContent = '\uFEFF' + csvLines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  link.href = url;
  link.setAttribute('download', `${slug || 'trms'}-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function SectionToolbar({
  title,
  loading,
  onRefresh,
  search,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder = 'Tìm kiếm trong trang hiện',
  showSearch = true,
  showCustomize = true,
  showFilter = false,
  showFilterButton = false,
  onFilterClick,
  filterContent,
  primaryButton,
  primaryAction,
  extraRight,
  extraActions,
}: {
  title: string;
  loading?: boolean;
  onRefresh?: () => void;
  search?: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  onSearchSubmit?: () => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
  showCustomize?: boolean;
  showFilter?: boolean;
  showFilterButton?: boolean;
  onFilterClick?: () => void;
  filterContent?: React.ReactNode;
  primaryButton?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    splitItems?: SplitActionItem[];
  };
  primaryAction?: {
    label: string;
    hasDropdown?: boolean;
    onClick: () => void;
  };
  extraRight?: React.ReactNode;
  extraActions?: React.ReactNode;
}) {
  const [splitOpen, setSplitOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [wrapMode, setWrapMode] = useState(() =>
    typeof document !== 'undefined' ? document.body.classList.contains('table-wrap-mode') : false
  );
  const splitRef = useRef<HTMLDivElement>(null);
  const customizeRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const effectiveSearch = search ?? searchValue ?? '';
  const effectiveShowFilter = showFilter || showFilterButton || Boolean(filterContent);
  const effectiveExtraRight = extraRight || extraActions;
  const effectivePrimaryButton =
    primaryButton ||
    (primaryAction
      ? {
          label: primaryAction.label,
          icon: <Plus className="w-4 h-4" />,
          onClick: primaryAction.onClick,
          splitItems: primaryAction.hasDropdown
            ? ([{ label: primaryAction.label, onClick: primaryAction.onClick }] as SplitActionItem[])
            : undefined,
        }
      : undefined);

  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      if (splitRef.current && !splitRef.current.contains(ev.target as Node)) {
        setSplitOpen(false);
      }
      if (customizeRef.current && !customizeRef.current.contains(ev.target as Node)) {
        setCustomizeOpen(false);
      }
      if (filterRef.current && !filterRef.current.contains(ev.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const toggleWrapMode = () => {
    const next = !wrapMode;
    setWrapMode(next);
    if (next) document.body.classList.add('table-wrap-mode');
    else document.body.classList.remove('table-wrap-mode');
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2.5">
      {/* Left: Section Heading + Circular Refresh Icon */}
      <div className="flex items-center gap-2">
        <h2 className="text-[16px] font-bold text-[#1f2937]">{title}</h2>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="p-1 text-[#4b5563] hover:text-[#111827] rounded-full hover:bg-gray-100 cursor-pointer"
            title="Làm mới"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Right: Search + Tùy chỉnh + Bộ lọc + Primary Teal Button */}
      <div className="flex flex-wrap items-center gap-2">
        {effectiveExtraRight}

        {showSearch && onSearchChange && (
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-[#6b7280] absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={effectiveSearch}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit?.()}
              placeholder={searchPlaceholder}
              className="h-[34px] w-[215px] pl-8 pr-3 rounded-[17px] border border-[#d1d5db] bg-white text-[13px] text-[#374151] placeholder:text-[#6b7280] focus:outline-none focus:border-[#00897b]"
            />
            {effectiveSearch && (
              <button
                type="button"
                onClick={() => {
                  onSearchChange('');
                  onSearchSubmit?.();
                }}
                className="absolute right-2.5 text-[#6b7280] hover:text-[#111827] cursor-pointer"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {showCustomize && (
          <div className="relative inline-flex" ref={customizeRef}>
            <button
              type="button"
              onClick={() => setCustomizeOpen(!customizeOpen)}
              className="inline-flex items-center gap-1.5 h-[34px] px-3 rounded-[6px] border border-[#d1d5db] bg-white hover:bg-[#f9fafb] text-[13px] text-[#374151] cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-[#4b5563]" />
              <span>Tùy chỉnh</span>
            </button>
            {customizeOpen && (
              <div className="absolute right-0 top-[38px] w-60 bg-white rounded-[8px] shadow-lg border border-[#e5e7eb] py-2 z-50 text-[13px] text-[#1f2937]">
                <div className="px-3.5 py-1 text-[11px] font-semibold uppercase text-[#6b7280]">
                  Tùy chỉnh hiển thị bảng
                </div>
                <button
                  type="button"
                  onClick={toggleWrapMode}
                  className="w-full px-3.5 py-2 text-left hover:bg-[#f3f4f6] flex items-center justify-between cursor-pointer"
                >
                  <span>Tự động xuống dòng ô dài</span>
                  <input type="checkbox" readOnly checked={wrapMode} className="accent-[#00897b]" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomizeOpen(false);
                    exportTableToCsv(title);
                  }}
                  className="w-full px-3.5 py-2 text-left hover:bg-[#f3f4f6] flex items-center justify-between cursor-pointer"
                >
                  <span>Xuất CSV / Excel bảng hiện tại</span>
                </button>
                {onRefresh && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomizeOpen(false);
                      onRefresh();
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-[#f3f4f6] flex items-center justify-between cursor-pointer"
                  >
                    <span>Tải lại dữ liệu mới nhất</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {effectiveShowFilter && (
          <div className="relative inline-flex" ref={filterRef}>
            <button
              type="button"
              onClick={() => {
                if (onFilterClick) onFilterClick();
                else setFilterOpen(!filterOpen);
              }}
              className="inline-flex items-center gap-1.5 h-[34px] px-3 rounded-[6px] border border-[#d1d5db] bg-white hover:bg-[#f9fafb] text-[13px] text-[#374151] cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5 text-[#4b5563]" />
              <span>Bộ lọc</span>
            </button>
            {filterOpen && filterContent && (
              <div className="absolute right-0 top-[38px] w-72 bg-white rounded-[8px] shadow-lg border border-[#e5e7eb] p-3.5 z-50 space-y-3 text-[13px]">
                {filterContent}
              </div>
            )}
          </div>
        )}

        {effectivePrimaryButton && (
          <div className="relative inline-flex" ref={splitRef}>
            <button
              type="button"
              onClick={effectivePrimaryButton.onClick}
              className={`inline-flex items-center gap-1.5 h-[34px] px-3.5 bg-[#00897b] hover:bg-[#00796b] text-white text-[13px] font-medium cursor-pointer ${
                effectivePrimaryButton.splitItems && effectivePrimaryButton.splitItems.length > 0
                  ? 'rounded-l-[6px]'
                  : 'rounded-[6px]'
              }`}
            >
              {effectivePrimaryButton.icon}
              <span>{effectivePrimaryButton.label}</span>
            </button>
            {effectivePrimaryButton.splitItems && effectivePrimaryButton.splitItems.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setSplitOpen(!splitOpen)}
                  className="inline-flex items-center justify-center h-[34px] w-[28px] bg-[#00897b] hover:bg-[#00796b] text-white border-l border-white/25 rounded-r-[6px] cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {splitOpen && (
                  <div className="absolute right-0 top-[38px] w-52 bg-white rounded-[8px] shadow-lg border border-[#e5e7eb] py-1 z-50">
                    {effectivePrimaryButton.splitItems.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSplitOpen(false);
                          item.onClick();
                        }}
                        className="w-full px-3.5 py-2 text-left text-[13px] text-[#1f2937] hover:bg-[#f3f4f6] flex items-center gap-2 cursor-pointer"
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 4. PASTEL BADGES (Exact match to m-chip in Legacy TRMS)
// ============================================================================
export type BadgeTone =
  | 'teal'
  | 'sky'
  | 'blue'
  | 'purple'
  | 'amber'
  | 'yellow'
  | 'orange'
  | 'green'
  | 'red'
  | 'gray';

const TONE_CLASSES: Record<BadgeTone, string> = {
  teal: 'bg-[#e0f2f1] text-[#00796b]',
  green: 'bg-[#e6f4ea] text-[#0d9488]',
  sky: 'bg-[#e0f2fe] text-[#0284c7]',
  blue: 'bg-[#e0f2fe] text-[#0284c7]',
  purple: 'bg-[#f3e8ff] text-[#9333ea]',
  amber: 'bg-[#fef3c7] text-[#d97706]',
  yellow: 'bg-[#fef3c7] text-[#d97706]',
  orange: 'bg-[#ffedd5] text-[#ea580c]',
  red: 'bg-[#fee2e2] text-[#dc2626]',
  gray: 'bg-[#f3f4f6] text-[#4b5563]',
};

export function PastelBadge({
  label,
  children,
  tone,
  variant,
}: {
  label?: React.ReactNode;
  children?: React.ReactNode;
  tone?: BadgeTone;
  variant?: BadgeTone;
}) {
  const effectiveTone = tone || variant || 'teal';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[12px] font-medium whitespace-nowrap ${TONE_CLASSES[effectiveTone]}`}
    >
      {label ?? children}
    </span>
  );
}

// Helpers to map backend enum codes to exact Legacy Vietnamese labels & tones
export function renderRequestTypeBadge(requestType: string) {
  if (requestType === 'BUSINESS' || requestType === 'BUSINESS_TRIP')
    return <PastelBadge label="Công tác" tone="sky" />;
  if (requestType === 'GOODS' || requestType === 'CARGO')
    return <PastelBadge label="Hàng hóa" tone="purple" />;
  if (requestType === 'OVERTIME' || requestType === 'OT')
    return <PastelBadge label="Làm thêm giờ OT" tone="amber" />;
  return <PastelBadge label={requestType} tone="gray" />;
}

export function renderRequestStatusBadge(status: string) {
  switch (status) {
    case 'PENDING_GA':
    case 'PENDING_GA_DEPARTMENT':
      return <PastelBadge label="Chờ GA phê duyệt" tone="sky" />;
    case 'PENDING_DEPARTMENT':
      return <PastelBadge label="Đang chờ phê duyệt" tone="amber" />;
    case 'WAITING_VENDOR_DISPATCH':
      return <PastelBadge label="Chờ điều phối" tone="sky" />;
    case 'WAITING_DRIVER_CONFIRM':
    case 'DISPATCHED':
      return <PastelBadge label="Chờ tài xế xác nhận" tone="purple" />;
    case 'DRIVER_CONFIRMED':
      return <PastelBadge label="Tài xế đã xác nhận" tone="purple" />;
    case 'IN_PROGRESS':
      return <PastelBadge label="Đang chạy" tone="sky" />;
    case 'WAITING_DISTANCE_INPUT':
      return <PastelBadge label="Chờ nhập KM" tone="amber" />;
    case 'COMPLETED':
      return <PastelBadge label="Hoàn thành" tone="green" />;
    case 'APPROVED_BY_TAXI':
      return <PastelBadge label="Duyệt đi Taxi" tone="teal" />;
    case 'RETURNED':
      return <PastelBadge label="Trả về sửa" tone="amber" />;
    case 'REJECTED':
      return <PastelBadge label="Đã từ chối" tone="red" />;
    case 'CANCELLED':
      return <PastelBadge label="Đã hủy" tone="gray" />;
    default:
      return <PastelBadge label={status} tone="gray" />;
  }
}

export function renderPassengerTypeBadge(passengerType?: string | null) {
  if (!passengerType) return <span className="text-gray-400">—</span>;
  if (passengerType === 'WORKER') return <PastelBadge label="Công nhân" tone="purple" />;
  if (passengerType === 'STAFF') return <PastelBadge label="Nhân viên" tone="green" />;
  return <PastelBadge label={passengerType} tone="gray" />;
}

export function renderTripTypeBadge(dispatchType?: string, isDeadhead?: boolean) {
  if (isDeadhead) return <PastelBadge label="Chuyến chạy rỗng" tone="gray" />;
  if (dispatchType === 'FIXED_ROUTE') return <PastelBadge label="Tuyến thường" tone="green" />;
  if (dispatchType === 'SUPPLEMENT') return <PastelBadge label="Tuyến bổ sung" tone="amber" />;
  if (dispatchType === 'DISPATCH' || dispatchType === 'AD_HOC' || dispatchType === 'MERGED')
    return <PastelBadge label="Điều chuyến" tone="sky" />;
  return <PastelBadge label={dispatchType || 'Tuyến thường'} tone="green" />;
}

export function renderVehicleTypeLabel(vehicleType?: string | null) {
  switch (vehicleType) {
    case 'BUS_29':
      return 'Bus 29 chỗ';
    case 'BUS_45':
      return 'Bus 45 chỗ';
    case 'VAN_16':
      return 'Van 16 chỗ';
    case 'SUV_7':
      return 'SUV 7 chỗ';
    case 'SEDAN_4':
      return 'Sedan 4 chỗ';
    default:
      return vehicleType || 'Bus 29 chỗ';
  }
}

// ============================================================================
// 5. LEGACY PAGINATION FOOTER (Exact match to bottom bar of Legacy tables)
// ============================================================================
export function usePagination<T>(items: T[], initialPageSize = 999) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const pagedItems = items.slice(startIdx, startIdx + pageSize);
  return {
    page: safePage,
    setPage,
    pageSize,
    setPageSize: (nextSize: number) => {
      setPageSize(nextSize);
      setPage(1);
    },
    totalPages,
    startIndex: startIdx,
    pagedItems,
    totalCount: items.length,
  };
}

export function LegacyPagination({
  totalCount,
  totalItems,
  shownCount,
  pageSize = 999,
  page,
  onPageChange,
  onPageSizeChange,
}: {
  totalCount?: number;
  totalItems?: number;
  shownCount?: number;
  pageSize?: number;
  page?: number;
  onPageChange?: (nextPage: number) => void;
  onPageSizeChange?: (nextSize: number) => void;
}) {
  const [internalPage, setInternalPage] = useState(1);
  const [internalSize, setInternalSize] = useState(pageSize);

  const effectiveSize = onPageSizeChange ? pageSize : internalSize;
  const effectiveTotal = totalCount ?? totalItems ?? 0;
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / effectiveSize));
  const currentPage = Math.min(onPageChange ? (page ?? 1) : internalPage, totalPages);

  const start = effectiveTotal > 0 ? (currentPage - 1) * effectiveSize + 1 : 0;
  const end =
    shownCount !== undefined
      ? shownCount
      : Math.min(effectiveTotal, currentPage * effectiveSize);

  const handleSizeChange = (nextSize: number) => {
    if (onPageSizeChange) onPageSizeChange(nextSize);
    else {
      setInternalSize(nextSize);
      setInternalPage(1);
    }
  };

  const handlePageChange = (nextPage: number) => {
    const clamped = Math.max(1, Math.min(totalPages, nextPage));
    if (onPageChange) onPageChange(clamped);
    else setInternalPage(clamped);
  };

  return (
    <div className="sticky bottom-0 bg-white z-20 flex flex-wrap items-center justify-between gap-2 py-2.5 border-t border-[#e5e7eb] text-[12px] text-[#4b5563]">
      <div>
        Hiển thị {start} - {end} của {effectiveTotal} bản ghi
      </div>
      <div className="flex items-center gap-2">
        <span>Số dòng:</span>
        <select
          value={effectiveSize}
          onChange={(e) => handleSizeChange(Number(e.target.value))}
          className="h-[28px] px-2 rounded border border-[#d1d5db] bg-white text-[12px] text-[#1f2937] cursor-pointer"
        >
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={999}>999</option>
        </select>
        <button
          type="button"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="w-[28px] h-[28px] inline-flex items-center justify-center rounded border border-[#d1d5db] text-[#374151] disabled:text-[#9ca3af] bg-white hover:bg-gray-50 disabled:hover:bg-white cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span>Trang</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={currentPage}
          onChange={(e) => handlePageChange(Number(e.target.value) || 1)}
          className="w-[40px] h-[28px] text-center rounded border border-[#d1d5db] bg-white text-[12px] text-[#1f2937]"
        />
        <span>/{totalPages}</span>
        <button
          type="button"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="w-[28px] h-[28px] inline-flex items-center justify-center rounded border border-[#d1d5db] text-[#374151] disabled:text-[#9ca3af] bg-white hover:bg-gray-50 disabled:hover:bg-white cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 6. FLOATING CONTEXT MENU ON ROW CLICK (Exact match to 046/051/053/060/062/067)
// ============================================================================
export interface ContextMenuAction {
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function RowContextMenu({
  title,
  position,
  x,
  y,
  actions,
  items,
  onClose,
}: {
  title?: string;
  position?: { x: number; y: number };
  x?: number;
  y?: number;
  actions?: ContextMenuAction[];
  items?: ContextMenuAction[];
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const posX = position?.x ?? x ?? 100;
  const posY = position?.y ?? y ?? 100;
  const effectiveActions = actions ?? items ?? [];

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{
        top: Math.min(posY, window.innerHeight - 220),
        left: Math.min(posX, window.innerWidth - 240),
      }}
      className="fixed z-50 w-52 bg-white rounded-[8px] shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[#e5e7eb] py-1.5 text-[13px]"
    >
      {title && (
        <div className="px-3.5 py-1.5 font-semibold text-[#111827] border-b border-[#f3f4f6]">
          {title}
        </div>
      )}
      <div className="py-1">
        {effectiveActions.map((act, idx) => (
          <button
            key={idx}
            type="button"
            disabled={act.disabled}
            onClick={() => {
              onClose();
              act.onClick();
            }}
            className={`w-full px-3.5 py-1.5 text-left flex items-center gap-2.5 transition-colors ${
              act.disabled
                ? 'text-gray-300 cursor-not-allowed'
                : act.danger
                  ? 'text-[#dc2626] hover:bg-[#fef2f2] cursor-pointer'
                  : 'text-[#1f2937] hover:bg-[#f3f4f6] cursor-pointer'
            }`}
          >
            {act.icon}
            <span>{act.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
