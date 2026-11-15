import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { quizApi } from '../api/client'

export default function Home() {
  const [stats, setStats] = useState(null)
  useEffect(() => {
    quizApi.stats().then(setStats).catch(() => {})
  }, [])

  return (
    <>
      <section className="hero">
        <h1>Викторины в реальном времени</h1>
        <p>Создавайте квизы, запускайте игру по PIN-коду и смотрите, как таблица лидеров обновляется на глазах.</p>
        <div className="hero-actions">
          <Link to="/quizzes" className="btn btn-primary btn-lg">Открыть библиотеку</Link>
        </div>
      </section>
      {stats && (
        <section className="stats" aria-label="Статистика">
          <div className="stat"><b>{stats.total}</b><span>квизов</span></div>
          <div className="stat"><b>{stats.totalQuestions}</b><span>вопросов</span></div>
          <div className="stat"><b>{stats.byCategory.length}</b><span>категорий</span></div>
        </section>
      )}
    </>
  )
}
