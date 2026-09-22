# Verificación — Cutover: Usuarios

Fecha: 2026-09-22
Autor: Cowork, verificación independiente vía device bridge (funcionando normalmente esta sesión).

Conclusión: **aprobado**. Segundo cutover de la serie (después de No Conformidades) sin ningún
cambio de código, ni backend ni frontend — la investigación previa no encontró mismatch y la
verificación real lo confirma sin sorpresas.

## 1. El punto que yo había dejado abierto — resuelto y confirmado

Mis instrucciones originales dejaban como "a confirmar durante la verificación" si `/usuarios`
tenía guard de ruta para roles sin permiso. `design.md` (D1) lo resuelve por lectura directa de
código, no como pregunta abierta: `router/routeAccess.ts:51` define
`usersAdmin: ['ADMINISTRADOR_EMPRESA']` y `router/index.tsx:211` envuelve `/usuarios` en
`<RoleGuard requiredRoles={ROUTE_ROLE_GROUPS.usersAdmin} />` — coincide con `canAdminister` de
`UserList.tsx`. Confirmado en `tasks.md` 4.2: un actor `JEFE_CALIDAD_SYST` contra `GET /api/users`
responde 403 real. No verifiqué el redirect de UI por clic (sin herramienta de navegador en esa
sesión tampoco), pero la lectura de código citada es concreta (archivo + línea) y consistente con
el patrón `RoleGuard` ya usado en el resto de la app.

## 2. Verificación funcional — sin discrepancias

`tasks.md` documenta un ciclo de verificación completo por API directa contra el backend real:
listado con filtros, creación (`OPERARIO` simple, `SUPERVISOR` con validación de área obligatoria,
avatar válido/inválido), las dos variantes del 409 de email duplicado (con una nota honesta de que
el primer intento de la variante "otra empresa" se contaminó por reusar un usuario que sin querer
ya tenía asignación en la empresa activa — no fue un bug de la app, fue un error de metodología del
propio test, correctamente diagnosticado y corregido en el momento), edición con el 409
verificado como "no deja campos a medio actualizar", `toggle-active` sin validación de bloqueo, y
reset de contraseña generando una contraseña distinta de la de creación.

El hallazgo más interesante a verificar era D5 (independencia de `Rol` entre empresas) — lo
comprobaron con un usuario real en dos empresas: cambiar su rol en una empresa (`ADMINISTRADOR_EMPRESA`
→ edita a `JEFE_CALIDAD_SYST`) no tocó su rol `SUPERVISOR` en la otra empresa, confirmado
consultando ambas asignaciones por separado. Esto es exactamente el bug del mock que el comentario
del código ya decía que corregía — bien verificado con un caso real, no solo por lectura.

También verificaron la excepción `SUPERADMIN` de `GET /api/users` (D9): devuelve usuarios de todas
las empresas con `rol: null` en el 100%, coincidente con lo esperado — y no encontraron ningún
punto de la UI que la ejercite, consistente con lo que ya sabíamos (la página que ve `SUPERADMIN`
usa un endpoint distinto, ya cutover-eado en `cutover-catalogos`).

## 3. Estado real de archivo y entorno

- **`openspec/changes/cutover-usuarios/` sigue activo, no archivado** — confirmado listando
  `openspec/changes/` (`archive/`, `cutover-no-conformidades/`, `cutover-quality-events/`,
  `cutover-usuarios/`). Los dos anteriores siguen sin archivar también, como ya sabíamos.
- **`.env.development` revertido**: confirmé leyendo el archivo real —
  `VITE_API_BASE_URL=` (vacío), `VITE_ENABLE_MSW=true`. Estado original restaurado.
- **`.env.production` no tocado** (coherente con el Non-Goal explícito).

No encontré nada pendiente de corregir. Con Dashboard como único módulo de dominio restante del
roadmap original, la serie de cutovers está prácticamente completa — quedan tres `openspec/changes/`
sin archivar (No Conformidades, Quality Events, Usuarios) y Dashboard sin empezar.

## 4. Qué sigue

Con Auth, Catálogos, Incidentes, Documentos, No Conformidades, Quality Events y Usuarios
cutover-eados y verificados, queda Dashboard — el último módulo de dominio del roadmap original.
Avisame cuando quieras que empiece esa investigación.
