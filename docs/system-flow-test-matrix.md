# Ma trận kiểm thử luồng hệ thống

Phạm vi đếm: **17 nhóm luồng nghiệp vụ end-to-end** của giao diện customer, admin và warehouse manager. Một nhóm có thể đi qua nhiều trang/API. Bộ này không tính riêng từng endpoint hoặc thao tác CRUD thành một luồng mới. Các luồng vận hành như backup/restore và tải đồng thời được ghi riêng ở cuối.

## 17 luồng nghiệp vụ

| # | Luồng | Kiểm tra hiện có / mở rộng | Tình huống lỗi, ranh giới hoặc kịch bản xấu |
|---|---|---|---|
| 1 | Đăng ký customer | Unit đăng ký backend/frontend và E2E qua form | Mật khẩu xác nhận sai không gửi API; tên đăng nhập trùng; đăng ký thành công tạo đúng role CUSTOMER; ID sequence sau fixture |
| 2 | Đăng nhập và phân quyền | Unit/API acceptance và E2E login | Mật khẩu sai; token/user giả trong storage; endpoint không đăng nhập hoặc sai role; kho của manager bị giới hạn |
| 3 | Danh mục, tìm kiếm, chi tiết và tồn khả dụng | E2E trình duyệt + acceptance API | Không có kết quả tìm kiếm; sản phẩm ngừng bán; localStorage giả; tải API lỗi; tồn thay đổi sau khi mở trang |
| 4 | Wishlist | E2E toggle và reload | Bật/tắt rồi tải lại giữ trạng thái. Wishlist hiện là localStorage; chưa phải dữ liệu đồng bộ backend hoặc tách tài khoản phía server. |
| 5 | Giỏ hàng | E2E thêm, xóa món cuối, đổi số lượng | Giỏ rỗng; tồn backend giảm dưới số lượng trong giỏ; cart không được phép vượt lượng khả dụng |
| 6 | Checkout và tạo đơn | E2E UI + PostgreSQL/HTTP acceptance | Tồn đổi giữa lúc xem và đặt; không đủ một kho thì không tạo đơn/không giữ một phần; giá lấy từ server; request lặp/idempotency; lỗi DB rollback |
| 7 | Thanh toán giả lập | E2E SUCCESS, FAILED, INCOMPLETE và retry; acceptance replay | FAILED/INCOMPLETE giải phóng giữ hàng; retry giữ lại; retry sau khi kho đã hết bị từ chối; callback lặp không trừ kho lần hai |
| 8 | Theo dõi chi tiết đơn | E2E theo dõi và kiểm tra snapshot | Khách khác không xem được đơn; thông tin sản phẩm/giá cũ vẫn giữ dù catalog đổi tên, giá hoặc ngừng bán |
| 9 | Lịch sử mua hàng | E2E lọc đơn Completed và mở chi tiết | Bộ lọc trạng thái; đơn thuộc người khác không lộ; đơn rỗng/không tìm thấy |
| 10 | Khách hủy đơn | E2E dismiss/accept xác nhận; acceptance pending/paid/replay | Đóng xác nhận không đổi dữ liệu; Pending giải phóng reservation; Paid hoàn kho đúng một lần; Processing/Completed/Cancelled không thể hủy |
| 11 | Khách xác nhận đã nhận hàng | E2E Processing → Completed; unit backend | Chỉ chủ đơn được xác nhận; trạng thái không hợp lệ hoặc xác nhận lặp; nút hủy bị khóa khi Processing |
| 12 | Dashboard admin | E2E tải từ API, lỗi rồi thử lại | API lỗi không hiện KPI giả/không đồng bộ một phần; thử lại nạp số liệu thật; role khác không truy cập |
| 13 | Quản lý sản phẩm admin | E2E thêm/sửa/ngừng bán/kích hoạt; API acceptance | Giá/tên/danh mục không hợp lệ; sản phẩm ngừng bán không xuất hiện trong danh mục; kích hoạt lại không tự đổi tồn; inventory mới có đủ dòng cho mọi kho |
| 14 | Paid → Processing phía admin | E2E danh sách Paid/Processing; unit + API | Chỉ đơn Paid được chuyển; chuyển lặp hoặc sai trạng thái bị từ chối; tồn kho không đổi ở bước này |
| 15 | Dashboard tồn kho admin | E2E API lỗi/thử lại, KPI, lọc kho và màn hình nhỏ | Không hiện số 0 giả; lọc theo kho; dữ liệu tải lỗi; không tràn ngang ở 375px |
| 16 | Xem tồn kho theo kho | E2E quyền admin/manager, lọc kho và tồn backend | Manager chỉ thao tác kho được gán; admin có thể xem nhưng không nhập hàng; API lỗi không làm tồn giả |
| 17 | Nhập hàng và cảnh báo/ngưỡng tồn | E2E nhập hàng, API lỗi/thử lại và đổi ngưỡng; acceptance equality/restock | Số lượng 0 bị chặn; manager nhập kho khác bị từ chối; ngưỡng âm không cập nhật; lỗi lưu giữ giá trị nhập; cảnh báo mở đúng tại ngưỡng và được xử lý sau nhập hàng |

## Tệp kiểm thử chính

- `backend/scripts/test-catalog-inventory-ui.js`: luồng E2E với PostgreSQL riêng và giao diện thật; tập trung vào catalog, tài khoản, cart/checkout/payment, các màn tồn kho, dashboard admin, quản lý sản phẩm và vòng đời đơn.
- `backend/scripts/test-customer-order-confirmation-ui.js`: test giao diện nút xác nhận nhận hàng với API giả lập.
- `backend/tests/acceptance/acceptance.test.js`, `catalog-inventory.test.js`, `payment-reconciliation.test.js`: API, PostgreSQL transactions, phân quyền, tồn, payment replay, cancellation và concurrency.
- `backend/tests/unit/`: chính sách tồn, validation, đăng ký, payment/processing/receipt và dữ liệu dashboard.

## Luồng kiểm thử vận hành ngoài 17 luồng nghiệp vụ

Repository còn có test backup/restore (`test:restore`), test tải/soak (`test:load:k6`, `test:soak`, `test:ui:load`) và kiểm thử API acceptance. Chúng đánh giá độ bền/vận hành, không phải luồng người dùng độc lập.

## Cách chạy

Tại thư mục `backend`:

```powershell
npm.cmd test
npm.cmd run test:data:ui
npm.cmd run test:ui:order-confirmation
npm.cmd run test:acceptance
```

`test:data:ui` chỉ chạy khi PostgreSQL có database riêng `multi_warehouse_m4_test`; script từ chối URL database khác và tạo hai cổng ngẫu nhiên cho backend/frontend để không vô tình dùng server dev đang chạy.

## Kết quả xác minh hiện tại

- Unit: 14 file, 108 test đạt.
- Acceptance PostgreSQL/HTTP: 3 file, 33 test đạt.
- E2E xác nhận nhận hàng: 4 tình huống đạt.
- E2E tổng hợp: 29 kịch bản nghiệp vụ và responsive ở viewport 375px đạt sau khi clip phần tràn ngang do `.atelier-side-drawer` đang ẩn ngoài màn hình. Test còn mở ngăn kéo wishlist để kiểm tra nó vẫn hoạt động sau thay đổi. Ảnh và kết quả chạy nằm trong `backend/tests/reports/api-ui-chrome-catalog-375.png` và `backend/tests/reports/catalog-inventory-ui-chrome.json`.

Lần chạy trước khi sửa đã ghi nhận `scrollWidth` 412px trên viewport 375px. Lỗi được sửa ở `src/index.css` bằng `overflow-x: clip` trên `html`, sau đó toàn bộ kịch bản tổng hợp chạy lại đạt.
