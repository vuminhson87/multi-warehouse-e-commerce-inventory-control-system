# M4 – Phạm Đức Thiện: triển khai và bằng chứng kiểm thử

Ngày chạy: 29/10/2026. Phạm vi theo tài liệu bàn giao: unit/integration/load, P95, nghiệp vụ, phân quyền, responsiveness và độ ổn định.

## Kết quả thực chạy
- 73 unit test đạt (6 file; bao gồm payment-ownership.test.js và storage.test.js hiện tại).
- 15 acceptance test mới chạy trực tiếp PostgreSQL và HTTP đạt.
- 11 integration test cũ chạy qua backend riêng cổng 3301 đạt. Runner tạo dữ liệu trước khi chạy, không phụ thuộc thứ tự hai suite.
- Load: 30 customer khác nhau, 120 sản phẩm, 3 kho, stock giới hạn 10. Tạo đúng 10 đơn, 20 yêu cầu bị từ chối hợp lệ; thanh toán 10 đơn rồi onHand=0, reserved=0, không có vi phạm đối soát reservation.
- P95 HTTP reservation của lần chạy hoàn chỉnh: 2924 ms, dưới 5000 ms. Chỉ đo POST tạo đơn, không tính mock payment. Đây là burst 30 request, chưa phải bằng chứng tải duy trì dài hạn.
- Chrome 156.0.8078.48 và Edge 156.0.4314.50: giỏ hàng thêm/tăng/giảm/tổng tiền/lưu sau reload/xóa đạt. Catalog/detail/cart/login tại 375px không tràn ngang, không có pageerror. Chỉ xác minh phiên bản cài sẵn; chưa xác minh hai phiên bản mới nhất của từng browser.
- Backup database test và restore sang multi_warehouse_m4_restore: fingerprint sản phẩm/đơn/tồn kho/reservation/payment trùng khớp. Không restore vào database demo.
- Build giao diện đã đạt trước đợt này; kiểm tra lại lint và unit sau bổ sung công cụ.
- Soak 8 giờ đã bắt đầu lúc khoảng 21:42 ngày 29/10/2026 (giờ Việt Nam), đang chạy. Chưa đánh dấu đạt; cần giữ máy, Docker và backend hoạt động. Báo cáo cập nhật mỗi 30 giây, không có maintenance exclusion. Tỷ lệ probe thành công là phép ước lượng độ sẵn sàng, không phải phép đo uptime liên tục.

## Test mới trên DB thật
T03 không split giỏ qua hai kho; T04 reserve trước payment và giá từ DB; T05/T19 payment replay không double consume, cancel replay không double restore; T06 FAILED/INCOMPLETE release rồi retry; T07 retry khi hàng đã bị giữ hết; T13 HTTP 401/403/404 và role lấy từ DB; T14 cancel pending; T16 từ chối cancel Processing/Completed/Cancelled; T17 snapshot lịch sử khi đổi tên/giá/ngừng bán; T18 rollback reserve và rollback cancel khi trigger DB cố ý gây lỗi; T12 cảnh báo tại ngưỡng và resolve sau restock; T08/T21 tải đồng thời và đối soát DB.

## Chạy lại
Tại backend, bật PostgreSQL bằng Docker. Tạo DB một lần nếu chưa có:

```powershell
docker exec mw-postgres createdb -U mw_user multi_warehouse_m4_test
$env:DATABASE_URL='postgresql://mw_user:mw_password@localhost:5432/multi_warehouse_m4_test?schema=public&connection_limit=40'
npm.cmd run db:deploy
Remove-Item Env:DATABASE_URL
```

Các lệnh độc lập; không chạy hai bộ M4 DB đồng thời vì chúng reset cùng database test:

```powershell
npm.cmd test -- --run tests/unit
npm.cmd run test:acceptance
npm.cmd run test:api
npm.cmd run test:restore
```

- test:acceptance reset database multi_warehouse_m4_test, tạo fixture, mở HTTP server cổng tự chọn và đóng sau khi xong.
- test:api reset chính database test đó, seed, tạo đơn mẫu, chạy server cổng 3301 và đóng sau khi xong. Nếu cổng bị chiếm cần giải phóng trước.
- test:restore cần docker trong PATH; chỉ đọc database M4, restore database multi_warehouse_m4_restore.
- test browser: bật frontend ở http://127.0.0.1:5173 tại cửa sổ khác, chạy `npm.cmd run test:browser`. Cần Chrome và Edge đã cài. Test mở browser profile riêng, không sửa giỏ thật của người dùng.
- soak: giữ backend ở localhost:3001, chạy `npm.cmd run test:soak` (mặc định 28800 giây); có thể chọn SOAK_API_URL, SOAK_DURATION_SECONDS, SOAK_INTERVAL_SECONDS. Lần chạy ngắn không được tính đạt tiêu chí 8 giờ.
- UI load: `npm.cmd run test:ui:load` dùng 30 phiên Chrome và 120 sản phẩm thử; đây là bài nặng, nên chạy riêng khi không chạy build/lint song song. Ghi latest-ui-load-result.json và trả lỗi nếu vượt ngưỡng. Không thay thế P95 API catalog còn thiếu.
- Các kết quả JSON/ảnh/SQL nằm ở backend/tests/reports. Snapshot backup chỉ phục vụ dữ liệu thử.

## Chưa thể nghiệm thu vì thiếu phần chức năng/môi trường
- T09/T10/T11: API inventory, restock, threshold, alerts chưa được mount trong app.js. Test repository không thay thế test quyền Manager ở server; chưa kết luận warehouse scope đạt.
- T01/T17: frontend catalog/admin còn dùng local data/localStorage; API catalog/admin chưa mount. Test snapshot DB đạt nhưng chưa nghiệm thu luồng admin discontinue qua HTTP.
- P95 UI với 30 phiên Chrome/120 sản phẩm localStorage: tìm kiếm 3010 ms (CHƯA ĐẠT 3000 ms), cập nhật giỏ 966 ms (ĐẠT 2000 ms). Bài tải bị dừng sau khi đã ghi báo cáo vì làm máy chậm; chưa có lần chạy thoát sạch hoàn chỉnh. Kết quả bao gồm độ trễ tự động hóa trên máy local, không phải hiệu năng API catalog hoặc toàn bộ thao tác thêm/xóa giỏ. Cần đo lại trên môi trường kiểm thử ổn định trước nghiệm thu.
- Soak còn đang chạy; phiên bản trình duyệt thứ hai chưa được cài/kiểm tra.
- TLS/triển khai production chưa kiểm thử trên localhost.

Không thay đổi nghiệp vụ để làm test xanh; không tính test mock là bằng chứng transaction/concurrency PostgreSQL. Các thay đổi chưa commit/push.
