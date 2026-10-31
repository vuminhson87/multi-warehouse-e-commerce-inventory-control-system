import {
  BrowserRouter,
  Routes,
  Route,
} from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import ProductCatalogPage from './pages/ProductCatalogPage'
import InventoryDashboardPage from './pages/InventoryDashboardPage'
import ProductManagementPage from './pages/ProductManagementPage'
import NotFoundPage from './pages/NotFoundPage'
import ProductDetailPage from './pages/ProductDetailPage'
import ShoppingCartPage from './pages/ShoppingCartPage'
import CheckoutPage from './pages/CheckoutPage'
import OrderResultPage from './pages/OrderResultPage'
import OrderTrackingPage from './pages/OrderTrackingPage'
import PurchaseHistoryPage from './pages/PurchaseHistoryPage'
import WarehouseInventoryPage from './pages/WarehouseInventoryPage'
import LowStockAlertsPage from './pages/LowStockAlertsPage'
import AddProductPage from './pages/AddProductPage'
import EditProductPage from './pages/EditProductPage'
import DiscontinueProductPage from './pages/DiscontinueProductPage'
import { CartProvider } from './context/CartContext'
import { AuthProvider } from './context/AuthContext'
import './App.css'
import { ProductProvider } from './context/ProductContext'
import InventoryProvider from './context/InventoryProvider'
import { WishlistProvider } from './context/WishlistContext'
import HomePage from './pages/HomePage'
import CustomerLayout from './layouts/CustomerLayout'
import AdminLayout from './layouts/AdminLayout'
import WarehouseLayout from './layouts/WarehouseLayout'

function App() {
  return (
    <AuthProvider>
      <ProductProvider>
        <InventoryProvider>
          <CartProvider>
            <WishlistProvider>
              <BrowserRouter>
                <Routes>
                  <Route element={<CustomerLayout />}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/products" element={<ProductCatalogPage />} />
                    <Route path="/products/:productId" element={<ProductDetailPage />} />
                    <Route path="/cart" element={<ShoppingCartPage />} />
                    <Route path="/checkout" element={<CheckoutPage />} />
                    <Route path="/order-result" element={<OrderResultPage />} />
                    <Route path="/order-result/:orderId" element={<OrderResultPage />} />
                    <Route path="/orders" element={<PurchaseHistoryPage />} />
                    <Route path="/orders/:orderId" element={<OrderTrackingPage />} />
                  </Route>

                  <Route path="/login" element={<LoginPage />} />

                  {/* Warehouse */}
                  <Route element={<WarehouseLayout />}>
                    <Route
                      path="/inventory"
                      element={<InventoryDashboardPage />}
                    />
                    <Route
                      path="/inventory/warehouses"
                      element={<WarehouseInventoryPage />}
                    />
                    <Route
                      path="/inventory/alerts"
                      element={<LowStockAlertsPage />}
                    />
                  </Route>

                  {/* Admin */}
                  <Route element={<AdminLayout />}>
                    <Route
                      path="/admin/products"
                      element={<ProductManagementPage />}
                    />
                    <Route
                      path="/admin/products/add"
                      element={<AddProductPage />}
                    />
                    <Route
                      path="/admin/products/:productId/edit"
                      element={<EditProductPage />}
                    />
                    <Route
                      path="/admin/products/:productId/discontinue"
                      element={<DiscontinueProductPage />}
                    />
                  </Route>

                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </BrowserRouter>
            </WishlistProvider>
          </CartProvider>
        </InventoryProvider>
      </ProductProvider>
    </AuthProvider>
  )
}

export default App
