# INSTRUCCIONES PARA CLAUDE CODE — Pista "¿Olvidaste tu PIN?" + PIN incorrecto sin refresco de sesión

- **Fecha:** 2026-10-20
- **Autor:** Cowork (para Toño)
- **Origen:** tema "PIN olvidado" del handoff 2026-10-20 §7, mejora (a) aprobada por Toño. La mejora (b), que el ADMINISTRADOR_EMPRESA resetee el PIN, **no** entra: sigue abierta como P-01 y se decide con M6.
- **Change OpenSpec:** `pin-olvidado-pista`
- **Flujo:** `/opsx:sync → /opsx:propose → /opsx:apply → /opsx:archive`

---

## 1. Diagnóstico confirmado leyendo el código

**Cómo se recupera hoy un PIN olvidado.** El usuario va a Mi Perfil → "PIN de firma", donde solo se le pide la **contraseña actual** y el PIN nuevo; el PIN anterior no se pide (`ProfilePage.tsx`, `onSubmitPin` → `useSetPin` → `POST /api/auth/set-pin`). La otra vía es que el SUPERADMIN lo resetee. El problema es que ninguna pantalla le avisa al usuario que puede hacerlo él mismo.

**Los dos modales que piden el PIN:**

| Modal | Archivo | Situación actual |
|---|---|---|
| Firmar y publicar documento (M1) | `shc-controldoc/src/features/documents/components/DocumentSignatureModal.tsx` | Muestra el aviso con enlace a `/perfil` **solo** cuando no hay PIN (`tienePinFirma === false` o el servidor respondió `PIN_NO_CONFIGURADO`). Si el PIN es incorrecto (401), muestra "PIN incorrecto." bajo el campo, sin ninguna pista. |
| Firma del cierre de un QE (M4) | `shc-controldoc/src/features/quality-events/components/QECierreSection.tsx` (componente interno `PinModal`) | Tiene el mismo aviso para el caso sin PIN. Si el PIN es incorrecto, el error llega como **toast** desde `useFirmarCierre.onError` con el `message` del servidor, sin pista. |

**Mi Perfil** (`shc-controldoc/src/features/users/pages/ProfilePage.tsx`, alrededor de la línea 248): la `<section>` del PIN **no tiene `id`**, así que hoy no se puede enlazar directo a ella. El campo de contraseña tiene `id="pinPassword"`.

**Hallazgo sobre el 401 (decisión D3).** El PIN incorrecto se lanza como `UnauthorizedBusinessException("PIN incorrecto")` **sin errorCode**:
- `ShcMvpEndPoint/Features/Documentos/FirmarPublicarDocumento/FirmarPublicarDocumentoHandler.cs:50`
- `ShcMvpEndPoint/Features/QualityEvents/FirmarCierreQE/FirmarCierreQEHandler.cs:38`

`ApiExceptionHandler` lo convierte en un **401**. Al recibirlo, el interceptor de respuesta de `shc-controldoc/src/lib/axios.ts` (línea 93 aprox.) lo trata como un access token vencido: llama a `refreshToken()`, rota el refresh token y **reenvía la misma firma con el mismo PIN malo**. Recién después rechaza la promesa. El efecto es que cada PIN incorrecto se prueba dos veces y provoca una rotación de sesión innecesaria.

`SetPinHandler.cs:15` tiene el mismo patrón: `UnauthorizedBusinessException("Contraseña actual incorrecta")`, también sin código. Es justo la pantalla a la que lleva la pista nueva, así que entra en este change.

---

## 2. Decisiones de Toño

- **D1, alcance:** la pista va en **los dos modales** (firma de documento y cierre de QE) **y** en Mi Perfil.
- **D2, cuándo se ve:** **siempre**, debajo del campo PIN, como el "¿Olvidaste tu contraseña?" de un login. No depende de haber fallado antes.
- **D3, bug del 401:** **se corrige en este mismo change.** El PIN o la contraseña incorrectos llevan un `errorCode` propio, y el interceptor no refresca la sesión cuando ve esos códigos.

---

## 3. Qué implementar

### 3.1 Backend (`ShcMvpEndPoint/`)

1. En `FirmarPublicarDocumentoHandler.cs` y `FirmarCierreQEHandler.cs`: `throw new UnauthorizedBusinessException("PIN incorrecto", "PIN_INCORRECTO");`
2. En `SetPinHandler.cs`: `throw new UnauthorizedBusinessException("Contraseña actual incorrecta", "CONTRASENA_INCORRECTA");`
3. **Mantener el status 401.** El frontend ya distingue por `status === 401` en el modal de documento y en Perfil, y los tests de integración lo esperan. Solo se agrega el código.
4. Sin migración.

### 3.2 Frontend (`shc-controldoc/src/`)

**a) Interceptor (`lib/axios.ts`)**
- Definir una constante, por ejemplo `CREDENTIAL_ERROR_CODES = ['PIN_INCORRECTO', 'CONTRASENA_INCORRECTA']`.
- En el manejador de error, **antes** del bloque de refresh: si es 401 y `response.data.errorCode` está en esa lista, devolver `Promise.reject(error)` sin refrescar, sin reintentar y sin `endSession`.
- No tocar el manejo de `SESION_INACTIVA` / `SESION_MAXIMA_ALCANZADA` (design.md D12 de `sesion-timeout-inactividad`).

**b) Mi Perfil (`features/users/pages/ProfilePage.tsx`)**
- Agregar `id="pin-firma"` a la `<section>` del PIN de firma y un `scroll-mt-*` que deje el título visible debajo del encabezado fijo.
- Al montar la página con `location.hash === '#pin-firma'`: hacer `scrollIntoView({ behavior: 'smooth', block: 'start' })` sobre la sección y `focus()` sobre `#pinPassword`. Usar `useLocation` de react-router.
- Texto de ayuda dentro de la sección, debajo del título y **solo cuando `user.tienePinFirma` es true**: `profile.pinSection.forgotHint`, en `text-sm text-muted`.

**c) Modal de firma de documento (`DocumentSignatureModal.tsx`)**
- Debajo del campo PIN, y debajo del mensaje de error si lo hay, mostrar **siempre** que el campo esté visible (`!noPinConfigured`) un `<Link to="/perfil#pin-firma">` con el texto `signature.forgotPinLink`, en `text-xs` y color `coral`, con `hover:underline`.
- Al hacer clic, el modal se cierra porque la navegación lo desmonta. No hace falta llamar a `onClose`, salvo que el componente quede montado por la forma del layout; si pasa, llamar a `onClose()` en el `onClick`.
- El enlace existente `signature.configurePinLink` (caso sin PIN) también pasa a apuntar a `/perfil#pin-firma`.
- **Focus trap:** el trap actual calcula los elementos enfocables con `button, input, [tabindex]`, lo que **no incluye `<a>`**. Agregar `a[href]` al selector para que el enlace quede dentro del ciclo de Tab. Revisar el orden: el primer elemento enfocado tiene que seguir siendo el input del PIN. Hoy el primero es el input porque el `<Link>` sin PIN aparece antes del form; mantener ese comportamiento.

**d) Modal de cierre de QE (`QECierreSection.tsx`, `PinModal`)**
- Agregar el mismo enlace debajo del input, con `detail.cierre.pinModal.forgotPinLink`, y cambiar el `configurePinLink` existente a `/perfil#pin-firma`.
- El error de PIN incorrecto sigue saliendo como toast (`useFirmarCierre`). **No** cambiar ese comportamiento en este change; si te parece mejor llevarlo al modal, anótalo en `design.md` como divergencia propuesta y no lo implementes.

**e) i18n (`i18n/es-PE.json` y `i18n/en-US.json`)**

| Clave | es-PE | en-US |
|---|---|---|
| `documents:signature.forgotPinLink` | ¿Olvidaste tu PIN? Cámbialo en Mi Perfil con tu contraseña | Forgot your PIN? Change it in My Profile with your password |
| `qualityEvents:detail.cierre.pinModal.forgotPinLink` | ¿Olvidaste tu PIN? Cámbialo en Mi Perfil con tu contraseña | Forgot your PIN? Change it in My Profile with your password |
| `profile.pinSection.forgotHint` (namespace donde ya vive `pinSection`) | ¿Olvidaste tu PIN? No necesitas el anterior: confirma tu contraseña y define uno nuevo. | Forgot your PIN? You don't need the old one: confirm your password and set a new one. |

### 3.3 MSW (`shc-controldoc/src/mocks/handlers/`)

- `documents.handlers.ts:934`: `err('PIN incorrecto', 401, 'PIN_INCORRECTO')`.
- `quality-events.handlers.ts:1015`: agregar `errorCode: 'PIN_INCORRECTO'` al body del 401.
- `auth.handlers.ts:285` (set-pin): `err('Contraseña actual incorrecta', 401, 'CONTRASENA_INCORRECTA')`.

---

## 4. Tests

**Backend (`ShcMvpEndPoint.Tests`)**
- `DocumentosStateMachineEndpointTests.cs` (aserción de PIN incorrecto, línea 275 aprox.) y `QualityEventsCierreEndpointTests.cs` (línea 113 aprox.): además del 401, verificar que `errorCode == "PIN_INCORRECTO"`.
- Test de set-pin con contraseña incorrecta: 401 + `CONTRASENA_INCORRECTA`. Si no existe, crearlo.

**Frontend (Vitest)**
- `lib/axios`: un 401 con `PIN_INCORRECTO` **no** llama a `refreshToken` y la petición se envía **una sola vez**. Lo mismo para `CONTRASENA_INCORRECTA`. Un 401 sin código sigue refrescando y reintentando, sin regresión.
- `DocumentSignatureModal.test.tsx`:
  - el enlace "¿Olvidaste tu PIN?" se ve con PIN configurado y apunta a `/perfil#pin-firma`;
  - sigue visible después de un PIN incorrecto;
  - no se ve en el estado sin PIN, donde se muestra el aviso de configurar;
  - el enlace entra en el ciclo de Tab.
- `QECierreSection.test.tsx`: enlace visible y con el `href` correcto.
- `ProfilePage`: con hash `#pin-firma`, el foco queda en `#pinPassword`; `forgotHint` se ve solo si `tienePinFirma` es true.

---

## 5. Fuera de alcance (anotar, no implementar)

- **P-01**: reseteo del PIN por el ADMINISTRADOR_EMPRESA, se decide con M6.
- **Tema nuevo para Toño (P-16, sugerido):** el servidor **no limita los intentos de PIN**. Un PIN de 4 dígitos tiene 10.000 combinaciones. Conviene evaluar un bloqueo temporal tras N intentos fallidos. Solo dejarlo anotado en `design.md`.
- `ChangePassword` probablemente tiene el mismo patrón 401 sin código. Revisarlo y anotarlo en `design.md`, sin cambiarlo aquí.

---

## 6. Reglas de siempre

- Toda divergencia entre esta instrucción y el código real va en `design.md`, con su motivo.
- Correr la **suite completa** (frontend y backend) + `tsc --noEmit`, todo en verde.
- Antes de la prueba manual: **detener el backend → `dotnet build`** (no hay migración) → `dotnet run` → Ctrl+F5 en el navegador. Si aparece un 404 o un comportamiento viejo, buscar el `ShcMvpEndPoint.exe` que quedó colgado.
- **Prueba manual con MSW apagado:**
  1. Abrir el modal de firma de un documento: el enlace se ve bajo el PIN.
  2. Ingresar un PIN incorrecto: aparece "PIN incorrecto." y en DevTools → Network hay **una sola** llamada a firmar y **ninguna** a `/api/auth/refresh`.
  3. Hacer clic en el enlace: lleva a Mi Perfil, baja a "PIN de firma" y el foco queda en la contraseña.
  4. Cambiar el PIN con una contraseña errónea: aparece el error en el campo y no hay refresh. Con la contraseña correcta, el PIN se guarda.
  5. Firmar con el PIN nuevo: funciona.
  6. Repetir los pasos 1 y 3 en el cierre de un QE.
- Toño avisa con **"listo"** para que Cowork verifique.
