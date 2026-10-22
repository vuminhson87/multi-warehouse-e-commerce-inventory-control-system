import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ManagementNavigation from '../components/ManagementNavigation'

function AdminLayout() {
  const { currentUser } = useAuth()

  // Chỉ ADMIN được truy cập khu vực quản lý sản phẩm
  if (currentUser?.role !== 'ADMIN') {
    return <Navigate to="/" replace />
  }

  return (
    <>
      <ManagementNavigation />
      <Outlet />
    </>
  )
}

export default AdminLayout