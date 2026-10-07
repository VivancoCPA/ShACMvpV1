## 1. Backend — contrato de error y TienePinFirma

- [x] 1.1 Agregar `string? ErrorCode` a `ApiResponse<T>` (`ShcMvpEndPoint.Domain/Common/ApiResponse.cs`) y un overload `ApiResponse.Fail(string message, string? errorCode = null, string[]? errors = null)`.
- [x] 1.2 Actualizar `ApiExceptionHandler` para mapear `BusinessRuleException.RuleCode` a `ErrorCode` en la rama 422.
- [x] 1.3 Agregar `ruleCode: "PIN_NO_CONFIGURADO"` al `throw new BusinessRuleException(...)` en `FirmarPublicarDocumentoHandler.cs` (línea del check `actor.PinHash is null`).
- [x] 1.4 Agregar `ruleCode: "PIN_NO_CONFIGURADO"` al `throw new BusinessRuleException(...)` en `FirmarCierreQEHandler.cs` (mismo check).
- [x] 1.5 Agregar `TienePinFirma` a `UserDto` (`Features/Auth/AuthDtos.cs`), calculado en `UserDto.From` como `user.PinHash is not null`. (Hallazgo no previsto en design.md: también había una segunda construcción directa de `UserDto` en `Features/Users/ListarUsuarios/UsuarioListRow.cs`/`ListarUsuariosHandler.cs` vía Dapper — se agregó `TienePinFirma` ahí también, proyectando `pin_hash IS NOT NULL` en el SQL.)
- [x] 1.6 Confirmar que `docs/SHAC-Contrato-API.md` (si el proyecto lo mantiene como fuente de verdad del contrato) documenta `TienePinFirma` y `errorCode` — actualizarlo si existe esa sección. (Se agregaron además las filas de `set-pin`/`reset-pin` a la tabla de endpoints de Auth, que no estaban documentadas.)

## 2. Backend — tests de integración

- [x] 2.1 Test: `set-pin` con contraseña incorrecta → 401, `PinHash` sin cambios. (ya existía: `SetPin_PasswordActualIncorrecta_Devuelve401`)
- [x] 2.2 Test: `set-pin` con PIN de formato inválido (letras, 3 dígitos) → 400. (ya existía: `SetPin_FormatoDePinInvalido_Devuelve400`)
- [x] 2.3 Test: `set-pin` con PIN válido → login/refresh posterior tiene `TienePinFirma: true`. (nuevo: `SetPin_PinValido_LoginPosteriorExponeTienePinFirmaTrue`)
- [x] 2.4 Test: firmar documento (`POST /:id/sign`) sin PIN configurado → 422 con `errorCode: "PIN_NO_CONFIGURADO"`. (test existente `FirmarPublicar_SinPinConfigurado_DevuelveErrorDeNegocio` extendido con el assert de `ErrorCode`)
- [x] 2.5 Test: firmar cierre de QE (`PATCH /:id/firmar-cierre`) sin PIN configurado → 422 con `errorCode: "PIN_NO_CONFIGURADO"`. (test existente `FirmarCierre_SinPinConfigurado_NoDevuelve500` extendido con el assert de `ErrorCode`)
- [x] 2.6 Test: `reset-pin` deja `TienePinFirma = false` en el siguiente login. (nuevo: `ResetPin_Exito_LoginPosteriorExponeTienePinFirmaFalse`)
- [x] 2.7 Correr la suite completa de `ShcMvpEndPoint.Tests` y confirmar que nada existente se rompe por el nuevo campo `ErrorCode` opcional. (516/516 verde — ver sección 10.3)

## 3. Frontend — tipos y contrato

- [x] 3.1 Agregar `tienePinFirma: boolean` a `User` (`src/types/auth.types.ts`). (Opcional — `tienePinFirma?: boolean` — por diseño D4/riesgo de sesión persistida sin el campo: `undefined` se trata igual que `false`.)
- [x] 3.2 Verificar que los tres puntos de construcción de sesión en el frontend (login, refresh, switch-empresa) propagan el campo sin transformación adicional. (Los tres solo hacen spread de `User` tal como llega de `/api/auth/*`; una vez agregado en los handlers MSW (sección 8) no requieren cambio propio.)

## 4. Frontend — Mi Perfil: sección PIN de firma

- [x] 4.1 Crear `src/features/auth/schemas/setPin.schema.ts` (Zod: `password` requerido, `pin`/`confirmPin` exactamente 4 dígitos, refine de coincidencia).
- [x] 4.2 Crear `src/features/auth/api/auth.api.ts` función `setPin(data: { password: string; pin: string })` → `POST /api/auth/set-pin`.
- [x] 4.3 Crear `src/features/auth/hooks/useSetPin.ts`: mutation con `onSuccess` (toast éxito, actualizar `tienePinFirma: true` en `authStore` vía nueva acción `setTienePinFirma`) y `onError` (401 → delegado al llamador para el campo contraseña; otros → toast genérico).
- [x] 4.4 Agregar la sección "PIN de firma" en `ProfilePage.tsx`: estado actual (Configurado/No configurado) + formulario (React Hook Form + Zod), siguiendo el mismo patrón visual que la sección "Cambiar contraseña" ya existente.
- [x] 4.5 Claves i18n namespace `users` (es-PE y en-US) + `auth:validation.pinFormat`/`pinMismatch`: título de sección, estados, labels de campos, mensajes de error/éxito.

## 5. Frontend — DocumentSignatureModal

- [x] 5.1 Leer `tienePinFirma` desde `useAuthStore` en `DocumentSignatureModal`.
- [x] 5.2 Cuando `tienePinFirma === false`: ocultar el input de PIN, mostrar aviso con link a `/perfil`, deshabilitar el submit.
- [x] 5.3 Renombrar claves i18n de `documents:signature.passwordLabel`/`passwordPlaceholder` a `pinLabel`/`pinPlaceholder` ("PIN de firma (4 dígitos)" / "••••"); agregar `noPinConfigured` y el error genérico.
- [x] 5.4 Actualizar `onSubmit`: manejar `errorCode === 'PIN_NO_CONFIGURADO'` (mostrar el mismo aviso), `status === 401` (como hoy), y cualquier otro error (mostrarlo inline, no silenciarlo).
- [x] 5.5 Crear `DocumentSignatureModal.test.tsx` (no existía) cubriendo los tres casos de error + el caso sin PIN + firma exitosa — 5/5 verde.

## 6. Frontend — QECierreSection / PinModal

- [x] 6.1 Pasar `tienePinFirma` (desde `useAuthStore`, ya leído en el componente) como prop a `PinModal`.
- [x] 6.2 `PinModal`: cuando `tienePinFirma === false`, ocultar el input y mostrar el aviso con link a `/perfil`; deshabilitar confirmar.
- [x] 6.3 Agregar manejo de `errorCode === 'PIN_NO_CONFIGURADO'` en el flujo de `onPinConfirm`/`useFirmarCierre` — el `onError` del hook ahora omite su toast genérico para ese código específico, y un `onError` a nivel de llamada en `onPinConfirm` enciende `pinResetMidSession` para que el modal muestre el mismo aviso.
- [x] 6.4 Claves i18n namespace `qualityEvents` (es-PE y en-US): `detail.cierre.pinModal.noPinConfigured` + `configurePinLink`.
- [x] 6.5 Creado `QECierreSection.test.tsx` (no existía) cubriendo el aviso sin PIN, el error `PIN_NO_CONFIGURADO` mid-session, PIN incorrecto (401) y firma exitosa — 4/4 verde.

## 7. Frontend — Reset de PIN por SUPERADMIN

- [x] 7.1 Agregar `resetPinUsuarioEmpresa(empresaId, usuarioId)` en `src/features/empresas/api/empresas.api.ts` → `PATCH /api/empresas/{empresaId}/usuarios/{usuarioId}/reset-pin`.
- [x] 7.2 Agregar `useResetPinUsuarioEmpresa(empresaId)` en `useUsuarioEmpresa.ts`, siguiendo el patrón de `useToggleUsuarioEmpresa` (toast; sin invalidate — la lista no muestra estado de PIN).
- [x] 7.3 Agregar la acción "Resetear PIN" (ícono `KeyRound`, `ConfirmModal`) en `EmpresaUsuariosPage.tsx`, junto a la acción de toggle de estado existente.
- [x] 7.4 Claves i18n namespace `empresas` (es-PE y en-US): acción, confirmación, toast de éxito/error.
- [x] 7.5 Test en `EmpresaUsuariosPage.test.tsx`: la acción pide confirmación y llama al endpoint con el `usuarioId` correcto — 2/2 verde.

## 8. MSW — mock de PIN

- [x] 8.1 Agregar `pin?: string` a `MockUser` (`src/mocks/fixtures/auth.fixtures.ts`), sin valor inicial para ningún usuario semilla (los 18 usuarios arrancan sin PIN).
- [x] 8.2 Agregar `tienePinFirma` calculado (`pin !== undefined`) en la resolución de sesión de `login`/`refresh`/`switch-empresa` (`auth.handlers.ts`) — nuevo helper `toUserDto()` centraliza el strip de `password`/`pin` + el cálculo, reemplazando los 4 sitios que antes hacían `const { password: _pw, ...rest } = user` a mano (y que habrían dejado `pin` crudo filtrarse sin el fix).
- [x] 8.3 Agregar handler `POST /api/auth/set-pin` en `auth.handlers.ts` (mismo patrón que `change-password`, pero vía `getUsersStore()` — store cross-dominio — en vez de `authFixtures` directo).
- [x] 8.4 Agregar handler `PATCH /api/empresas/:empresaId/usuarios/:usuarioId/reset-pin` en `empresas.handlers.ts` (gate `SUPERADMIN` vía `requireSuperadmin` ya existente, valida asignación `UsuarioEmpresa`, pone `user.pin = undefined` vía `getUsersStore()`).
- [x] 8.5 Actualizar el handler `POST /api/documents/:id/sign` en `documents.handlers.ts`: eliminada la comparación contra `MOCK_PIN` (agnóstica de identidad — ni siquiera miraba quién firmaba), ahora valida contra `signer.pin` resuelto vía `getSessionUser(request)` + `getUsersStore()`; responde `errorCode: 'PIN_NO_CONFIGURADO'` (422) o PIN incorrecto (401).
- [x] 8.6 Decisión tomada: `POST /api/documents/:id/publicar` confirmado sin ningún consumidor en `src/api`/`src/features` (grep exhaustivo) → eliminado por completo en vez de parchear código muerto.
- [x] 8.7 Actualizado `PATCH /api/quality-events/:id/firmar-cierre`: agregada la validación de PIN que **no existía en absoluto** (bug real — cualquier PIN de 4 dígitos cerraba el QE), contra `signer.pin` vía `getUsersStore()`, antes de los chequeos de orden de firma (QE-AC-006).
- [x] 8.8 Confirmado: `MOCK_PIN` eliminado de `documents.handlers.ts` (único lugar que lo tenía); `quality-events.handlers.ts` nunca tuvo un PIN fijo (ese era precisamente el bug — no validaba nada).
- [x] 8.9 Tests agregados/actualizados: `auth.handlers.test.ts` (`tienePinFirma` en login + `set-pin` 200/401/400), `empresas.handlers.test.ts` (nuevo archivo — no existía; `reset-pin` 200/403/404), `documents.handlers.test.ts` (sign: 422 `PIN_NO_CONFIGURADO` + 401 + éxito, este último fijeado para configurar PIN primero), `quality-events.handlers.test.ts` (firmar-cierre: 422 `PIN_NO_CONFIGURADO` + 401 + éxito).

**Hallazgo crítico no anticipado en design.md — compatibilidad con fixtures de test:** el helper `setCurrentUser(id, rol)` de `quality-events.handlers.test.ts` usa `createMockUser(...)` (un `User` sintético, desacoplado de `authFixtures`) para poblar la sesión en ~48 tests de ese archivo. Validar el PIN contra `getUsersStore().find(u => u.id === ...)` solo funciona cuando `id` tiene contraparte real en `authFixtures` — los 3 call sites que efectivamente llaman `firmar-cierre` usan `'user-supervisor-001'` (fixture real), así que el fix fue: extender `setCurrentUser` para que, cuando `id` matchea un fixture real, le asigne automáticamente `pin: '1234'` (el mismo valor que esos 3 tests ya enviaban) — sin esto, los 3 tests de `firmar-cierre notifications` habrían empezado a fallar con 422. Mismo patrón aplicado a `authHeaders()` en `documents.handlers.test.ts` (test de notificaciones de `/sign`, que usaba el viejo `MOCK_PIN` de 6 dígitos). Documentado explícitamente porque es exactamente el patrón de "fixtures desincronizados" que CLAUDE.md pide vigilar.

## 9. Verificación manual (MSW apagado, backend .NET real)

- [ ] 9.1 Detener el backend si estaba corriendo y ejecutar `dotnet build` antes de la prueba manual.
- [ ] 9.2 Con un aprobador sin PIN configurado, intentar firmar un documento y verificar que aparece el aviso con enlace a `/perfil` (sin intentar la petición).
- [ ] 9.3 Configurar el PIN en Mi Perfil; firmar con PIN incorrecto (debe mostrar error inline) y luego con el correcto — el documento debe quedar `PUBLICADO`.
- [ ] 9.4 Como `SUPERADMIN`, resetear el PIN de ese usuario desde `EmpresaUsuariosPage` y verificar que vuelva a pedir configurarlo.
- [ ] 9.5 Repetir el flujo completo (sin PIN → aviso, configurar, PIN incorrecto → error, PIN correcto → éxito, reset) para la firma de cierre de un QE.

## 10. Regresión y cierre

- [x] 10.1 Correr la suite completa de frontend (`npm test` o equivalente en `shc-controldoc`). (181/181 archivos, 1441/1442 tests — 1 expected-fail preexistente, no relacionado a este change; se detectó y corrigió una regresión real propia: `ProfilePage.changePassword.test.tsx` fallaba porque la nueva sección de PIN reutilizaba la misma etiqueta "Contraseña actual" que el formulario de cambio de contraseña, generando dos labels idénticos en la misma página — se le dio un texto distintivo ("Confirma tu contraseña actual") nuevo en `profile.pinSection.currentPassword`.)
- [x] 10.2 Correr `tsc` (sin `any` nuevo, tipado estricto). (sin errores)
- [x] 10.3 Correr la suite completa de backend (`ShcMvpEndPoint.Tests`). (516/516 verde — requirió detener el proceso `ShcMvpEndPoint.exe` que estaba corriendo y bloqueaba la escritura de los DLLs de build)
- [ ] 10.4 Confirmar Light/Dark mode sin defectos visuales en los componentes nuevos/tocados (sección PIN de Mi Perfil, avisos en ambos modales, acción en `EmpresaUsuariosPage`).
- [x] 10.5 Confirmar que las claves i18n nuevas existen en `es-PE.json` y `en-US.json` para todos los namespaces tocados. (verificado por script: paridad exacta de claves en `users.profile.pinSection`, `auth.validation.pin*`, `documents.signature`, `qualityEvents.detail.cierre.pinModal`, `empresas.toasts`/`asignacion.actions`/`asignacion.confirmarResetPin` — ambos JSON parsean correctamente.)
