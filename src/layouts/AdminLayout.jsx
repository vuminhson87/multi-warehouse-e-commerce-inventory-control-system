import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ManagementShell from '../components/ManagementShell'

function AdminLayout() {
  const { currentUser } = useAuth()

  // Chỉ ADMIN được truy cập khu vực quản lý sản phẩm
  if (currentUser?.role !== 'ADMIN') {
    return <Navigate to="/" replace />
  }

  return (
    <>
      <ManagementShell>
      <Outlet />
      </ManagementShell>
    </>
  )
}

export default AdminLayout