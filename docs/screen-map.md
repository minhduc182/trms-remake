# Screen Mapping: Legacy Lit SPA (39 Pages/Modals) → React 19 Routes (`apps/web`)

| # | Legacy Lit Page / Component (`frontend/src/features/trms`) | Route Mới (`apps/web`) | Mô tả chức năng |
|---|---|---|---|
| 1 | `trms-dashboard.ts` | `/dashboard` | Tổng quan vận hành, thống kê chuyến, yêu cầu, xe |
| 2 | `trms-master-data-hub.ts` | `/master-data` | Hub Quản lý dữ liệu gốc (7 Tab) |
| 3 | `trms-points-list.ts` + modal | `/master-data?tab=points` | Tab 1: Điểm đón/trả |
| 4 | `trms-drivers-list.ts` + modal | `/master-data?tab=drivers` | Tab 2: Tài xế & liên kết tài khoản |
| 5 | `trms-vehicles-list.ts` + modal | `/master-data?tab=vehicles` | Tab 3: Phương tiện & gói tháng |
| 6 | `trms-leg-definitions-list.ts` + modal | `/master-data?tab=legs` | Tab 4: Danh mục lượt chạy |
| 7 | `trms-routes-list.ts` + modal | `/master-data?tab=routes` | Tab 5: Tuyến cố định & cấu hình chặng |
| 8 | `trms-employee-transport-profiles-list.ts` | `/master-data?tab=etp` | Tab 6: Người đi xe tuyến (ETP) |
| 9 | `trms-etp-registration-history-modal.ts` | `/master-data?tab=etp` (Modal) | Lịch sử đăng ký & kích hoạt lại ETP |
| 10 | `trms-etp-import-modal.ts` | `/master-data?tab=etp` (Modal) | Import Excel đăng ký / hủy ETP |
| 11 | `trms-cost-configs-list.ts` + `trms-cost-config-create-modal.ts` | `/master-data?tab=cost-configs` | Tab 7: Cấu hình chi phí & đơn giá |
| 12 | `trms-shift-data.ts` | `/shifts` | Dữ liệu phân ca 7 ngày & Danh mục ca đưa đón |
| 13 | `trms-operations-request-list.ts` | `/requests` | Danh sách yêu cầu đặt xe |
| 14 | `trms-operations-shared.ts` (Create/Edit Form) | `/requests` (Modal) | Form tạo/sửa đơn Công tác, OT theo ca, Hàng hóa |
| 15 | `trms-operations-approval-queue.ts` | `/requests?tab=approvals` | Hàng đợi phê duyệt TBP & GA |
| 16 | `trms-dispatch-hub.ts` | `/dispatch` | Trung tâm điều phối (Đơn lẻ/Gộp & Tuyến cố định) |
| 17 | `trms-commute-dispatch-list.ts` | `/dispatch?tab=commute` | Điều phối đưa đón hôm nay & Kế hoạch ngày mai |
| 18 | `trms-offroute-weekly-plan.ts` + `trms-offroute-plan-model.ts` | `/dispatch?tab=weekly-plan` | Kế hoạch xe tuần & gán xe |
| 19 | `trms-trip-tracking.ts` | `/trips` | Theo dõi chuyến, nhập KM thực tế, đổi xe/tài xế |
| 20 | `trms-vehicle-operation-center.ts` | `/vehicle-ops` | Giám sát trạng thái đội xe & Timeline |
| 21 | `trms-driver-confirmation.ts` | `/driver` | Màn hình Tài xế: Xác nhận, Bắt đầu, Hoàn thành chuyến |
| 22 | `trms-cost-reports.ts` (Daily, Vehicle Bill, Monthly) | `/cost-reports` | Báo cáo chi phí ngày, Bill xe, Thanh toán tháng |
| 23 | `trms-audit-trail.ts` | `/audit-logs` | Nhật ký kiểm tra hệ thống |
| 24 | `general-config` (Holiday, OT slots, VAT, CC Email) | `/settings` | Cấu hình chung hệ thống |
