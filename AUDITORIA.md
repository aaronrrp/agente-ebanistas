# Auditoría Técnica PiLLA — v51 (julio 2026)

Auditoría completa del sistema realizada antes de aplicar cambios. Este documento
registra los hallazgos, lo que se corrigió en v51, y las recomendaciones que quedan
para ciclos futuros.

---

## 1. Arquitectura general

**Stack:** Node.js puro (`node:http`), cero dependencias npm, JSON files como
almacenamiento, frontend vanilla JS en un solo `app.js`, desplegado en Render
(free plan, filesystem efímero).

| Componente | Archivos | Estado |
|---|---|---|
| Servidor HTTP + rutas legacy | `server.js` (~2.150 líneas) | Sólido; if-chain legacy + `routeModules[]` moderno |
| Módulos de rutas | `routes/*.js` (10 módulos) | Patrón uniforme `handle(req,res,ctx)` |
| Helpers compartidos | `lib/shared.js`, `lib/activity-log.js` | Bien factorizado |
| Frontend | `app.js` (~12.000 líneas), `index.html`, `styles.css` | Monolítico pero organizado por secciones |
| PDF nativo | `pdf.js` | Sin dependencias, correcto |
| Datos | 15 archivos JSON + backup/restore | Atomic writes en todo |

**Veredicto:** la arquitectura es coherente con sus restricciones (cero deps,
Render free). El patrón `routeModules` permite crecer sin engordar el if-chain.

---

## 2. Sistema de usuarios y roles (máxima prioridad)

### Roles existentes y sus almacenes de sesión

| Rol | Login | Sesión | TTL | Rate limit login |
|---|---|---|---|---|
| Administrador | password (env) | `adminSessions` | 8 h | 8/min/IP ✓ |
| Ebanista | código + password opcional | `ebanistaSessions` | 24 h | 15/min/IP ✓ |
| Vendedor | código + password | `sellerSessions` | 24 h | 15/min/IP ✓ |
| Profesional | código + password | `professionalSessions` | 24 h | 15/min/IP ✓ |
| Empresa | código + password | `companySessions` | 24 h | 15/min/IP ✓ |
| Usuario gratuito | código + password | `freeUserSessions` | 24 h | ✓ |

### Fortalezas confirmadas (ya existían)

- **PBKDF2-SHA512 con 100.000 iteraciones + salt de 16 bytes** por usuario
  (equivalente práctico a bcrypt para este contexto; sin dependencias).
- **Comparaciones en tiempo constante** (`crypto.timingSafeEqual`) en contraseñas
  y en el password de admin (`safeCompare` con HMAC efímero).
- Tokens de sesión de 32 bytes aleatorios (`crypto.randomBytes`) — no adivinables.
- Intentos fallidos de login **registrados en el activity log** con IP.
- Sin cookies: tokens por header `Authorization: Bearer` → **CSRF no aplica**.
- Sin SQL: almacenamiento JSON → **SQL injection no aplica**.
- XSS: el cliente usa `escapeHtml()` de forma consistente en todos los templates
  revisados; las notas de admin se insertan con `textContent`.
- `atomicWrite()` (tmp + rename) en toda escritura → sin JSON corruptos por crash.

### Fallos encontrados y corregidos en v51

| # | Hallazgo | Gravedad | Fix |
|---|---|---|---|
| 1 | `ADMIN_PASSWORD` con default `admin1234` si faltaba la env var | **Crítica** | S1: en Render sin env var el login admin queda deshabilitado (503 + log). Fallback solo para desarrollo local |
| 2 | Botón "Admin" visible en el login público | Alta | S1: eliminado; acceso solo por ruta privada |
| 3 | `/api/upload-image` sin auth ni límite — cualquiera quemaba la cuota de Cloudinary | **Crítica** | S2: requiere cualquier sesión válida + 10/min/IP |
| 4 | Endpoints de IA sin rate limit — cualquiera quemaba el crédito de OpenAI | **Crítica** | S2: topes por IP en los 5 endpoints |
| 5 | Sesiones caducadas nunca purgadas si el token no vuelve a usarse (leak con miles de usuarios) | Media | S3: barrido central cada 10 min sobre los 6 stores |
| 6 | `Access-Control-Allow-Origin: *` en todas las APIs | Media | S3: eliminado (app same-origin) |
| 7 | `readBody` seguía acumulando el body en memoria tras superar 10 MB | Baja | S3: `req.destroy()` al superar el límite |
| 8 | Contraseña vacía podría hacer match si `ADMIN_PASSWORD` fuese null | Alta | S1: guard explícito antes del compare |

### Acceso administrativo (rediseñado en S1)

- La plataforma pública **nunca** muestra la opción Administrador.
- El login de admin solo aparece entrando por la **ruta privada** que sirve el
  servidor (`ADMIN_ACCESS_PATH`, configurable por env var en Render; default
  `/acceso-admin`). La ruta vive solo en el servidor — no aparece en `app.js`.
- La página del gate lleva `X-Robots-Tag: noindex, nofollow` y `no-store`.
- Defensas activas: rate limit 8/min/IP, intentos fallidos y rate-limited
  registrados en el activity log (visibles en Admin → Logs), comparación
  timing-safe, sesión de 8 h.

### Verificación de permisos por módulo (revisión endpoint por endpoint)

- `professionals.js` / `companies.js`: mutaciones `/api/admin/*` → `requireAdmin`;
  `/me` → sesión propia; registro público crea SIEMPRE `status: "pending"`
  (nunca visible sin aprobación); los listados públicos filtran `approved` y
  eliminan `passwordHash/passwordSalt` (`publicProfessional`/`publicCompany`).
- `ratings.js`: crear/editar exige sesión de cualquier rol; edición solo del
  propio rating (verifica `raterRole + raterId`); moderación → `requireAdmin`.
- `locations.js`: lecturas públicas, todo CRUD → `requireAdmin`.
- `ads.js`, `catalog.js`, `admin-config.js`, `admin-dashboard.js`: mutaciones
  → `requireAdmin` (verificado por conteo y lectura).
- `retazos.js`: publicar exige sesión (cualquier rol); moderación → admin.
- **No se encontró ningún endpoint que exponga datos de un rol a otro.**

### Recuperación de contraseñas

- Admin puede cambiar la contraseña de cualquier profesional/empresa desde el
  panel (v50 Fase D) — esta es la vía de recuperación oficial.
- No hay "enlace de recuperación por correo": requeriría un servicio de email
  (SMTP/API externa). Documentado como decisión, no como omisión — el proyecto
  es cero dependencias y sin proveedor de correo configurado.

---

## 3. Performance

### Corregido en v51 (S4)

- **gzip** en todos los estáticos de texto vía `node:zlib` (cero deps):
  `app.js` 630 KB → ~138 KB (−78 %), `styles.css` 70 KB → 12 KB.
- **Last-Modified + If-Modified-Since → 304**: las recargas no re-descargan nada.
- **Caché en memoria** de estáticos (buffer + gzip pre-comprimido, invalidada por
  mtime): el disco se lee y se comprime **una vez por deploy**, no por request.
- `Cache-Control: no-cache` (guardar pero revalidar): los deploys de Render se
  ven al instante, sin caches desactualizados.

### Consumo de OpenAI (ya estaba bien instrumentado; se reforzó)

Existente y verificado:
- Cadena de imágenes **gratis-primero**: Cloudflare FLUX → Together FLUX →
  gpt-image-1 (pago) → Pollinations (cliente).
- Log de costo estimado por llamada (`logEstimatedCost`) con tokens de la API.
- Router semántico que evita regenerar imagen en ajustes menores de un mueble
  ("cámbiale el color" no paga una imagen nueva).
- Modelo configurable por env (`OPENAI_MODEL`, default `gpt-4.1-mini` — barato).

Nuevo en v51: rate limits por IP en los 5 endpoints de IA/PDF (S2) — además de
seguridad, ponen un **techo duro al gasto por hora** incluso ante abuso.

### Memoria / CPU

- Barrido de sesiones (S3) elimina el único leak identificado.
- El rate-limit store ya tenía su propio barrido (verificado).
- JSON files se mantienen en memoria como arrays — correcto a esta escala;
  ver §4 para el plan de migración futura.

---

## 4. "Base de datos" (JSON files)

- **Integridad:** `atomicWrite` en todas las escrituras; sin riesgo de archivos
  truncados. Migraciones de esquema aditivas (`migrateTenants`, backfill de
  slugs v50) — nunca destructivas. ✓
- **Backup/restore:** todos los archivos de datos (15) incluidos, con
  `reload()` por módulo tras restaurar. Es el mecanismo de supervivencia al
  filesystem efímero de Render. ✓
- **Riesgo operativo conocido:** en Render free, TODO lo escrito tras el último
  deploy se pierde al reiniciar el contenedor. Disciplina necesaria: descargar
  backup desde Admin tras cambios importantes. (Alternativa de pago: Render Disk.)
- **Preparación para migración futura:** cada entidad ya tiene módulo propio con
  `load/save/reload` — el cambio a SQLite/Postgres sería localizado en esos
  puntos sin tocar la lógica de negocio. Recomendado cuando haya >5.000
  registros por entidad o >1 instancia.

---

## 5. UX / UI

- Login público simplificado: 4 pestañas (Ebanista/Profesional/Empresa/Vendedor)
  — la opción Admin ya no distrae ni expone superficie de ataque.
- Se mantiene la estética PiLLA (morado #3B2D8F / dorado #F5B400) y tipografía
  grande, adecuada para el público 30–60.
- Pendientes recomendados (no aplicados en este ciclo para no crecer el alcance):
  - Indicador de fuerza de contraseña en registros.
  - "Mostrar contraseña" (ojito) en los inputs de password.
  - Confirmación visual al copiar código de acceso tras registro.

---

## 6. Organización del código

- Corregido: handler muerto de `[data-public-tab]` (navegación pre-v47) eliminado.
- `app.js` (12k líneas) sigue monolítico **a propósito**: partirlo exigiría
  bundler (dependencia) o múltiples `<script>` con orden frágil. Está organizado
  por secciones con banners claros; se documenta como deuda aceptada.
- El if-chain legacy de `server.js` (tenants/sellers/handoffs) convive con
  `routeModules[]`; la ruta de migración es mover bloques al patrón moderno
  cuando se toquen por otra razón — no hacer big-bang.

---

## 7. Resumen de cambios v51

| Commit | Contenido |
|---|---|
| S1 | Acceso admin privado (sin botón público, ruta secreta, sin password default en prod) |
| S2 | Rate limits en IA/PDF + auth y límite en upload-image |
| S3 | Barrido de sesiones, CORS cerrado, readBody con corte real |
| S4 | gzip + 304 + caché de estáticos en memoria |
| S5 | Código muerto eliminado + este informe |

## 8. Recomendaciones futuras (orden sugerido)

1. **Correo transaccional** (recuperación self-service, notificación de
   aprobación): requiere decidir proveedor (Resend/SES/SMTP) — única función
   que pide romper la regla de cero dependencias, o usar fetch a su API REST.
2. **SQLite** (`node:sqlite`, built-in desde Node 22) cuando el volumen lo pida:
   elimina la disciplina de backups manuales de Render.
3. **Paginación** en listados públicos cuando haya >200 perfiles.
4. **CSP** (Content-Security-Policy): hoy bloqueada por estilos/handlers inline
   en index.html; requiere refactor previo de esos atributos.
5. Partir `app.js` por shells (public/admin/company/professional) si se adopta
   un bundler algún día.
