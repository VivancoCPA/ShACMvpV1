## 1. Preparar el entorno local

- [x] 1.1 Confirmar `docker-compose up -d` en `ShcMvpEndPoint/` con `shac-postgres` sano — confirmado, `shac-postgres` estaba `Up 11 days (healthy)`, ya arriba de una sesión anterior.
- [x] 1.2 Confirmar `dotnet run` levanta sin errores contra Postgres dev, anotar el puerto real — confirmado, backend ya corriendo en `http://localhost:5072` (responde 401 en `GET /api/users` sin token).
- [x] 1.3 Confirmar que los usuarios QA multi-empresa reutilizables siguen sirviendo para probar Usuarios como `ADMINISTRADOR_EMPRESA` — **ninguno de los dos tenía ese rol** (`multi.empresa.qa` es `JEFE_CALIDAD_SYST` mono-empresa; `mono.empresa.qa` es multi-empresa con `JEFE_CONTROL_DOCUMENTARIO`/`SUPERVISOR`/`ADMINISTRADOR_SISTEMA` en sus 3 empresas, ninguna `ADMINISTRADOR_EMPRESA`). Verificado por API directa como `SUPERADMIN` (`GET /api/empresas/:id/usuarios` en las 4 empresas existentes) que no hay ningún `ADMINISTRADOR_EMPRESA` en todo el dataset dev. Se creó una empresa QA dedicada ("Cutover Usuarios QA S.A.C.", `POST /api/empresas` como `SUPERADMIN`) y se asignó `mono.empresa.qa@shac.dev` a ella con rol `ADMINISTRADOR_EMPRESA` vía `AsignarUsuarioEmpresa` — no se tocó ninguna asignación existente, solo se sumó una nueva. Login confirmado con `empresaId` de la nueva empresa en el payload de `POST /api/auth/login` devuelve `rol: 'ADMINISTRADOR_EMPRESA'`.

## 2. Confirmar que no hay mismatch de contrato (re-verificación previa a tocar el entorno)

- [x] 2.1 Releer `ActualizarUsuarioHandler.cs`/`CrearUsuarioHandler.cs`/`ToggleActivoUsuarioHandler.cs`/`ResetPasswordUsuarioHandler.cs`/`ListarUsuariosHandler.cs` y confirmar que siguen coincidiendo con `users.api.ts` — confirmado, `git diff --stat` sobre `Features/Users` desde la verificación previa de esta sesión (propose) da vacío.
- [x] 2.2 Releer `Extensions/EndpointExtensions.cs` y confirmar que las 5 rutas de Usuarios siguen registradas sin cambios — confirmado, mismo `git diff --stat` vacío incluye `EndpointExtensions.cs` y `users.api.ts`.
- [x] 2.3 Sin discrepancias detectadas — no aplica documentar nada nuevo en `design.md`.

## 3. Apuntar el frontend al backend real

- [x] 3.1 Editado `shc-controldoc/.env.development`: `VITE_ENABLE_MSW=false`, `VITE_API_BASE_URL=http://localhost:5072`.
- [x] 3.2 Ver nota de metodología (tasks.md, más abajo, sección 4): sin herramienta de automatización de navegador disponible en este entorno (sin Playwright/similar) — se verifica el contrato completo por API directa (`curl`, JWT real por login) en vez de clic en la UI, mismo criterio que `cutover-no-conformidades`. Login confirmado contra el backend real con `mono.empresa.qa@shac.dev` como `ADMINISTRADOR_EMPRESA` (ver 1.3).

## 4. Verificar listado y acceso por rol (frontend-usuarios-cutover-verification)

- [x] 4.1 Listado de Usuarios con filtros reales (`rol`, `activo`) contra `GET /api/users` — confirmado por API directa como `ADMINISTRADOR_EMPRESA` (`mono.empresa.qa` en "Cutover Usuarios QA S.A.C."): sin filtro, `?rol=ADMINISTRADOR_EMPRESA`, `?activo=true` devuelven el rol efectivo resuelto vía el JOIN a `usuarios_empresa`, coincidente con el rol real de la asignación.
- [x] 4.2 Confirmado por API directa: `GET /api/users` con un actor `JEFE_CALIDAD_SYST` (`multi.empresa.qa`, sin `ADMINISTRADOR_EMPRESA`/`SUPERADMIN`) responde 403. **Nota de metodología**: sin herramienta de automatización de navegador disponible en este entorno (sin Playwright/similar) — el guard de ruta del frontend (`RoleGuard` → redirect `/no-autorizado`) ya se confirmó por lectura directa de código en `design.md` D1 (`router/routeAccess.ts:51,85`, `router/index.tsx:211`), no se re-verifica por clic.

## 5. Verificar creación de Usuario

- [x] 5.1 Creado Usuario `OPERARIO` (`ana.prueba.cutover@shac.dev`) vía `POST /api/users` — confirmado: `rol: 'OPERARIO'`, `activo: true`, y `temporaryPassword` real devuelto en el mismo nivel que el resto de campos del usuario (coincide con el shape que `TemporaryPasswordModal`/`useCreateUser` esperan, `created.temporaryPassword` sin wrapper anidado).
- [x] 5.2 Confirmado que `SUPERVISOR` sin `areaId`/`areaIds` es rechazado (400, `"areaId es requerido para el rol SUPERVISOR"` + `"areaIds es requerido para el rol SUPERVISOR"`). Se creó un área de prueba (`POST /api/areas` como `JEFE_CALIDAD_SYST`, necesario asignar temporalmente ese rol a `multi.empresa.qa` en la empresa QA dedicada — sin afectar sus asignaciones existentes en otras empresas) y se creó `beto.supervisor.cutover@shac.dev` con `rol: 'SUPERVISOR'` + `areaId`/`areaIds` — ambos campos persistidos correctamente en la respuesta.
- [x] 5.3 Confirmada la validación de avatar espejada: `avatarBase64` con mime `text/plain` rechazado (400, `"El avatar debe ser JPEG o PNG"`); un PNG válido (1x1 mínimo) aceptado y persistido en `avatarUrl`.
- [x] 5.4 Confirmadas ambas variantes del 409: (a) mismo email ya en la empresa activa (`ana.prueba.cutover@shac.dev` repetido) → `"El email ya está en uso"`; (b) email existente en otra empresa, sin asignación en la empresa activa (`user-a6b08e71e6a942bfbd9e8ca1eb31e5f2@shac.pe`, usuario `SUPERVISOR` solo en otra empresa) → `"Este usuario ya está registrado en otra empresa. Para asignarlo también a esta empresa, contacta a un Superadmin."`. **Nota de metodología**: el primer intento de (b) usó `multi.empresa.qa@shac.dev`, que sin querer ya tenía asignación en la empresa activa (se le había dado `JEFE_CALIDAD_SYST` ahí mismo para crear el área de 5.2) — devolvió el mensaje simple de (a) correctamente, no es un bug, solo contaminación del propio test; se reintentó con un usuario genuinamente ausente de la empresa activa y el mensaje (b) salió como se esperaba.

## 6. Verificar edición de Usuario

- [x] 6.1 Editados nombre/apellido de `ana.prueba.cutover@shac.dev` vía `PATCH /api/users/:id` — confirmado: campos persistidos contra el backend real.
- [x] 6.2 Asignada `ana.prueba.cutover@shac.dev` a una segunda empresa (`QA Empresa Beta S.A.C.`) con rol `SUPERVISOR` vía `AsignarUsuarioEmpresa` (`SUPERADMIN`). Luego, desde la empresa activa original ("Cutover Usuarios QA S.A.C.", como `ADMINISTRADOR_EMPRESA`), se cambió su rol a `JEFE_CALIDAD_SYST` — confirmado: la respuesta del PATCH refleja `rol: 'JEFE_CALIDAD_SYST'`, y la fila `UsuarioEmpresa` de `QA Empresa Beta` (consultada como `SUPERADMIN` vía `GET /api/empresas/:id/usuarios`) sigue en `rol: 'SUPERVISOR'`, sin cambios. Confirma en el backend real el fix D5 del bug ya conocido del mock.
- [x] 6.3 Confirmado el 409 al editar: `PATCH` con `email` ya usado por otro usuario (`beto.supervisor.cutover@shac.dev`) junto con `nombre` en el mismo payload → 409, y una relectura posterior confirma que `nombre` NO cambió (el email fallido no dejó ningún campo a medio actualizar).

## 7. Verificar baja/reactivación y reseteo de contraseña

- [x] 7.1 Alternado `toggle-active` dos veces sobre `ana.prueba.cutover@shac.dev` (`true→false→true`) — confirmado, ambas operaciones exitosas (200) sin ninguna validación de bloqueo, coincidente con el diseño D6 (sin verificación de asignaciones QE/NC/Incidentes/AC).
- [x] 7.2 Reseteada la contraseña de `ana.prueba.cutover@shac.dev` vía `POST /:id/reset-password` — confirmado: nueva `temporaryPassword` generada (`p88xHUKi`), distinta de la contraseña de creación (`2wG81qsg`). **Nota de metodología**: el texto de ayuda de la UI sobre cómo compartir la contraseña temporal (`UserList.tsx`) no se verifica por clic al no haber herramienta de automatización de navegador en este entorno — ya está confirmado por lectura de código en cutovers/specs anteriores (M6-S07), fuera del alcance de re-verificar en este change centrado en contrato de red.

## 8. Verificar la excepción `SUPERADMIN` de `GET /api/users`

- [x] 8.1 Login como `SUPERADMIN` (`superadmin@shac.dev`) y `GET /api/users` sin empresa activa — confirmado: devuelve usuarios de todas las empresas (14,242 en este dataset dev acumulado, no relevante para el contrato) con `rol: null` en el 100% de los registros, coincidente con D9 de `be-crud-gestion-usuarios`.

## 9. Tests y cierre del ciclo

- [x] 9.1 Inspeccionados los cuatro archivos frontend que usan `setupServer`/`msw/node` en Usuarios: `mocks/handlers/users.handlers.test.ts` (testea los HANDLERS MSW mismos, `setupServer(...userHandlers, ...authHandlers)` — sin equivalente posible contra backend real), y `features/users/hooks/useUsers.test.ts`, `features/users/components/UserList.test.tsx`, `features/users/pages/ProfilePage.changePassword.test.tsx` (usan MSW como doble de red offline para ejercitar hooks/componentes reales — migrarlos requeriría levantar Postgres/backend real dentro de la suite de tests unitarios, fuera de alcance de este change). Ninguno de los cuatro se migra — mismo criterio y misma conclusión que `cutover-no-conformidades` 7.1/`cutover-incidentes` 10.1.
- [x] 9.2 Suite completa corrida sin regresiones: backend `dotnet test` → 451/451 passed; frontend `npx vitest run` → 1310 passed + 1 expected fail (mismo patrón pre-existente ya documentado en `cutover-auth`/`cutover-incidentes`/`cutover-no-conformidades`).
- [x] 9.3 Sin hallazgos reales que documentar — la verificación completa (secciones 4-8) confirmó exactamente el comportamiento ya descrito en `design.md`, sin ninguna discrepancia nueva. Único punto a mencionar: el `GET /api/users` de `SUPERADMIN` devolvió 14,242 usuarios (dataset dev acumulado de sesiones de prueba anteriores) — no es un hallazgo de contrato, solo volumen de datos de desarrollo; no requiere acción en este change.
- [x] 9.4 Revertido `shc-controldoc/.env.development` a `VITE_API_BASE_URL=`, `VITE_ENABLE_MSW=true` (estado original).
- [x] 9.5 Confirmado: `shc-controldoc/.env.production` no requiere cambios — ya tenía `VITE_ENABLE_MSW=false` desde `cutover-auth`, mismo Open Question de hosting pendiente.
- [x] 9.6 Evaluado — no aplica, mismo criterio que cutovers anteriores: el estado global de Usuarios en la tabla "Módulos del Sistema" de `CLAUDE.md` sigue siendo "Implementado (mock)" a nivel de toda la app hasta que Dashboard (único módulo de dominio restante) también tenga su cutover.
