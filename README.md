# QuizLive — платформа для проведения викторин и квизов в реальном времени

Курсовой проект по дисциплине «Интернет-технологии и веб-программирование» (БГУИР, дистанционная форма).

## Запуск (Docker)

```bash
cp .env.example .env        # при необходимости поправьте секреты
docker compose up -d --build
```

| Сервис | Адрес |
|---|---|
| API | http://localhost:4000 (`/health`) |
| PostgreSQL | localhost:5433 (`quiz` / `quiz`, база `quizlive`) |

Администратор создаётся автоматически из `ADMIN_EMAIL` / `ADMIN_PASSWORD` (по умолчанию `admin@quizlive.local` / `Admin#12345`).

## Локальная разработка и тесты

```bash
docker compose up -d db
cd server && npm install
npm run dev                  # API на :4000
npm test                     # Jest + supertest (база quizlive_test)
```

## Документация

- `docs/API.md` — описание эндпоинтов и мер безопасности
- `docs/postman/quizlive.postman_collection.json` — коллекция Postman (`node docs/postman/build-collection.js` пересобирает)

## Ветки

`ipr21` → `kr21` → `ipr22` → `kr22` → `main` (каждая ветка продолжает предыдущую).
