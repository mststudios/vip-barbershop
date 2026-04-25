const BASE = import.meta.env.VITE_API_URL
const ADMIN_PASSWORD = 'vip2024admin'
const HEADERS = {
  'Content-Type': 'application/json',
  'x-admin-password': ADMIN_PASSWORD,
}

export const getBookings = () =>
  fetch(`${BASE}/bookings`, { headers: HEADERS }).then(r => r.json())

export const cancelBooking = (bookingId: string) =>
  fetch(`${BASE}/cancel`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ bookingId }),
  }).then(r => r.json())

export const blockDay = (date: string, type: string, closeAt?: string, barberId?: string) =>
  fetch(`${BASE}/block`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ date, type, closeAt, barberId }),
  }).then(r => r.json())

export const unblockDay = (date: string, barberId?: string) =>
  fetch(`${BASE}/unblock`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ date, barberId }),
  }).then(r => r.json())

export const getAvailability = (date: string, barberId?: string) => {
  const params = new URLSearchParams({ date })
  if (barberId) params.append('barber_id', barberId)
  return fetch(`${BASE}/availability?${params}`).then(r => r.json())
}
