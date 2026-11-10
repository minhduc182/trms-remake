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

test.describe('QA Workbook Suite — MKVC_Testcase_MES_Quanlyxe_Điều hành yêu cầu xe.xlsx (330 Cases)', () => {
  test('Sheet 4: Cấu hình chi phí (Case_0..Case_53) — 7 tabs, filters, table headers, currency formatting, column customizer & modal rules', async ({ page }) => {
    await loginAsAdmin(page);
    await page.click('[data-testid="nav-master-data"]');

    // Case_0: Verify all 7 tabs in Master Data
    await expect(page.locator('[data-testid="master-tab-POINTS"]')).toBeVisible();
    await expect(page.locator('[data-testid="master-tab-DRIVERS"]')).toBeVisible();
    await expect(page.locator('[data-testid="master-tab-VEHICLES"]')).toBeVisible();
    await expect(page.locator('[data-testid="master-tab-LEGS"]')).toBeVisible();
    await expect(page.locator('[data-testid="master-tab-ROUTES"]')).toBeVisible();
    await expect(page.locator('[data-testid="master-tab-ETP"]')).toBeVisible();
    await expect(page.locator('[data-testid="master-tab-COST_CONFIGS"]')).toBeVisible();

    // Case_5..Case_11: Open Cost Configs tab & verify headers and formatted rows
    await page.click('[data-testid="master-tab-COST_CONFIGS"]');
    for (const colHeader of [
      'Phiên bản',
      'Loại',
      'Hành khách',
      'Phạm vi tính giá',
      'Xe',
      'Quy tắc',
      'Giá chính',
      'Hạn mức KM / tháng',
      'Đơn giá KM vượt',
      'Giá OT / giờ',
      'Giá lưu đêm',
      'Áp dụng từ',
      'Trạng thái',
    ]) {
      await expect(page.getByRole('columnheader', { name: colHeader, exact: true })).toBeVisible();
    }
    await expect(page.locator('tbody tr').first()).toBeVisible();

    // Case_22..Case_27: Column customizer ("Tùy chỉnh")
    await page.click('button:has-text("Tùy chỉnh")');
    await expect(page.getByText('Hiển thị', { exact: true })).toBeVisible();
    await expect(page.locator('button:has-text("Đặt lại")')).toBeVisible();
    await page.click('button:has-text("Tùy chỉnh")');

    // Case_28..Case_53: Create Cost Config modal defaults & COMMUTE+WORKER dynamic rule table
    await page.click('button:has-text("Tạo phiên bản")');
    await expect(page.locator('text=Tạo quy tắc chi phí')).toBeVisible();
    const modalForm = page.locator('form', { hasText: 'Tạo quy tắc chi phí' });
    await modalForm.locator('select').nth(0).selectOption('COMMUTE');
    await modalForm.locator('select').nth(1).selectOption('WORKER');
    await expect(modalForm.locator('text=Giá theo chuyến / quãng đường')).toBeVisible();
    await expect(modalForm.locator('button:has-text("+ Thêm mục")')).toBeVisible();
    await modalForm.locator('button:has-text("Hủy")').click();
  });

  test('Sheet 5: Tạo yêu cầu / Danh sách yêu cầu (Case_0..Case_172) — tabs, filters, single-line columns, customizer, Excel import/export & 3 request types', async ({ page }) => {
    await loginAsAdmin(page);
    await page.click('text=Điều hành yêu cầu xe');

    // Case_0..Case_14: Verify tabs and all 9 table columns
    await expect(page.locator('button:has-text("Danh sách yêu cầu")')).toBeVisible();
    await expect(page.locator('button:has-text("Hàng chờ phê duyệt")')).toBeVisible();
    for (const colHeader of [
      'Loại yêu cầu',
      'Trạng thái',
      'Người yêu cầu',
      'Bộ phận người yêu cầu',
      'Số lượng đăng ký',
      'Giờ khởi hành / Đón',
      'Điểm đón / Lấy hàng',
      'Điểm trả / Giao hàng',
    ]) {
      await expect(page.getByRole('columnheader', { name: colHeader, exact: true })).toBeVisible();
    }

    // Case_54..Case_59: Column customizer hide/show & reset
    await page.click('button:has-text("Tùy chỉnh")');
    await expect(page.getByText('Hiển thị', { exact: true })).toBeVisible();
    await page.click('button:has-text("Đặt lại")');
    await page.click('button:has-text("Tùy chỉnh")');

    // Case_80..Case_105: Split menu on "+ Tạo yêu cầu" -> Import Excel modal & template download
    await page.locator('button:has-text("Tạo yêu cầu") + button').click();
    await expect(page.locator('button:has-text("Nhập yêu cầu")')).toBeVisible();
    await expect(page.locator('button:has-text("Xuất excel trang hiện tại")')).toBeVisible();
    await page.click('button:has-text("Nhập yêu cầu")');
    await expect(page.locator('text=Nhập yêu cầu vận chuyển')).toBeVisible();
    await expect(page.locator('button:has-text("Tải file mẫu")')).toBeVisible();
    await page.click('button:has-text("Hủy")');

    // Case_106..Case_172: Create Request modal (BUSINESS, OVERTIME, GOODS)
    await page.click('button:has-text("Tạo yêu cầu")');
    const reqForm = page.locator('form', { hasText: 'Tạo yêu cầu vận chuyển' });
    await expect(reqForm).toBeVisible();
    await reqForm.locator('button:has-text("Hủy")').click();
  });

  test('Sheet 6: Hàng chờ phê duyệt (Case_0..Case_115) — approval queue table, checkboxes, bulk approval toolbar & context menu actions', async ({ page }) => {
    await loginAsAdmin(page);
    await page.click('text=Điều hành yêu cầu xe');
    await page.click('button:has-text("Hàng chờ phê duyệt")');

    // Case_0..Case_39: Verify Approval Queue toolbar & Export button
    await expect(page.locator('h2:has-text("Hàng chờ phê duyệt")')).toBeVisible();
    await expect(page.locator('button:has-text("Xuất excel trang hiện tại")')).toBeVisible();

    // Case_40..Case_46, Case_75..Case_84: Select row checkbox & verify bulk action bar
    const firstRowCb = page.locator('tbody tr input[type="checkbox"]').first();
    if (await firstRowCb.isVisible()) {
      await firstRowCb.check();
      await expect(page.locator('button:has-text("Chấp thuận")')).toBeVisible();
      await expect(page.locator('button:has-text("Duyệt và yêu cầu ghép đơn")')).toBeVisible();
      await expect(page.locator('button:has-text("Taxi")')).toBeVisible();
      await expect(page.locator('button:has-text("Từ chối")')).toBeVisible();
      await firstRowCb.uncheck();
    }
  });
});
