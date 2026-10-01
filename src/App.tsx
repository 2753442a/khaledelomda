import { lazy, Suspense } from 'react'
import { HashRouter, Link, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { Busy, ToastHost } from './components/ui'
import { ScrollToTop, SetupNotice, SiteFooter, SiteHeader } from './components/SiteChrome'

const AdminGate = lazy(() => import('./pages/AdminPages').then((module) => ({ default: module.AdminGate })))
const AdminAddOns = lazy(() => import('./pages/AdminPages').then((module) => ({ default: module.AdminAddOns })))
const AdminAudit = lazy(() => import('./pages/AdminPages').then((module) => ({ default: module.AdminAudit })))
const AdminAvailability = lazy(() => import('./pages/AdminPages').then((module) => ({ default: module.AdminAvailability })))
const AdminBookings = lazy(() => import('./pages/AdminPages').then((module) => ({ default: module.AdminBookings })))
const AdminContent = lazy(() => import('./pages/AdminPages').then((module) => ({ default: module.AdminContent })))
const AdminCoupons = lazy(() => import('./pages/AdminPages').then((module) => ({ default: module.AdminCoupons })))
const AdminCustomers = lazy(() => import('./pages/AdminPages').then((module) => ({ default: module.AdminCustomers })))
const AdminInquiries = lazy(() => import('./pages/AdminPages').then((module) => ({ default: module.AdminInquiries })))
const AdminOverview = lazy(() => import('./pages/AdminPages').then((module) => ({ default: module.AdminOverview })))
const AdminPackages = lazy(() => import('./pages/AdminPages').then((module) => ({ default: module.AdminPackages })))
const AdminReviews = lazy(() => import('./pages/AdminPages').then((module) => ({ default: module.AdminReviews })))
const AdminSettings = lazy(() => import('./pages/AdminPages').then((module) => ({ default: module.AdminSettings })))
const AdminUnits = lazy(() => import('./pages/AdminPages').then((module) => ({ default: module.AdminUnits })))

const AccountPage = lazy(() => import('./pages/AccountPages').then((module) => ({ default: module.AccountPage })))
const BookingDetailsPage = lazy(() => import('./pages/AccountPages').then((module) => ({ default: module.BookingDetailsPage })))
const BookingsPage = lazy(() => import('./pages/AccountPages').then((module) => ({ default: module.BookingsPage })))
const FavoritesPage = lazy(() => import('./pages/AccountPages').then((module) => ({ default: module.FavoritesPage })))
const LoginPage = lazy(() => import('./pages/AccountPages').then((module) => ({ default: module.LoginPage })))
const NotificationsPage = lazy(() => import('./pages/AccountPages').then((module) => ({ default: module.NotificationsPage })))
const OwnerSetupPage = lazy(() => import('./pages/AccountPages').then((module) => ({ default: module.OwnerSetupPage })))

const BookingPage = lazy(() => import('./pages/BookingPage').then((module) => ({ default: module.BookingPage })))
const PaymentResultPage = lazy(() => import('./pages/BookingPage').then((module) => ({ default: module.PaymentResultPage })))

const HomePage = lazy(() => import('./pages/GuestPages').then((module) => ({ default: module.HomePage })))
const InquiryPage = lazy(() => import('./pages/GuestPages').then((module) => ({ default: module.InquiryPage })))
const PolicyPage = lazy(() => import('./pages/GuestPages').then((module) => ({ default: module.PolicyPage })))
const SetupPage = lazy(() => import('./pages/GuestPages').then((module) => ({ default: module.SetupPage })))
const UnitDetailsPage = lazy(() => import('./pages/GuestPages').then((module) => ({ default: module.UnitDetailsPage })))
const UnitsPage = lazy(() => import('./pages/GuestPages').then((module) => ({ default: module.UnitsPage })))

function PublicLayout() {
  return <><SetupNotice /><SiteHeader /><Outlet /><SiteFooter /></>
}

function NotFoundPage() {
  return <main className="inner-page section-wrap not-found"><span className="eyebrow">404 · الصفحة غير موجودة</span><h1>يبدو أنك وصلت<br />إلى طريق هادئ.</h1><p>الرابط الذي فتحته غير متاح. يمكنك العودة إلى الاستراحات أو الصفحة الرئيسية.</p><div><Link className="button button-primary" to="/">الرئيسية</Link><Link className="button button-outline" to="/units">اكتشف الاستراحات</Link></div></main>
}

export default function App() {
  return <AuthProvider><HashRouter><ScrollToTop /><Suspense fallback={<main className="inner-page"><Busy label="نجهّز الصفحة" /></main>}><Routes>
    <Route element={<PublicLayout />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/units" element={<UnitsPage />} />
      <Route path="/units/:slug" element={<UnitDetailsPage />} />
      <Route path="/book/:unitId" element={<BookingPage />} />
      <Route path="/payment/result" element={<PaymentResultPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="/account/favorites" element={<FavoritesPage />} />
      <Route path="/bookings" element={<BookingsPage />} />
      <Route path="/bookings/:bookingId" element={<BookingDetailsPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/inquiry" element={<InquiryPage />} />
      <Route path="/policies/:policy" element={<PolicyPage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/owner-setup" element={<OwnerSetupPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
    <Route path="/admin" element={<AdminGate />}>
      <Route index element={<AdminOverview />} />
      <Route path="bookings" element={<AdminBookings />} />
      <Route path="units" element={<AdminUnits />} />
      <Route path="packages" element={<AdminPackages />} />
      <Route path="add-ons" element={<AdminAddOns />} />
      <Route path="availability" element={<AdminAvailability />} />
      <Route path="coupons" element={<AdminCoupons />} />
      <Route path="reviews" element={<AdminReviews />} />
      <Route path="inquiries" element={<AdminInquiries />} />
      <Route path="customers" element={<AdminCustomers />} />
      <Route path="content" element={<AdminContent />} />
      <Route path="settings" element={<AdminSettings />} />
      <Route path="audit" element={<AdminAudit />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes></Suspense><ToastHost /></HashRouter></AuthProvider>
}
