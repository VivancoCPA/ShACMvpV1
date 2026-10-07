# Instrucciones para Claude Code: mostrar la fecha en la columna "Próx. Revisión"

Fecha: 2026-09-30
Autor: Cowork (investigación sobre el código real)
Origen: Toño. En la lista de documentos, la columna "Próx. Revisión" muestra solo un indicador de color. Con el rojo aparece "Próximo", pero no se ve **cuándo** vence.
Change sugerido: `semaforo-revision-con-fecha` (change pequeño y solo de frontend).

Ciclo: `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

---

## Estado actual (confirmado leyendo el código)

`features/documents/components/RevisionSemaforo.tsx` (lo usa `DocumentListRow.tsx:140`) **nunca muestra la fecha**:

| Días restantes | Qué se ve | Información adicional |
|---|---|---|
| > `DOC_REVISION_ALERT_DAYS` | solo un punto verde | ninguna |
| 8 hasta el umbral | solo un punto ámbar | tooltip con "N días restantes", **solo al pasar el mouse** |
| 1 a 7 | punto rojo y badge "Próximo" | tooltip con "N días restantes", solo al pasar el mouse |
| ≤ 0 | punto rojo pulsante y badge "Vencido" | ninguna (no dice desde cuándo está vencido) |
| sin fecha | "—" | — |

No es un bug de contrato: la fecha llega bien desde el backend (`fechaRevisionProxima`). Es un hueco de UX. El tooltip no sirve en pantallas táctiles y no aparece en verde ni en vencido.

## Qué implementar

1. **Mostrar siempre la fecha** junto al indicador, en los cuatro estados. Usa `formatCalendarDate` de `utils/date.utils.ts`, el helper de "fecha de calendario sin zona" que se agregó en `fix-fechas-utc`. **No** uses `new Date(...)` con formato local ni `formatShortDate`: en UTC-5 mostrarían el día anterior.
2. **Mantener el color y los badges** ("Próximo", "Vencido") con los mismos umbrales. No cambies `DOC_REVISION_ALERT_DAYS` ni el corte de 8 días.
3. **Días restantes visibles sin hover** en ámbar y rojo, en texto secundario. Por ejemplo: `15/10/2026 · en 5 días`. En vencido, muéstralo en positivo: `20/09/2026 · hace 10 días`. En verde basta con la fecha. Usa claves i18n nuevas en es-PE y en-US, con pluralización correcta (1 día / N días) y el caso de 0 días ("hoy").
4. **Accesibilidad:** el color no debe ser el único portador de información, así que el texto visible reemplaza al tooltip. Si conservas el tooltip, que sea redundante y no la única forma de ver el dato.
5. **Detalle del documento:** revisa si `DocumentDetailPage` (o el encabezado del detalle) muestra la fecha de próxima revisión. Si usa `RevisionSemaforo`, el cambio aplica también ahí. Si formatea la fecha por su cuenta, confirma que use `formatCalendarDate` y anótalo.
6. **Ancho de la columna:** confirma que la columna no rompe el layout de la tabla en anchos chicos. Si hace falta, la fecha puede ir en una línea y los días en otra, debajo.

## Tests
- `RevisionSemaforo` con los cuatro estados y sin fecha: la fecha formateada aparece siempre. Los textos "en N días", "hace N días" y "hoy" aparecen donde corresponde.
- Un caso con zona horaria UTC-5 que confirme que la fecha mostrada no se corre un día.
- Actualiza los tests existentes de `DocumentListRow` y `RevisionSemaforo` que dependían del tooltip.

## Reglas de siempre
- Corre la suite completa de tests del frontend y `tsc`.
- Prueba manual con MSW apagado contra el backend real. Crea o edita documentos con próxima revisión dentro de 30 días, dentro de 7 días, hoy y en el pasado, y confirma la fecha y el texto de cada uno en la lista.
- Al terminar, Toño avisa con "listo". Cowork verifica releyendo el código real.
