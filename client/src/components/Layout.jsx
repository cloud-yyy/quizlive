import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="QuizLive — на главную">
          <span className="brand-mark">?</span> QuizLive
        </Link>
        <nav className="nav" aria-label="Основная навигация">
          <NavLink to="/quizzes">Библиотека</NavLink>
        </nav>
        <div className="topbar-right">
          {user ? (
            <>
              <span className="who" data-testid="current-user">{user.nickname}</span>
              <button
                className="btn btn-ghost"
                onClick={async () => {
                  await logout()
                  navigate('/')
                }}
              >
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link className="btn btn-ghost" to="/login">Войти</Link>
              <Link className="btn btn-primary" to="/register">Регистрация</Link>
            </>
          )}
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <footer className="footer">QuizLive · курсовой проект БГУИР</footer>
    </div>
  )
}
