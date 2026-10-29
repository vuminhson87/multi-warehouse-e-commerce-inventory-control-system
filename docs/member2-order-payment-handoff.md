# Member 2 — Order & Payment Handoff

## Phạm vi
UC04 (Đặt hàng, giữ kho nguyên tử, thanh toán giả lập, thử lại thanh toán), UC09 (Theo dõi & chi tiết đơn hàng), UC10 (Lịch sử mua hàng & phân trang/lọc), UC11 (Hủy đơn hàng và giải phóng/hoàn trả tồn kho).

## Chạy môi trường
- Docker Desktop + `backend/docker-compose.yml` (`mw-postgres`, `mw-redis` ở trạng thái healthy)
- `backend/.env` (bí mật, không commit), root `.env.local` (`VITE_API_URL=http://127.0.0.1:3001`, không commit)
- `npm.cmd run dev`: backend chạy tại cổng `3001`, frontend Vite chạy tại cổng `5173`

## API đã tích hợp
- `POST /api/orders`
- `POST /api/orders/:orderId/payments`
- `GET /api/orders?page=&limit=&status=`
- `GET /api/orders/:orderId`
- `POST /api/orders/:orderId/cancel`

## Các file đã thay đổi
- `backend/src/modules/order/order.routes.js`: Sửa lỗi cú pháp `} catch (error) {S` ở nhánh xử lý hủy đơn.
- `backend/src/modules/order/order.query.service.js`: Đồng bộ DTO cho danh sách và chi tiết đơn hàng (`fulfillmentWarehouseName`, `customerUsername`, `hasActiveReservation`, `canPay`, `canCancel`, `paymentInProgress`, `payments`, `items`), luôn lọc theo `customerId` từ JWT.
- `.env.local` (root): Chuyển cấu hình `VITE_API_URL=http://127.0.0.1:3001` về thư mục gốc repo (xóa `src/.env.local`).
- `src/services/apiClient.js`: Bổ sung phân biệt lỗi mạng (`NETWORK_ERROR`, `isNetworkError`) và lỗi HTTP/API (`status`, `code`, `details`), không in token ra log.
- `src/services/orderApi.js`: Chuẩn hóa hàm gọi API `createOrderApi`, `payOrderApi`, `getOrdersApi` (hỗ trợ `page`, `limit`, `status`), `getOrderDetailApi`, `cancelOrderApi`.
- `src/services/orderAdapter.js`: Tạo mới bộ chuyển đổi DTO từ Backend sang cấu trúc dữ liệu hiển thị của UI (`id`, `fulfillmentWarehouseName`, `reservationActive`, `paymentAttempts`, `items[].productNameSnapshot`).
- `src/services/requestKeys.js`: Tạo mới quản lý `idempotencyKey` theo `sessionStorage` và fingerprint giỏ hàng để chống gửi trùng khi retry.
- `src/hooks/useCustomerOrder.js`: Tạo mới hook tải chi tiết đơn hàng từ PostgreSQL kèm trạng thái `loading`, `error`, `reload` và tự làm sạch khi đổi phiên/người dùng.
- `src/hooks/useCustomerOrders.js`: Tạo mới hook tải danh sách lịch sử đơn hàng có lọc trạng thái và phân trang server-side.
- `src/constants/order.js`: Bổ sung nhãn hiển thị `PENDING: 'Đang xử lý/đối soát'` trong `PAYMENT_RESULT_LABELS`.
- `src/pages/CheckoutPage.jsx`: Tích hợp `acquireCheckoutKey`/`clearCheckoutKey`, điều hướng sang `/order-result/:orderId`, cập nhật nhãn tạm tính/dự kiến kho và giữ giỏ hàng khi API trả lỗi.
- `src/pages/OrderResultPage.jsx`: Đọc đơn hàng từ PostgreSQL qua `useCustomerOrder` (hỗ trợ cả URL param `:orderId` khi F5 và `location.state`), gọi `payOrderApi` cho `SUCCESS`/`FAILED`/`INCOMPLETE`, khóa nút khi đang xử lý hoặc cần đối soát (`paymentInProgress`/`needsReconciliation`).
- `src/pages/OrderTrackingPage.jsx`: Đọc chi tiết đơn hàng thật từ API, tích hợp thanh toán lại (`payOrderApi`) và hủy đơn (`cancelOrderApi`) với khóa an toàn khi đối soát.
- `src/pages/PurchaseHistoryPage.jsx`: Lấy danh sách đơn hàng từ DB qua `useCustomerOrders`, lọc trạng thái và phân trang server-side, hủy đơn qua `cancelOrderApi`.
- `src/App.jsx`: Thêm route `/order-result/:orderId` và gỡ `<OrderProvider>` khỏi cây ứng dụng để ngắt hoàn toàn luồng ghi/đọc đơn hàng vào `localStorage` (`multi_warehouse_orders_v1`), giữ nguyên file `OrderProvider.jsx`/`OrderContext.js` để tránh xung đột nhánh.
- `src/context/AuthContext.jsx`: Giữ phiên khi gặp lỗi mạng tạm thời, chỉ xóa phiên khi token không hợp lệ (`401`/`403`), chờ `authLoading` trước khi điều hướng.
- `src/pages/ShoppingCartPage.jsx` & `src/context/CartContext.jsx`: Cập nhật thông báo dự kiến kho/tạm tính, không chặn cứng nút chuyển sang trang Checkout bởi dữ liệu tồn kho mock local.

## Bằng chứng kiểm thử
- **Ngày thực thi:** 29/10/2026
- **Kiểm tra dịch vụ hạ tầng:**
  - `docker compose -f backend/docker-compose.yml ps`: `mw-postgres` (healthy), `mw-redis` (healthy).
  - `curl.exe -i http://127.0.0.1:3001/api/health`: `HTTP/1.1 200 OK` (`{"success":true,"message":"Backend đang hoạt động.","services":{"api":"ok","database":"ok"}}`).
- **Backend Automated Tests (`cd backend && npm.cmd test`):**
  - Kết quả: **7/7 test files passed, 73/73 tests passed** (`inventory.policy.test.js`, `seed-data.test.js`, `foundation.test.js`, `order.validator.test.js`, `order-api.test.js`, `order-write.test.js`, `m3-storage.test.js`).
- **Frontend Build & Lint:**
  - `npm.cmd run build`: Pass (`vite build` thành công, bundle output tại `dist/`).
  - `npx.cmd eslint src`: Pass (**0 errors, 0 warnings** trên toàn bộ thư mục `src/`). Lưu ý: lệnh `npm.cmd run lint` gốc ở root quét cả thư mục `backend/` với cấu hình `globals.browser` nên báo `process is not defined` trên các file Node.js nền có sẵn của `backend/`.
- **Kiểm thử tích hợp End-to-End & Đối chiếu PostgreSQL:**
  - Đã thực thi và xác nhận các kịch bản E01–E20: đăng nhập (`customer`), xác thực `/api/auth/me`, tạo đơn mới + chống tạo trùng bằng `idempotencyKey`, đọc chi tiết đơn + ánh xạ qua `adaptOrder`, thanh toán `FAILED` (giải phóng reservation, giữ `PendingPayment`), retry thanh toán `SUCCESS` (giữ lại kho, chuyển `Paid`, reservation `CONSUMED`), kiểm tra quyền sở hữu chéo với `customer2` (nhận `404 ORDER_NOT_FOUND`), hủy đơn `Paid` (`inventoryAction: RESTORED`), thanh toán `INCOMPLETE`, hủy đơn `PendingPayment` (`RELEASED`), phân trang & lọc danh sách đơn hàng.
  - Đã đối chiếu trực tiếp trên PostgreSQL qua `psql` với các bảng `orders`, `payment_attempts`, `stock_reservations`.

## Chưa hoàn thành / phụ thuộc nhóm
- **Product & Inventory UI (Member 1 / Member 3):** `ProductContext.jsx` và `InventoryProvider.jsx` trên frontend hiện vẫn đọc từ dữ liệu mock/`localStorage` cho đến khi tích hợp API đọc danh mục/tồn kho thực tế. Các thao tác đặt hàng, thanh toán và hủy đơn của Member 2 đã hoàn toàn lấy dữ liệu chuẩn từ PostgreSQL và không tự cộng/trừ tồn kho trên React state.
- **Kiểm thử tải cao & đối soát chuyên sâu (Member 4 / Tester):** Các bài test concurrency 30 VUs (k6), rollback khi lỗi DB giữa chừng và đối soát giao dịch `PENDING`/`REQUEST_OUTCOME_UNKNOWN` cần Tester phối hợp kiểm thử sâu.
- **Mock Gateway:** Chỉ phục vụ mô phỏng kịch bản `SUCCESS` / `FAILED` / `INCOMPLETE` khi `DEMO_MODE=true`, không kết nối cổng thanh toán tiền thật.

## Hướng dẫn demo
1. Khởi động Docker (`mw-postgres`, `mw-redis`), chạy backend (`cd backend && npm.cmd run dev`) và frontend (`npm.cmd run dev`).
2. Mở trình duyệt tại `http://localhost:5173`, đăng nhập bằng tài khoản khách hàng demo (`customer`).
3. Duyệt danh mục sản phẩm (`/products`), thêm sản phẩm còn hàng vào giỏ (`/cart`) và chuyển sang `/checkout`.
4. Nhấn **Xác nhận đặt hàng** → hệ thống gọi `POST /api/orders` và chuyển sang `/order-result/:orderId` (F5 vẫn giữ nguyên thông tin đơn từ PostgreSQL).
5. Thử các nút giả lập thanh toán (**Thành công**, **Thất bại**, **Không hoàn tất**) → quan sát trạng thái đơn hàng, trạng thái giữ hàng và bảng lịch sử giao dịch cập nhật từ DB.
6. Mở **Lịch sử mua hàng** (`/orders`), thử bộ lọc trạng thái, chuyển trang, bấm **Xem chi tiết & Theo dõi** (`/orders/:orderId`) và thực hiện **Hủy đơn hàng** (trên đơn `PendingPayment` hoặc `Paid`).
