# Known Legacy Quirks & Reconciliation Notes (`TRMS Remake`)

> Tài liệu này ghi lại các đặc thù (quirks) từ hệ thống Go + Oracle cũ được giữ tương thích 100% theo quy tắc **VĐ12** trong `docs/plans/2026-11-10-trms-remake-plan.md`, cùng kết quả đối soát dữ liệu thực tế.

---

## 1. Kết quả Đối soát Dữ liệu & Chi phí (§5.4)

- **Nguồn dữ liệu:** Oracle `192.84.100.96:1522/SYSTEMPDB1` (`GA_CORE`, `TRMS_CORE`, `TRMS_DATA`).
- **Đích dữ liệu:** PostgreSQL 16 (`localhost:5433/trms_remake`).
- **Tập lệnh đối soát:** `pnpm data:reconcile` (`migration/reconcile/reconcile-costs.ts`).
- **Kết quả đối soát bản ghi & tổng tiền:**
  - `TRMS_COST_RECORDS`: **766 / 766** dòng khớp 100%.
  - Tổng tiền trước thuế (`SUM(appliedAmount)`): **`9,872,911,678.18 VND`** (Lệch: **`0.00 VND`**).
  - Tổng tiền sau thuế (`SUM(amountAfterVat)`): **`10,662,744,611.92 VND`** (Lệch: **`0.00 VND`**).
  - `TRMS_MONTHLY_PAYMENTS`: **2 / 2** kỳ thanh toán tháng khớp 100%.
  - `TRMS_MONTHLY_COST_DETAILS`: **78 / 78** dòng chi tiết thanh toán tháng khớp 100%.

---

## 2. Các đặc thù nghiệp vụ từ hệ thống cũ được bảo toàn (VĐ12)

1. **Bộ lọc Loại điểm đón/trả (`pointType`):**
   - Lọc `PICKUP` chỉ trả về đúng các điểm có `pointType = 'PICKUP'`, **không** tự động gộp các điểm `BOTH`. Tuy nhiên, trên dropdown chọn điểm đón/trả khi cấu hình tuyến hoặc tạo đơn, hệ thống lấy cả `PICKUP + BOTH` (cho điểm đón) và `DROPOFF + BOTH` (cho điểm trả), đồng thời ưu tiên xếp các điểm `BOTH` (`GICO`, `MKHC`, `MKVC`) lên đầu danh sách.

2. **Tự động khóa Hướng chạy khi bật `isEmptyRun` (Chiều chạy rỗng):**
   - Trong danh mục Khung chạy (`LegDefinition`), khi `isEmptyRun = true`, hệ thống tự động ép `direction = 'TO_FACTORY'` và không cho phép chọn `'OTHER'`.

3. **Áp khung giá hợp đồng `COMMUTE STAFF` cho chuyến phát sinh ngày thường (`applyStaffContractBasis`):**
   - Khi xe đang được phân công cố định trên tuyến `STAFF` (`TRMS_ROUTE_SEGMENTS`) chạy thêm chuyến phát sinh (`EXTRA` — công tác/OT) vào ngày thường (`WEEKDAY`), động cơ tính phí ngày không tính theo bảng giá `EXTRA` thông thường mà áp khung `COMMUTE STAFF` (tính theo đơn giá KM vượt hợp đồng).

4. **Khung giờ chuẩn tính ngoài giờ theo Xe-Ngày (`06:30–18:30`):**
   - Phí ngoài giờ (`OVERTIME_HOUR`) không cộng dồn từng chuyến độc lập mà gom theo từng `(vehicleId, businessDate)`: lấy `max(0, 06:30 - min(actualStart)) + max(0, max(actualEnd) - 18:30)` trên toàn bộ các chuyến hoàn thành trong ngày của xe đó.

5. **12 Mã quyền `FR-*` đã thu hồi / hợp nhất trong tổng số 77 mã:**
   - Hệ thống giữ nguyên 65 mã quyền `FR-*` đang active và ánh xạ tương thích 12 mã đã gộp (`FR-EMP-TRANSPORT-001`, `004`, `005`, `008`, `009`, `010`, `FR-REQUEST-000`, `006`, `007`, `008`, `010`, `FR-COMMUTE-DISPATCH-004`) về các mã quyền chuẩn tương ứng theo đúng `TRMS_FEATURE_CODES.md`.
