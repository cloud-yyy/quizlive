import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Login from './pages/Login'
import Quizzes from './pages/Quizzes'
import Register from './pages/Register'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="quizzes" element={<Quizzes />} />
        <Route path="*" element={<p className="state">Страница не найдена</p>} />
      </Route>
    </Routes>
  )
}
