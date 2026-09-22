# Instrucciones para Claude Code — Cutover: Quality Events

Fecha: 2026-09-22
Autor: Cowork, tras investigar el código real (frontend `shc-controldoc`, backend `.NET`) vía
device bridge. Sexto módulo del roadmap de cutover — Auth, Catálogos, Incidentes, Documentos y No
Conformidades ya quedaron cerrados y verificados (los tres primeros archivados de forma confirmada;
`cutover-no-conformidades` quedó pendiente de que decidas cuándo archivarlo).
Nota de contexto: el bridge de shell a tu compu sigue caído (mismo problema de Windows desde el 8
de septiembre, sin fecha de resolución confirmada), así que esta investigación la hice leyendo
archivos puntuales vía `device_list_dir`/`device_stage_files` en vez de con `grep`/`git log` — el
listado recursivo de directorios sí me dio visibilidad completa de los 23 endpoints backend y del
árbol completo del frontend, y leí todos los archivos relevantes de las áreas de mayor riesgo, pero
puede que se me haya escapado algo en zonas que no prioricé (ver Sección 4). Verificá con más
cuidado de lo habitual si algo no cuadra.

Toño ya eligió seguir con Quality Events — **no le vuelvas a preguntar si conviene**. A diferencia
de No Conformidades (sin ningún mismatch), acá encontré **dos problemas bloqueantes reales**, uno
de ellos más grave que cualquiera de los que vimos en Documentos: un gate de PIN hardcodeado en el
frontend que haría fallar el 100% de los intentos reales de firma de cierre.

## 1. BLOQUEANTE — PIN hardcodeado en el modal de firma de cierre (`QECierreSection.tsx`)

`PinModal` (componente interno de `QECierreSection.tsx`, usado tanto para la primera firma
JEFE_CALIDAD_SYST como para la segunda firma SUPERVISOR) valida el PIN **contra un literal
hardcodeado antes de siquiera invocar la mutación real**:

```ts
const handleSubmit = () => {
  if (pin !== '1234') {
    setError(true)
    return
  }
  setError(false)
  onConfirm(pin)
}
```

`onConfirm` es lo que dispara `firmarCierre.mutate(...)` (la llamada real a
`PATCH /api/quality-events/:id/firmar-cierre`). Con este gate, **ningún usuario real puede firmar
un cierre de QE salvo que su PIN configurado sea literalmente "1234"** — el backend nunca llega a
recibir el intento si el usuario escribe su PIN real. Es un remanente evidente de cuando el mock no
verificaba el PIN contra nada (probablemente placeholder de desarrollo temprano, nunca limpiado al
migrar a PIN real con `POST /api/auth/set-pin`).

El contrato de payload en sí **está bien armado** — no es un mismatch como el de Documentos:

- `firmarCierreSchema` (`firmarCierre.schema.ts`): `{ rol: enum(...), pin: string.length(4) }`
- `FirmarCierreQECommand` (backend): `record(UserRole Rol, string Pin)`, validado por
  `FirmarCierreQEValidator` (`NotEmpty().Length(4).Matches("^[0-9]{4}$")`)
- Los nombres de campo coinciden (`rol`/`Rol`, `pin`/`Pin` — binding case-insensitive de
  ASP.NET Core), y el backend valida el PIN real contra `ShacUser.PinHash` vía
  `IPasswordHasher<ShacUser>.VerifyHashedPassword` (`FirmarCierreQEHandler.cs:36-38`).

El problema es exclusivamente ese `if (pin !== '1234')` en el componente. **La corrección es
eliminar por completo esa validación client-side** — el PIN debe viajar tal cual el usuario lo
escribió (4 dígitos, ya validado por `firmarCierreSchema`/`z.string().length(4)` si querés mantener
una validación de formato) y dejar que el backend sea la única fuente de verdad sobre si el PIN es
correcto (ya lo hace, devolviendo 401 "PIN incorrecto" si falla — `FirmarCierreQEHandler.cs:38`).

## 2. BLOQUEANTE — mismatch de contrato en `revisarAjustePlazoAC` (aprobar/rechazar ajuste de plazo de AC)

`revisarAjustePlazoAC` (`quality-events.api.ts:123-134`, invocado desde
`useRevisarAjustePlazoAC.ts`) envía:

```ts
data: { accion: 'APROBAR' | 'RECHAZAR'; comentarioRevision?: string }
```

`PATCH /api/quality-events/:qeId/acciones-correctivas/:acId/solicitud-plazo/:solicitudId`

Pero `RevisarAjustePlazoACCommand` (backend) espera:

```csharp
public sealed record RevisarAjustePlazoACCommand(SolicitudAjustePlazoEstado Estado, string? ComentarioRevision);
```

Con `SolicitudAjustePlazoEstado` definido como `{ PENDIENTE, APROBADA, RECHAZADA }` — **el frontend
nunca envía el campo `estado`** (envía `accion`, que no existe en el command), y los valores que sí
enviaría (`'APROBAR'`/`'RECHAZAR'`) tampoco coinciden con los nombres reales del enum
(`'APROBADA'`/`'RECHAZADA'`).

Esto es **más peligroso que un mismatch típico** porque **no falla con un error**: como
`Estado` es un enum (tipo valor) sin marcar `[Required]` a nivel de binding, el JSON binder de
ASP.NET Core simplemente deja `command.Estado` en su valor por defecto — `PENDIENTE` (el primer
miembro del enum, valor 0) — cuando el campo no está presente en el body. El request devuelve
`200 OK`, el handler (`RevisarAjustePlazoACHandler.cs`) sí guarda `RevisadoPorId`/`RevisadoEn`/
`ComentarioRevision` (esos campos sí coinciden), pero **`solicitud.Estado` queda en `PENDIENTE`**
— ni se aprueba ni se rechaza realmente — y como
`if (command.Estado == SolicitudAjustePlazoEstado.APROBADA) accion.PlazoFecha = solicitud.FechaSolicitada;`
tampoco se cumple nunca, **el plazo de la acción correctiva jamás se actualiza**, incluso cuando el
usuario cree que aprobó la solicitud. Peor aún: como el guard de reintento
(`if (solicitud.Estado != PENDIENTE) throw ...`) sigue viendo `PENDIENTE`, la misma solicitud queda
abierta a ser "revisada" repetidamente sin error.

**Corrección recomendada**: cambiar el payload que arma `revisarAjustePlazoAC`/
`useRevisarAjustePlazoAC.ts` para enviar `{ estado: 'APROBADA' | 'RECHAZADA', comentarioRevision }`
en lugar de `{ accion: 'APROBAR' | 'RECHAZAR' }` — mapeando en el punto de invocación (o dentro de
la propia función `revisarAjustePlazoAc` en `quality-events.api.ts`) `'APROBAR' → 'APROBADA'` y
`'RECHAZAR' → 'RECHAZADA'` si preferís mantener el vocabulario `accion` en la UI/componentes que la
llaman. Verificá también si hay algún componente de UI que invoque este hook (no llegué a leer el
componente que renderiza el flujo de revisión de ajuste de plazo — priorizá encontrarlo, confirmar
qué strings usa hoy, y decidí ahí si el mapeo va en el hook o en el componente).

## 3. El resto del contrato coincide — confirmado archivo por archivo

Verifiqué campo por campo (nombre y forma) los siguientes pares, sin encontrar más mismatches:

- `cerrarQE` (`PATCH /:id/cerrar`) ↔ `CerrarQECommand(string ResultadoCierre, int? PlazoVerificacionDias)`:
  coincide con `qualityEventCierreFormSchema` (`resultadoCierre` min 100/max 500,
  `plazoVerificacionDias` default 60). El backend bloquea el cierre si alguna AC no está
  `CERRADA` con evidencia (RN-QE-003, `CerrarQEHandler.cs:23-28`) — gate real server-side, a
  diferencia del mock donde `PENDIENTE_CIERRE` se alcanzaba solo como efecto emergente.
- `cerrarQEAccion`/`updateQEAccion` (ambos contra el mismo `PATCH .../acciones-correctivas/:acId/status`)
  ↔ `CambiarEstadoAccionCorrectivaQECommand(QEAccionCorrectivaEstado Estado, string? DescripcionEvidencia, string? EvidenciaUrl)`:
  confirmado intencional — comentario propio del código (D7 en `be-quality-events design.md`)
  documenta que QE, a diferencia de NC, no tiene una sub-ruta `/cerrar` dedicada. `cerrarQEAccion`
  simplemente agrega `estado: 'CERRADA'` al body de `cerrarQEAccionSchema`
  (`descripcionEvidencia`/`evidenciaUrl`), que coincide exactamente. El handler también dispara la
  auto-transición `EN_EJECUCION → PENDIENTE_CIERRE` cuando todas las ACs quedan cerradas con
  evidencia — réplica intencional del comportamiento del mock (comentario propio del handler).
- `editarSeveridad` (`PATCH /:id/editar-severidad`) ↔ `EditarSeveridadQECommand(QESeveridad Severidad)`:
  coincide con `qualityEventEditSeveridadSchema` (`.strict()`, solo `severidad`). El campo extra
  `requiereNotificacionUrgente` de `EditarSeveridadResponse` sí lo devuelve el handler
  (`EditarSeveridadQEHandler.cs`, disparado cuando `Severidad == CRITICA`, notificación
  best-effort en try/catch) — pero **ningún componente lo consume** (confirmé leyendo
  `QEEditSeveridadMineralModal.tsx` completo). Ver Sección 4, es informativo, no bloqueante.
- `solicitarAjustePlazoAC` (`POST .../:acId/solicitud-plazo`) ↔
  `SolicitarAjustePlazoACCommand(DateTime FechaSolicitada, string Justificacion)`: coincide con
  `solicitarAjustePlazoACSchema` (`fechaSolicitada`, `justificacion` min 50). El backend calcula
  `requiereAprobacionGerencia` server-side vía `AjustePlazoCalculator` (puerto de
  `plazoAjuste.constants.ts`/`.utils.ts`, según el propio comentario del handler) — no hace falta
  que el frontend lo calcule ni lo envíe.
- `transitionQEStatus` (`PATCH /:id/status`) ↔ `TransicionarEstadoQECommand(QEEstado NuevoEstado, string? Comentario)`:
  coincide con el payload que arma `QEStatusTransitionPanel.tsx` (`{ nuevoEstado: target }`). El
  backend **sí tiene una máquina de estados estricta real** (`QualityEventTransitionValidator.cs`,
  puerto documentado del propio `VALID_QE_TRANSITIONS` del frontend), a diferencia de NC — confirma
  lo que ya se sabía por el `design.md` de NC. También valida RN-QE-002 (causa raíz firmada antes de
  `EN_EJECUCION`) y RN-QE-009 (solicitudes de AC pendientes bloquean `ANALISIS_COMPLETADO`) — ambas
  reglas también están replicadas en la UI (`QEStatusTransitionPanel.tsx`, botones deshabilitados
  con tooltip) para que el usuario no dispare el 409 innecesariamente.
- `exportQualityEventPdf` (`POST /:id/export-pdf`): **no es una discrepancia** — confirmé que el
  handler backend (`ExportarPdfQEHandler.cs`) solo registra auditoría (`EXPORTADO_PDF`) y no genera
  ningún archivo; el propio comentario del handler lo dice explícitamente ("esa responsabilidad es
  exclusiva del frontend"). El PDF real se arma client-side con `jsPDF` en `buildQualityEventPdf.ts`
  a partir del `QualityEvent` ya cargado. El tipo de retorno `Promise<QualityEvent>` de la función
  del frontend es correcto — el mismo objeto QE se usa para refrescar la query (`useExportQualityEventPdf.ts`)
  y como fuente de datos para el PDF. A diferencia de Documentos (que sí genera el PDF server-side y
  usa `responseType: 'blob'`), acá el patrón es distinto mas no incorrecto.
- `resolveRolSegundaFirma` (frontend, `qualityEventPermissions.ts`) ya está reconciliado con
  `FirmaCierreResolver.ResolverRolSegundaFirma()` (backend): ambos devuelven siempre `SUPERVISOR`
  (comentario propio del código en ambos lados cita la misma decisión D15/RN-QE-004,
  2026-08-20 — la escalada a ALTA_DIRECCION por "misma persona" se retiró por ser estructuralmente
  inalcanzable). Coinciden.
- Las 23 rutas de `Features/QualityEvents/` están registradas en `EndpointExtensions.cs`
  (`.Map(app)`) y sus 23 handlers en `AddFeatureHandlers` (`.AddScoped<...Handler>()`) — confirmado
  1:1 contra las 22 funciones de `quality-events.api.ts` (`registrarVerificacionEficacia` es la
  función 22, más las rutas de vinculación Documento↔QE ya cutover-eadas en `fs-vinculacion-documento-qe`).
- `.env.development` actual: `VITE_ENABLE_MSW=true`, `VITE_API_BASE_URL` vacío — baseline esperado,
  sin tocar.

## 4. Informativo, sin riesgo — no bloquea el cutover

- `VALID_QE_TRANSITIONS` (frontend) incluye `REABIERTO` como estado válido (`EN_VERIFICACION →
  REABIERTO`, `REABIERTO → EN_INVESTIGACION`), pero el diccionario real del backend
  (`QualityEventTransitionValidator.cs`) **no tiene ninguna entrada para `REABIERTO`** — ni como
  origen ni como destino. Confirmado intencional por el propio comentario del validador backend: la
  reapertura va directo a `EN_INVESTIGACION` sin pasar por un estado persistido `REABIERTO`
  (manejado en `VerificacionEficaciaQEHandler.cs`, que no llegué a leer en detalle — si vas a tocar
  el flujo de verificación de eficacia, confirmalo ahí). `QEStatusTransitionPanel.tsx` ya excluye
  `REABIERTO` de los botones reales (`EXCLUDED_TARGETS`), así que es código muerto sin consumidor
  real — mismo patrón "no consumer, no bug" ya visto en otros módulos.
- `EditarSeveridadResponse.requiereNotificacionUrgente`: el backend lo calcula y lo devuelve, pero
  ningún componente lo lee (ver Sección 3). Informativo — podrías usarlo para mostrar un banner
  adicional en el modal de edición, pero no es requisito para el cutover.
- `firmarCierreSchema`/`PinModal` referencian el rol `'ALTA_DIRECCION'` como posible segunda firma
  (tipos, textos i18n `titleAltaDireccion`/`buttonAltaDireccion`), pero `resolveRolSegundaFirma`
  siempre devuelve `'SUPERVISOR'` (ver Sección 3) — esas ramas de UI son código muerto alcanzable
  solo si en el futuro se relaja la regla RN-QE-004. No hace falta tocarlo.
- No llegué a leer en profundidad `VerificacionEficaciaQEHandler.cs`/`QEVerificacionSection.tsx` ni
  `ForzarVencimientoVerificacionHandler.cs`/`useForzarVencimientoVerificacion.ts` — por tiempo,
  prioricé las áreas de mayor riesgo (firma, cierre, ajuste de plazo, transición de estados). Antes
  de dar por cerrado este cutover, hacé una pasada rápida vos mismo sobre esos dos flujos (mismo
  criterio: comparar schema frontend vs Command backend, nombre de campo por nombre de campo) — no
  tengo evidencia de que haya un problema ahí, pero tampoco los verifiqué con el mismo rigor que el
  resto.
- Ídem para `EditarReporteInicialQE`/`EditarMineralQE` — los leí solo parcialmente (confirmé que
  están registrados en `EndpointExtensions.cs` y que sus commands existen, pero no comparé campo
  por campo contra `qualityEventEditReporteInicial.schema.ts`/`qualityEventEditMineral.schema.ts`).

## 5. Estrategia

1. Backend local (`dotnet run` + Postgres dev), `.env.development` local con MSW apagado mientras
   verificás — no toques `.env.production`.
2. Corregí primero la Sección 1 (PIN hardcodeado) — es el bloqueante más grave, sin él no se puede
   verificar nada del flujo de cierre real. Corregí después la Sección 2 (mismatch de
   `revisarAjustePlazoAC`).
3. Verificación funcional completa: CRUD de QE, transición de estados (con los tres guards
   RN-QE-002/003/009), acciones correctivas (crear/actualizar/cerrar), solicitud y revisión de
   ajuste de plazo (aprobar y rechazar, confirmando que ahora sí cambia `solicitud.Estado` y que
   aprobar sí actualiza `accion.PlazoFecha`), edición de reporte inicial/severidad/mineral, cierre
   con firma dual (primera firma JEFE_CALIDAD_SYST, segunda firma SUPERVISOR, con PINs reales
   distintos — confirmá que el 401 "PIN incorrecto" aparece si alguno escribe mal su PIN, algo que
   hoy es imposible de probar por el bug de la Sección 1), exportación de PDF (confirmá que se
   genera el archivo client-side y que el audit trail registra `EXPORTADO_PDF`), vinculación con
   Documentos (ya verificada antes, confirmá que sigue funcionando), verificación de eficacia y
   forzar vencimiento (Sección 4 — dale una pasada aunque no esté en el foco principal).
4. Si encontrás algún otro mismatch que yo no vi (especialmente en verificación de eficacia o los
   dos edits que no comparé campo por campo), documentalo con el mismo criterio de los cutovers
   anteriores: causa raíz confirmada (archivo + línea), Decision en `design.md`.
5. Revertí `shc-controldoc/.env.development` a `VITE_ENABLE_MSW=true` al terminar. No toques
   `.env.production`.

## 6. Ciclo OpenSpec

Los hallazgos de las Secciones 1 y 2 son bloqueantes reales — documentalos como Decisions con causa
raíz (archivo + línea) en `design.md`, igual que el `password`/`Pin` de Documentos. La Sección 4 es
informativa/opcional, mismo criterio que en cutovers anteriores — no es requisito de cierre, salvo
que decidas ampliar el alcance vos mismo durante la implementación.
