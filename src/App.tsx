import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import BookPage from './pages/BookPage'
import MyBookingsPage from './pages/MyBookingsPage'
import AdminPage from './pages/AdminPage'
import WaterOrderPage from './pages/WaterOrderPage'

const App: React.FC = () => {
  return (
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter>
          <div className="min-h-screen flex flex-col font-cairo" dir="rtl">
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/book" element={<BookPage />} />
                <Route path="/water" element={<WaterOrderPage />} />
                <Route path="/my-bookings" element={<MyBookingsPage />} />
                <Route path="/admin" element={<AdminPage />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  )
}

export default App
