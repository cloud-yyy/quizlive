import { useCallback, useEffect, useState } from 'react'
import { errorMessage, quizApi } from '../api/client'
import { EmptyState, ErrorState, Spinner } from '../components/Feedback'

const DIFFICULTY = { easy: 'Легко', medium: 'Средне', hard: 'Сложно' }

export default function Quizzes() {
  const [state, setState] = useState({ status: 'loading', items: [], error: '' })

  const load = useCallback(() => {
    setState((s) => ({ ...s, status: 'loading' }))
    quizApi
      .list({ limit: 50 })
      .then((data) => setState({ status: 'ready', items: data.items, error: '' }))
      .catch((err) => setState({ status: 'error', items: [], error: errorMessage(err) }))
  }, [])

  useEffect(load, [load])

  if (state.status === 'loading') return <Spinner />
  if (state.status === 'error') return <ErrorState message={state.error} onRetry={load} />
  if (!state.items.length) return <EmptyState title="Пока нет опубликованных квизов" />

  return (
    <>
      <h1>Библиотека квизов</h1>
      <ul className="grid" aria-label="Список квизов">
        {state.items.map((q) => (
          <li key={q.id} className="card quiz-card">
            <h2>{q.title}</h2>
            <p className="muted">{q.description || 'Без описания'}</p>
            <div className="chips">
              <span className="chip">{q.category}</span>
              <span className={`chip chip-${q.difficulty}`}>{DIFFICULTY[q.difficulty]}</span>
              <span className="chip">{q.questionCount} вопр.</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
