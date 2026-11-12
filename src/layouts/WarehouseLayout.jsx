import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ManagementShell from '../components/ManagementShell'

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
      <ManagementShell>
      <Outlet />
      </ManagementShell>
    </>
  )
}

export default WarehouseLayout