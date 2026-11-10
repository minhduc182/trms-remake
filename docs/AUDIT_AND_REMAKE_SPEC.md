# BÁO CÁO AUDIT NGHIỆP VỤ & ĐẶC TẢ LÀM LẠI TOÀN DIỆN HỆ THỐNG TRMS (`trms-remake`)

> [!IMPORTANT]
> Tài liệu này là kết quả kiểm toán độc lập 100% mã nguồn giữa **Bản gốc Lit SPA (`e:\platform-monorepo\frontend\src\features\trms\`)** và **Bản Remake React 19 + GraphQL (`E:\trms-remake\`)** do **Tổ Audit Nghiệp vụ & Tính năng (3 Auditors)** thực hiện. Mọi hạng mục bị thiếu, làm giả (hardcode/mock), lệch bộ lọc hoặc đứt gãy luồng nghiệp vụ đều được liệt kê chi tiết tại đây làm căn cứ bắt buộc để triển khai làm lại.

---

## TỔNG QUAN KẾT QUẢ KIỂM TOÁN (EXECUTIVE SUMMARY)

Qua rà soát đối chiếu 138 file mã nguồn của bản gốc Lit TRMS với bản Remake, Tổ Audit xác định **4 nhóm vấn đề cốt lõi** khiến bản Remake trước đó *"nhiều phần chỉ có hình chứ chưa có tính năng, dữ liệu lấy lên frontend chưa có bộ lọc"*:

1. **Dữ liệu & Hành vi gán cứng (Hardcode / Fake UI) để khớp ảnh chụp màn hình:**
   - **Dashboard (`DashboardPage.tsx`):** Gán cứng số fallback `|| 221`, `?? 16`, `?? 153`, `?? 83` và tính sai công thức `Active Trips`.
   - **Điều hành xe (`TripsAndVehicleOpsPage.tsx`):** Hardcode object `fixedRouteOverlay` cho 7 biển số xe và dùng regex `!/^(19|29|30)[A-Z]\d{5}$/` ẩn sạch các xe khác khi không gõ tìm kiếm.
   - **Điều phối xe tuyến (`DispatchPage.tsx`):** Hardcode `if/else` theo tên tuyến (`Tuyến C:`, `CN01:`..`CN04:`) để gán cứng số lượt thiếu ghế (`shortageLegCount`) và số chỗ thiếu (`shortagePerLeg`), đồng thời ẩn mọi tuyến không bắt đầu bằng chữ `'Tuyến'`.
   - **Dữ liệu ca làm (`ShiftsPage.tsx`):** Khi bộ lọc không có kết quả, tự gọi danh sách nhân viên rồi sinh giả chu kỳ ca `['HC', 'C1', 'C2', 'C3']`; cho click vào ô ngày để đổi ca giả trên bộ nhớ trình duyệt.
   - **Chi tiết Yêu cầu (`RequestsPage.tsx`):** Khối `Lịch sử tóm tắt` hardcode tĩnh 1 dòng `"Nhập yêu cầu — Administrator — 19:50 11/10/2026"`, không đọc `approvals`, `statusHistory` hay `auditLogs`.
   - **Import Excel (`RequestsPage.tsx`, `MasterDataPage.tsx`):** Hoặc thiếu hoàn toàn, hoặc bấm nút chỉ hiện Toast giả mà không đọc file/preview/gọi API.

2. **Thiếu hoặc cắt xén các Drawer / Split-view / Modal nghiệp vụ chuyên sâu (28 components ở bản gốc):**
   - Thiếu **`TripDetailDrawer`** (xem chi tiết 8 khối thông tin chuyến, hoán đổi xem chuyến khứ hồi cặp `pairedTripId`, mở inline panel `Đổi xe / tài xế`, mở form `Sửa thực tế` có KM, Phí cầu đường, Giờ thực tế, Số đêm lưu trú, Hủy/Hoàn thành chuyến).
   - Nút **`Bổ sung chuyến đã chạy`** mở nhầm popup nhập KM thay vì Modal 5 bước **`CompletedTripForm`** (khai báo hậu kiểm chuyến tăng cường).
   - Thiếu **`VehicleDetailDrawer`** trên màn Điều hành xe (chuyển tab theo từng khung giờ chuyến trong ngày của xe, xem bảng Hành khách kèm ca làm, bảng Yêu cầu vận chuyển và lịch sử xe).
   - Thiếu **`DriverStepPanel`** cho 3 bước tài xế (`Xác nhận`, `Bắt đầu`, `Hoàn thành`), thiếu Modal nhập **Công-tơ-mét đầu (`startOdometerKm`)**, **Công-tơ-mét cuối (`endOdometerKm`)**, **Số khách thực tế (`actualPassengerCount`)**, **Phí cầu đường/bến bãi (`tollFeeAmount`)**, và thiếu Drawer chi tiết chuyến chế độ tài xế (`driverMode`).
   - Thiếu **`TripAttachPanel`** (`Ghép đơn vào chuyến có sẵn`), **`DispatchConflictPanel`** (giải quyết trùng lịch xe), **`DeadheadSuggestion`** (gợi ý tạo chuyến chạy rỗng nối chuyến & chạy rỗng về GICO).
   - Thiếu **`CommuteDispatchDrawer`** chuẩn (bảng lượt chạy `Daily legs` kèm `Demand / Total seats / Short`, `CommuteSupplementPanel` kiểm tra hạn mức chuyến/ngày, `CommuteReassignPanel` điều chuyển xe sang tuyến thiếu ghế kèm kiểm tra an toàn ghế, Modal `Withdraw` rút xe, và `Plan issues` drawer).
   - Thiếu hoàn toàn **Tab 3: `Kế hoạch tuần ngoài tuyến` (`Off-route weekly plan`)** trong Quản lý điều phối.
   - Trong Quản lý dữ liệu gốc: Modal **Tuyến xe** thiếu 5 trường cấu hình quan trọng nhất trên mỗi chặng (`Xe`, `Tài xế`, `Điểm đón`, `Điểm trả`, `Ca làm việc`); Tab **Người đi xe tuyến** thiếu luồng Nhân viên tạm chưa có mã nhân sự (`Provisional Employee` + `Gán mã NV`); Tab **Cấu hình chi phí** không đọc mảng `rules` khiến các cột giá hiển thị `—` và lưu bị lỗi `rateType is invalid`; Báo cáo **Chi phí ngày / Thanh toán tháng** thiếu Drawer `Dữ liệu cần xử lý` (`issueSummary`).

3. **Nhiều API đã có sẵn ở Backend (`E:\trms-remake\apps\api`) nhưng Frontend chưa nối:**
   - `updateTransportRequest`, `gaEditTransportRequest`, `otShiftOptions`, `resolveEmployeeForOt`
   - `attachRequestsToTrip`, `suggestedDriver`, `availableVehicles`, `deadheadCandidate`
   - `reassignPlanVehicle`, `cancelPlanAssignment`, `reassignTripVehicle`
   - `provisionalCount`, `createProvisionalEtp`, `linkProvisionalEtp`, `importEtpRegistrations`
   - `costConfigHistory`, `upsertCostConfig` (với mảng `rules`), `deleteCostConfig`

4. **Các bộ lọc (Filters) chưa đồng bộ với bản gốc:**
   - Nhiều danh sách Phòng ban, Tháng chi phí đang bị hardcode thay vì lấy từ DB (`orgUnits`) hoặc chọn tháng động.
   - Thiếu các bộ lọc động phụ thuộc ngữ cảnh (ví dụ: chọn `Loại yêu cầu = OT` ở Hàng chờ điều phối phải hiện thêm `Khung giờ OT`, `Chiều đi/về`, `Loại ngày OT`; chọn `Loại chuyến = Chuyến rỗng` ở Theo dõi chuyến đi phải hiện thêm `Loại chuyến rỗng`; chọn `Loại chuyến = Công tác` phải hiện thêm `Chiều khứ hồi`).

---

## PHẦN I — ĐẶC TẢ CHI TIẾT KHỐI TỔNG QUAN, YÊU CẦU XE & ĐIỀU PHỐI (AUDITOR 1)

### 1. Màn hình Tổng quan (`DashboardPage.tsx` & `dispatch-trip/schema.ts`)
- **Xóa bỏ hoàn toàn số liệu giả (Fake Fallbacks):**
  - Bỏ `|| 221`, `?? 16`, `?? 153`, `?? 83`. Khởi tạo bằng `0` khi đang tải hoặc khi giá trị thực bằng `0`.
- **Chuẩn hóa công thức KPI tại Backend (`dashboardStats`):**
  - `activeTrips`: Đếm số chuyến có `status IN ('DISPATCHED', 'DRIVER_CONFIRMED', 'IN_PROGRESS')`.
  - `pendingApprovalRequests`: Đếm số đơn có `status IN ('PENDING_DEPARTMENT', 'PENDING_GA')`.
  - `waitingDispatchRequests`: Đếm số đơn có `status = 'WAITING_VENDOR_DISPATCH'`.
  - `availableVehicles`: Đếm số xe đang hoạt động (`activeFlag = 'Y'`).
- **Bổ sung dòng mô tả (`description`) dưới 10 thẻ điều hướng** trong 3 cột (`Vận hành`, `Dữ liệu gốc`, `Báo cáo`) và hiển thị badge tổng `pendingApprovalRequests + waitingDispatchRequests` trên mục `Điều hành yêu cầu xe`.

---

### 2. Màn hình Điều hành Yêu cầu xe & Hàng chờ Phê duyệt (`RequestsPage.tsx` & `request/schema.ts`)

#### 2.1. Bảng dữ liệu & Bộ lọc
- **Bộ lọc chuẩn:**
  - `Giờ khởi hành`: Hỗ trợ lọc từ ngày/giờ (`departureFrom`) đến ngày/giờ (`departureTo`) hoặc ngày vận hành.
  - `Trạng thái`:
    - Ở tab `Danh sách yêu cầu`: Hỗ trợ chọn tất cả 11 trạng thái (`PENDING_DEPARTMENT`, `PENDING_GA`, `RETURNED`, `WAITING_VENDOR_DISPATCH`, `WAITING_DRIVER_CONFIRM`, `IN_PROGRESS`, `WAITING_DISTANCE_INPUT`, `COMPLETED`, `TAXI_ARRANGED`, `CANCELLED`, `REJECTED`).
    - Ở tab `Hàng chờ phê duyệt`: Chỉ hiển thị các trạng thái chờ duyệt (`Tất cả`, `Chờ bộ phận duyệt - PENDING_DEPARTMENT`, `Chờ GA duyệt - PENDING_GA`).
  - `Loại yêu cầu`: `Tất cả`, `Công tác (BUSINESS)`, `Làm thêm giờ (OT)`, `Hàng hóa (CARGO)`.
  - `Phòng ban`: Truy vấn danh sách phòng ban thực tế từ bảng `orgUnits` (`query { orgUnits { id unitCode unitName } }`), xóa bỏ mảng 7 phòng ban hardcode.
- **Đầy đủ các cột trên bảng:**
  - Bổ sung cột `Mã yêu cầu` (`requestCode`), hiển thị đầy đủ điểm đón/trả chiều đi & chiều về, và hiển thị các chip cảnh báo bên cạnh trạng thái (`Yêu cầu ghép chuyến - Merge required`, `Taxi`, trạng thái đơn cặp OT).
  - Đặt kích thước phân trang mặc định là `20` dòng/trang (sửa lỗi `usePagination(filteredRequests, 999)`).
  - Sửa nút `Xuất excel trang hiện tại` ở tab `Hàng chờ phê duyệt` gọi `exportTableToCsv('hang-cho-phe-duyet')` thật.

#### 2.2. Drawer Chi tiết Yêu cầu (`RequestDetailDrawer`)
- **Thanh nút hành động trên Header Drawer:**
  - Khi mở từ `Danh sách yêu cầu`: Hiển thị nút **`Sửa`** (khi đơn ở `PENDING_DEPARTMENT`, `PENDING_GA` hoặc `RETURNED`), nút **`Sửa (GA)`** (khi đơn ở `PENDING_GA`), và nút **`Hủy yêu cầu`** (khi đơn chưa hoàn thành/chưa hủy).
  - Khi mở từ `Hàng chờ phê duyệt`: Hiển thị các nút **`Phê duyệt`**, **`Duyệt & yêu cầu ghép chuyến`**, **`Duyệt cấp Taxi`**, **`Trả về bổ sung`**, **`Từ chối`**.
- **5 Khối nội dung chuẩn trong Drawer:**
  1. **Thông tin chung:** Mã đơn, Người yêu cầu, Bộ phận, Loại yêu cầu, Ca OT (`otShiftCode`), Chặng cặp OT (`Outbound / Return`), Chế độ chuyến (`Một chiều / Khứ hồi`), Trạng thái (kèm chip `Yêu cầu ghép chuyến` / `Taxi`), Người liên hệ & SĐT, Mục đích, Ghi chú từ GA (`mergeNote` / `taxiNote`), Ghi chú đơn (`notes`), Lý do trả về / từ chối / ghi đè (`overrideReason`).
  2. **Lộ trình Chiều đi & Chiều về (hoặc Thông tin Lấy hàng & Giao hàng):** Điểm đón, Điểm trả, Giờ đi, Giờ đến dự kiến, Chi tiết đón/trả nhiều điểm (`departurePointNote`, `returnPointNote`), Thông tin người gửi (`senderInfo`) & người nhận (`receiverInfo`) đối với đơn Hàng hóa.
  3. **Danh sách Hành khách (`Passengers`):** Bảng danh sách hành khách đăng ký trong đơn (`passengerName`, `employeeCode`, `departmentName`).
  4. **Thông tin Chuyến xe (`Trip` & `Paired Trip`):** Nếu đơn đã được điều phối vào chuyến (`tripLinks`), hiển thị Mã chuyến, Khung giờ, Biển số xe, Tài xế, Trạng thái chuyến, Số KM thực tế.
  5. **Lịch sử hoạt động (`History Summary`):** Đọc trực tiếp từ `request.approvals`, `request.statusHistory` và `auditLogs(entityType: "REQUEST", entityId: request.id)` để dựng Timeline thật (xóa bỏ dòng lịch sử tĩnh giả).

#### 2.3. Modal Tạo / Sửa Yêu cầu (`RequestFormModal`) & Đăng ký OT hàng loạt (`BulkOtModal`) & Import Excel (`ImportRequestModal`)
1. **Chế độ Tạo mới / Sửa của người tạo (`Edit` & `Resubmit`) / Sửa trực tiếp của GA (`Edit (GA)`):**
   - Hỗ trợ nạp dữ liệu đơn hiện tại vào Modal để **Sửa (`updateTransportRequest`)**. Nếu đơn đang ở trạng thái `RETURNED`, hiển thị Banner màu vàng nêu rõ lý do bị trả về và nút lưu đổi thành **`Gửi lại phê duyệt (Resubmit)`**.
   - Hỗ trợ chế độ **`Sửa (GA)` (`gaEditTransportRequest`)**: khóa các trường thông tin người tạo/mục đích/hành khách, chỉ cho phép GA sửa thời gian, điểm đón/trả, ghi chú điểm và nhập `Lý do chỉnh sửa`.
   - **Đơn Công tác (`BUSINESS`):**
     - Chọn `Điểm đón` / `Điểm trả` từ danh mục Điểm (`points`) hoặc nhập địa chỉ tùy chỉnh (lưu cả `PointId` và `PointText`).
     - Khi chọn `Khứ hồi (ROUND_TRIP)`: hiển thị đầy đủ `Điểm đón chiều về`, `Điểm trả chiều về` (mặc định đảo ngược từ chiều đi), `Giờ khởi hành chiều về`, `Giờ đến dự kiến chiều về`.
     - Công tắc **`Đón/trả nhiều điểm` (`multiPointEnabled`)**: khi bật sẽ hiển thị ô nhập `Chi tiết điểm đón/trả chiều đi` (`departurePointNote`) và `Chi tiết điểm đón/trả chiều về` (`returnPointNote`).
     - **Bảng danh sách hành khách đi công tác:** Cho phép thêm/xóa từng dòng hành khách (Mã NV / Họ tên / Bộ phận) thay vì gán cứng `'Nguyễn Văn A'`.
   - **Đơn Hàng hóa (`CARGO` / `GOODS`):**
     - Tự động khóa `Một chiều (ONE_WAY)`, hiển thị riêng `Thông tin người gửi - SĐT` (`senderInfo`), `Thông tin người nhận - SĐT` (`receiverInfo`), `Thời gian lấy hàng dự kiến`, `Thời gian giao hàng dự kiến`, và `Ghi chú hàng hóa`.
2. **Sửa triệt để Modal Đăng ký xe Làm thêm giờ (`OT`):**
   - Sửa lỗi lệch tên biến (`employeeCode`, `employeeName`, `departmentName`, `legDirection`, `pickupPoint`, `dropoffPoint`, `purpose`) trong `handleCreateBulkOt`.
   - Tích hợp gọi query `otShiftOptions(businessDate)` để lấy danh sách khung giờ/ca OT hợp lệ theo loại ngày (Ngày thường / Thứ 7 / Chủ nhật / Ngày lễ).
   - Khi nhập hoặc chọn Mã nhân viên trên từng dòng, gọi `resolveEmployeeForOt(employeeCode, businessDate)` để tự động điền Họ tên, Bộ phận, Tuyến xe tuyến cố định và Điểm đón/trả mặc định của nhân viên, kèm hiển thị trạng thái kiểm tra (`Hợp lệ` / `Không tìm thấy`).
3. **Bổ sung Modal Nhập yêu cầu từ Excel (`ImportRequestModal`):**
   - Nút `Nhập từ Excel` trên thanh công cụ mở Modal cho phép tải file mẫu CSV/Excel, chọn file tải lên, hiển thị **Bảng xem trước (Preview)** kiểm tra tính hợp lệ của từng dòng (Loại yêu cầu, Ngày giờ, Điểm đón, Điểm trả, Số khách...) và nút `Nhập các dòng hợp lệ`.
4. **Thay thế `window.prompt()` bằng Modal Xác nhận Phê duyệt / Từ chối / Trả về / Duyệt ghép / Duyệt Taxi / Hủy đơn:**
   - Hiển thị tóm tắt thông tin đơn, cảnh báo nếu GA duyệt vượt cấp Trưởng bộ phận hoặc nếu đơn thuộc cặp ca OT 2 chiều, kèm ô nhập `Lý do / Ghi chú GA`.
   - Bổ sung hành động **`Duyệt & yêu cầu ghép chuyến` (`Approve & require merge`)** và **`Duyệt cấp Taxi hàng loạt` (`Bulk Taxi`)**.

---

### 3. Màn hình Quản lý Điều phối (`DispatchPage.tsx` & `dispatch-trip/schema.ts`)

#### 3.1. Tab 1: Điều phối yêu cầu (`REQUEST_DISPATCH`)
1. **Bộ lọc chuẩn:**
   - Hiển thị đầy đủ: `Ngày vận hành`, `Loại yêu cầu`, `Bộ phận` (từ danh mục phòng ban), `Điểm đón`, `Điểm trả`.
   - Khi chọn `Loại yêu cầu = Làm thêm giờ OT`: tự động hiển thị thêm 3 bộ lọc chuyên biệt: **`Khung giờ / Ca OT`**, **`Chiều chạy` (`Đến nhà máy` / `Từ nhà máy`)**, và **`Loại ngày OT` (`Ngày thường` / `Thứ Bảy` / `Chủ Nhật`)**.
   - Xóa bỏ hàm `.sort()` hardcode ngày `'2026-09-22'` và `'2027-'`.
2. **Xem chi tiết đơn (`View`) & Ghép vào chuyến có sẵn (`Attach to trip` - `TripAttachModal`):**
   - Menu dòng có đủ 3 hành động: **`Xem chi tiết đơn`** (mở `RequestDetailDrawer`), **`Điều phối xe & tài xế`**, và **`Ghép vào chuyến có sẵn`**.
   - Thanh công cụ khi tích chọn nhiều đơn có 2 nút: **`Điều phối gộp chuyến (N)`** và **`Ghép vào chuyến có sẵn (N)`**.
   - **`TripAttachModal` (3 bước):**
     - Bước 1: Danh sách các đơn được chọn và chiều cần ghép (`Chiều đi` / `Chiều về` / `Cả 2 chiều`).
     - Bước 2: Danh sách các chuyến xe ứng viên trong ngày (`trips`), chọn 1 chuyến đích.
     - Bước 3: Thanh tiến trình tải trọng hành khách sau khi ghép (`X / Y ghế`, cảnh báo đỏ nếu vượt số ghế), nhập `Lý do ghép chuyến` và gọi mutation `attachRequestsToTrip`.
3. **Nâng cấp Panel/Modal Điều phối Chuyên sâu (`RequestDispatchModal`):**
   - **Khối 1 — Tóm tắt các đơn trong chuyến & Ghi chú gửi tài xế:** Hiển thị danh sách đơn được chọn; nếu có nhiều đơn OT thì tự động tổng hợp gợi ý lộ trình gom khách theo điểm đón/trả.
   - **Khối 2 — Chế độ chuyến & Thời gian / Lộ trình:**
     - Cho phép chọn `Một chiều (ONE_WAY)` hoặc `Khứ hồi (ROUND_TRIP)`. Nếu `ROUND_TRIP`, cho phép chọn **`Điều cả chiều đi và chiều về ngay` (`TOGETHER`)** hoặc **`Điều chiều về sau` (`LATER`)**.
     - Cho phép chỉnh sửa `Giờ khởi hành`, `Giờ kết thúc dự kiến`, `Điểm đón`, `Điểm trả` (cho cả chiều đi và chiều về).
   - **Khối 3 — Chọn Xe & Tài xế (Hỗ trợ cả Xe hệ thống & Xe ngoài):**
     - Cho phép chọn xe trong danh mục hoặc bật **`Sử dụng xe ngoài / tài xế ngoài`** (nhập Biển số xe ngoài, Loại xe/Số ghế, Tên tài xế ngoài, SĐT tài xế).
     - Khi chọn xe hệ thống, tự động gọi query `suggestedDriver(vehicleId, beforeAt)` để gợi ý tài xế phụ trách xe đó.
     - Hiển thị **Thanh tải trọng ghế (`Vehicle load: X / Y ghế`)**, đổi màu đỏ nếu tổng khách vượt số ghế.
     - Tự động kiểm tra xung đột trùng lịch (`availableVehicles` / kiểm tra chuyến trùng giờ của xe) và hiển thị **Khối Giải quyết Trùng lịch (`DispatchConflictPanel`)** cho phép chọn xe thay thế hoặc nhập lý do ghi đè.
   - **Khối 4 — Chuyến chạy rỗng (`Deadhead`):**
     - Tự động gọi query `deadheadCandidate(vehicleId, nextStartAt, nextPickupPointId)` để gợi ý tích chọn **`Tạo chuyến chạy rỗng nối từ vị trí chuyến trước`**, và tùy chọn **`Tạo chuyến chạy rỗng quay về bãi GICO`** (`returnToGico`).
   - **Khối 5 — Bảng giá & Lưu đêm:**
     - Tự động hiển thị thông tin bảng giá áp dụng (`Hợp đồng nhân viên` / `Tăng cường nhân viên` / `Tăng cường công nhân` + phạm vi `Tiêu chuẩn` / `Chạm Hòa Bình`), và ô nhập **`Số đêm lưu trú` (`overnightNights`)** đối với đơn Công tác.

#### 3.2. Tab 2: Điều phối đưa đón hàng ngày (`COMMUTE_DISPATCH`)
1. **Xóa bỏ hoàn toàn đoạn code gán cứng số ghế thiếu theo tên tuyến (`Tuyến C:`, `CN01:`..`CN04:`):**
   - Hiển thị toàn bộ các tuyến cố định từ dữ liệu thực của Backend (`commuteDispatches` + `routes`), tính toán chính xác `Số xe tuyến cố định`, `Số lượt thiếu chỗ`, `Tổng chỗ thiếu` từ nhu cầu ca làm việc và phân công thực tế của từng lượt chạy trong ngày.
   - Mặc định `Ngày vận hành` là ngày có kế hoạch/chuyến gần nhất hoặc ngày hiện tại, kèm hiển thị rõ huy hiệu trạng thái (`Kế hoạch nháp`, `Kế hoạch đã chốt`, `Chuyến chạy thực tế`, `Chưa tạo kế hoạch`) và nút **`Vấn đề kế hoạch (N)` (`Plan issues`)** trên thanh công cụ.
2. **Nâng cấp Drawer Chi tiết Điều phối Tuyến (`CommuteDispatchDrawer`):**
   - Hiển thị bảng **Các lượt chạy trong ngày (`Daily legs`)** với đầy đủ 7 cột: `Mã lượt`, `Thông tin lượt & Giờ chạy`, `Nhu cầu khách (Demand)`, `Tổng số ghế (Total seats)`, `Thiếu/Thừa (Short/Surplus)`, `Danh sách xe trên lượt` (phân biệt màu chip: Xe cố định tuyến / Xe gói theo chặng / Xe tăng cường ngoài), và `Thao tác`.
   - Cung cấp đầy đủ **4 luồng thao tác trên từng lượt chạy**:
     1. **`Điều xe bổ sung / điều bù` (`CommuteSupplementPanel`):** Chọn loại điều bù (`Xe mặc định tuyến`, `Theo gói số chặng` kèm hiển thị hạn mức chuyến còn lại trong ngày, hoặc `Thuê xe tăng cường ngoài` nhập biển số/tài xế/số ghế/phạm vi giá Hòa Bình).
     2. **`Điều chuyển xe sang tuyến khác` (`CommuteReassignPanel`):** Hiển thị Banner kiểm tra an toàn ghế khi rút xe (`Đủ ghế sau khi chuyển` hoặc `Cảnh báo thiếu X ghế`), chọn Tuyến đích (ưu tiên tuyến đang thiếu ghế), Lượt đích, Ghi chú và gọi `reassignPlanVehicle`.
     3. **`Rút xe khỏi lượt` (`Withdraw`):** Mở modal xác nhận rút xe kèm cảnh báo an toàn ghế và gọi `cancelPlanAssignment`.
     4. **`Đổi xe / tài xế chuyến thực tế` (`CommuteTripReassignPanel`):** Gọi `reassignTripVehicle` (kèm nhập `actualKm` nếu chuyến đã hoàn thành).

#### 3.3. Tab 3: Kế hoạch tuần ngoài tuyến (`OFFROUTE_PLAN`) — Dựng mới hoàn chỉnh
- Bổ sung Tab thứ 3 **`Kế hoạch ngoài tuyến` (`OFFROUTE_PLAN`)** trên `DispatchPage.tsx`:
  - Bộ lọc: `Ngày vận hành`, `Nguồn` (`Tất cả` / `Theo ca kế hoạch` / `Bổ sung OT`), `Ca làm / Giờ về OT`, `Tuyến`, `Điểm dừng`.
  - Hiển thị các chip thống kê nhanh: Trạng thái ngày (`Chưa chốt` / `Đã chốt ngày`), Số người cần đi xe ngoài giờ tuyến cố định, Số người chưa xếp xe, Nút mở Drawer **`Xe hôm nay (N)`** và nút **`Chốt kế hoạch ngày` / `Mở lại ngày`**.
  - Bảng **`Danh sách người cần bố trí xe`**: hiển thị Mã NV, Họ tên, Bộ phận, Ca làm / Giờ OT, Giờ đi & Xe chiều đi, Giờ về & Xe chiều về, Tuyến, Điểm dừng, Nguồn; cho phép tích chọn nhiều nhân viên để bấm **`Gán vào xe`** (hoặc bố trí đi Taxi / Xe trung chuyển Feeder).
  - Drawer **`Xe hôm nay` (`Today's vehicles`)**: Quản lý các xe ngoài tuyến & xe trung chuyển (Feeder), thêm xe mới, gán biển số xe & tài xế thật, khóa chuyến (`Lock trip`), xử lý chặng cuối (`Đi thẳng đến điểm trả`, `Đi chung Taxi`, `Chuyển sang xe trung chuyển`) và tự động sinh ghi chú lộ trình cho tài xế.

---

## PHẦN II — ĐẶC TẢ CHI TIẾT KHỐI CHUYẾN ĐI, ĐIỀU HÀNH XE, TÀI XẾ & CA LÀM (AUDITOR 2)

### 1. Màn hình Theo dõi Chuyến đi (`TripsAndVehicleOpsPage.tsx` view `TRIPS`)
1. **Bổ sung đầy đủ 11 cột trên bảng Theo dõi chuyến đi:**
   - Thêm 3 cột đang thiếu: **`Chiều khứ hồi` (`tripLeg` — chip `Chiều đi` / `Chiều về`)**, **`Quãng đường (km)` (`actualKm` hoặc `~estimatedKm`)**, và **`Ghi chú` (`notes`)**.
   - Cột `Hành khách`: hiển thị `actualPassengerCount / passengerCount` (bỏ hardcode `?? 80`).
2. **Sửa bộ lọc `Loại chuyến đi` (8 giá trị) & 2 bộ lọc phụ thuộc:**
   - `Loại chuyến đi`: `Tất cả`, `Đưa đón cố định (COMMUTE)`, `Công tác (BUSINESS)`, `Làm thêm giờ (OT)`, `Chở hàng (CARGO)`, `Chuyến ghép hỗn hợp (MIXED)`, `Chuyến rỗng (DEADHEAD)`, `Chiều về rỗng (EMPTY_RETURN)`.
   - Khi chọn `Chuyến rỗng (DEADHEAD)`: hiện thêm bộ lọc **`Loại chuyến rỗng`** (`Chạy rỗng nối chuyến - CONNECTOR`, `Chạy rỗng về GICO - BASE_RETURN`, `Chạy rỗng tuyến thường - NONE`).
   - Khi chọn `Công tác (BUSINESS)`: hiện thêm bộ lọc **`Chiều khứ hồi`** (`Chiều đi - OUTBOUND`, `Chiều về - RETURN`).
3. **Xây dựng `TripDetailDrawer` (mở khi click vào bất kỳ dòng chuyến đi nào):**
   - Header Drawer có 2 nút: **`Đổi xe / tài xế`** (mở inline panel đổi xe/tài xế, tự gợi ý tài xế theo xe, bắt buộc nhập `actualKm` nếu chuyến đã hoàn thành) và **`Sửa thực tế`** (mở inline form cập nhật thực tế).
   - **8 Section chi tiết:** Thông tin chung (kèm nút `Mở chi tiết` chuyến cặp khứ hồi `pairedTripId`), Các đơn ghép trong chuyến (`Orders in this trip`), Xe & Tài xế, Lộ trình chiều đi & chiều về, Thực tế & Chi phí (`KM thực tế`, `Phí cầu đường`, `Số đêm lưu trú` cho chuyến Công tác), Chi tiết điểm dừng, Ghi chú & Cảnh báo, **Bảng Hành khách trên chuyến**, và **Timeline Lịch sử hoạt động (`auditLogs` của chuyến)**.
   - **Form `Sửa thực tế` (`Edit actuals`):** Nhập `KM thực tế`, `Phí cầu đường (VND)`, `Giờ bắt đầu thực tế`, `Giờ kết thúc thực tế`, `Số đêm lưu trú` (nếu chuyến Công tác), `Lý do cập nhật (bắt buộc)` và 2 nút **`Hoàn thành chuyến`** / **`Hủy chuyến`** (có Modal xác nhận hiển thị rõ nếu hủy cả cặp chuyến khứ hồi).
4. **Xây dựng Modal 5 bước `Bổ sung chuyến đã chạy` (`CompletedTripFormModal`):**
   - Thay thế hành vi mở nhầm `setKmModal` của nút `Bổ sung chuyến đã chạy` bằng Modal chuẩn 5 bước:
     - Bước 1: Thông tin chuyến (`Ngày thực hiện`, `Loại chuyến` OT/Công tác/Hàng hóa, `Hình thức` 1 chiều/Khứ hồi, `Người yêu cầu/liên hệ`, `SĐT liên hệ`).
     - Bước 2: Xe & Tài xế đã chạy (cho phép chọn xe/tài xế hệ thống hoặc nhập biển số xe ngoài + số ghế + tên/SĐT tài xế ngoài).
     - Bước 3: Lộ trình & Thời gian thực tế (`Điểm đón/trả chiều đi & chiều về`, `Giờ xuất phát/kết thúc thực tế`, `Công-tơ-mét đầu`, `Công-tơ-mét cuối`, tự tính `Số km thực tế = cuối - đầu`).
     - Bước 4: Chi phí theo bảng giá (`Đối tượng tính giá` Nhân viên/Công nhân, `Phạm vi giá` Tiêu chuẩn/Chạm Hòa Bình, tự động tra cứu đơn giá).
     - Bước 5: Ghi chú & Kiểm tra lưu chuyến hoàn thành.

---

### 2. Màn hình Điều hành xe (`TripsAndVehicleOpsPage.tsx` view `VEHICLE_OPS`)
1. **Xóa bỏ hoàn toàn dữ liệu giả `fixedRouteOverlay` và regex ẩn biển số xe `!/^(19|29|30)[A-Z]\d{5}$/`.**
2. **Bổ sung bộ lọc `Tuyến xe` (`routeId`)** cạnh bộ lọc `Loại xe` và `Trạng thái vận hành`.
3. **Xây dựng `VehicleDetailDrawer` (mở khi click vào dòng xe):**
   - Khối Thông tin xe: Biển số, Loại xe, Số ghế, Trạng thái vận hành, Tài xế hiện tại.
   - **Thanh Tabs Chuyến đi theo khung giờ trong ngày (`Timeline Trips`):** Mỗi chuyến của xe được hiển thị thành 1 tab khung giờ (`HH:mm - HH:mm`). Khi chọn tab chuyến nào sẽ hiển thị:
     - Tóm tắt chuyến đi (Mã chuyến, Loại điều phối, Tuyến, Tài xế, Trạng thái, Giờ đi/đến, Điểm đón/trả).
     - **Bảng Hành khách trên chuyến** (Mã NV, Họ tên, Ca làm việc).
     - **Bảng Yêu cầu vận chuyển gắn với chuyến** (Mã đơn, Người yêu cầu - Bộ phận, Trạng thái).
   - **Timeline Lịch sử hoạt động của xe** (`auditLogs` với `entityType: "VEHICLE"`).

---

### 3. Màn hình Xác nhận Tài xế (`DriverPage.tsx`)
1. **Hiển thị đầy đủ cột `Quãng đường` (`actualKm`) và `Chế độ xác nhận` (`Hỗ trợ` / `Tài xế`)** trên bảng ở Tab 0 (`Chuyến`), bổ sung bộ lọc **`Loại chuyến đi`** và trạng thái **`Đã hủy (CANCELLED)`**.
2. **Xây dựng giao diện `DriverStepPanel` dạng Thẻ (Card) chuyên biệt cho 3 Tab `Xác nhận (Bước 1)`, `Bắt đầu (Bước 2)`, `Hoàn thành (Bước 3)`:**
   - Hiển thị tiêu đề hướng dẫn từng bước, bộ đếm số chuyến cần xử lý và danh sách Thẻ chuyến đi (`DriverTripCard`).
   - Trên mỗi Thẻ chuyến đi hiển thị: Mã chuyến, Chiều chạy, Loại chuyến, Trạng thái, Tuyến, Điểm đón → Điểm trả, Khung giờ, Biển số xe, Số hành khách, Thông tin liên hệ (`tel:` bấm gọi ngay), Thông tin người gửi/nhận hàng (với đơn Hàng hóa), Danh sách khách gom theo điểm đón/trả (với đơn OT), Accordion `Chi tiết điểm dừng` & `Ghi chú nhà xe`, nút **`Xem chi tiết` (`DriverTripDetailDrawer`)** và nút hành động chính:
     - Ở Tab `Xác nhận`: Nút **`Xác nhận nhận chuyến` (`Confirm Trip`)**.
     - Ở Tab `Bắt đầu`: Nút **`Bắt đầu chuyến` (`Start Trip`)** → mở **Modal nhập `Số công-tơ-mét đầu chuyến (km)` (`startOdometerKm > 0`)**.
     - Ở Tab `Hoàn thành`: Nút **`Hoàn thành chuyến` (`Complete Trip`)** → mở **Modal nhập `Số công-tơ-mét cuối chuyến (km)` (`endOdometerKm >= startOdometerKm`), `Số hành khách thực tế trên xe` (`actualPassengerCount`), và `Phí cầu đường / bến bãi / BOT (VND)` (`tollFeeAmount`)**.

---

### 4. Màn hình Dữ liệu Ca làm (`ShiftsPage.tsx` & `shift/schema.ts`)
1. **Xóa bỏ hành vi click đổi ca giả trên bảng 7 ngày** và **xóa bỏ đoạn code tự sinh ca giả `['HC', 'C1', 'C2', 'C3']`** khi bộ lọc không có kết quả.
2. **Lấy danh mục `Phòng ban` thực tế từ bảng `orgUnits`** (hỗ trợ lọc theo phòng ban cha bao gồm cả các phòng ban con tại Backend).
3. **Nâng cấp Modal `Danh sách ca làm việc` (`WorkShiftListModal`):**
   - Bổ sung 2 bộ lọc trên đầu Modal: **`Loại ca` (`Master`: Tất cả / Ca chính / Ca phụ)** và **`Trạng thái` (`Status`: Tất cả / Đang hoạt động / Ngừng hoạt động)** bên cạnh bộ lọc `Xe đưa đón`.
   - Bổ sung 2 cột còn thiếu trong bảng: **`Loại ca` (`Ca chính` / `Ca phụ`)** và **`Trạng thái` (`Hoạt động` / `Ngừng hoạt động`)**.
   - **Khóa nút tắt `Xe đưa đón`** đối với các ca đang được gắn vào chặng tuyến (`segmentUsageCount > 0`) kèm hiển thị rõ số chặng đang sử dụng.
   - Bổ sung nút `Làm mới` và `Xuất Excel` ngay trong Modal Danh mục ca.

---

## PHẦN III — ĐẶC TẢ CHI TIẾT KHỐI DỮ LIỆU GỐC, BÁO CÁO CHI PHÍ & NHẬT KÝ (AUDITOR 3)

### 1. Màn hình Quản lý Dữ liệu gốc — 7 Tabs (`MasterDataPage.tsx` & `master/schema.ts`, `etp/schema.ts`, `cost-config/schema.ts`)

1. **Khung chung & Cảnh báo Chặng đang sử dụng (`SegmentUsageToast`):**
   - Reset các bộ lọc dùng chung khi chuyển qua lại giữa 7 tab để không bị rò rỉ bộ lọc.
   - Khi người dùng bấm **Bật/tắt hoạt động** hoặc **Xóa** đối với Điểm, Tài xế, Xe, Lượt chạy đang được gắn vào tuyến (`segmentUsageCount > 0`), hiển thị thông báo nêu rõ số chặng/tuyến đang sử dụng.
   - Thay toàn bộ `window.confirm()` bằng Modal xác nhận chuẩn hiển thị thông tin bản ghi sắp xóa.
2. **Tab 1 — Điểm đón / trả (`POINTS`):**
   - Trong Modal Thêm/Sửa điểm: cho phép sửa `Mã điểm` (`pointCode`), nhưng **khóa trường `Loại điểm` (`pointType`) khi điểm đã gắn vào chặng (`segmentUsageCount > 0`)**.
   - Bổ sung hành động **`Bật / Tắt hoạt động`** trong menu dòng.
3. **Tab 2 — Tài xế (`DRIVERS`):**
   - Bổ sung hành động **`Bật / Tắt hoạt động`** trong menu dòng của Tài xế.
   - Trong Modal Thêm/Sửa Tài xế:
     - Mặc định khi thêm mới là `'NONE'` (Không dùng tài khoản đăng nhập); khi chọn `'NONE'` **vẫn giữ `activeFlag = 'Y'`** (sửa lỗi ép `activeFlag = 'N'` khi không dùng tài khoản).
     - Khi chọn `'CREATE_NEW'` (Tạo tài khoản mới): tự động điền `Tên đăng nhập = Số điện thoại` và mật khẩu mặc định `'123456'`.
     - Khi chọn `'LINK_EXISTING'` (Liên kết tài khoản có sẵn): lọc danh sách user chưa liên kết với tài xế khác.
4. **Tab 3 — Xe (`VEHICLES`):**
   - Xóa bỏ đoạn code hardcode 4 biển số xe `['19H08980', '29B16247', '29B16365', '29B30791']`.
   - Bổ sung hành động **`Bật / Tắt hoạt động`** trong menu dòng của Xe.
   - Bổ sung bộ lọc **`Loại sở hữu` (`ownershipType`: Công ty, Thuê ngoài, Taxi, Xe tải)** trên thanh filter-row.
   - Trong Modal Thêm/Sửa Xe:
     - Bổ sung trường **`Loại sở hữu` (`ownershipType`)**.
     - Bổ sung đầy đủ các loại xe (`SEDAN_4`, `SUV_7`, `VAN_16`, `BUS_29`, `BUS_45`).
     - Khi chọn `Loại hành khách = WORKER` và `Phương thức tính cước = BY_SEGMENT` (Theo số chặng): hiển thị **2 dropdown chuẩn**: **`Số chuyến/ngày` (`dailyTripCount`: `2`, `4`, `6` chuyến)** và **`Km tối đa` (`maxDistanceKm`: `25`, `40`, `55` km)**.
5. **Tab 4 — Lượt chạy (`LEGS`):**
   - Sửa lỗi cột `Trạng thái` luôn hiển thị cứng `"Hoạt động"` (đọc đúng `leg.activeFlag === 'Y'`).
   - Xóa bỏ bộ lọc ẩn các lượt chạy bắt đầu bằng chữ `test`.
   - Bổ sung bộ lọc **`Trạng thái`** & **`Hướng`** trên thanh filter-row, và bổ sung hành động **`Bật / Tắt hoạt động`** trong menu dòng.
6. **Tab 5 — Tuyến xe (`ROUTES`):**
   - Bổ sung cột **`Mã tuyến` (`routeCode`)** lên bảng danh sách Tuyến xe và hiển thị đúng `routeClass`.
   - Bổ sung 2 hành động **`Bật / Tắt hoạt động`** và **`Xóa tuyến`** vào menu dòng của Tuyến xe.
   - Trong Modal Thêm/Sửa Tuyến xe:
     - Bổ sung lựa chọn `Chỉ Thứ Bảy (SAT_ONLY / 32)` và mở khóa trường `Ngày có kế hoạch xe` cho cả tuyến Công nhân.
     - Trong khối `Xe chạy chuyến này` (`routeVehicles`): chỉ lọc các xe thuộc gói `Theo số chặng (BY_SEGMENT)`.
     - **Nâng cấp toàn diện khối `Danh sách chặng` (`Route Segments Builder`):** Mỗi chặng hiển thị đầy đủ **8 trường cấu hình**: `Lượt chạy` (chọn từ danh mục `legDefinitions`), `Giờ khởi hành`, `Giờ đến`, **`Xe mặc định` (`defaultVehicleId`)**, **`Tài xế mặc định` (`defaultDriverId`)**, **`Điểm đón` (`pickupPointIds` - chọn nhiều điểm đón theo thứ tự)**, **`Điểm trả` (`dropoffPointIds` - chọn nhiều điểm trả theo thứ tự)**, và **`Ca làm việc` (`shiftIds` - chọn các ca có xe đưa đón)**.
7. **Tab 6 — Người đi xe tuyến (`ETP`):**
   - Bổ sung cặp nút Pill lọc nhanh **`Tất cả`** | **`Chưa có mã NV (N)`** (`provisionalCount`) và bộ lọc **`Điểm đón`** / **`Điểm trả`** trên thanh bộ lọc; thêm trạng thái **`Đã nghỉ việc (RESIGNED)`** vào bộ lọc Trạng thái phê duyệt.
   - **Bổ sung đầy đủ Luồng Nhân viên tạm chưa có mã nhân sự (`Provisional Employee`):**
     - Trong Modal Thêm đăng ký: bổ sung công tắc **`Nhân viên chưa có mã nhân sự`** (nhập Họ tên, chọn Bộ phận, Ca làm việc, Ngày làm việc → gọi `createProvisionalEtp`).
     - Trên bảng & menu dòng của hồ sơ tạm: hiển thị chip `"Chưa có mã NV"`, bổ sung hành động **`Gán mã NV chính thức` (`Link HR ID` modal kiểm tra nhân viên + lịch phân ca 7 ngày → gọi `linkProvisionalEtp`)** và **`Sửa thông tin tạm`**.
   - **Lọc Điểm đón / Điểm trả theo Tuyến đã chọn** trong Modal Thêm đăng ký / Thêm tuyến (chỉ hiển thị các điểm nằm trên các chặng của tuyến đó).
   - **Bổ sung ô nhập `Lý do ngừng sử dụng xe`** trong Modal Ngừng sử dụng xe.
   - **Nâng cấp Modal Lịch sử đăng ký (`etpHistoryModal`):** Hiển thị đầy đủ 12 cột (bổ sung `Người tạo`, `Thời điểm tạo`, `Người duyệt/từ chối`, `Thời điểm duyệt/từ chối`), chỉ hiện nút `Kích hoạt lại` cho dòng đã ngừng (`INACTIVE`), bổ sung nút `Phê duyệt` / `Từ chối` cho dòng `PENDING` và nút `Xóa` cho dòng tương lai.
   - **Thay thế Modal Import Excel giả bằng 2 Modal Import thật:**
     1. **`Thêm đăng ký bằng Excel`:** Tải file mẫu, đọc file CSV/Excel, hiển thị bảng **Preview 7 cột** kiểm tra lỗi từng dòng, và bấm Xác nhận gọi `importEtpRegistrations`.
     2. **`Hủy đăng ký bằng Excel`:** Tải file mẫu, đọc file, hiển thị bảng **Preview 5 cột** (`Mã NV`, `Tên NV`, `Ngày ngừng`, `Lý do`, `Trạng thái kiểm tra`) và bấm Xác nhận hủy hàng loạt.
8. **Tab 7 — Cấu hình chi phí (`COST_CONFIGS`):**
   - **Sửa ngay query `LoadTabCostConfigs`** để lấy đầy đủ mảng `rules { id ruleCode rateType priceUnit tripPerDay minKm maxKm dayType pricingScope unitPrice monthlyKmQuota description }`.
   - Trích xuất đúng đơn giá từ mảng `rules` để hiển thị lên bảng danh sách (bổ sung cột **`Giá qua đêm (VND)`**, hiển thị đầy đủ `Giá chính`, `Hạn mức KM/tháng`, `Giá KM vượt`, `Giá OT/giờ`, `Phụ cấp điện thoại`).
   - **Nâng cấp Modal Tạo mới / Tạo phiên bản tiếp theo / Xem chi tiết (`costModal`):**
     - Khi `COMMUTE + STAFF`: Nhập `Giá thuê cơ bản tháng (BASE_MONTHLY)`, `Hạn mức KM/tháng`, `Đơn giá KM vượt (EXCESS_KM)`, `Đơn giá OT/giờ (OVERTIME_HOUR)`, `Phụ cấp điện thoại (PHONE_ALLOWANCE)`.
     - Khi `COMMUTE + WORKER`: Bảng cấu hình **`Giá theo số chuyến & khoảng cách` (`DAILY_PACKAGE`: Số chuyến/ngày 2-4-6, Từ KM, Đến KM, Giá tháng, Giá Chủ nhật/ngày, Giá Ngày lễ/ngày)** + `Đơn giá KM vượt` + `Đơn giá OT/giờ` + `Phụ cấp điện thoại`.
     - Khi `EXTRA + STAFF` / `EXTRA + WORKER`: Bảng **`Giá chuyến phát sinh` (`TRIP` theo Loại ngày / Khoảng cách KM / Phạm vi giá)** + `Giá lưu đêm (OVERNIGHT)` + `Gói Chủ nhật / Ngày lễ`.
     - Gửi đúng mã `rateType` và `priceUnit` chuẩn lên mutation `upsertCostConfig`.
   - **Nâng cấp Modal Lịch sử phiên bản (`costHistoryModal`):** Hiển thị đầy đủ các cột giá từ `rules`, bổ sung nút **`Tạo phiên bản tiếp theo`** và nút **`Xóa phiên bản tương lai`** (gọi mutation `deleteCostConfig`).

---

### 2. Màn hình Báo cáo Chi phí & Báo cáo Hồ sơ sử dụng xe (`CostReportsPage.tsx` & `cost/schema.ts`)
1. **View 1 — Hóa đơn xe (`VEHICLE_BILL`):**
   - Dropdown `Hóa đơn xe` nạp danh sách các cặp **`Biển số - Tài xế`** thực tế phát sinh trong ngày từ `dailyCosts`, tự động chọn Bill đầu tiên hoặc Bill được truyền từ khi click vào Biển số ở màn Chi phí ngày.
   - Bổ sung cột **`Giờ làm thêm` (`Overtime hours`)** và tổng giờ làm thêm ở dòng `Tổng cộng` cuối bảng.
   - Cột `Lộ trình chuyến`: bổ sung nút **`Mở rộng` / `Thu gọn`** khi lộ trình có nhiều điểm dừng.
   - Sửa nút `Xuất Excel` gọi hàm xuất file thực tế (`exportTableToCsv('hoa-don-xe')`) thay vì chỉ hiện Toast giả.
2. **View 2 — Chi phí hàng ngày (`DAILY`) & View 3 — Thanh toán hàng tháng (`MONTHLY`):**
   - **Bổ sung Nút & Drawer `Dữ liệu cần xử lý` (`Data requiring action` - `issueSummary`):**
     - Tự động kiểm tra các vấn đề dữ liệu trong ngày/tháng (chuyến chưa hoàn thành, chuyến thiếu KM thực tế, xe chưa có cấu hình giá...).
     - Khi bấm vào nút `Dữ liệu cần xử lý (N)`, mở Drawer liệt kê từng vấn đề kèm nút hành động mở nhanh `TripDetailDrawer` hoặc nhảy sang ngày/xe tương ứng để xử lý.
   - Ở View `DAILY`: Dòng tổng cuối bảng hiển thị rõ **`Tổng {vehicleCount} xe`**, tô màu phân biệt dòng phụ lục phát sinh (`isExtraSupplement`), và click vào **`Biển số`** nhảy sang đúng Bill của cặp `Biển số - Tài xế` đó ở tab `Hóa đơn xe`.
   - Ở View `MONTHLY`:
     - Hiển thị thanh Header **`Mã bảng kê thanh toán` (`payment.paymentCode`)** và **Huy hiệu trạng thái (`payment.status`)**.
     - Cho phép chọn **bất kỳ Tháng/Năm nào** (`<input type="month">`) thay vì chỉ 5 tháng cố định.
     - Kết nối bộ lọc **`Trạng thái` (`statusFilter`)** lọc thực tế theo trạng thái bảng kê (`CALCULATED`, `APPROVED`, `PAID`, `DRAFT`).
     - Với dòng `EXTRA_ROUTE` (không có `vehicleId`), hiển thị `'—'` ở 3 cột Phụ cấp điện thoại.
3. **View 4 — Báo cáo hồ sơ sử dụng xe (`ETP_REPORT`):**
   - Mỗi bảng (`Biến động theo tháng` và `Đăng ký theo tuyến`) có nút **Làm mới (`Refresh`)** và thanh phân trang riêng; bộ lọc `Năm` tự động sinh 5 năm gần nhất + `Tất cả`.

---

### 3. Màn hình Nhật ký Kiểm tra & Cấu hình chung (`AuditAndSettingsPage.tsx`)
1. **Nhật ký kiểm tra (`AUDIT`):**
   - Bổ sung đầy đủ **12 loại thực thể (`Entity Type`)** vào bộ lọc (`REQUEST`, `TRIP`, `VEHICLE`, `DRIVER`, `ROUTE`, `POINT`, `IMPORT`, `COST`, `COST_DAILY`, `COST_MONTHLY`, `COST_CONFIG`, `PLAN_VERSION`, `EMPLOYEE_TRANSPORT_PROFILE`).
   - Bộ lọc `Hoạt động` (`actionTypeFilter`) cập nhật danh sách hành động động theo loại thực thể (bao gồm cả `IMPORT`, `DEACTIVATE`, `REACTIVATE`, `LINK_EMPLOYEE`, `RECALCULATE`, `CONFIRM`, `DISPATCH`...).
   - Bổ sung lọc khoảng ngày **`Từ ngày` (`dateFrom`) — `Đến ngày` (`dateTo`)** kèm kiểm tra `dateFrom <= dateTo`.
   - Hiển thị cột `Thông tin liên quan` trích xuất thông minh từ `summaryText` / `afterState` / `beforeState` (Biển số xe, Mã chuyến, Mã đơn, Tên nhân viên...).
   - **Xây dựng `AuditDetailDrawer` (mở khi click vào bất kỳ dòng nhật ký nào):**
     - Hiển thị Tiêu đề hành động, Thời gian, Người thực hiện, Vai trò, Lý do.
     - **Bảng so sánh `Trước (Before)` vs `Sau (After)`** cho các trường thay đổi (tự động dịch tên trường sang tiếng Việt và format số KM, tiền tệ VND, ngày giờ).
     - **Accordion `Dữ liệu kỹ thuật (JSON)`** đóng/mở gọn gàng.

---

## KẾ HOẠCH TRIỂN KHAI LÀM LẠI (EXECUTION ROADMAP)

Để đảm bảo tốc độ và chất lượng tuyệt đối, việc làm lại sẽ được chia thành **4 gói công việc song song** trên `E:\trms-remake`:

1. **Gói 1 (Backend API Enhancement — `apps/api/src/modules/`):**
   - Cập nhật `dispatch-trip/schema.ts`, `request/schema.ts`, `master/schema.ts`, `etp/schema.ts`, `cost/schema.ts`, `shift/schema.ts`, `audit/schema.ts` bổ sung các trường và tham số lọc còn thiếu (`dashboardStats.activeTrips` chuẩn, `approveTransportRequest` với `mergeRequired`/`mergeNote` + đồng bộ cặp OT, `cancelTrip` đồng bộ `pairedTripId`, `completeTrip` với `tollFeeAmount` & tự tính `actualKm = endOdometerKm - startOdometerKm`, `vehicleTimelineTrips` & `vehicleTimelineTripDetail`).
2. **Gói 2 (Frontend Khối 1 — `DashboardPage.tsx`, `RequestsPage.tsx`, `DispatchPage.tsx`):**
   - Làm lại toàn bộ Dashboard, Điều hành yêu cầu xe, Hàng chờ phê duyệt (Import Excel, Edit/Resubmit/GA Edit, Approve & Merge, Bulk Taxi, Modal xác nhận, Drawer 5 khối với Audit Timeline thật), Quản lý điều phối (TripAttachModal, RequestDispatchModal 5 khối có xe ngoài/xung đột/deadhead, CommuteDispatchDrawer 4 luồng thao tác lượt chạy, và Tab 3 `Kế hoạch ngoài tuyến`).
3. **Gói 3 (Frontend Khối 2 — `TripsAndVehicleOpsPage.tsx`, `DriverPage.tsx`, `ShiftsPage.tsx`):**
   - Làm lại Theo dõi chuyến đi (11 cột, 8 loại chuyến + bộ lọc động, `TripDetailDrawer` 8 khối + `Edit actuals` + `Reassign`, Modal 5 bước `CompletedTripFormModal`), Điều hành xe (bỏ `fixedRouteOverlay`, thêm lọc Tuyến, dựng `VehicleDetailDrawer` có timeline tabs), Xác nhận tài xế (`DriverStepPanel` dạng Card cho 3 bước + Modal nhập công-tơ-mét/số khách/phí cầu đường + `DriverTripDetailDrawer`), và Dữ liệu ca làm (bỏ sinh ca giả, lọc phòng ban từ `orgUnits`, nâng cấp `WorkShiftListModal`).
4. **Gói 4 (Frontend Khối 3 — `MasterDataPage.tsx`, `CostReportsPage.tsx`, `AuditAndSettingsPage.tsx`):**
   - Làm lại 7 tab Dữ liệu gốc (khóa/mở trường chuẩn, nút Bật/tắt hoạt động, cấu hình 8 trường mỗi chặng trong Modal Tuyến xe, luồng Nhân viên tạm & Gán mã NV, 2 Modal Import/Hủy Import Excel ETP có Preview, bảng & Modal Cấu hình chi phí đọc/ghi đầy đủ `rules` + xóa phiên bản tương lai), 4 view Báo cáo chi phí (Bill theo cặp Biển số - Tài xế, mở rộng lộ trình, Drawer `Dữ liệu cần xử lý`, Header bảng kê tháng, chọn tháng bất kỳ), và `AuditDetailDrawer` có so sánh Before/After.
