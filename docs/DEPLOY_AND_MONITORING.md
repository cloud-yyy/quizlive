# Деплой, CI/CD и мониторинг (ИПР 2)

Всё работает на собственном VPS (on-premise), без внешних облачных сервисов: приложение, база, мониторинг uptime, логи и сбор ошибок подняты в Docker Compose рядом друг с другом. Снаружи используются только GitHub Actions (CI/CD) и Telegram Bot API (уведомления).

## Схема

```
GitHub (push) ──► GitHub Actions: lint → tests → docker build → deploy (SSH) → Telegram
                                                        │
VPS ────────────────────────────────────────────────────▼──────────────────────────
  nginx (HTTPS, Let's Encrypt)
   ├─ quizlive.cloudyyy.tech          → web (nginx + React)  → /api → server (Node.js) → db (PostgreSQL)
   ├─ uptime.quizlive.cloudyyy.tech   → Uptime Kuma   — проверки /health и главной, алерты в Telegram
   ├─ errors.quizlive.cloudyyy.tech   → GlitchTip     — ошибки backend (@sentry/node) и frontend (@sentry/react)
   └─ logs.quizlive.cloudyyy.tech     → Grafana ← Loki ← server (winston-loki)
```

| Требование ИПР 2 | Чем закрыто | Где в репозитории |
|---|---|---|
| CI/CD | GitHub Actions: ESLint/oxlint, Jest (с PostgreSQL), сборка Docker-образов, деплой по SSH, Telegram | `.github/workflows/deploy.yml` |
| Деплой backend + frontend | `docker compose` на VPS, вызывается из CI скриптом | `docker-compose.prod.yml`, `deploy/deploy.sh` |
| База данных | PostgreSQL 16 в контейнере, данные в volume | `docker-compose.prod.yml` |
| HTTPS | nginx на хосте + Let's Encrypt (certbot) | `deploy/nginx/`, `deploy/setup-host.sh` |
| Мониторинг uptime | Uptime Kuma (self-hosted), проверка раз в 60 с | `deploy/uptime-kuma-setup.js` |
| Логи | Grafana Loki + Grafana, транспорт `winston-loki`; дашборд «QuizLive — логи» | `server/src/utils/logger.js`, `deploy/loki/`, `deploy/grafana/` |
| Сбор ошибок | GlitchTip (open-source, совместим с Sentry SDK) | `server/src/utils/monitoring.js`, `client/src/main.jsx` |
| Тестовая ошибка | `GET /api/debug/error` (только admin) | `server/src/routes/system.js` |
| `/health`, `/metrics`, страница метрик | статус API и БД; uptime, память, нагрузка CPU, счётчик запросов; `/api/status` | `server/src/routes/system.js`, `server/src/utils/metrics.js` |
| Telegram | сборка — job `notify`; падение — уведомление Uptime Kuma | `.github/workflows/deploy.yml` |

## Первичная настройка VPS (один раз)

1. Docker и Docker Compose, пользователь в группе `docker`. DNS: `quizlive` и `*.quizlive` → IP сервера.
2. Код: `git clone https://github.com/cloud-yyy/quizlive ~/apps/quizlive`.
3. Окружение: `cp deploy/.env.prod.example .env && chmod 600 .env`, заполнить секреты (`openssl rand -hex 32`).
4. Стек: `bash deploy/deploy.sh ipr22` (или `main`).
5. nginx и сертификат: `sudo bash deploy/setup-host.sh`.
6. GlitchTip: создать суперпользователя `docker compose -f docker-compose.prod.yml exec glitchtip ./manage.py createsuperuser`, в веб-интерфейсе — организацию и два проекта (Node.js, React), их DSN записать в `.env` (`SENTRY_DSN`, `VITE_SENTRY_DSN`) и повторить деплой.
7. Uptime Kuma: `deploy/uptime-kuma-setup.js` создаёт администратора, мониторы HTTP(s) на `https://quizlive.cloudyyy.tech/api/health` и `https://quizlive.cloudyyy.tech/` (раз в 60 с, повтор через 30 с, контроль срока сертификата) и публичную статус-страницу `/status/quizlive`:
   `docker compose -f docker-compose.prod.yml exec -T -e KUMA_USER -e KUMA_PASS uptime-kuma node - < deploy/uptime-kuma-setup.js`.
   Уведомление Telegram (токен бота, chat id) добавляется в веб-интерфейсе: Settings → Notifications, «Применить ко всем мониторам».
8. Ключ деплоя: отдельная пара `ssh-keygen -t ed25519`, публичный ключ в `~/.ssh/authorized_keys` с ограничением
   `command="/home/cloudy/apps/quizlive/deploy/deploy.sh",restrict ssh-ed25519 AAAA… github-actions-deploy`.

## Секреты и переменные GitHub (Settings → Secrets and variables → Actions)

| Имя | Тип | Значение |
|---|---|---|
| `VPS_SSH_KEY` | secret | приватный ключ деплоя |
| `TELEGRAM_BOT_TOKEN` | secret | токен бота от @BotFather |
| `VPS_HOST`, `VPS_PORT`, `VPS_USER` | variable | адрес, SSH-порт и пользователь сервера |
| `VPS_KNOWN_HOSTS` | variable | вывод `ssh-keyscan -p <port> <host>` (защита от подмены сервера) |
| `TELEGRAM_CHAT_ID` | variable | id чата для уведомлений |

Секреты приложения (JWT, пароли БД и администраторов, ключ GlitchTip) в GitHub не хранятся: они лежат только в `.env` на сервере (права `600`).

## Безопасность

- Все контейнеры слушают только `127.0.0.1`, наружу открыт лишь nginx (80/443); PostgreSQL и Loki недоступны из интернета.
- Ключ CI может выполнить на сервере только `deploy/deploy.sh` (forced command + `restrict`), и только для веток `main` / `ipr22` / `kr22`.
- Sentry SDK `beforeSend` вырезает cookies, `Authorization` и тело запроса; в логи не пишутся пароли и токены.
- Регистрация в GlitchTip и Grafana закрыта, вход только для администратора.
- Логи хранятся 14 дней (Loki), события ошибок — 30 дней (GlitchTip), у Docker-логов ротация 3 × 10 МБ.
