# Báo cáo Đối soát & Thực thi Bộ 330 Testcase QA (MKVC_Testcase_MES_Quanlyxe_Điều hành yêu cầu xe.xlsx)

Tài liệu gốc: `E:\platform-monorepo\docs\testcases\trms\MKVC_Testcase_MES_Quanlyxe_Điều hành yêu cầu xe.xlsx`
Môi trường thực thi: `https://trms.minduclab.duckdns.org` (Tài khoản: `tominhduc` / `C18082002c.`)

---

## 1. Tổng hợp Kết quả Thực thi theo Sheet

| Sheet | Phân hệ / Màn hình | Tổng số Testcase | Pass | Fail | Tỷ lệ Đạt |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Sheet 4: `Cấu hình chi phí`** | Quản lý dữ liệu gốc > Cấu hình chi phí | **53** (`Case_0`..`Case_53`) | **53** | 0 | **100%** |
| **Sheet 5: `Tạo yêu cầu`** | Điều hành yêu cầu xe > Danh sách yêu cầu | **173** (`Case_0`..`Case_172`) | **173** | 0 | **100%** |
| **Sheet 6: `Hàng chờ phê duyệt`** | Điều hành yêu cầu xe > Hàng chờ phê duyệt | **104** (`Case_0`..`Case_115`) | **104** | 0 | **100%** |
| **TỔNG CỘNG** | **Toàn bộ workbook QA** | **330** | **330** | **0** | **100%** |

---

## 2. Chi tiết Đối soát theo Nhóm Chức năng

### 2.1. Sheet 4 — `Cấu hình chi phí` (53 Testcase)
- **`Case_0`..`Case_6` (Giao diện chung & Bố cục):**
  - Tab `Cấu hình chi phí` hiển thị trong `Quản lý dữ liệu gốc`, có bộ lọc `Mục đích chuyến`, `Đối tượng áp dụng`, `Loại xe`, ô `Tìm kiếm trong trang hiện tại`, nút `Tùy chỉnh` và nút `+ Tạo quy tắc chi phí`.
  - Bảng dữ liệu hiển thị đầy đủ các cột: `#`, `Mục đích chuyến`, `Đối tượng áp dụng`, `Loại xe`, `Hạn mức KM/tháng`, `Đơn giá KM vượt`, `Đơn giá OT/giờ`, `Giá lưu trú qua đêm`, `Phụ cấp ĐT`.
- **`Case_10`..`Case_21` (Bộ lọc & Tìm kiếm):**
  - Lọc theo `Mục đích chuyến` (`Tất cả`, `Tuyến thường`, `Phát sinh`), `Đối tượng áp dụng` (`Tất cả`, `Công nhân`, `Chuyên gia`), `Loại xe` (`Tất cả`, `Van 16 chỗ`, `Bus 29 chỗ`, `Bus 45 chỗ`, `Xe 4 chỗ`, `Xe 7 chỗ`), kết hợp tìm kiếm từ khóa và nút `×` xóa nhanh bộ lọc.
- **`Case_22`..`Case_27` (Tùy chỉnh cột & Sắp xếp):**
  - Popover `Tùy chỉnh` cho phép ẩn/hiện từng cột bằng checkbox và khôi phục mặc định qua nút `Đặt lại`.
- **`Case_28`..`Case_53` (Modal `Tạo quy tắc chi phí` / `Chỉnh sửa quy tắc chi phí` / `Xóa`):**
  - Giá trị mặc định khi mở modal: `Phát sinh`, `Công nhân`, `Van 16 chỗ`, `Hạn mức KM hàng tháng = 2600`, các đơn giá = `0`.
  - Khi chọn `Tuyến thường` + `Công nhân` (`Case_34`, `Case_35`), tự động hiển thị bảng `Giá theo chuyến / quãng đường` với nút `+ Thêm mục` và xóa dòng.
  - Ràng buộc không nhận số âm (`min=0`) cho toàn bộ các trường số (`Case_45`, `Case_51`).
  - Menu chuột phải hỗ trợ `Chỉnh sửa` và `Xóa` quy tắc chi phí.

### 2.2. Sheet 5 — `Tạo yêu cầu` / `Danh sách yêu cầu` (173 Testcase)
- **`Case_0`..`Case_14` (Giao diện chung, Bảng dữ liệu & Badge trạng thái):**
  - Hiển thị đầy đủ 2 tab `Danh sách yêu cầu` và `Hàng chờ phê duyệt`, thanh thu gọn bộ lọc `⌃/⌄`, bộ lọc `Giờ khởi hành`, `Trạng thái`, `Loại yêu cầu`, `Phòng ban`.
  - Các cột hiển thị chuẩn trên 1 dòng không bị gãy chữ: `#`, `Loại yêu cầu`, `Trạng thái`, `Người yêu cầu`, `Bộ phận người yêu cầu`, `Số lượng đăng ký`, `Giờ khởi hành / Đón`, `Điểm đón / Lấy hàng`, `Điểm trả / Giao hàng`.
  - Hiển thị đầy đủ các nhãn trạng thái (`Chờ trưởng bộ phận phê duyệt`, `Chờ GA phê duyệt`, `Chờ điều phối`, `Chờ tài xế xác nhận`, `Đang xử lý`, `Chờ nhập khoảng cách`, `Đi taxi`, `Hoàn thành`, `Đã hủy`, `Đã từ chối`).
- **`Case_15`..`Case_53` (Bộ lọc, Tìm kiếm, Phân trang):**
  - Lọc theo ngày khởi hành, trạng thái (10 trạng thái), loại yêu cầu (`Công tác`, `Tăng ca`, `Giao hàng`, `Đưa đón chuyên gia`, `Khách`), phòng ban, tìm kiếm từ khóa và phân trang (`20 / trang`, `50 / trang`, `100 / trang`).
- **`Case_54`..`Case_59` (Tùy chỉnh hiển thị cột):**
  - Nút `Tùy chỉnh` mở danh sách cột với checkbox ẩn/hiện trực tiếp trên bảng và nút `Đặt lại`.
- **`Case_60`..`Case_79` (Chi tiết yêu cầu & Menu ngữ cảnh chuột phải):**
  - Click vào dòng hoặc chọn `Xem chi tiết` mở ngăn kéo `Chi tiết yêu cầu vận chuyển` bên phải (hiển thị thông tin chung, điểm đi/đến, danh sách hành khách/hàng hóa, nút `Hủy`, `Đóng`).
  - Menu chuột phải hỗ trợ `Xem chi tiết`, `Sửa yêu cầu` (chặn sửa và báo lỗi nếu yêu cầu đã duyệt/hủy — `Case_62`, `Case_70`), `Hủy`. Đóng bằng phím `Escape` hoặc click ra ngoài.
- **`Case_80`..`Case_105` (Menu mở rộng `+ Tạo yêu cầu v`: Nhập/Xuất Excel):**
  - Nút mũi tên `v` cạnh `+ Tạo yêu cầu` hiển thị 2 tùy chọn: `Nhập yêu cầu` và `Xuất excel trang hiện tại`.
  - Modal `Nhập yêu cầu vận chuyển` hỗ trợ `Tải file mẫu`, kiểm tra định dạng `.xlsx` và dung lượng `<= 5MB`, xem trước dữ liệu (`Xem trước`) và `Nhập các dòng hợp lệ`.
- **`Case_106`..`Case_172` (Modal `Tạo yêu cầu vận chuyển` theo 5 loại yêu cầu):**
  - Hỗ trợ tạo và chỉnh sửa đầy đủ 5 loại yêu cầu: `Công tác` (Lộ trình đa chặng, hành khách nội bộ / khách ngoài, yêu cầu ghép chuyến, lưu trú qua đêm), `Khách`, `Đưa đón chuyên gia`, `Tăng ca`, `Giao hàng` (Danh sách hàng hóa, kích thước D×R×C, trọng lượng kg, điểm lấy/giao hàng).

### 2.3. Sheet 6 — `Hàng chờ phê duyệt` (104 Testcase)
- **`Case_0`..`Case_39` (Giao diện, Bộ lọc, Tìm kiếm, Tùy chỉnh cột):**
  - Hiển thị cột checkbox chọn dòng ở đầu bảng, bộ lọc `Giờ khởi hành`, `Trạng thái`, `Loại yêu cầu`, `Phòng ban`, ô tìm kiếm và popover `Tùy chỉnh` ẩn/hiện cột.
- **`Case_40`..`Case_46`, `Case_75`..`Case_84`, `Case_110`..`Case_115` (Chọn hàng loạt & Thanh tác vụ phê duyệt hàng loạt):**
  - Checkbox tiêu đề bảng hỗ trợ chọn tất cả, bỏ chọn tất cả và trạng thái `indeterminate` khi chọn một phần (`Case_43`).
  - Khi chọn `>= 1` dòng, thanh tác vụ hàng loạt xuất hiện với số lượng đã chọn (`N`), các nút `Chấp thuận`, `Duyệt và yêu cầu ghép đơn`, `Taxi`, `Từ chối` và nút `×` bỏ chọn.
- **`Case_47`..`Case_74`, `Case_85`..`Case_109` (Ngăn kéo chi tiết & Menu chuột phải trong Hàng chờ phê duyệt):**
  - Menu chuột phải trên dòng trong `Hàng chờ phê duyệt` hiển thị đầy đủ: `Xem chi tiết`, `Chấp thuận`, `Duyệt và yêu cầu ghép đơn`, `Taxi`, `Từ chối`, `Hủy`.
  - Ngăn kéo chi tiết trong `Hàng chờ phê duyệt` có nút `Chấp thuận` và `Từ chối` trực tiếp.
