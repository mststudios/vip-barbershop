import { useState, useEffect } from 'react'
import { getBookings, cancelBooking, blockDay, unblockDay, getBlockedTimes } from '../services/adminApi'

const ADMIN_PASSWORD = 'password'
const SLOT_DURATION = 30
const DEFAULT_OPEN = '09:00'
const WEEKDAY_CLOSE = '18:00'
const SATURDAY_CLOSE = '14:00'

const generateSlots = (open: string, close: string): string[] => {
  const slots: string[] = []
  const [oh, om] = open.split(':').map(Number)
  const [ch, cm] = close.split(':').map(Number)
  let current = oh * 60 + om
  const end = ch * 60 + cm
  while (current + SLOT_DURATION <= end) {
    const h = Math.floor(current / 60).toString().padStart(2, '0')
    const m = (current % 60).toString().padStart(2, '0')
    slots.push(`${h}:${m}`)
    current += SLOT_DURATION
  }
  return slots
}

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

const toDateString = (date: Date): string => date.toISOString().split('T')[0]

const getDayClose = (date: Date): string => {
  const day = date.getDay()
  if (day === 0) return ''
  if (day === 6) return SATURDAY_CLOSE
  return WEEKDAY_CLOSE
}

export default function Admin() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin_authed') === 'true')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [view, setView] = useState<'schedule' | 'manage'>('schedule')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [blockedDays, setBlockedDays] = useState<Record<string, { type: string; closeAt?: string }>>({})
  const [clickedDay, setClickedDay] = useState<string | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [closeAtInput, setCloseAtInput] = useState('15:00')

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthed(true)
      sessionStorage.setItem('admin_authed', 'true')
    } else {
      setLoginError('Forkert adgangskode')
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('admin_authed')
    setAuthed(false)
  }

  const fetchBookings = async () => {
    setLoading(true)
    try {
      const data = await getBookings()
      setBookings(Array.isArray(data) ? data : [])
    } catch { setBookings([]) }
    setLoading(false)
  }

  const fetchBlockedTimes = async () => {
    try {
      const data = await getBlockedTimes()
      if (Array.isArray(data)) {
        const mapped: Record<string, { type: string; closeAt?: string }> = {}
        data.forEach((item: any) => {
          const start = item.start_slot?.substring(0, 5)
          const end = item.end_slot?.substring(0, 5)
          if (start === '00:00' && end === '23:59') {
            mapped[item.date] = { type: 'full_day' }
          } else if (item.reason === 'early_close') {
            mapped[item.date] = { type: 'early_close', closeAt: start }
          }
        })
        setBlockedDays(mapped)
      }
    } catch { }
  }

  useEffect(() => {
    if (authed) {
      fetchBookings()
      fetchBlockedTimes()
    }
  }, [authed])

  const handleCancel = async (id: string) => {
    if (!confirm('Er du sikker på at du vil aflyse denne booking?')) return
    await cancelBooking(id)
    fetchBookings()
  }

  const handleBlockDay = async (date: string, type: string, closeAt?: string) => {
    await blockDay(date, type, closeAt)
    await fetchBlockedTimes()
    setClickedDay(null)
  }

  const handleUnblock = async (date: string) => {
    await unblockDay(date)
    await fetchBlockedTimes()
    setClickedDay(null)
  }

  const dateStr = toDateString(selectedDate)
  const dayClose = getDayClose(selectedDate)
  const isSunday = selectedDate.getDay() === 0
  const blockedInfo = blockedDays[dateStr]
  const isFullyClosed = isSunday || blockedInfo?.type === 'full_day'
  const effectiveClose = blockedInfo?.type === 'early_close' && blockedInfo.closeAt ? blockedInfo.closeAt : dayClose
  const slots = isFullyClosed || !dayClose ? [] : generateSlots(DEFAULT_OPEN, effectiveClose)

  const getDanishHHMM = (): string => {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Copenhagen',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date())
  }

  const isOpenNow = (() => {
    if (isFullyClosed || !dayClose) return false
    const isToday = toDateString(selectedDate) === toDateString(new Date())
    if (!isToday) return false
    const current = getDanishHHMM()
    return current >= DEFAULT_OPEN && current < effectiveClose
  })()

  const dayBookings = bookings.filter(b => b.date === dateStr)

  const getSlotBooking = (slot: string) =>
    dayBookings.find(b => b.start_slot?.substring(0, 5) === slot)

  // Calendar helpers
  const calYear = calendarMonth.getFullYear()
  const calMonth = calendarMonth.getMonth()
  const firstDay = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const calDays = Array.from({ length: daysInMonth }, (_, i) => new Date(calYear, calMonth, i + 1))

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#FAFAF6] flex items-center justify-center">
        <div className="bg-white border border-[#E8DDD0] rounded-2xl p-10 w-full max-w-sm shadow-sm">
          <div className="text-center mb-8">
            <p className="text-[10px] font-bold text-[#D4A853] uppercase tracking-widest mb-1">Admin</p>
            <h1 className="text-2xl font-bold text-[#2C1A0E]">VIP Barbershop</h1>
          </div>
          <div className="space-y-4">
            <input
              type="password"
              placeholder="Adgangskode"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full border border-[#D4C4B0] rounded-lg px-4 py-3 text-sm text-[#2C1A0E] focus:outline-none focus:border-[#D4A853]"
            />
            {loginError && <p className="text-red-500 text-xs">{loginError}</p>}
            <button
              onClick={handleLogin}
              className="w-full bg-[#2C1A0E] text-[#F5EDD8] py-3 rounded-lg text-sm font-semibold hover:bg-[#3D2812] transition-colors"
            >
              Log ind
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-[#FAFAF6]">

      {/* Sidebar */}
      <div className="w-56 bg-[#2C1A0E] flex flex-col shrink-0">

        {/* Logo + brand */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-[#D4A853] flex items-center justify-center shrink-0">
              <span className="text-base font-bold text-[#2C1A0E]">V</span>
            </div>
            <div>
              <p className="text-[10px] text-[#D4A853] font-bold uppercase tracking-widest">Admin</p>
              <p className="text-sm font-semibold text-[#F5EDD8]">VIP Barbershop</p>
            </div>
          </div>
          <p className="text-[10px] text-[#9B7A55] font-bold uppercase tracking-widest mb-2">Navigation</p>
          <nav className="space-y-1">
            <button
              onClick={() => setView('schedule')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                view === 'schedule'
                  ? 'bg-[#D4A853] text-[#2C1A0E]'
                  : 'text-[#9B7A55] hover:bg-white/5 hover:text-[#E8D5B0]'
              }`}
            >
              <span className="text-base">✂</span> Skema
            </button>
            <button
              onClick={() => setView('manage')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                view === 'manage'
                  ? 'bg-[#D4A853] text-[#2C1A0E]'
                  : 'text-[#9B7A55] hover:bg-white/5 hover:text-[#E8D5B0]'
              }`}
            >
              <span className="text-base">⊞</span> Administrer dage
            </button>
          </nav>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User + logout */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-[#3D2812] border border-[#5C3D20] flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-[#D4A853]">M</span>
            </div>
            <div>
              <p className="text-xs font-medium text-[#E8D5B0]">Mohsen</p>
              <p className="text-[10px] text-[#9B7A55]">Administrator</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 rounded-lg bg-white/4 border border-white/6 text-xs font-medium text-[#9B7A55] hover:text-[#E8D5B0] hover:bg-white/8 transition-colors text-left"
          >
            Log ud
          </button>
        </div>

      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">

        {/* SCHEDULE VIEW */}
        {view === 'schedule' && (
          <div className="animate-fade-up">
            {/* Top header bar */}
            <div className="bg-white border-b border-[#E8DDD0] px-7 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d) }}
                  className="w-8 h-8 rounded-lg border border-[#D4C4B0] flex items-center justify-center text-[#2C1A0E] hover:bg-[#F5EDD8] transition-colors text-lg"
                >
                  ‹
                </button>
                <div>
                  <p className="text-base font-bold text-[#2C1A0E] capitalize">{formatDate(selectedDate)}</p>
                  <p className="text-[11px] text-[#9B8070] font-medium">
                    {isFullyClosed
                      ? 'Lukket denne dag'
                      : `${dayBookings.length} booking${dayBookings.length !== 1 ? 'er' : ''} i dag`}
                  </p>
                </div>
                <button
                  onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d) }}
                  className="w-8 h-8 rounded-lg border border-[#D4C4B0] flex items-center justify-center text-[#2C1A0E] hover:bg-[#F5EDD8] transition-colors text-lg"
                >
                  ›
                </button>
                <button
                  onClick={() => setSelectedDate(new Date())}
                  className="px-3 py-1.5 rounded-lg border border-[#D4A853] bg-[#FDF3E0] text-xs font-semibold text-[#8B5E1A] hover:bg-[#FAE8C0] transition-colors"
                >
                  I dag
                </button>
                {loading && <span className="text-xs text-[#9B8070]">Henter...</span>}
              </div>
              {!isFullyClosed && dayClose && (
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isOpenNow ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  <span className="text-xs text-[#6B5A4A] font-medium">
                    {isOpenNow ? `Åbent · Lukker ${effectiveClose}` : `Lukket · Åbner ${DEFAULT_OPEN}`}
                  </span>
                </div>
              )}
            </div>

            {/* Stat cards */}
            {!isFullyClosed && (
              <div className="grid grid-cols-3 gap-3 px-7 pt-5">
                <div className="bg-white border border-[#E8DDD0] rounded-xl p-4">
                  <p className="text-[10px] font-bold text-[#9B8070] uppercase tracking-widest mb-1">Bookinger i dag</p>
                  <p className="text-2xl font-bold text-[#2C1A0E]">{dayBookings.length}</p>
                </div>
                <div className="bg-white border border-[#E8DDD0] rounded-xl p-4">
                  <p className="text-[10px] font-bold text-[#9B8070] uppercase tracking-widest mb-1">Ledige tider</p>
                  <p className="text-2xl font-bold text-[#2C1A0E]">{slots.length - dayBookings.length}</p>
                </div>
                <div className="bg-white border border-[#E8DDD0] rounded-xl p-4">
                  <p className="text-[10px] font-bold text-[#9B8070] uppercase tracking-widest mb-1">Forventet omsætning</p>
                  <p className="text-2xl font-bold text-[#D4A853]">
                    {dayBookings.reduce((sum, b) => sum + (b.services?.price || 0), 0).toLocaleString('da-DK')} kr.
                  </p>
                </div>
              </div>
            )}

            {/* Schedule */}
            <div className="px-7 py-5">
              {isFullyClosed ? (
                <div className="flex items-center justify-center h-48 bg-white border border-[#E8DDD0] rounded-xl">
                  <p className="text-[#9B8070] font-medium">Lukket denne dag</p>
                </div>
              ) : (
                <div className="bg-white border border-[#E8DDD0] rounded-xl overflow-hidden">
                  {slots.map((slot, idx) => {
                    const booking = getSlotBooking(slot)
                    return (
                      <div
                        key={slot}
                        className={`flex items-center gap-4 px-5 py-3 transition-colors hover:bg-[#FDFAF5] ${
                          idx !== slots.length - 1 ? 'border-b border-[#F5EDD8]' : ''
                        }`}
                      >
                        <span className="text-sm font-bold text-[#2C1A0E] w-12 shrink-0">{slot}</span>
                        {booking ? (
                          <div className="flex-1 bg-[#FDF3E0] border-l-[3px] border-[#D4A853] rounded-lg px-4 py-2.5 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-[#2C1A0E]">{booking.services?.name}</p>
                              <p className="text-xs text-[#6B5A4A] mt-0.5">{booking.customer_name} · {booking.customer_phone}</p>
                            </div>
                            <div className="flex items-center gap-2 ml-4 shrink-0">
                              <span className="text-[11px] font-semibold text-[#D4A853] bg-[#FEF9EE] border border-[#D4A853] rounded-full px-2.5 py-0.5">
                                {booking.services?.price} kr.
                              </span>
                              <button
                                onClick={() => handleCancel(booking.id)}
                                className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-md px-2.5 py-1 hover:bg-red-100 transition-colors"
                              >
                                Aflys
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center gap-3">
                            <div className="flex-1 h-px bg-[#E8DDD0]" />
                            <span className="text-xs text-[#C4B8A8] font-medium">Ledig</span>
                            <div className="flex-1 h-px bg-[#E8DDD0]" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MANAGE DAYS VIEW */}
        {view === 'manage' && (
          <div className="p-8 flex gap-8">
            {/* Calendar */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => setCalendarMonth(new Date(calYear, calMonth - 1, 1))}
                  className="w-9 h-9 rounded-lg border border-[#D4C4B0] flex items-center justify-center text-[#2C1A0E] hover:bg-[#F5EDD8]"
                >
                  ‹
                </button>
                <h2 className="text-lg font-bold text-[#2C1A0E] capitalize">
                  {calendarMonth.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' })}
                </h2>
                <button
                  onClick={() => setCalendarMonth(new Date(calYear, calMonth + 1, 1))}
                  className="w-9 h-9 rounded-lg border border-[#D4C4B0] flex items-center justify-center text-[#2C1A0E] hover:bg-[#F5EDD8]"
                >
                  ›
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map(d => (
                  <div key={d} className="text-center text-xs font-bold text-[#9B8070] py-2">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: (firstDay === 0 ? 6 : firstDay - 1) }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {calDays.map(day => {
                  const ds = toDateString(day)
                  const isSun = day.getDay() === 0
                  const blocked = blockedDays[ds]
                  const isToday = ds === toDateString(new Date())
                  const isSelected = ds === clickedDay
                  let bg = 'bg-white hover:bg-[#FDF3E0]'
                  if (isSun) bg = 'bg-[#F5F5F5] cursor-default'
                  else if (blocked?.type === 'full_day') bg = '!bg-red-600 hover:!bg-red-700'
                  else if (blocked?.type === 'early_close') bg = '!bg-amber-400 hover:!bg-amber-500'
                  return (
                    <button
                      key={ds}
                      disabled={isSun}
                      onClick={() => setClickedDay(isSelected ? null : ds)}
                      className={`
                        ${isSun ? 'bg-[#F5F5F5] cursor-default text-[#C4B8A8]' : `${bg} hover:scale-105 active:scale-95`}
                        ${isSelected ? 'ring-2 ring-[#D4A853]' : ''}
                        rounded-lg py-2 text-sm text-center border ${blocked?.type === 'full_day' ? 'border-red-700' : blocked?.type === 'early_close' ? 'border-amber-500' : 'border-[#E8DDD0]'} transition-all duration-150 relative
                      `}
                    >
                      {isToday ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#D4A853] text-white font-bold text-sm">
                          {day.getDate()}
                        </span>
                      ) : (
                        <span className={isSun ? 'text-[#C4B8A8]' : blocked?.type === 'full_day' ? 'text-white font-bold' : blocked?.type === 'early_close' ? 'text-amber-900 font-bold' : 'text-[#2C1A0E]'}>
                          {day.getDate()}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="flex gap-3 mt-5">
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-full px-3 py-1">
                  <div className="w-2 h-2 rounded-full bg-red-300" />
                  <span className="text-xs font-medium text-red-600">Lukket</span>
                </div>
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-xs font-medium text-amber-700">Tidlig lukning</span>
                </div>
              </div>
            </div>

            {/* Day panel */}
            {clickedDay && (
              <div key={clickedDay} className="w-72 bg-white border border-[#E8DDD0] rounded-xl p-6 h-fit shrink-0 slide-in-right">
                <h3 className="font-bold text-[#2C1A0E] mb-1 capitalize">
                  {new Date(clickedDay).toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <p className="text-xs text-[#9B8070] mb-6">Vælg hvad der skal ske denne dag</p>

                {blockedDays[clickedDay]?.type === 'full_day' ? (
                  <div className="space-y-3">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 font-medium">Lukket hele dagen</div>
                    <button onClick={() => handleUnblock(clickedDay)} className="w-full py-2.5 rounded-lg border border-[#D4C4B0] text-sm font-medium text-[#2C1A0E] hover:bg-[#FDF3E0] transition-colors">Åbn dagen igen</button>
                  </div>
                ) : blockedDays[clickedDay]?.type === 'early_close' ? (
                  <div className="space-y-3">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 font-medium">Lukker kl. {blockedDays[clickedDay].closeAt}</div>
                    <button onClick={() => handleUnblock(clickedDay)} className="w-full py-2.5 rounded-lg border border-[#D4C4B0] text-sm font-medium text-[#2C1A0E] hover:bg-[#FDF3E0] transition-colors">Fjern tidlig lukning</button>
                    <button onClick={() => handleBlockDay(clickedDay, 'full_day')} className="w-full py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors">Luk hele dagen i stedet</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button onClick={() => handleBlockDay(clickedDay, 'full_day')} className="w-full py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors">Luk hele dagen</button>
                    <div className="border-t border-[#E8DDD0] pt-3">
                      <p className="text-xs font-bold text-[#9B8070] uppercase tracking-widest mb-2">Tidlig lukning</p>
                      <div className="flex gap-2">
                        <input
                          type="time"
                          value={closeAtInput}
                          onChange={e => setCloseAtInput(e.target.value)}
                          style={{ colorScheme: 'light', pointerEvents: 'auto' }}
                          className="flex-1 border border-[#D4C4B0] rounded-lg px-3 py-2 text-sm font-medium text-[#2C1A0E] bg-white focus:outline-none focus:border-[#D4A853] cursor-text transition-colors"
                        />
                        <button
                          onClick={e => { e.stopPropagation(); handleBlockDay(clickedDay!, 'early_close', closeAtInput) }}
                          className="px-4 py-2 bg-[#2C1A0E] text-[#F5EDD8] rounded-lg text-sm font-medium hover:bg-[#3D2812] transition-colors shrink-0"
                        >
                          Gem
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
