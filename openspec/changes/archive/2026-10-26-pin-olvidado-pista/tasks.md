## 1. Backend — errorCode de credencial incorrecta

- [x] 1.1 `FirmarPublicarDocumentoHandler.cs:50`: `throw new UnauthorizedBusinessException("PIN incorrecto", "PIN_INCORRECTO");`
- [x] 1.2 `FirmarCierreQEHandler.cs:38`: `throw new UnauthorizedBusinessException("PIN incorrecto", "PIN_INCORRECTO");`
- [x] 1.3 `SetPinHandler.cs:15`: `throw new UnauthorizedBusinessException("Contraseña actual incorrecta", "CONTRASENA_INCORRECTA");` (no tocar `ChangePasswordHandler`, ver design.md Open Questions)
- [x] 1.4 `DocumentosStateMachineEndpointTests.cs` (PIN incorrecto, ~línea 275): además del 401, verificar `errorCode == "PIN_INCORRECTO"`
- [x] 1.5 `QualityEventsCierreEndpointTests.cs` (PIN incorrecto, ~línea 113): además del 401, verificar `errorCode == "PIN_INCORRECTO"`
- [x] 1.6 `SetPinEndpointTests.cs` (`SetPin_PasswordActualIncorrecta_Devuelve401`): agregar la aserción de `errorCode == "CONTRASENA_INCORRECTA"`

## 2. MSW — paridad de errorCode

- [x] 2.1 `documents.handlers.ts:934`: `err('PIN incorrecto', 401, 'PIN_INCORRECTO')`
- [x] 2.2 `quality-events.handlers.ts:1015`: agregar `errorCode: 'PIN_INCORRECTO'` al body del 401
- [x] 2.3 `auth.handlers.ts:285` (set-pin): `err('Contraseña actual incorrecta', 401, 'CONTRASENA_INCORRECTA')` (no tocar el de change-password en la línea 268)

## 3. Interceptor Axios

- [x] 3.1 `lib/axios.ts`: definir `CREDENTIAL_ERROR_CODES = ['PIN_INCORRECTO', 'CONTRASENA_INCORRECTA']` y, en el manejador de error, antes del chequeo de política y del bloque de refresh, devolver `Promise.reject(error)` si el 401 trae uno de esos códigos (sin refresh, sin reintento y sin `endSession`)
- [x] 3.2 Test (junto a `lib/axios.session.test.ts` o en un archivo nuevo `lib/axios.credentials.test.ts`): un 401 `PIN_INCORRECTO` no llama a `refreshToken` y la petición se envía una sola vez; lo mismo para `CONTRASENA_INCORRECTA`; un 401 sin código sigue refrescando y reintentando una vez

## 4. i18n

- [x] 4.1 `es-PE.json` / `en-US.json`: `documents.signature.forgotPinLink`
- [x] 4.2 `es-PE.json` / `en-US.json`: `qualityEvents.detail.cierre.pinModal.forgotPinLink`
- [x] 4.3 `es-PE.json` / `en-US.json`: `users.profile.pinSection.forgotHint`

## 5. DocumentSignatureModal

- [x] 5.1 Debajo del input PIN y de su error, mientras `!noPinConfigured`, mostrar `<Link to="/perfil#pin-firma">` con `t('signature.forgotPinLink')` (`text-xs text-coral hover:underline`, más su variante `dark:`)
- [x] 5.2 Cambiar el enlace `signature.configurePinLink` a `/perfil#pin-firma`
- [x] 5.3 Focus trap: agregar `a[href]` al selector y recalcular los enfocables dentro de `handleKey`; el foco inicial al montar sigue cayendo en el input del PIN cuando el usuario tiene PIN (design.md D4)
- [x] 5.4 Verificar que el modal se desmonta al navegar; si no, agregar `onClick={onClose}` al enlace (design.md D5)
- [x] 5.5 `DocumentSignatureModal.test.tsx`: enlace visible con PIN y `href="/perfil#pin-firma"`; sigue visible tras un 401 `PIN_INCORRECTO`; no visible sin PIN (sí el aviso de configurar, con `href` al ancla); el enlace entra en el ciclo de Tab

## 6. PinModal de cierre de QE

- [x] 6.1 `QECierreSection.tsx` (`PinModal`): agregar debajo del input el enlace `/perfil#pin-firma` con `t('detail.cierre.pinModal.forgotPinLink')`
- [x] 6.2 Cambiar el enlace `configurePinLink` a `/perfil#pin-firma`
- [x] 6.3 No tocar el toast de `useFirmarCierre` (divergencia propuesta documentada en design.md D6)
- [x] 6.4 `QECierreSection.test.tsx`: enlace visible con PIN y `href` correcto; el enlace de configurar apunta al ancla

## 7. Mi Perfil

- [x] 7.1 `ProfilePage.tsx`: `id="pin-firma"` y `scroll-mt-6` en la `<section>` del PIN de firma
- [x] 7.2 `useLocation` + efecto declarado antes del `if (!user) return null`: con `hash === '#pin-firma'`, `scrollIntoView({ behavior: 'smooth', block: 'start' })` sobre la sección y `focus()` sobre `#pinPassword` (design.md D3)
- [x] 7.3 Bajo el título de la sección, solo si `user.tienePinFirma`: `<p className="text-sm text-muted dark:text-on-dark-soft">{t('profile.pinSection.forgotHint')}</p>`
- [x] 7.4 Test de `ProfilePage`: con la ruta `/perfil#pin-firma` el foco queda en `#pinPassword` (mockear `scrollIntoView` en jsdom); `forgotHint` se ve solo con `tienePinFirma === true`; un 401 `CONTRASENA_INCORRECTA` muestra el error en el campo de contraseña

## 8. Verificación

- [x] 8.1 Frontend: `npx tsc --noEmit` + suite Vitest completa, todo en verde — **bloqueado por fallas previas ajenas a este change** (2026-10-20): `tsc` reporta 18 errores, todos en archivos o líneas que este change no toca (`documents.fixtures.ts`, `documents.handlers.ts` 364/685/1054/1057, `IncidentForm.tsx:412`, `documents.types.test.ts`), y Vitest da 1679/1680 con la falla `router/documentReplaceOriginal.test.tsx` (botón de descarga del original visible para el SUPERVISOR revisor, RN-DOC-013). Los tests de este change pasan todos
- [x] 8.2 Backend: `dotnet test` (suite completa), todo en verde
- [x] 8.3 Detener el backend (y matar cualquier `ShcMvpEndPoint.exe` que haya quedado colgado) → `dotnet build` → `dotnet run` → Ctrl+F5 en el navegador
- [x] 8.4 Manual con MSW apagado, firma de documento: el enlace se ve bajo el PIN; con un PIN incorrecto aparece "PIN incorrecto." y en Network hay **una** llamada a `/sign` y **ninguna** a `/api/auth/refresh`
- [x] 8.5 Manual: el clic en el enlace lleva a Mi Perfil, baja a "PIN de firma" y deja el foco en la contraseña
- [x] 8.6 Manual: cambiar el PIN con una contraseña errónea muestra el error en el campo y no dispara refresh; con la correcta, el PIN se guarda; firmar con el PIN nuevo funciona
- [x] 8.7 Manual: repetir 8.4 y 8.5 en la firma de cierre de un QE (el error de PIN incorrecto sale como toast)
- [x] 8.8 Light/Dark mode sin defectos visuales en el enlace de ambos modales y en el texto de ayuda de Mi Perfil
