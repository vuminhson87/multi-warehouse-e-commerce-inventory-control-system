import { Outlet } from 'react-router-dom'
import CustomerHeader from '../components/CustomerHeader'
import { useWishlist } from '../context/WishlistContext'

function CustomerLayout() {
  const { isDrawerOpen } = useWishlist()

  return (
    <div className="bg-white min-h-screen">
      <CustomerHeader />
      <div className={isDrawerOpen ? 'app-dimmed' : 'app-normal'}>
        <Outlet />
      </div>
    </div>
  )
}

export default CustomerLayout
