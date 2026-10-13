import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import Navbar from './components/Navbar'
import ErrorBoundary from './components/ErrorBoundary'
import HomePage from './pages/HomePage'

// Code splitting / Lazy loading for heavy pages to drastically reduce initial bundle size
const BookPage = lazy(() => import('./pages/BookPage'))
const WaterOrderPage = lazy(() => import('./pages/WaterOrderPage'))
const HeritageFurniturePage = lazy(() => import('./pages/HeritageFurniturePage'))
const MyBookingsPage = lazy(() => import('./pages/MyBookingsPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

const PageLoader: React.FC = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
    <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
    <span className="text-xs text-gray-400 font-medium">جاري التحميل...</span>
  </div>
)

const App: React.FC = () => {
  return (
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter>
          <div className="min-h-screen flex flex-col font-cairo" dir="rtl">
            <Navbar />
            <main className="flex-1">
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/book" element={<BookPage />} />
                    <Route path="/water" element={<WaterOrderPage />} />
                    <Route path="/furniture" element={<HeritageFurniturePage />} />
                    <Route path="/my-bookings" element={<MyBookingsPage />} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </main>
          </div>
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  )
}

export default App

