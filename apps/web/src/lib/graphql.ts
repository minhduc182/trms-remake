import { ALL_FEATURE_CODES } from '@trms/shared';

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export interface TestRoleProfile {
  username: string;
  roleCode: string;
  label: string;
  fullName: string;
  badgeColor: string;
  isAdmin: boolean;
  defaultFeatures: string[];
}

export const TEST_ROLE_PROFILES: TestRoleProfile[] = [
  {
    username: 'tominhduc',
    roleCode: 'ADMIN',
    label: 'Tô Minh Đức (Admin)',
    fullName: 'Tô Minh Đức',
    badgeColor: 'bg-[#00897b] text-white',
    isAdmin: true,
    defaultFeatures: ALL_FEATURE_CODES,
  },
  {
    username: 'test_admin',
    roleCode: 'ADMIN',
    label: 'Admin Kiểm Thử',
    fullName: 'Admin Kiểm Thử (Toàn quyền)',
    badgeColor: 'bg-purple-600 text-white',
    isAdmin: true,
    defaultFeatures: ALL_FEATURE_CODES,
  },
  {
    username: 'test_ga_leader',
    roleCode: 'GA_LEADER',
    label: 'Trưởng Phòng GA',
    fullName: 'Trưởng Phòng GA (Duyệt & Quản trị)',
    badgeColor: 'bg-emerald-600 text-white',
    isAdmin: false,
    defaultFeatures: ALL_FEATURE_CODES,
  },
  {
    username: 'test_ga_pic',
    roleCode: 'GA_PIC',
    label: 'Chuyên Viên GA',
    fullName: 'Chuyên Viên Điều Phối GA',
    badgeColor: 'bg-teal-600 text-white',
    isAdmin: false,
    defaultFeatures: ALL_FEATURE_CODES,
  },
  {
    username: 'test_tbp',
    roleCode: 'TBP',
    label: 'Trưởng Bộ Phận (TBP)',
    fullName: 'Trưởng Bộ Phận Duyệt Đơn',
    badgeColor: 'bg-amber-600 text-white',
    isAdmin: false,
    defaultFeatures: [
      'FR-REQUEST-001',
      'FR-REQUEST-002',
      'FR-REQUEST-003',
      'FR-REQUEST-012',
      'FR-REQUEST-015',
    ],
  },
  {
    username: 'test_requester',
    roleCode: 'REQUESTER',
    label: 'Nhân Viên Đặt Xe',
    fullName: 'Nhân Viên Đặt Xe (Requester)',
    badgeColor: 'bg-blue-600 text-white',
    isAdmin: false,
    defaultFeatures: [
      'FR-REQUEST-001',
      'FR-REQUEST-002',
      'FR-REQUEST-003',
      'FR-REQUEST-004',
      'FR-REQUEST-005',
      'FR-REQUEST-015',
    ],
  },
  {
    username: 'test_vendor',
    roleCode: 'VENDOR',
    label: 'Điều Phối Nhà Xe',
    fullName: 'Điều Phối Nhà Xe (Vendor)',
    badgeColor: 'bg-indigo-600 text-white',
    isAdmin: false,
    defaultFeatures: [
      'FR-REQUEST-001',
      'FR-REQUEST-002',
      'FR-REQUEST-009',
      'FR-REQUEST-010',
      'FR-TRIP-000',
      'FR-TRIP-001',
      'FR-TRIP-006',
    ],
  },
  {
    username: 'test_driver',
    roleCode: 'DRIVER',
    label: 'Tài Xế (Driver)',
    fullName: 'Tài Xế Kiểm Thử',
    badgeColor: 'bg-rose-600 text-white',
    isAdmin: false,
    defaultFeatures: [
      'FR-DRIVER-JOURNEY-000',
      'FR-DRIVER-JOURNEY-001',
      'FR-DRIVER-JOURNEY-002',
      'FR-DRIVER-JOURNEY-003',
      'FR-DRIVER-JOURNEY-004',
    ],
  },
];

const STORAGE_KEY = 'trms_active_test_user';
const AUTH_SESSION_KEY = 'trms_auth_logged_in';

export function isUserLoggedIn(): boolean {
  if (typeof window === 'undefined') return true;
  if (window.location.pathname === '/login') return false;
  if (localStorage.getItem(AUTH_SESSION_KEY) === 'true') return true;
  // Allow automated headless Playwright screenshot runner on localhost to render pages directly
  if (
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    typeof navigator !== 'undefined' &&
    navigator.webdriver === true
  ) {
    return true;
  }
  return false;
}

export function setLoggedInUser(username: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_SESSION_KEY, 'true');
  localStorage.setItem(STORAGE_KEY, username);
  window.dispatchEvent(new CustomEvent('trms-role-changed', { detail: { username } }));
}

export function logoutUser(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_SESSION_KEY);
  window.dispatchEvent(new CustomEvent('trms-auth-changed', { detail: { loggedIn: false } }));
}

export function getActiveUsername(): string {
  if (typeof window === 'undefined') return 'tominhduc';
  return localStorage.getItem(STORAGE_KEY) || 'tominhduc';
}

export function setActiveUsername(username: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, username);
  window.dispatchEvent(new CustomEvent('trms-role-changed', { detail: { username } }));
}

export function getActiveProfile(): TestRoleProfile {
  const username = getActiveUsername();
  return (
    TEST_ROLE_PROFILES.find((p) => p.username === username) || TEST_ROLE_PROFILES[0]
  );
}

export function hasFeature(
  userFeatures: string[] | Set<string>,
  isAdmin: boolean,
  requiredCode?: string | string[],
): boolean {
  if (isAdmin) return true;
  if (!requiredCode) return true;
  const set = userFeatures instanceof Set ? userFeatures : new Set(userFeatures);
  if (Array.isArray(requiredCode)) {
    return requiredCode.some((c) => set.has(c));
  }
  return set.has(requiredCode);
}

export async function gqlRequest<T = any>(
  query: string,
  variables?: Record<string, unknown>,
  overrideUsername?: string,
): Promise<T> {
  const username = overrideUsername || getActiveUsername();
  const profile = TEST_ROLE_PROFILES.find((p) => p.username === username);

  const res = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${username}`,
      'x-username': username,
      ...(profile ? { 'x-user-role': profile.roleCode } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    let errText = res.statusText;
    try {
      const errJson = (await res.json()) as GraphQLResponse<T>;
      if (errJson.errors?.length) {
        errText = errJson.errors.map((e) => e.message).join('; ');
      }
    } catch {
      // ignore
    }
    throw new Error(errText || `HTTP ${res.status}`);
  }

  const json = (await res.json()) as GraphQLResponse<T>;
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }
  if (!json.data) {
    throw new Error('Không nhận được dữ liệu từ máy chủ GraphQL');
  }
  return json.data;
}

export function formatCurrencyVnd(val: number | string | null | undefined): string {
  const num = Number(val ?? 0);
  if (!Number.isFinite(num)) return '0 VND';
  return `${num.toLocaleString('vi-VN')} VND`;
}

export const formatVnd = formatCurrencyVnd;

export function formatDateTimeVn(val: string | null | undefined): string {
  if (!val) return '-';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const formatDateTime = formatDateTimeVn;

export function formatDateVn(val: string | null | undefined): string {
  if (!val) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split('-');
    return `${d}/${m}/${y}`;
  }
  return val;
}
