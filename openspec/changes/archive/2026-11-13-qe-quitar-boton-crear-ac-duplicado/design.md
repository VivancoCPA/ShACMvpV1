## Context

`solicitudes-ac-y-ac-del-qe-en-origen` (D10) agregó un botón "Crear AC" dentro del aviso de solicitudes pendientes de `QEACSection`. Ese botón ejecuta `setShowAddModal(true)` bajo `canAsignarAC`, exactamente igual que "+ Nueva AC" del encabezado de la sección. El descuento de la solicitud ocurre en el servidor (`CrearAccionCorrectivaQEHandler` / handler MSW de `POST /:id/acciones-correctivas`), sin importar desde qué botón se abrió el modal.

## Goals / Non-Goals

**Goals:**
- Un único punto de entrada para crear AC en la sección: "+ Nueva AC" del encabezado.
- Que el aviso explique cómo atender la solicitud (crear con «Nueva AC» o descartar).

**Non-Goals:**
- No se toca el botón "Crear AC" del asistente de IA (`detail.investigation.ia.crearAC`): precarga la acción sugerida y no es redundante.
- No hay cambios de backend, MSW ni de la lógica de descuento de solicitudes.
- No se reestiliza el botón "+ Nueva AC".

## Decisions

- **Quitar el botón del aviso y no el del encabezado.** Decisión de Toño. "+ Nueva AC" existe aun sin solicitudes, así que es el punto de entrada estable.
- **El aviso conserva "Descartar solicitud" con su condición actual (`!readOnly`).** El contenedor de acciones del aviso queda solo con ese botón.
- **Se elimina la clave `detail.acSection.crearDesdeSolicitud`** en ambos idiomas en lugar de dejarla huérfana.

## Divergencias con la instrucción

- **Texto en-US del aviso.** La instrucción propone `Create it with "New CA" or dismiss it.`, pero la etiqueta real del botón en en-US (`detail.acSection.actions.add`) es **"New AC"**. Para que el aviso nombre el botón que el usuario ve en pantalla, el texto en-US queda: `{{count}} pending new CA request(s) — logged from the QE's origin. Create it with "New AC" or dismiss it.` El resto del texto sigue a la instrucción.

## Risks / Trade-offs

- [El JCA podría no encontrar dónde crear la AC desde el aviso] → El texto del aviso indica explícitamente «Nueva AC», y el botón está justo debajo, en el encabezado de la sección.

## Verificación (estado al aplicar)

- `QEACSection.test.tsx`: 36/36 en verde. `grep crearDesdeSolicitud src` → sin resultados.
- Suite completa: 1998 pasan, 1 falla, que es `IncidentQuickReportForm.test.tsx` ("envío offline con 2 fotos…"). Pasa 10/10 en aislamiento, así que es intermitente bajo carga y no depende de este cambio.
- `tsc --noEmit -p tsconfig.app.json`: 18 errores ya existentes en archivos que este cambio no toca (`documents.fixtures.ts`, `documents.handlers.ts`, `documents.types.test.ts`, `PanelPendientesAreaWidget.test.tsx`). Ninguno está en archivos de este cambio.
- `npm run lint`: 53 errores ya existentes en otros archivos. `eslint` sobre `QEACSection.tsx` y su test da 0 errores; los 2 warnings de `watch()` ya existían. **No se cumple "lint con cero errores" a nivel global**. Queda fuera del alcance de este cambio.
