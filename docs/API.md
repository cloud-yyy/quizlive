# QuizLive API

Base URL (local): `http://localhost:4000` (via the web container: `http://localhost:8080/api`).
All bodies are JSON. Errors have the shape `{ "error": { "code", "message", "details?" } }`.
Authentication: `Authorization: Bearer <accessToken>`. The refresh token lives in an `httpOnly` cookie.

Roles (hierarchy): `user` < `moderator` < `admin`.

## Auth

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | public | `{ email, password, nickname? }` → `201 { user }`. Password: 8–72 chars, letter + digit + special char. Role is always `user`; unknown fields (e.g. `role`) → `400`. |
| POST | `/auth/login` | public | `{ email, password }` → `{ accessToken, user }` + refresh cookie. 5 failed attempts lock the account for 15 min (`423`, `Retry-After`). |
| POST | `/auth/refresh` | cookie | Rotates the refresh token, returns a new `accessToken`. Reusing an old token revokes all sessions. |
| POST | `/auth/logout` | cookie | Revokes the refresh token (`204`). |
| GET | `/auth/me` | user | Current user. |

## Users (admin only)

| Method | Path | Description |
|---|---|---|
| GET | `/users?page=&limit=` | Paginated list. |
| PATCH | `/users/:id/role` | `{ role: user|moderator|admin }` (not for yourself). |
| PATCH | `/users/:id/block` | `{ isBlocked }` (not for yourself). |
| DELETE | `/users/:id` | `204` (not for yourself). |

## Quizzes

Fields: `title` (3–120), `slug` (unique, `[a-z0-9-]`, auto-generated if omitted), `description`, `category`, `difficulty` (`easy|medium|hard`), `isPublic`, `status` (`draft|published|hidden`).

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/quizzes?page=&limit=` | public | Published public quizzes; authenticated users also see their own, staff sees all. |
| GET | `/quizzes/:id` | public* | *Drafts/hidden quizzes: owner and staff only (otherwise `404`). |
| POST | `/quizzes` | user | Create. `ownerId` is taken from the token. |
| PUT | `/quizzes/:id` | owner / admin | Update (partial). If a moderator hid the quiz, changing `status` is `403` for the owner. |
| DELETE | `/quizzes/:id` | owner / admin | `204`. |
| PATCH | `/quizzes/:id/moderation` | moderator+ | `{ status: published|hidden }`. |

### Search, filters, statistics (assignment “КР 1”)

`GET /quizzes` query: `q` (case-insensitive search in title/description), `category`, `difficulty`, `status`, `mine=true`, `sort=newest|oldest|title|questions`, `page`, `limit`. Each item has `questionCount`.

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/quizzes/stats` | public | `{ total, totalQuestions, byCategory[], byDifficulty[] }` of the published library. |
| GET | `/quizzes/categories` | public | Distinct categories (for filters). |

## Questions

Types: `single` (exactly 1 correct), `multiple` (≥ 1 correct), `truefalse` (2 options, 1 correct). 2–6 options, unique texts. `timeLimitSec` 5–120 (default 20), `points` 100–5000 (default 1000).

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/quizzes/:id/questions` | owner / admin | Questions with options and correct answers. |
| POST | `/quizzes/:id/questions` | owner / admin | `{ text, type?, timeLimitSec?, points?, options[] }` → `201`. |
| PUT | `/questions/:id` | owner / admin | Partial update; options are replaced when provided. |
| DELETE | `/questions/:id` | owner / admin | `204`; the last question of a published quiz cannot be deleted (`409`). |

`GET /quizzes/:id` includes questions; `isCorrect` is stripped for everyone except the owner and staff. A quiz can be published only with ≥ 1 question.

Interactive documentation: **Swagger UI at `/docs`**, raw spec at `/openapi.json`.

## Security measures (assignment “ИПР 1”)

Mandatory: Helmet, global rate limiting, input validation (Joi) on every endpoint, ORM (parameterised SQL), logging of suspicious actions (`logs/security.log`), role guard.
Additional (from the assignment table): **#3** password complexity · **#5** access JWT + refresh token in httpOnly cookie (rotation, reuse detection) · **#6** lock after 5 failed logins for 15 min · **#9** mass-assignment protection (unknown fields rejected) · **#19** HTML tags are stripped from free-text fields (`nickname`, quiz `title`, `description`, `category`) before validation and storage · **#22** CORS white list · **#24** generic errors in production.
