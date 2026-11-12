import { Outlet } from 'react-router-dom'
import CustomerHeader from '../components/CustomerHeader'

function CustomerLayout() {
    return (
        <div className="customer-shell">
            <CustomerHeader />
            <Outlet />
        </div>
    )
}

export default CustomerLayout
