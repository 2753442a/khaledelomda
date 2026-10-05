import React, { useState, useEffect, useCallback } from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isToday, isBefore, startOfDay,
  addMonths, subMonths, getDay
} from 'date-fns'
import { ar } from 'date-fns/locale'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getPriceForDate, formatCurrency, isWeekendDay } from '../lib/utils'

interface DateStatus {
  status: 'available' | 'reserved' | 'pending' | 'past'
  price?: number
}

interface BookingCalendarProps {
  propertyId: string
  weekdayPrice: number
  weekendPrice: number
  onDateSelect: (date: Date | null) => void
  selectedDate: Date | null
}

const WEEKDAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']

const BookingCalendar: React.FC<BookingCalendarProps> = ({
  propertyId, weekdayPrice, weekendPrice, onDateSelect, selectedDate
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [dateStatuses, setDateStatuses] = useState<Record<string, DateStatus>>({})
  const [loading, setLoading] = useState(false)

  const fetchBookedDates = useCallback(async (month: Date) => {
    setLoading(true)
    const start = format(startOfMonth(month), 'yyyy-MM-dd')
    const end = format(endOfMonth(month), 'yyyy-MM-dd')

    const { data } = await supabase
      .from('bookings')
      .select('booking_date, status')
      .eq('property_id', propertyId)
      .gte('booking_date', start)
      .lte('booking_date', end)
      .in('status', ['confirmed', 'pending_receipt', 'pending_verification'])

    const statuses: Record<string, DateStatus> = {}
    if (data) {
      data.forEach(b => {
        statuses[b.booking_date] = {
          status: b.status === 'confirmed' ? 'reserved' : 'pending',
        }
      })
    }
    setDateStatuses(statuses)
    setLoading(false)
  }, [propertyId])

  useEffect(() => {
    fetchBookedDates(currentMonth)
  }, [currentMonth, fetchBookedDates])

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  // Saturday start calculation: In JS getDay(), Sunday is 0, Saturday is 6.
  // We want Saturday to be index 0, Sunday index 1, etc.
  const rawFirstDay = getDay(startOfMonth(currentMonth))
  const firstDayOfWeek = (rawFirstDay + 1) % 7

  const getDayStatus = (date: Date): DateStatus => {
    if (isBefore(date, startOfDay(new Date()))) return { status: 'past' }
    const key = format(date, 'yyyy-MM-dd')
    if (dateStatuses[key]) return dateStatuses[key]
    return {
      status: 'available',
      price: getPriceForDate(date, weekdayPrice, weekendPrice),
    }
  }

  const handleDayClick = (date: Date) => {
    const s = getDayStatus(date)
    if (s.status !== 'available') return
    if (selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')) {
      onDateSelect(null)
    } else {
      onDateSelect(date)
    }
  }

  const prev = () => setCurrentMonth(m => subMonths(m, 1))
  const next = () => setCurrentMonth(m => addMonths(m, 1))

  return (
    <div className="card p-5 border border-white/10 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/8">
        <button onClick={prev} className="glass p-2.5 rounded-xl hover:bg-white/10 transition-colors" aria-label="الشهر السابق">
          <ChevronRight size={20} />
        </button>
        <h3 className="font-bold text-lg text-white">
          {format(currentMonth, 'MMMM yyyy', { locale: ar })}
        </h3>
        <button onClick={next} className="glass p-2.5 rounded-xl hover:bg-white/10 transition-colors" aria-label="الشهر القادم">
          <ChevronLeft size={20} />
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs font-medium">
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-md bg-emerald-500/30 border border-emerald-500/60" />
          <span className="text-gray-300">متاح</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-md bg-red-500/30 border border-red-500/60" />
          <span className="text-gray-300">محجوز</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-md bg-amber-500/30 border border-amber-500/60" />
          <span className="text-gray-300">قيد المراجعة</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-md bg-purple-500/30 border border-purple-500/60" />
          <span className="text-gray-300">عطلة أسبوعية</span>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center font-bold text-xs sm:text-sm text-slate-400 py-2 mb-1" dir="rtl">
        {WEEKDAYS.map(day => (
          <div key={day} className="truncate py-1 select-none">{day}</div>
        ))}
      </div>

      {/* Days grid */}
      {loading ? (
        <div className="h-52 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5" dir="rtl">
          {/* Empty cells before first day */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[52px] sm:min-h-[60px]" />
          ))}
          {days.map(day => {
            const s = getDayStatus(day)
            const isSelected = selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
            const isWeekend = isWeekendDay(day)

            let bgClass = ''
            let textClass = 'text-gray-200'
            let cursor = 'cursor-pointer hover:scale-102 hover:border-emerald-400'

            if (s.status === 'past') {
              bgClass = 'bg-white/2 border border-transparent opacity-40'
              textClass = 'text-gray-500'
              cursor = 'cursor-not-allowed'
            } else if (s.status === 'reserved') {
              bgClass = 'bg-red-500/20 border border-red-500/50'
              textClass = 'text-red-300'
              cursor = 'cursor-not-allowed'
            } else if (s.status === 'pending') {
              bgClass = 'bg-amber-500/20 border border-amber-500/50'
              textClass = 'text-amber-300'
              cursor = 'cursor-not-allowed'
            } else if (isSelected) {
              bgClass = 'bg-emerald-600 border border-emerald-400 shadow-lg shadow-emerald-600/40 ring-2 ring-emerald-400'
              textClass = 'text-white font-bold'
            } else if (isWeekend) {
              bgClass = 'bg-purple-500/15 border border-purple-500/30 hover:bg-purple-500/25'
              textClass = 'text-purple-200'
            } else {
              bgClass = 'bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/25'
              textClass = 'text-emerald-200'
            }

            return (
              <div
                key={format(day, 'yyyy-MM-dd')}
                onClick={() => handleDayClick(day)}
                className={`relative min-h-[52px] rounded-xl p-1.5 text-center transition-all flex flex-col items-center justify-center ${bgClass} ${textClass} ${cursor} ${isToday(day) ? 'ring-1 ring-white/60' : ''}`}
              >
                <span className="text-sm font-bold block">{format(day, 'd')}</span>
                {s.status === 'available' && s.price && (
                  <span className="text-[10px] font-mono opacity-80 leading-none mt-0.5">
                    {s.price >= 1000 ? `${(s.price / 1000).toFixed(s.price % 1000 === 0 ? 0 : 1)}k` : s.price}
                  </span>
                )}
                {s.status === 'reserved' && (
                  <span className="text-[9px] text-red-300 leading-none mt-0.5 font-medium">محجوز</span>
                )}
                {s.status === 'pending' && (
                  <span className="text-[9px] text-amber-300 leading-none mt-0.5 font-medium">مراجعة</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {selectedDate && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-400">
          ✓ تم اختيار:{' '}
          <span className="font-bold">
            {format(selectedDate, 'EEEE، d MMMM yyyy', { locale: ar })}
          </span>
          <br />
          <span className="text-white font-bold">
            السعر: {formatCurrency(getPriceForDate(selectedDate, weekdayPrice, weekendPrice))}
          </span>
          <span className="text-gray-400"> / ليلة</span>
        </div>
      )}
    </div>
  )
}

export default BookingCalendar
