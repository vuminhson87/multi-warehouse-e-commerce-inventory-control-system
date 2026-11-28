import { Outlet } from 'react-router-dom'
import CustomerHeader from '../components/CustomerHeader'
import LuckyWheelWidget from '../components/LuckyWheelWidget'
import SupportChatWidget from '../components/SupportChatWidget'

function CustomerLayout() {
    return (
        <div className="customer-shell">
            <CustomerHeader />
            <Outlet />
            <LuckyWheelWidget />
            <SupportChatWidget />
        </div>
    )
}

export default CustomerLayout
