import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Admin from './pages/Admin'

const MainPage = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
    <p style={{ fontSize: '18px', color: '#999', fontFamily: 'sans-serif' }}>Hovedside — kommer snart</p>
  </div>
)

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  )
}
