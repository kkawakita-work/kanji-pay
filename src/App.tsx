import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HostPage from './pages/HostPage'
import PayPage from './pages/PayPage'
import StatusPage from './pages/StatusPage'

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<HostPage />} />
          <Route path="/pay" element={<PayPage />} />
          <Route path="/status/:id" element={<StatusPage />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
