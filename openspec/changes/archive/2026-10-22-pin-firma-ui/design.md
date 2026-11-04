## Context

El backend .NET (`ShcMvpEndPoint`) ya implementa el mecanismo completo de PIN de firma:

- `ShacUser.PinHash` (nullable), hasheado con `IPasswordHasher<ShacUser>`.
- `POST /api/auth/set-pin` (`Features/Auth/SetPin/`) — autogestión, requiere `password` actual + `pin` de 4 dígitos.
- `PATCH /api/empresas/{empresaId}/usuarios/{usuarioId}/reset-pin` (`Features/Empresas/ResetPin/`) — solo `SUPERADMIN`.
- `FirmarPublicarDocumentoHandler` y `FirmarCierreQEHandler` ya exigen el PIN y ya lanzan `BusinessRuleException` cuando `PinHash` es `null` (texto fijo, sin código de error distinguible) y `UnauthorizedBusinessException` (401) cuando el PIN no coincide.

Nada de esto es invocable desde el frontend: ningún componente llama `set-pin` ni `reset-pin`, `UserDto` no expone si el usuario tiene PIN, y los dos modales de firma (`DocumentSignatureModal`, `PinModal` en `QECierreSection`) hablan de "contraseña" en vez de PIN y solo reaccionan al 401 — cualquier otro error (incluido "no tenés PIN configurado") se pierde en silencio. El mock MSW agrava el problema: `documents.handlers.ts` valida contra un `MOCK_PIN` fijo (`'123456'`, de 6 dígitos — inconsistente con la regla real de 4 dígitos) y `quality-events.handlers.ts` **no valida el PIN en absoluto** en `PATCH /:id/firmar-cierre`.

Este change cierra el circuito completo: backend expone el estado (`TienePinFirma`) y un código de error estable, y el frontend + MSW ganan los flujos de configurar/resetear PIN y corrigen ambos modales de firma.

## Goals / Non-Goals

**Goals:**
- Cualquier usuario puede configurar/cambiar su propio PIN desde `/perfil`, contra el backend real.
- Los dos modales de firma (documento, cierre de QE) usan lenguaje de PIN correcto, detectan "sin PIN configurado" antes de intentar firmar, y muestran visiblemente cualquier error de firma, no solo 401.
- `SUPERADMIN` puede resetear el PIN de un usuario asignado a una empresa desde `EmpresaUsuariosPage`.
- El mock MSW reproduce fielmente el contrato real (incluyendo el nuevo `errorCode`), para que el desarrollo sin backend siga siendo representativo.

**Non-Goals:**
- No se cambia el mecanismo de firma en sí (PIN de 4 dígitos + `IPasswordHasher`) ni las reglas de quién puede firmar qué (RN-DOC-004, RN-QE-004).
- No se extiende el permiso de reset de PIN a `ADMINISTRADOR_EMPRESA` — queda como pregunta abierta (ver más abajo), el endpoint se mantiene `SUPERADMIN`-only.
- No se toca `ForgotPasswordPage`/`ResetPasswordPage` (stub documentado aparte en CLAUDE.md) ni el cambio de contraseña de login (`user-profile-change-password`), que son mecanismos distintos.

## Decisions

**D1 — `errorCode` como campo nuevo en `ApiResponse<T>`, no como parsing de `Message`.**
Se agrega `string? ErrorCode` a `ApiResponse<T>` (`ShcMvpEndPoint.Domain/Common/ApiResponse.cs`) y un overload `ApiResponse.Fail(string message, string? errorCode = null, string[]? errors = null)`. `ApiExceptionHandler` mapea `BusinessRuleException.RuleCode` (que ya existe en el dominio, hoy sin consumidor) a `ErrorCode` para el caso 422. Se evita cualquier variante que obligue al frontend a comparar el texto de `message` — ese texto puede cambiar o traducirse a futuro.

**D2 — `PIN_NO_CONFIGURADO` se pasa como `ruleCode` en los dos `throw new BusinessRuleException(...)` ya existentes.**
`FirmarPublicarDocumentoHandler` y `FirmarCierreQEHandler` ya lanzan el mensaje correcto en el momento correcto (`actor.PinHash is null`); el único cambio es agregar el segundo argumento `ruleCode: "PIN_NO_CONFIGURADO"`. Ningún otro `BusinessRuleException` del código recibe código por ahora — no es necesario para este change y evita tocar handlers no relacionados.

**D3 — `TienePinFirma` se calcula en `UserDto.From`, nunca se persiste como campo propio.**
`UserDto.From(ShacUser user, ...)` ya es el único punto de construcción compartido por Login/Refresh/SwitchEmpresa (`Features/Auth/AuthDtos.cs:23`). Agregar `user.PinHash is not null` ahí cubre los tres flujos con un solo cambio, sin riesgo de que alguno quede desactualizado.

**D4 — Frontend: `tienePinFirma` vive en `authStore`/`User`, se actualiza localmente tras `set-pin`/`reset-pin` exitoso, sin refetch de sesión.**
Igual que cualquier otro campo de `User` en `authStore`. Tras un `set-pin` exitoso, el hook actualiza `user.tienePinFirma = true` en el store directamente (no hay endpoint de "refresh de sesión ligero"); tras un `reset-pin` desde `EmpresaUsuariosPage`, el usuario afectado normalmente no es la sesión actual (es `SUPERADMIN` reseteando a otro usuario), así que no aplica.

**D5 — Los modales de firma reciben `tienePinFirma` desde `useAuthStore`, no desde una llamada adicional.**
`DocumentSignatureModal` y `QECierreSection`/`PinModal` ya pueden leer `useAuthStore((s) => s.user)` (el segundo ya lo hace). Evita una petición extra solo para saber si mostrar el campo o el aviso.

**D6 — Un solo mecanismo de "error visible" en ambos modales: distinguir `errorCode === 'PIN_NO_CONFIGURADO'` del resto, no solo 401/genérico.**
`DocumentSignatureModal.onSubmit` hoy solo reacciona a `status === 401` (cualquier otro error, incluido "sin PIN", se pierde en silencio). `PinModal`/`QECierreSection` sí tiene manejo de error — `useFirmarCierre` ya trae un `onError` genérico que muestra `toast.error(backend.message)` para cualquier fallo — pero no distingue "sin PIN" (que debería ofrecer un link a `/perfil`, no solo un toast de texto) ni evita el intento cuando ya se sabe de antemano que no hay PIN. Se agrega en ambos: (1) si `tienePinFirma === false` al abrir el modal, ocultar el campo y mostrar directamente el aviso con link a `/perfil`, sin intentar enviar; (2) si el backend responde `errorCode: 'PIN_NO_CONFIGURADO'` (PIN reseteado entre que se abrió el modal y se envió), mostrar el mismo aviso en vez del toast genérico; (3) 401 → "PIN incorrecto" inline; (4) cualquier otro error → el mensaje del backend, visible (toast para el modal de QE, que ya sigue ese patrón; inline para el modal de documento, que no usa toast).

**D7 — PIN mock: campo `pin?: string` en texto plano en `MockUser`, igual que `password`.**
`MockUser` ya guarda `password: string` en texto plano (es mock, no hay hashing real). Se agrega `pin?: string` con la misma convención: `undefined` = sin PIN configurado (`tienePinFirma: false`), string de 4 dígitos = PIN configurado. `set-pin` valida `password` contra `user.password` (mismo patrón que `change-password`) y, si coincide, asigna `user.pin`. `reset-pin` pone `user.pin = undefined`.

**D8 — Ningún usuario semilla arranca con PIN configurado.**
Los 18 usuarios de `authFixtures` empiezan con `pin: undefined` (campo ausente). Esto es intencional: reproduce el estado real de un backend recién desplegado donde nadie tiene `PinHash` todavía, y obliga a que la prueba manual pase primero por el flujo "configurar PIN" antes de poder firmar — exactamente el bug que este change corrige. (Alternativa descartada: semillar un PIN fijo tipo `'1234'` para destrabar pruebas rápido — es el mismo antipatrón que ya causó un bug real en QE, mencionado explícitamente como algo a no repetir.)

**D9 — MSW de firma de documento y de cierre de QE validan contra `user.pin`, no contra un valor fijo del módulo.**
`documents.handlers.ts` deja de usar `MOCK_PIN = '123456'` para el endpoint de firma (ver impacto en D11 sobre otros usos de `MOCK_PIN`); `quality-events.handlers.ts` agrega la validación que hoy no existe. Ambos: `getUsersStore()` de `auth.fixtures.ts` (cross-domain store ya exportado, nunca el array estático) → si `!user.pin` responder 422 con `errorCode: PIN_NO_CONFIGURADO`; si `body.pin !== user.pin` responder 401.

**D10 — Acción "Resetear PIN" en `EmpresaUsuariosPage` sigue el patrón exacto de "Desactivar/Reactivar" (`ConfirmModal` + mutation + toast), no un modal nuevo desde cero.**
Mismo `ConfirmModal` ya usado para el toggle de estado; nuevo ícono (`KeyRound` de `lucide-react`, ya usado en otras partes del proyecto) en la columna de acciones, visible siempre en esta página (la ruta completa ya es `SUPERADMIN`-only vía `RoleGuard`/`routeAccess.ts`, no se necesita un segundo check de rol en el componente, igual que el botón de toggle existente no lo tiene).

**D11 — `documents.handlers.ts` tiene dos endpoints de firma; solo uno está realmente en uso.**
`POST /api/documents/:id/sign` (campo `pin`) es el que llama `documents.api.ts`/`useSignDocument` — ese es el que migra a validar contra `user.pin`. `POST /api/documents/:id/publicar` (campo `password`, mismo `MOCK_PIN`) no tiene ningún consumidor en `src/api`/`src/features` — es código muerto preexistente. Se corrige igual por consistencia (evita dejar un `MOCK_PIN` fijo en el mismo archivo que confunda a quien lo lea después), pero no es parte del flujo que este change necesita destrabar.

## Risks / Trade-offs

- [Riesgo] El campo mock `pin` en texto plano en `authFixtures` es visible en el bundle de desarrollo → Mitigación: ya es el mismo riesgo aceptado para `password` en el mismo archivo; no es código que llegue a producción (MSW se desactiva vía `VITE_ENABLE_MSW`).
- [Riesgo] Un usuario que ya tenía una sesión abierta antes de este change no tiene `tienePinFirma` en su `User` persistido en el store (si `authStore` persiste en `localStorage`) → Mitigación: tratar `tienePinFirma` como `undefined`/`falsy` igual que "no configurado" en el frontend (no asumir `true` por ausencia); se corrige solo con el próximo login/refresh.
- [Riesgo] Cambiar la forma de `ApiResponse<T>` (nuevo campo `ErrorCode`) es un cambio de contrato compartido por **todos** los endpoints, no solo los de PIN → Mitigación: el campo es opcional (`string?`), por diseño no rompe ningún consumidor existente que no lo lea; se verifica con la suite completa de tests de backend.
- [Riesgo] Revisar los switches exhaustivos de permisos al tocar `EmpresaUsuariosPage` (nota técnica M6-S01 de CLAUDE.md) no aplica aquí — no se agrega ningún rol nuevo, solo una acción nueva dentro de una página ya restringida a `SUPERADMIN`.

## Migration Plan

No aplica migración de datos de usuarios reales — `ShacUser.PinHash` ya existe en el esquema (migración `20260821173057_FixShacUserAreaIdTypesAndAddPinHash` ya aplicada). Este change es aditivo: nuevo campo opcional en DTO, nuevo campo opcional en el envelope de error, nuevos componentes/hooks de frontend, nuevos handlers MSW. Sin pasos de rollback especiales — revertir el change revierte los archivos tocados sin dejar estado inconsistente (ningún PIN existente se pierde: `reset-pin` solo limpia `PinHash` cuando se invoca explícitamente).

## Open Questions

- **¿`ADMINISTRADOR_EMPRESA` debería poder resetear el PIN de los usuarios de su propia empresa, además de `SUPERADMIN`?** Hoy el endpoint `reset-pin` y el gate de `EmpresaUsuariosPage` son estrictamente `SUPERADMIN`. Toño pidió dejar esto como pregunta abierta explícita — **no se cambia en este change**, el endpoint y el guard de ruta se mantienen como están.
