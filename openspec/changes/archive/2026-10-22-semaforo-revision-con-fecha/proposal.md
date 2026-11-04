## Why

La columna "Próx. Revisión" de la lista de documentos (`RevisionSemaforo.tsx`, usado por `DocumentListRow.tsx:140`) nunca muestra la fecha — solo un punto de color. El texto de días restantes vive en un tooltip que solo aparece al pasar el mouse, no existe en verde ni en vencido, y no funciona en pantallas táctiles. El usuario no puede saber *cuándo* vence un documento sin tener que abrir cada uno. No es un bug de contrato (`fechaRevisionProxima` llega bien desde el backend real, confirmado en `fix-fechas-utc`); es un hueco de UX confirmado leyendo el código.

## What Changes

- `RevisionSemaforo` muestra siempre la fecha de calendario (`formatCalendarDate`, el helper sin desfase de zona horaria de `fix-fechas-utc`) junto al indicador de color, en los cuatro estados.
- En ámbar y rojo (próximo/vencido), agrega el texto de días relativo visible sin hover ("en N días" / "hace N días" / "hoy"), con pluralización correcta vía claves i18n `_one`/`_other`.
- El tooltip deja de ser la única forma de ver el dato — la información pasa a texto visible (color no es el único portador).
- Mismos umbrales y colores de siempre (`DOC_REVISION_ALERT_DAYS`, corte de 8 días); sin cambios de lógica de negocio.

## Capabilities

### Modified Capabilities
- `document-list-view`: el requirement de `RevisionSemaforo` se actualiza para reflejar el comportamiento real vigente (helpers de `fix-fechas-utc`, `null` además de `undefined`) y el nuevo requisito de mostrar siempre la fecha y el texto relativo sin depender de hover.

## Impact

- Frontend únicamente: `features/documents/components/RevisionSemaforo.tsx` (+ test), i18n `es-PE`/`en-US` (namespace `documents`), y confirmación de que `DocumentDetailHeader.tsx` (que también usa `RevisionSemaforo` y además muestra la fecha por su cuenta con `formatCalendarDateMedium`) no necesita cambios adicionales.
- Sin cambios de backend, de contrato de API ni de tipos compartidos.
