## Context

Hoy el PIN de firma se recupera solo desde Mi Perfil (`ProfilePage.tsx`, sección "PIN de firma"): con la contraseña actual y un PIN nuevo, sin pedir el anterior (`POST /api/auth/set-pin`). La otra vía es el reset por SUPERADMIN (`pin-firma-ui`). Ningún modal de firma lo indica cuando el usuario sí tiene PIN y lo olvidó.

Además, `FirmarPublicarDocumentoHandler.cs:50`, `FirmarCierreQEHandler.cs:38` y `SetPinHandler.cs:15` lanzan `UnauthorizedBusinessException` **sin `errorCode`**. `ApiExceptionHandler` los convierte en un 401 genérico. El interceptor de `lib/axios.ts` trata ese 401 como un token vencido: hace `refreshToken()`, rota la cookie y reenvía la petición con el mismo PIN malo, y solo entonces rechaza. Cada PIN incorrecto se prueba dos veces y la sesión rota sin motivo. Con tokens de 5 min y refresh single-flight (`sesion-timeout-inactividad`), esa rotación extra no rompe nada, pero sobra y ensucia los logs.

`UnauthorizedBusinessException(string message, string? errorCode = null)` ya acepta el código y `ApiExceptionHandler` ya lo serializa en el envelope (`ApiResponse.Fail(ex.Message, ex.ErrorCode)`). No hace falta tocar infraestructura.

Este change se apoya en dos changes **todavía no archivados** cuyo código ya está en el working tree:
- `pin-firma-ui`: crea la capability `user-profile-pin-firma`, el aviso "sin PIN" de ambos modales y `errorCode: PIN_NO_CONFIGURADO`. Le faltan las pruebas manuales 9.x y 10.4.
- `sesion-timeout-inactividad`: rama de `SESION_INACTIVA`/`SESION_MAXIMA_ALCANZADA` en el interceptor (design D12), `endSession`, refresh single-flight. Le faltan 2 tareas.

## Goals / Non-Goals

**Goals:**
- El usuario que olvidó su PIN ve en el mismo modal de firma cómo resolverlo solo, y llega en un clic a la sección correcta de Mi Perfil con el foco en el campo que tiene que completar.
- Un PIN o una contraseña incorrectos producen **una sola** petición y **ninguna** llamada a `/api/auth/refresh`.

**Non-Goals:**
- Reseteo del PIN por `ADMINISTRADOR_EMPRESA` (P-01, se decide con M6).
- Límite de intentos de PIN (P-16 sugerido, ver Open Questions).
- Cambiar `ChangePassword` (mismo patrón; ver Open Questions).
- Llevar el error de PIN incorrecto del cierre de QE del toast al modal (ver D6).

## Decisions

### D1. Se agrega un `errorCode` y se mantiene el status 401
`PIN_INCORRECTO` (firma de documento y de cierre de QE) y `CONTRASENA_INCORRECTA` (set-pin), con el status 401 sin cambios. El modal de documento y `ProfilePage.onSubmitPin` ya distinguen por `status === 401`, y los tests de integración esperan 401.
*Alternativa descartada:* pasar a 403 o 422 para que el interceptor no lo trate como sesión vencida. Rompería los contratos existentes y semánticamente sigue siendo un fallo de credencial.

### D2. Lista explícita `CREDENTIAL_ERROR_CODES` en el interceptor
En `lib/axios.ts`, antes del bloque de refresh (y del chequeo de política), si `status === 401` y `response.data.errorCode ∈ CREDENTIAL_ERROR_CODES`, se devuelve `Promise.reject(error)` directamente. Es una lista de permitidos explícita, con la misma forma que el chequeo de `sessionEndReasonFromError`. El orden respecto del chequeo de política no importa porque los códigos son disjuntos, pero ponerlo primero deja claro que un error de credencial nunca toca la sesión.
*Alternativa descartada:* "no refrescar ante ningún 401 que traiga `errorCode`". Es más general, pero cambiaría en silencio el comportamiento de cualquier código futuro, y `SESION_*` necesita su propia rama de todos modos.

### D3. El enlace va a `/perfil#pin-firma` con scroll y foco en el montaje
En `ProfilePage`, un `useEffect` que corre una vez al montar: si `location.hash === '#pin-firma'`, hace `scrollIntoView({ behavior: 'smooth', block: 'start' })` sobre la sección y `focus()` sobre `#pinPassword`. Es un efecto imperativo sobre el DOM, no un estado derivado, así que no choca con la regla de arquitectura nº 1. El efecto (y `useLocation`) tienen que declararse **antes** del `if (!user) return null` (línea 49) para respetar las reglas de hooks. Como el `return null` evita que la sección se renderice sin usuario, el efecto depende de `user` y de `location.hash`. Para enfocar se usa un `ref` en el input o `document.getElementById('pinPassword')`. Se prefiere el `ref`, combinado con el `ref` de `register` de RHF mediante el callback que devuelve `registerPin('password')`.

### D4. Focus trap del modal de documento
El selector pasa a `'a[href], button, input, [tabindex]:not([tabindex="-1"])'`. `querySelectorAll` devuelve los elementos en orden de documento, sin importar el orden del selector:
- **Con PIN:** input → enlace "¿Olvidaste tu PIN?" → Cancelar → Firmar. El primero sigue siendo el input.
- **Sin PIN:** el primero pasa a ser el enlace "Configurar PIN" (antes era el botón Cancelar, porque `<a>` no estaba en el selector). Es aceptable: es la única acción útil en ese estado.

Además, la lista de enfocables se recalcula dentro de `handleKey` en vez de calcularse una sola vez al montar. Hoy, si el estado cambia a mitad de sesión (`pinResetMidSession`), el input desaparece y el trap queda con referencias viejas. El foco inicial sigue aplicándose una sola vez al montar.

### D5. Al navegar no hace falta llamar a `onClose`
`DocumentSignatureModal` se monta dentro de la página de detalle del documento, y `PinModal` dentro de `QECierreSection`. Al navegar a `/perfil`, la ruta cambia y el modal se desmonta junto con su página. Si durante la implementación aparece que el modal sobrevive a la navegación, se agrega `onClick={onClose}` al `<Link>`.

### D6. El PIN incorrecto del cierre de QE sigue en toast (divergencia propuesta, no implementada)
Por instrucción, `useFirmarCierre.onError` sigue mostrando un toast con el `message`. **Divergencia propuesta para decidir más adelante:** mostrarlo inline bajo el input del `PinModal`, como en el modal de documento, usando el nuevo `errorCode: PIN_INCORRECTO`. Así los dos flujos se comportan igual y la pista queda al lado del error. De paso, el fallback `'Error al registrar la firma'` de `useFirmarCierre.ts` está hardcodeado en español (viola la regla nº 4) y conviene pasarlo a i18n en ese mismo cambio.

### D7. Namespace de `forgotHint`
`pinSection` vive en el namespace `users` (`users.profile.pinSection` en `es-PE.json`). La clave queda como `users:profile.pinSection.forgotHint`.

## Divergencias entre la instrucción y el código real

- **Nombre del change:** se pidió `32-pin-olvidado`, pero el CLI de OpenSpec exige que el nombre empiece por una letra. Se usa `pin-olvidado-pista`, el nombre que trae la propia instrucción.
- **`scroll-mt-*`:** la instrucción supone un encabezado fijo. En realidad `AppShell` renderiza `TopNav` **fuera** de `<main className="flex-1 overflow-y-auto">`, que es el contenedor que hace scroll, así que el encabezado no tapa la sección. Se usa un `scroll-mt-6` pequeño solo para dejar aire sobre el título.
- **Test de set-pin con contraseña incorrecta:** ya existe (`SetPinEndpointTests.cs:70`, `SetPin_PasswordActualIncorrecta_Devuelve401`). Se extiende con la aserción del `errorCode` y no se crea uno nuevo.
- **Focus trap sin PIN:** la instrucción dice que hoy el primer elemento enfocado es el input. En el estado sin PIN no hay input y el primero es el botón Cancelar; al agregar `a[href]` pasa a ser el enlace "Configurar PIN" (ver D4).
- **Rutas reales:** la firma de documento es `POST /api/documents/:id/sign` y el cierre de QE es `PATCH /api/quality-events/:id/firmar-cierre`.

## Risks / Trade-offs

- [Archivo de specs: dos changes abiertos modifican los mismos requirements (`DocumentSignatureModal`, "Firma dual de cierre", etc.)] → Este change solo usa `## ADDED Requirements`, así que no choca con los bloques MODIFIED de `pin-firma-ui` en ningún orden de archivo. Igual se recomienda archivar primero `sesion-timeout-inactividad` y `pin-firma-ui`, en ese orden, y después este.
- [Un 401 `PIN_INCORRECTO` con el access token realmente vencido] → No puede pasar: el backend valida el JWT antes del handler, y un token vencido devuelve 401 **sin** código, que sigue refrescando.
- [Pista siempre visible = algo de ruido visual] → Decisión D2 de Toño: mismo patrón que "¿Olvidaste tu contraseña?", en `text-xs`.

## Migration Plan

No hay migración de base de datos. Despliegue: backend y frontend juntos. Si el frontend va primero, no pasa nada: el interceptor sigue refrescando porque el código todavía no llega. Si el backend va primero, el 401 lleva el código y el frontend viejo lo ignora. Rollback: revertir el commit.

## Open Questions

- **P-01** (sigue abierta): ¿`ADMINISTRADOR_EMPRESA` puede resetear el PIN de los usuarios de su empresa? Se decide con M6.
- **P-16** (sugerida): el servidor **no limita los intentos de PIN**. Un PIN de 4 dígitos tiene 10.000 combinaciones. Evaluar un bloqueo temporal tras N intentos fallidos (por usuario, con contador y expiración) y el mensaje correspondiente en ambos modales.
- **ChangePassword:** `ChangePasswordHandler.cs:15` lanza `UnauthorizedBusinessException("Contraseña actual incorrecta")` sin código, y el mock `auth.handlers.ts:268` igual. Un cambio de contraseña con la actual errónea también dispara hoy refresh + reintento. Se arregla de la misma forma (reusando `CONTRASENA_INCORRECTA`), pero queda fuera de este change por instrucción.
