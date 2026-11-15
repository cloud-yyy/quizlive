import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(form.email, form.password)
      navigate(location.state?.from || '/quizzes', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Не удалось войти'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card auth-card">
      <h1>Вход</h1>
      <form onSubmit={onSubmit} className="form">
        <label>
          E-mail
          <input type="email" name="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>
          Пароль
          <input type="password" name="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Входим…' : 'Войти'}</button>
      </form>
      <p className="muted">Нет аккаунта? <Link to="/register">Зарегистрируйтесь</Link></p>
    </section>
  )
}
