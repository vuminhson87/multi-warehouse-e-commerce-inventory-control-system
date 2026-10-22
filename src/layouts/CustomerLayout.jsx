
import { Outlet } from 'react-router-dom'
import CustomerHeader from '../components/CustomerHeader'

function CustomerLayout() {
  return (
    <>
      <CustomerHeader />
      <Outlet />
    </>
  )
}

export default CustomerLayout
