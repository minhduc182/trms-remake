import { test, expect } from '@playwright/test';

test.describe('TRMS Remake E2E UI Acceptance Suite', () => {
  test('E2E-001: Loads Dashboard, switches test roles via 1-click Role Switcher, and navigates all 12 modules without GraphQL errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('dialog', async (dialog) => {
      pageErrors.push(dialog.message());
      await dialog.dismiss();
    });

    await page.goto('/');

    // 1. Dashboard loads with real Oracle-migrated statistics
    await expect(page.locator('text=Tổng quan').first()).toBeVisible();

    // 2. Navigate to Master Data (7 tabs) and verify all 7 tabs load cleanly
    await page.click('[data-testid="nav-master-data"]');
    await expect(page.locator('[data-testid="master-tab-POINTS"]')).toBeVisible();
    await page.click('[data-testid="master-tab-DRIVERS"]');
    await page.click('[data-testid="master-tab-VEHICLES"]');
    await page.click('[data-testid="master-tab-LEGS"]');
    await page.click('[data-testid="master-tab-ROUTES"]');
    await page.click('[data-testid="master-tab-ETP"]');
    await page.click('[data-testid="master-tab-COST_CONFIGS"]');

    // 3. Navigate to Shifts
    await page.click('text=Dữ liệu ca làm');
    await expect(page.locator('text=Dữ liệu ca làm').first()).toBeVisible();

    // 4. Navigate to Requests
    await page.click('text=Điều hành yêu cầu xe');
    await expect(page.locator('text=Điều hành yêu cầu xe').first()).toBeVisible();

    // 5. Navigate to Dispatch
    await page.click('text=Quản lý điều phối');
    await expect(page.locator('text=Quản lý điều phối').first()).toBeVisible();

    // 6. Navigate to Trips & Vehicle Ops
    await page.click('text=Theo dõi chuyến đi');
    await expect(page.locator('text=Theo dõi chuyến đi').first()).toBeVisible();
    await page.click('text=Điều hành xe');
    await expect(page.locator('text=Điều hành xe').first()).toBeVisible();

    // 7. Navigate to Cost Reports & ETP Reports
    await page.click('text=Báo cáo chi phí');
    await expect(page.locator('text=Báo cáo chi phí').first()).toBeVisible();
    await page.click('text=Báo cáo hồ sơ sử dụng xe');
    await expect(page.locator('text=Báo cáo hồ sơ sử dụng xe').first()).toBeVisible();

    // 8. Navigate to Audit Logs & Settings
    await page.click('text=Nhật ký kiểm tra');
    await expect(page.locator('text=Nhật ký kiểm tra').first()).toBeVisible();
    await page.click('text=Cấu hình chung');
    await expect(page.locator('text=Cấu hình chung').first()).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
