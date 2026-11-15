# QuizLive — платформа для проведения викторин и квизов в реальном времени

Курсовой проект по дисциплине «Интернет-технологии и веб-программирование» (БГУИР, дистанционная форма).

Ветка `ipr22` — ИПР №2 «Деплой и мониторинг приложения»: CI/CD на GitHub Actions, автодеплой на собственный VPS (Docker Compose, nginx, HTTPS), мониторинг uptime (Uptime Kuma), сбор логов (Grafana Loki), сбор ошибок (GlitchTip), эндпоинты `/health` и `/metrics`, страница метрик, уведомления в Telegram.

## Запуск (Docker)

```bash
cp .env.example .env        # при необходимости поправьте секреты
docker compose up -d --build
```

| Сервис | Адрес |
|---|---|
| Веб-приложение (nginx + React) | http://localhost:8080 |
| API | http://localhost:4000 (`/health`, `/metrics`, `/status`); через веб — http://localhost:8080/api |
| Swagger UI | http://localhost:4000/docs |
| PostgreSQL | localhost:5433 (`quiz` / `quiz`, база `quizlive`) |

Администратор создаётся автоматически из `ADMIN_EMAIL` / `ADMIN_PASSWORD` (по умолчанию `admin@quizlive.local` / `Admin#12345`).

## Локальная разработка и тесты

```bash
docker compose up -d db
cd server && npm install
npm run dev                  # API на :4000
npm test                     # Jest + supertest (база quizlive_test)
```

## Клиент (локально)

```bash
cd client && npm install && npm run dev   # http://localhost:5173, API проксируется на :4000
```

## E2E-тесты (Playwright, Chrome)

```bash
RATE_LIMIT_AUTH_MAX=5000 RATE_LIMIT_MAX=100000 docker compose up -d --build   # лимиты подняты, чтобы тесты не упирались в rate limiting
cd e2e && npm install && npx playwright test
```

## Продакшен

| Что | Ссылка |
|---|---|
| Приложение (frontend) | https://quizlive.cloudyyy.tech |
| API (backend) | https://quizlive.cloudyyy.tech/api — [`/health`](https://quizlive.cloudyyy.tech/api/health), [`/metrics`](https://quizlive.cloudyyy.tech/api/metrics), [Swagger](https://quizlive.cloudyyy.tech/api/docs) |
| Дашборд метрик | https://quizlive.cloudyyy.tech/api/status |
| Мониторинг uptime (Uptime Kuma) | https://uptime.quizlive.cloudyyy.tech/status/quizlive |
| Сбор ошибок (GlitchTip) | https://errors.quizlive.cloudyyy.tech |
| Логи (Grafana + Loki) | https://logs.quizlive.cloudyyy.tech |
| CI/CD (GitHub Actions) | https://github.com/cloud-yyy/quizlive/actions |
| Уведомления | Telegram-бот «monitoring»: сборка (GitHub Actions) и падение сервера (Uptime Kuma) |

Деплой — автоматически при push в `main` или `ipr22`. Устройство сервера, первичная настройка и секреты — `docs/DEPLOY_AND_MONITORING.md`. Продакшен-стек локально: `cp deploy/.env.prod.example .env`, заполнить, `docker compose -f docker-compose.prod.yml up -d --build`.

## Документация

- `docs/API.md` — описание эндпоинтов и мер безопасности
- `docs/DEPLOY_AND_MONITORING.md` — CI/CD, деплой на VPS, мониторинг, GlitchTip, Loki, Telegram
- `docs/postman/quizlive.postman_collection.json` — коллекция Postman (`node docs/postman/build-collection.js` пересобирает)

## Ветки

`ipr21` → `kr21` → `ipr22` → `kr22` → `main` (каждая ветка продолжает предыдущую).
