import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ManagementNavigation from '../components/ManagementNavigation'

function WarehouseLayout() {
  const { currentUser } = useAuth()

  const canAccessInventory =
    currentUser?.role === 'ADMIN' ||
    currentUser?.role === 'WAREHOUSE_MANAGER'

  if (!canAccessInventory) {
    return <Navigate to="/" replace />
  }

  return (
    <>
      <ManagementNavigation />
      <Outlet />
    </>
  )
}

export default WarehouseLayout