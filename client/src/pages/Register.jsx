import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ nickname: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await register(form.email, form.password, form.nickname.trim())
      navigate('/quizzes', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Не удалось зарегистрироваться'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card auth-card">
      <h1>Регистрация</h1>
      <form onSubmit={onSubmit} className="form">
        <label>
          Никнейм
          <input name="nickname" minLength={2} maxLength={30} autoComplete="nickname" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} />
        </label>
        <label>
          E-mail
          <input type="email" name="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>
          Пароль
          <input type="password" name="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <small className="muted">Минимум 8 символов: буква, цифра и спецсимвол</small>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Создаём…' : 'Создать аккаунт'}</button>
      </form>
      <p className="muted">Уже есть аккаунт? <Link to="/login">Войти</Link></p>
    </section>
  )
}
