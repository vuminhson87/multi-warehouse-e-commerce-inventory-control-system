import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
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
import { AuthProvider, useAuth } from './context/AuthContext'
import './App.css'
import ManagementNavigation from './components/ManagementNavigation'
import { ProductProvider } from './context/ProductContext'

function ManagementLayout() {
  const { currentUser } = useAuth()
  const location = useLocation()

  const isManagementUser =
    currentUser?.role === 'ADMIN' ||
    currentUser?.role === 'WAREHOUSE_MANAGER'

  const isManagementPage =
    location.pathname === '/inventory' ||
    location.pathname.startsWith('/inventory/') ||
    location.pathname === '/admin/products' ||
    location.pathname.startsWith('/admin/products/')

  if (!isManagementUser || !isManagementPage) {
    return null
  }

  return <ManagementNavigation />
}

function App() {
  return (
    <AuthProvider>
      <ProductProvider>
        <CartProvider>
          <BrowserRouter>
            <ManagementLayout />
            <Routes>
              <Route path="/" element={<Navigate to="/products" replace />} />

              <Route path="/login" element={<LoginPage />} />

              <Route path="/products" element={<ProductCatalogPage />} />
              <Route
                path="/products/:productId"
                element={<ProductDetailPage />}
              />
              <Route path="/cart" element={<ShoppingCartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/order-result" element={<OrderResultPage />} />
              <Route path="/orders" element={<PurchaseHistoryPage />} />
              <Route path="/orders/:orderId" element={<OrderTrackingPage />} />

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

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </ProductProvider>
    </AuthProvider>
  )
}

export default App