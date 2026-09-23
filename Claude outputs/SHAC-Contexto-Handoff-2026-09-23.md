# SHAC / AppCoDoc — Handoff de contexto para continuar en un chat nuevo

Fecha: 2026-09-23
Generado por: Cowork, al cierre de una sesión larga, para que un chat nuevo (Cowork u otro Claude)
retome sin fricción.

## Qué es este proyecto

SHAC (Sistema de Homologación y Auditoría de Calidad) es un sistema de gestión de calidad/seguridad
multi-tenant para minería/logística en Perú (ISO 9001/45001), en cutover de un frontend mockeado con
MSW hacia un backend .NET real.

- **Frontend**: `shc-controldoc` (React + TypeScript + TanStack Query + Zustand), repo en
  `C:\Users\ANTONIO\source\repos\OpenSpec\ShcMvp\shc-controldoc`.
- **Backend**: `ShcMvpEndPoint` (.NET 10, CQRS: Dapper para lecturas, EF Core para escrituras,
  vertical-slice `Features/<Modulo>/<Accion>/{Command,Validator,Handler,Endpoint}.cs`), mismo repo
  raíz, `C:\Users\ANTONIO\source\repos\OpenSpec\ShcMvp\ShcMvpEndPoint` — **ambos viven en el mismo
  repo git** (`ShcMvp`), no son checkouts separados.
- **OpenSpec**: `openspec/changes/<change-id>/` (`proposal.md`, `design.md`, `tasks.md`) →
  `openspec/changes/archive/<fecha>-<change-id>/` al archivar.

## La metodología de 3 roles (fija, no cambiar sin que Toño lo pida)

1. **Cowork** (yo, esta sesión/rol) investiga el código real vía device bridge (acceso al equipo
   Windows de Toño) y escribe **solo instrucciones en prosa** para Claude Code — nunca
   `proposal.md` ni código de producción directamente.
2. **Claude Code** (sesión local de Toño) implementa siguiendo el ciclo OpenSpec:
   `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`. Toño relaya el resultado con
   mensajes cortos tipo "listo, implementado".
3. **Cowork verifica independientemente** releyendo el código real (nunca confía en el autoreporte
   de Claude Code ni en el de Toño) y escribe un doc `SHAC-Verificacion-*.md`.

### Reglas fijas del proyecto (no negociables)

- Cowork nunca escribe `proposal.md` ni código de producción — solo prosa de instrucciones.
- El código real del frontend (especialmente los handlers MSW y los tipos TS) es la fuente de
  verdad, por encima de documentos de contrato reconstruidos e incluso por encima del texto literal
  del PRD cuando divergen.
- Toda ambigüedad genuina se escala a Toño como Decisión explícita (`D1`, `D2`, ...) en el
  `design.md` de cada change — nunca se resuelve en silencio.
- **Nunca confiar en un "ya quedó archivado" sin listar `openspec/changes/archive/` vía device
  bridge y confirmarlo.**
- Multi-tenancy: todo endpoint scoped filtra por `empresaId` de la sesión/JWT; un recurso cross-tenant
  o inexistente siempre devuelve 404 (nunca 403); las mutaciones fijan `empresaId` desde la sesión,
  nunca desde el body del cliente (única excepción deliberada y confirmada por Toño: sync offline de
  incidentes).
- CQRS: Dapper para lecturas, EF Core para escrituras; audit trail append-only.
- Notificaciones best-effort, siempre en try/catch, nunca bloqueantes.

## Roadmap de cutover — estado actual: **COMPLETO**

Los 8 módulos de dominio del roadmap original + Notificaciones (transversal, no estaba en el
roadmap original) están todos implementados, verificados independientemente por Cowork, y
**archivados**:

| Módulo | Verificado | Archivado |
|---|---|---|
| Auth | ✅ (sesión anterior) | ✅ (`2026-09-14-cutover-auth`) |
| Catálogos | ✅ (sesión anterior) | ✅ (`2026-09-12-fe-be-cutover-catalogos`) |
| Incidentes | ✅ 2026-09-15 | ✅ (`2026-09-15-cutover-incidentes`) |
| Documentos | ✅ 2026-09-15 | ✅ (`2026-09-15-cutover-documentos`) |
| No Conformidades | ✅ 2026-09-19 | ✅ (`2026-09-22-cutover-no-conformidades`) |
| Quality Events | ✅ 2026-09-22 | ✅ (`2026-09-22-cutover-quality-events`) |
| Usuarios | ✅ 2026-09-22 | ✅ (`2026-09-22-cutover-usuarios`) |
| Dashboard (8vo, último del roadmap original) | ✅ 2026-09-22 | ✅ (`2026-09-22-cutover-dashboard`) |
| **Notificaciones** (9no, transversal, no estaba en el roadmap original — lo preguntó Toño) | ✅ 2026-09-22 | ✅ (`2026-09-22-cutover-notificaciones`) |
| **Notificaciones en tiempo real** (resuelve el Open Question que dejó el anterior) | ✅ 2026-09-23 | ⏳ **sin archivar todavía** (`notificaciones-real-time`) |

`openspec/changes/` hoy solo debería tener `notificaciones-real-time/` pendiente de archivar — todo
lo demás ya está en `archive/`.

## Patrón de bugs que este proceso está diseñado para atrapar

Un mismatch de forma/nombre/tipo entre frontend y backend, invisible bajo MSW porque el mock nunca
lo ejercita. Ejemplos reales encontrados en esta serie (no exhaustivo, para dar la idea):

- PIN hardcodeado (`if (pin !== '1234')`) bloqueando firmas reales en QE.
- `revisarAjustePlazoAC` mandando `{accion: 'APROBAR'}` cuando el backend esperaba `{estado:
  'APROBADA'}` — defaulteaba en silencio al enum `0` sin error.
- `exportQualityEventPdf` tipado como `Promise<QualityEvent>` cuando el backend real responde `204
  No Content` — yo mismo concluí mal esto originalmente, Claude Code lo corrigió probando contra el
  backend real, y yo lo verifiqué y reconocí el error explícitamente.
- `NotificacionTipo` del frontend con solo 3 de los 7 valores reales del backend (hallazgo de
  Cowork, corregido en `cutover-notificaciones`).
- Un comentario de código (`useNotificationToast.ts`) que prometía una resolución de "push entre
  sesiones" que en realidad no existía — corregido dos veces en esta serie (primero para no mentir,
  después porque con SignalR sí pasó a ser parcialmente cierto).

## Lo más reciente — Notificaciones en tiempo real (cerrado 2026-09-23)

Toño preguntó por el estado de Notificaciones → Cowork encontró que era un 9no módulo pendiente
nunca cutover-eado (backend ya verificado en agosto, pero el contrato de red frontend↔backend real
nunca se probó) → se hizo ese cutover → quedó un Open Question: cómo se enteran los usuarios de una
notificación que no generaron ellos mismos (no había polling ni push). Toño decidió: **push real
(SignalR) para `SEVERIDAD_CRITICA`/`CIERRE`, polling liviano (60s) para los otros 5 tipos**.

Implementación verificada, arquitectura resultante:

- **Backend**: `NotificationsHub` (SignalR) en `/hubs/notifications`, grupos por
  `usuario-{usuarioId}`, JWT aceptado por query string (`?access_token=`) solo en ese path. El push
  se dispara desde un único helper compartido (`QualityEventNotificationSender.NotificarPorRolAsync`)
  con un filtro `if (tipo is SEVERIDAD_CRITICA or CIERRE)` después de `SaveChangesAsync`. Estos dos
  tipos **solo** los genera Quality Events hoy (confirmado por grep en todo el backend) — No
  Conformidades e Incidentes no disparan ninguno de los dos.
- **Frontend**: `@microsoft/signalr` nuevo, `useNotificationsHub()` montado una vez en
  `NotificationBell.tsx`, `useNotifications()` con `refetchInterval: 60_000`, y
  `useNotificationToast()` reconciliado con el hub vía un `NotificationToastHandle.markSeen()` para
  no duplicar toasts.
- **Hallazgo real encontrado y corregido por Claude Code durante su propia verificación**:
  `HubConnectionBuilder.build()` revienta de forma síncrona si `VITE_API_BASE_URL` está vacío (el
  estado normal en desarrollo con MSW) — rompía 12 tests no relacionados. Se corrigió con un guard
  explícito. Solo apareció porque corrieron la suite completa de tests, no solo los archivos
  tocados — lección reforzada una vez más en esta serie.
- **Otro hallazgo real**: `FirmarCierreQEHandler` solo notifica `CIERRE` para severidad
  `ALTA`/`CRITICA` (no `MEDIA`/`BAJA`) — comportamiento preexistente, documentado, no un bug de este
  change.

Verificación independiente de Cowork: **aprobada**, releyendo cada archivo tocado (backend y
frontend) contra las afirmaciones de `design.md`/`tasks.md`, sin ninguna discrepancia encontrada.

## Open Questions activos (ninguno bloqueante)

1. **Hosting/dominio de producción** — heredado de `cutover-auth`, presente en el `design.md` de
   *todos* los changes de esta serie. **Toño decidió explícitamente dejarlo para el final** —
   no resurgir esto hasta que él lo pida.
2. **Escalamiento de conexiones SignalR persistentes en producción** (memoria del proceso, sticky
   sessions si algún día hay más de una instancia del backend detrás de un load balancer) — nuevo,
   surgido de `notificaciones-real-time`, decisión de infraestructura futura, no bloquea nada hoy.
3. Edge case documentado, sin caso de uso confirmado: si un usuario tuviera dos pestañas con
   empresas activas distintas, el grupo del hub SignalR es por `usuarioId`, no por `empresaId` —
   podría recibir push de una empresa que no es la activa en esa pestaña. No resuelto a propósito,
   sin evidencia de que ocurra en la práctica.

## Housekeeping pendiente (no bloqueante, a discreción de Toño)

- Archivar `openspec/changes/notificaciones-real-time/` (Cowork ya recomendó hacerlo, sin ningún
  motivo para retenerlo).

## Acceso técnico / cómo retomar la investigación

- El acceso al código real es vía **device bridge** (herramientas `mcp__remote-devices__*`) al
  equipo Windows de Toño, carpeta conectada
  `C:\Users\ANTONIO\source\repos\OpenSpec\ShcMvp`. Cuando ese bridge esté disponible en el chat
  nuevo, listar `openspec/changes/` y `openspec/changes/archive/` primero para confirmar el estado
  real antes de asumir nada de este resumen (el estado puede haber cambiado si Toño trabajó fuera de
  esta conversación).
- `device_bash` (shell remota) ha estado intermitentemente caída por un bug de Windows conocido del
  lado del bridge ("Workspace unavailable... Windows update released September 8") — cuando falla,
  usar `device_list_dir` + `device_stage_files` (leer archivos vía `Read` sobre la ruta staged en
  `/mnt/user-data/uploads/ShcMvp/...`) en su lugar, funciona igual de bien para investigación
  read-only.
- Todos los docs de instrucciones (`INSTRUCCIONES-CLAUDE-CODE-*.md`) y de verificación
  (`SHAC-Verificacion-*.md`) de toda la serie están guardados en este Project ("AppCoDoc"), bajo el
  prefijo `claude/` — son el historial completo, con fecha, de cada decisión y cada hallazgo. Este
  archivo es un resumen, no un reemplazo — para el detalle de un módulo específico, leer su par de
  docs (instrucciones + verificación) directamente del Project.

## Qué falta hacer (no hay ninguna tarea abierta ahora mismo)

En este momento **no hay ningún módulo con cutover pendiente ni ninguna instrucción esperando
implementación**. El roadmap original de 8 módulos + Notificaciones + Notificaciones en tiempo real
está completo y verificado. El chat nuevo debería:

1. Confirmar con Toño si hay un módulo/feature nuevo que atacar, o si el pedido es otro tipo de
   trabajo (bug fix puntual, mejora, nueva capacidad).
2. Si Toño reporta algo como "ya lo implementé" sobre `notificaciones-real-time` o cualquier archive
   pendiente, seguir el mismo patrón: nunca aceptar el autoreporte sin releer el código real primero.
3. Si Toño pregunta por el Open Question de hosting, recordar que fue decisión suya dejarlo para el
   final — no resolverlo unilateralmente ni presionar para resolverlo antes de que él lo pida.
