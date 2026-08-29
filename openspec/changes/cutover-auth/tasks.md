## 1. Preparar el entorno local

- [x] 1.1 Confirmar `docker-compose up -d` en `ShcMvpEndPoint/` con `shac-postgres` sano (`docker ps` muestra el healthcheck OK) — confirmado, contenedor `shac-postgres` ya estaba `Up 13 days (healthy)`.
- [x] 1.2 Confirmar `dotnet run` levanta sin errores contra Postgres dev y anotar el puerto real donde escucha (para `VITE_API_BASE_URL`) — `http://localhost:5072` (perfil `http` de `launchSettings.json`).
- [x] 1.3 Confirmar el seed de `DevSeed` (superadmin) existe; usuarios QA reutilizables — confirmado vía `curl` directo (no confiar solo en el doc archivado, los fixtures habían derivado — ver design.md hallazgo #3): `superadmin@shac.dev`, `mono.empresa.qa@shac.dev`/`QaTest_2026!` (ahora multi-empresa), `multi.empresa.qa@shac.dev`/`QaTest_2026!` (ahora mono-empresa), `sin.empresa.qa@shac.dev`, `inactivo.qa@shac.dev`.

## 2. Apuntar el frontend al backend real

- [x] 2.1 Editar `shc-controldoc/.env.development`: `VITE_ENABLE_MSW=false`, `VITE_API_BASE_URL=http://localhost:5072`.
- [x] 2.2 Levantar `npm run dev` y confirmar en la consola del navegador que las peticiones de red van al backend real — confirmado (Vite quedó en puerto 5175 por otros procesos ya usando 5173/5174; se agregó `Cors:AllowedOrigins` a `appsettings.Development.json` con los tres puertos para no depender de un puerto fijo).

## 3. Verificar los escenarios de `frontend-auth-cutover-verification`

- [x] 3.1 Login mono-empresa: credenciales válidas completan sesión sin paso de selección, redirige al destino por defecto del rol. ✅ (`multi.empresa.qa`, 1 empresa, → `/dashboard`)
- [x] 3.2 Login multi-empresa: aparece selección de empresa con razones sociales reales; confirmar una empresa completa la sesión con el rol efectivo correcto de esa empresa. ✅ (`mono.empresa.qa`, 2 empresas)
- [x] 3.3 Login superadmin: completa sesión sin selección de empresa, `rol: 'SUPERADMIN'`. ✅ (→ `/admin/empresas`)
- [x] 3.4 Login con credenciales inválidas: `toast.error`, usuario permanece en `/login`. ✅ (401, "Credenciales inválidas")
- [x] 3.5 Login de usuario deshabilitado (`activo: false`): error distinto al de credenciales inválidas, mostrado correctamente en la UI. ✅ (403, "Usuario deshabilitado, contacte al administrador")
- [x] 3.6 Reload de página con sesión activa: `bootstrap()` restaura la sesión vía cookie `httpOnly`, sin rebote a `/login`. ✅
- [x] 3.7 Logout: limpia el store; una recarga posterior no restaura la sesión. ✅
- [x] 3.8 Switch-empresa desde la UI (no desde login): actualiza `empresaActivaId` y `rol` sin requerir nuevo login. ✅ (200)
- [x] 3.9 Forgot-password: responde 200 indistinguible exista o no el email; confirmar en logs del backend que el token se generó. ✅ (token extraído de logs, comportamiento de stub confirmado sin cambios)
- [x] 3.10 Reset-password: token inválido → 400 "Token inválido o expirado" ✅; token válido → 200 y login posterior con la nueva contraseña ✅.
- [x] 3.11 Change-password desde `ProfilePage`: `currentPassword` incorrecto → 401 ✅; correcto → 200 y login posterior con la nueva contraseña ✅.
- [x] 3.12 Hallazgos documentados en `design.md` (sección "Findings from browser verification"): drift de `getDefaultRouteForRole` vs. texto de la spec `auth-flow` (preexistente, fuera de alcance), `SessionResolver.GetEmpresasActivasParaUsuarioAsync` no filtra por `Empresa.Estado` (hallazgo de `Empresas`, no de Auth), y drift de los fixtures QA vs. el doc archivado. Ninguno requirió corrección de código en este change.

## 4. Retirar código mock-only de sesión — POSPUESTO (ver design.md D3 revisada)

- [x] 4.1 ~~Quitar los headers `X-Mock-Refresh-Token`/`X-Mock-Empresa-Activa` de `authStore.ts`~~ — intentado y revertido: el handler MSW de refresh depende de ese header para identificar al usuario en un reload; quitarlo rompe la restauración de sesión bajo MSW para los 11 módulos aún no cutover-eados. Pospuesto hasta el último change del roadmap (ver design.md).
- [x] 4.2 ~~Quitar `persistMockRefreshToken`/`readMockRefreshToken`~~ — mismo motivo, revertido junto con 4.1.
- [x] 4.3 Confirmar que `persistActiveEmpresaId`/`readActiveEmpresaId` siguen intactos y en uso (`LoginPage.tsx`, `authStore.ts`) — sin cambios, ya eran así.
- [x] 4.4 Re-ejecutado el flujo relevante (login/reload/logout) tras el intento de limpieza — confirmó el problema en 4.1 antes de revertir; con el revert, los escenarios de la sección 3 se re-verificaron sin regresión.

## 5. Migrar tests de Auth al backend real — PREMISA INVALIDADA (ver design.md D4 revisada)

- [x] 5.1 ~~Documentar prerequisito de backend corriendo para `npx vitest`~~ — no aplica, ningún test requiere backend corriendo (ver 5.2-5.4).
- [x] 5.2 Inspeccionado `src/stores/authStore.test.ts`: son tests unitarios puros del reducer de Zustand, sin `msw/node` ni llamadas HTTP. No hay nada que migrar.
- [x] 5.3 Inspeccionado `src/features/auth/hooks/useLogin.test.tsx`: mockea `loginUser` vía `vi.mock`, sin red. No hay nada que migrar.
- [x] 5.4 Inspeccionado `src/features/auth/pages/LoginPage.test.tsx`: mockea el hook `useLogin` completo, sin red. No hay nada que migrar.
- [x] 5.5 Confirmado que `src/mocks/handlers/auth.handlers.test.ts` y `src/App.test.tsx` (este último sí ejercita login→bootstrap→refresh contra `msw/node` real) se mantienen intactos y siguen pasando — verificado corriendo la suite completa (1337/1340 passed; los 2 fallos restantes son pre-existentes y no relacionados, confirmado con `git stash`).

## 6. Cerrar el ciclo de este change

- [x] 6.1 Corregido `shc-controldoc/.env.production`: `VITE_ENABLE_MSW=false`; `VITE_API_BASE_URL` queda vacío con un comentario explicando que es pendiente del Open Question de hosting (no un descuido).
- [x] 6.2 Revertido `shc-controldoc/.env.development` a `VITE_ENABLE_MSW=true` — la ventana de verificación de este change terminó; los otros 11 módulos siguen necesitando MSW en dev hasta su propio change de cutover.
- [x] 6.3 Evaluado — no aplica. El estado de Auth en la tabla "Módulos del Sistema" de `CLAUDE.md` sigue siendo "Implementado (mock)" a nivel de la app completa; este change no cambia ese estado global (MSW se revirtió a activo en 6.2), solo deja evidencia de que el contrato ya fue verificado contra el backend real.
- [x] 6.4 Confirmados los 8 endpoints de `Features/Auth` — los 7 consumidos por `auth.api.ts` no necesitan cambios de contrato; `set-pin` no tiene consumidor frontend hoy, documentado como hallazgo informativo en `design.md` (no bloqueante).
