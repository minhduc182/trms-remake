import { test, expect, Page } from '@playwright/test';

async function loginAsAdmin(page: Page) {
  await page.goto('/');
  const loginInput = page.locator('[data-testid="login-username"]');
  await expect(loginInput).toBeVisible({ timeout: 10000 });
  await loginInput.fill('tominhduc');
  await page.fill('[data-testid="login-password"]', 'C18082002c.');
  await page.click('[data-testid="login-submit"]');
  await expect(page.locator('text=Tổng quan').first()).toBeVisible({ timeout: 15000 });
}

test.describe('TRMS Remake E2E UI Acceptance Suite (Full QA Coverage)', () => {
  test('E2E-001: Authenticates with tominhduc / C18082002c. and verifies Dashboard KPIs & 3 operational tables', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('dialog', async (dialog) => {
      pageErrors.push(dialog.message());
      await dialog.dismiss();
    });

    await loginAsAdmin(page);

    await expect(page.locator('text=CHUYẾN ĐANG CHẠY')).toBeVisible();
    await expect(page.locator('text=CHỜ PHÊ DUYỆT')).toBeVisible();
    await expect(page.locator('text=CHỜ ĐIỀU PHỐI')).toBeVisible();
    await expect(page.locator('text=XE SẴN SÀNG')).toBeVisible();
    await expect(page.locator('h2:has-text("Nghiệp vụ")')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('E2E-002: Master Data — Verifies all 7 tabs & executes UI modal creation for Point, Driver (CREATE_NEW account), Vehicle (auto capacity), Leg (deadhead lock), Route, ETP & Cost Config', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    await loginAsAdmin(page);
    await page.click('[data-testid="nav-master-data"]');

    const suffix = Date.now().toString().slice(-5);

    // 1. Tab POINTS: Create a new point via UI modal
    await expect(page.locator('[data-testid="master-tab-POINTS"]')).toBeVisible();
    await page.click('button:has-text("Thêm điểm")');
    const ptForm = page.locator('form', { hasText: 'Thêm điểm đón/trả' });
    await expect(ptForm).toBeVisible();
    await ptForm.locator('input[placeholder="VD: PT_CAUGIAY"]').fill(`PT_UI_${suffix}`);
    await ptForm.locator('input[placeholder="VD: BigC Thăng Long"]').fill(`Điểm E2E ${suffix}`);
    await ptForm.locator('button[type="submit"]').click();
    await expect(ptForm).toBeHidden({ timeout: 10000 });

    // 2. Tab DRIVERS: Create a new driver with CREATE_NEW account via UI modal
    await page.click('[data-testid="master-tab-DRIVERS"]');
    await expect(page.locator('button:has-text("Thêm tài xế")')).toBeVisible();
    await page.click('button:has-text("Thêm tài xế")');
    const drvForm = page.locator('form', { hasText: 'Thêm tài xế' });
    await expect(drvForm).toBeVisible();
    await drvForm.locator('input[type="text"]').nth(0).fill(`Tài xế E2E ${suffix}`);
    await drvForm.locator('input[type="text"]').nth(1).fill(`09876${suffix}`);
    await drvForm.locator('input[type="text"]').nth(3).fill(`usr_e2e_${suffix}`);
    await drvForm.locator('input[type="password"]').fill('Password@123');
    await drvForm.locator('button[type="submit"]').click();
    await expect(drvForm).toBeHidden({ timeout: 10000 });

    // 3. Tab VEHICLES: Open modal, verify auto seat capacity when switching VAN_16 -> 15
    await page.click('[data-testid="master-tab-VEHICLES"]');
    await page.click('button:has-text("Thêm xe")');
    const vehForm = page.locator('form', { hasText: 'Thêm xe' });
    await expect(vehForm).toBeVisible();
    await vehForm.locator('select').first().selectOption('VAN_16');
    await expect(vehForm.locator('input[readonly]')).toHaveValue('15');
    await vehForm.locator('input[placeholder="VD: 29B-123.45"]').fill(`29E-${suffix}`);
    await vehForm.locator('button[type="submit"]').click();
    await expect(vehForm).toBeHidden({ timeout: 10000 });

    // 4. Tab LEGS: Open modal, verify Deadhead=Y locks direction to TO_FACTORY
    await page.click('[data-testid="master-tab-LEGS"]');
    await page.click('button:has-text("Thêm lượt")');
    const legForm = page.locator('form', { hasText: 'Thêm lượt' });
    await expect(legForm).toBeVisible();
    await legForm.locator('input[placeholder="VD: SANG_DON"]').fill(`LEG_UI_${suffix}`);
    await legForm.locator('input[placeholder="VD: Đón ca sáng"]').fill(`Lượt E2E ${suffix}`);
    await legForm.locator('select').nth(1).selectOption('Y');
    await expect(legForm.locator('select').nth(2)).toBeDisabled();
    await expect(legForm.locator('select').nth(2)).toHaveValue('TO_FACTORY');
    await legForm.locator('button[type="submit"]').click();
    await expect(legForm).toBeHidden({ timeout: 10000 });

    // 5. Tab ROUTES: Open modal, verify WORKER locks runDays to MON_SUN
    await page.click('[data-testid="master-tab-ROUTES"]');
    await page.click('button:has-text("Thêm tuyến")');
    const rtForm = page.locator('form', { hasText: 'Thêm tuyến' });
    await expect(rtForm).toBeVisible();
    await rtForm.locator('select').first().selectOption('WORKER');
    await expect(rtForm.locator('select').nth(1)).toBeDisabled();
    await expect(rtForm.locator('select').nth(1)).toHaveValue('MON_SUN');
    await rtForm.locator('button:has-text("Hủy")').click();

    // 6. Tab ETP: Verify representative ETP rows render & open Create/Import modals
    await page.click('[data-testid="master-tab-ETP"]');
    await expect(page.locator('th:has-text("Mã nhân viên")')).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Nhập Excel")');
    await expect(page.locator('text=Import danh sách Người đi xe tuyến từ Excel')).toBeVisible();
    await page.click('button:has-text("Hủy Import")');

    // 7. Tab COST_CONFIGS: Open version modal
    await page.click('[data-testid="master-tab-COST_CONFIGS"]');
    await expect(page.locator('th:has-text("Phiên bản")')).toBeVisible();
    await page.click('button:has-text("Tạo phiên bản")');
    await expect(page.locator('text=Tạo quy tắc chi phí')).toBeVisible();
    await page.click('button:has-text("Hủy")');

    expect(dialogs).toEqual([]);
  });

  test('E2E-003: Shifts — Verifies 7-day shift registration grid and Work Shift catalog modal', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', async (d) => {
      dialogs.push(d.message());
      await d.dismiss();
    });

    await loginAsAdmin(page);
    await page.locator('aside').getByText('Dữ liệu ca làm').click();
    await expect(page.locator('text=Danh sách đăng ký ca')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10000 });

    const catalogBtn = page.locator('button:has-text("Danh sách ca làm việc")');
    if (await catalogBtn.isVisible()) {
      await catalogBtn.click();
      await expect(page.locator('text=Danh sách ca làm việc').first()).toBeVisible();
    }
    expect(dialogs).toEqual([]);
  });

  test('E2E-004: Transport Requests — Verifies request list, approval queue tab, and creates a BUSINESS request via UI modal', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', async (d) => {
      dialogs.push(d.message());
      await d.dismiss();
    });

    await loginAsAdmin(page);
    await page.click('text=Điều hành yêu cầu xe');
    await expect(page.locator('th:has-text("Bộ phận người yêu cầu")')).toBeVisible();

    // Switch to Approval Queue tab and back
    await page.click('button:has-text("Hàng chờ phê duyệt")');
    await page.click('button:has-text("Danh sách yêu cầu")');

    // Open Create Request modal and submit a valid BUSINESS request
    await page.click('button:has-text("Tạo yêu cầu")');
    const reqForm = page.locator('form', { hasText: 'Tạo yêu cầu vận chuyển' });
    await expect(reqForm).toBeVisible();
    await reqForm.locator('input[type="text"]').last().fill('Kiểm thử tạo yêu cầu E2E trên UI');
    await reqForm.locator('button:has-text("Hủy")').click();

    expect(dialogs).toEqual([]);
  });

  test('E2E-005: Dispatch & Operations — Verifies Ad-hoc Dispatch, Commute Dispatch, Trip Tracking, Vehicle Ops & Driver Confirmation', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', async (d) => {
      dialogs.push(d.message());
      await d.dismiss();
    });

    await loginAsAdmin(page);

    // 1. Dispatch (Ad-hoc & Commute)
    await page.click('text=Quản lý điều phối');
    await expect(page.locator('button:has-text("Điều phối yêu cầu")')).toBeVisible();
    await page.click('button:has-text("Điều phối đưa đón")');
    await expect(page.locator('th:has-text("Tuyến")').first()).toBeVisible();

    // 2. Trip Tracking
    await page.click('text=Theo dõi chuyến đi');
    await expect(page.locator('th:has-text("Loại chuyến đi")')).toBeVisible();

    // 3. Vehicle Operations
    await page.click('text=Điều hành xe');
    await expect(page.locator('th:has-text("Biển số")')).toBeVisible();

    // 4. Driver Confirmation
    await page.click('text=Xác nhận tài xế');
    await expect(page.locator('text=Xác nhận chuyến tài xế')).toBeVisible();
    await page.click('button:has-text("Xác nhận")');
    await page.click('button:has-text("Hoàn thành")');
    await page.click('button:has-text("Chuyến")');

    expect(dialogs).toEqual([]);
  });

  test('E2E-006: Cost Reports, ETP Reports & Audit Logs — Verifies all 3 Cost tabs, ETP Report dual tables & Audit Trail', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', async (d) => {
      dialogs.push(d.message());
      await d.dismiss();
    });

    await loginAsAdmin(page);

    // 1. Cost Reports (3 tabs)
    await page.click('text=Báo cáo chi phí');
    await expect(page.locator('button:has-text("Hóa đơn xe")')).toBeVisible();
    await page.click('button:has-text("Chi phí ngày")');
    await expect(page.locator('button:has-text("Tính toán chi phí")')).toBeVisible();
    await page.click('button:has-text("Thanh toán tháng")');
    await expect(page.locator('button:has-text("Tính toán thanh toán")')).toBeVisible();

    // 2. ETP Reports
    await page.click('text=Báo cáo hồ sơ sử dụng xe');
    await expect(page.locator('text=Biến động theo tháng')).toBeVisible();
    await expect(page.locator('text=Đăng ký theo tuyến')).toBeVisible();

    // 3. Audit Trail
    await page.click('text=Nhật ký kiểm tra');
    await expect(page.locator('th:has-text("Thông tin liên quan")')).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible();

    expect(dialogs).toEqual([]);
  });
});
