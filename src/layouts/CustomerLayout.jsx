import { Outlet } from 'react-router-dom'
import CustomerHeader from '../components/CustomerHeader'
import LuckyWheelWidget from '../components/LuckyWheelWidget'

function CustomerLayout() {
    return (
        <div className="customer-shell">
            <CustomerHeader />
            <Outlet />
            <LuckyWheelWidget />
        </div>
    )
}

export default CustomerLayout
