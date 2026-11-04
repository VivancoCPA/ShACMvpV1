## Why

Un usuario que olvidó su PIN de firma ya puede recuperarlo solo: en Mi Perfil → "PIN de firma" se pide la contraseña actual y el PIN nuevo, nunca el anterior (`ProfilePage.tsx` → `useSetPin` → `POST /api/auth/set-pin`). El problema es que ninguna pantalla se lo dice, y los dos modales de firma solo enlazan a `/perfil` cuando no hay PIN configurado. Además, el PIN incorrecto (y la contraseña incorrecta en `set-pin`) vuelve como un 401 **sin `errorCode`**. El interceptor de `lib/axios.ts` lo toma por un access token vencido: refresca la sesión (rota el refresh token) y **reenvía la misma firma con el mismo PIN malo** antes de rechazar. Así, cada PIN incorrecto se prueba dos veces y provoca una rotación de sesión innecesaria.

## What Changes

- Backend: `FirmarPublicarDocumentoHandler` y `FirmarCierreQEHandler` lanzan `UnauthorizedBusinessException("PIN incorrecto", "PIN_INCORRECTO")`. `SetPinHandler` lanza `UnauthorizedBusinessException("Contraseña actual incorrecta", "CONTRASENA_INCORRECTA")`. El status sigue siendo 401 y no hay migración.
- Frontend `lib/axios.ts`: un 401 cuyo `errorCode` esté en `CREDENTIAL_ERROR_CODES` (`PIN_INCORRECTO`, `CONTRASENA_INCORRECTA`) se rechaza directamente: sin refresh, sin reintento y sin `endSession`. No cambia el manejo de `SESION_INACTIVA` / `SESION_MAXIMA_ALCANZADA`.
- Frontend `DocumentSignatureModal.tsx`: enlace **siempre visible** "¿Olvidaste tu PIN?" bajo el campo PIN (y bajo el error, si lo hay) hacia `/perfil#pin-firma`. El enlace existente "Configurar PIN" también apunta a `/perfil#pin-firma`. El focus trap incluye `a[href]`.
- Frontend `QECierreSection.tsx` (`PinModal`): mismo enlace bajo el input, y `configurePinLink` hacia `/perfil#pin-firma`. El PIN incorrecto sigue mostrándose como toast.
- Frontend `ProfilePage.tsx`: la sección del PIN recibe el ancla `id="pin-firma"`. Al entrar con ese hash, la página baja hasta la sección y pone el foco en `#pinPassword`. Si el usuario ya tiene PIN, se muestra el texto de ayuda `forgotHint`.
- MSW: los handlers de firma de documento, firma de cierre QE y `set-pin` devuelven los mismos `errorCode` que el backend.
- i18n: claves nuevas `documents:signature.forgotPinLink`, `qualityEvents:detail.cierre.pinModal.forgotPinLink` y `users:profile.pinSection.forgotHint` (es-PE + en-US).

## Capabilities

### New Capabilities
<!-- ninguna: todo extiende capabilities existentes o en curso -->

### Modified Capabilities
- `be-documentos-api`: el PIN incorrecto en la firma/publicación responde 401 con `errorCode: PIN_INCORRECTO`.
- `be-quality-events-api`: el PIN incorrecto en la firma de cierre responde 401 con `errorCode: PIN_INCORRECTO`.
- `be-firma-pin`: la contraseña actual incorrecta en `set-pin` responde 401 con `errorCode: CONTRASENA_INCORRECTA`.
- `auth-flow`: el interceptor de respuesta no refresca ni reintenta ante un 401 con código de credencial incorrecta.
- `document-approval-flow`: `DocumentSignatureModal` muestra siempre la pista "¿Olvidaste tu PIN?" con enlace a `/perfil#pin-firma`.
- `quality-event-cierre`: `PinModal` muestra la misma pista y enlace.
- `user-profile-pin-firma` (introducida por el change en curso `pin-firma-ui`): ancla `#pin-firma` con scroll y foco, y texto de ayuda para PIN olvidado.
- `document-msw-handlers`: el mock de firma de documento devuelve `errorCode: PIN_INCORRECTO`.
- `quality-event-msw-handlers`: el mock de firma de cierre devuelve `errorCode: PIN_INCORRECTO`.

## Impact

- Backend: `Features/Documentos/FirmarPublicarDocumento/FirmarPublicarDocumentoHandler.cs`, `Features/QualityEvents/FirmarCierreQE/FirmarCierreQEHandler.cs`, `Features/Auth/SetPin/SetPinHandler.cs`. Tests: `DocumentosStateMachineEndpointTests.cs`, `QualityEventsCierreEndpointTests.cs`, `SetPinEndpointTests.cs`.
- Frontend: `src/lib/axios.ts` (+ test), `src/features/documents/components/DocumentSignatureModal.tsx`, `src/features/quality-events/components/QECierreSection.tsx`, `src/features/users/pages/ProfilePage.tsx`, y sus tests.
- MSW: `src/mocks/handlers/documents.handlers.ts`, `quality-events.handlers.ts`, `auth.handlers.ts`.
- i18n: `src/i18n/es-PE.json`, `src/i18n/en-US.json`.
- Dependencias de changes abiertos: `pin-firma-ui` (crea `user-profile-pin-firma`; quedan pendientes las pruebas manuales 9.x/10.4) y `sesion-timeout-inactividad` (modificó el interceptor; quedan 2 tareas abiertas). Este change se apoya en el código de ambos, que ya está en el working tree.
