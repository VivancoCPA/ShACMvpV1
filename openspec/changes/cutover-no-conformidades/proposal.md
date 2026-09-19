## Why

`cutover-auth`, `cutover-catalogos`, `cutover-incidentes` y `cutover-documentos` ya verificaron y cerraron los primeros cuatro módulos del roadmap contra el backend .NET real. No Conformidades (M2) es el quinto. A diferencia de los cuatro anteriores, la investigación previa (leyendo el código real de `features/nonconformities/**` y `Features/NoConformidades/**`) no encontró ningún mismatch de contrato bloqueante entre frontend y backend — el contrato ya coincide ruta por ruta y campo por campo. Lo que sí hay es un hallazgo informativo que cambia cómo se verifica este cutover: la transición de estados principal de la NC (`ABIERTA → EN_INVESTIGACION → ANALISIS_COMPLETADO → EN_EJECUCION → PENDIENTE_CIERRE → CERRADA`) no tiene ningún punto de entrada real en la UI hoy — el backend la soporta vía el único `PATCH /:id` genérico, pero ningún botón la invoca.

## What Changes

- Apuntar `shc-controldoc` en desarrollo (`.env.development`, `VITE_ENABLE_MSW=false`) al backend .NET real y verificar en navegador/API directa: CRUD completo de No Conformidad, anulación, acciones correctivas (crear/actualizar/cerrar), vinculación con Quality Event (`qeGeneradoId`) y con Documentos — sin tocar `.env.production`.
- Verificar las transiciones de estado principales de la NC (`ABIERTA → EN_INVESTIGACION → ANALISIS_COMPLETADO → EN_EJECUCION → PENDIENTE_CIERRE → CERRADA`) por API directa contra el backend real, ya que hoy no existe ningún botón de transición en `NonconformityDetailPage.tsx` — documentar el hallazgo en `design.md` como trabajo de producto pendiente (construir esa UI), no como bug a corregir en este change.
- No se anticipa ningún cambio de código en backend ni frontend para cerrar un mismatch de contrato — la investigación previa, verificada de nuevo en esta sesión (grep + lectura directa de `ActualizarNoConformidadCommand.cs`/`ActualizarNoConformidadHandler.cs`, `nonconformities.api.ts`, `EndpointExtensions.cs`), no encontró ninguno. Cualquier discrepancia real que aparezca durante la verificación en navegador se corrige con causa raíz confirmada (mismo criterio que los cutovers anteriores), no se asume de antemano.
- Como en los cutovers anteriores: inspeccionar los tests de No Conformidades antes de asumir que dependen de MSW; documentar en `design.md` si "hay que migrar todo" no aplica.
- Al cerrar: revertir `.env.development` a `VITE_ENABLE_MSW=true` (los módulos restantes siguen dependiendo de MSW hasta su propio cutover).

## Capabilities

### New Capabilities

- `frontend-no-conformidades-cutover-verification`: escenarios de verificación manual/API para No Conformidades contra el backend .NET real + Postgres real, sin MSW — CRUD completo, anulación, acciones correctivas, vinculación con QE y con Documentos, y las transiciones de estado principales verificadas por API directa. Equivalente de No Conformidades a `frontend-incidentes-cutover-verification`.

### Modified Capabilities

(Ninguna — no se detectó ningún requirement de `be-no-conformidades-api` que necesite cambiar; el contrato ya coincide.)

## Impact

- **Afectado (frontend)**: `shc-controldoc/.env.development` (ventana de verificación), tests de No Conformidades que resulten depender de MSW tras inspección.
- **Afectado (backend)**: ninguno anticipado — a confirmar durante la verificación.
- **No afectado**: `nonconformities.api.ts`, todos los schemas Zod de No Conformidades, handlers MSW de No Conformidades (se mantienen intactos para módulos aún no cutover-eados), el resto de `features/nonconformities/**`.
- **Pendiente explícito, no se resuelve en este change**: la UI de transición de estados principal de la NC (`canIniciarInvestigacion`/`canRegistrarCorreccion`/`canSolicitarCierre` sin consumidor en `NonconformityDetailPage.tsx`, `cambiarEstadoNCSchema` sin consumidor real) — se documenta como hallazgo informativo; construirla es trabajo de producto nuevo, fuera de alcance salvo decisión explícita del usuario.
- **Fuera de alcance**: los 3 módulos de dominio restantes del roadmap (Quality Events, Dashboard, Users) — cada uno su propio change `cutover-<modulo>`.
