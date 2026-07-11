# PiLLA — API para la app móvil (Rork / React Native)

La web y la futura app consumen **la misma API REST**, mismo origen.
Autenticación por header: `Authorization: Bearer <token>`. Todo devuelve JSON.
Esto cumple el punto #16: la arquitectura ya es "mobile-ready", sin rewrite.

## Bootstrap
- `GET /api/meta` — versión, módulos activos, categorías, esquema de auth *(público)*
- `GET /api/flags` — módulos encendidos (para ocultar features apagadas) *(público)*
- `GET /api/health` — estado del servidor

## Auth (devuelven `{ token, user? }`)
- `POST /api/auth/free-user` `{ code, password }` — consumidor (code = correo)
- `POST /api/auth/professional` `{ code, password }` — profesional
- `POST /api/auth/company` `{ code, password }` — empresa
- Registro: `POST /api/free-users/register`, `/api/professionals/register`, `/api/companies/register`
- Validar sesión: `GET /api/auth/<role>/check`

## Trabajos (#1) + Reputación (#4)
- `GET /api/jobs` · `POST /api/jobs` (consumidor) · `GET /api/jobs/mine`
- `POST /api/jobs/:id/proposals` (profesional) · `GET /api/jobs/:id/proposals` (dueño)
- `POST /api/jobs/:id/{select|complete|cancel}`
- `GET /api/proposals/mine` · `GET /api/reputation/:proId`

## Materiales (#5/#6)
- `GET /api/marketplace/search?q=&province=&maxPrice=&sort=price|rating`
- `GET /api/marketplace/materials` · `GET /api/marketplace/company/:id`

## Contenido (#8/#9)
- `GET /api/courses` · `GET /api/inspiration?category=`

## Calculadoras (#10)
- 100% cliente (fórmulas locales) — no requieren API.

## Bolsa de empleo (#7)
- `GET /api/vacancies` · `POST /api/vacancies` (empresa) · `GET /api/vacancies/mine`
- `POST /api/vacancies/:id/apply` (profesional) · `GET /api/vacancies/:id/applications` (empresa)
- `GET /api/applications/mine` (profesional)

## Reservas (#2)
- `POST /api/bookings` · `GET /api/bookings/mine` · `GET /api/bookings/received`
- `POST /api/bookings/:id/{confirm|decline|cancel}`

## Referidos (#11)
- `GET /api/referrals/me` · `POST /api/referrals/track` `{ code }`

## Notificaciones (#13)
- `GET /api/notifications` · `GET /api/notifications/unread-count`
- `POST /api/notifications/read-all` · `POST /api/notifications/:id/read`

## Push (preparado, #16)
`lib/notifications.js` expone `pushSend(userRef, payload)` — hoy es un stub no-op.
Para activarlo: registrar tokens de dispositivo por usuario e implementar el envío
a FCM/APNs dentro de `pushSend`. Todo lo demás (crear/listar notificaciones) ya
funciona igual para web y móvil.

## Admin
- `GET /api/admin/analytics/insights` — métricas completas (#15): conteos +
  rankings (profesionales más contratados, materiales más buscados, categorías).
- CRUD admin por módulo bajo `/api/admin/...` (feature-flags en `/api/admin/flags`).
