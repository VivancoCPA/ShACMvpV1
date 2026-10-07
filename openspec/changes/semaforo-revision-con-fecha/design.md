## Context

`RevisionSemaforo.tsx` (leído completo) computa `diasRestantes` con `calendarDaysUntil` (ya corregido en `fix-fechas-utc`) y renderiza 4 ramas: verde (solo un punto, sin texto ni tooltip), ámbar (punto + tooltip con "N días restantes", solo hover), rojo-próximo (punto + badge "Próximo" + mismo tooltip), rojo-vencido (punto pulsante + badge "Vencido", sin tooltip ni indicación de desde cuándo). Ninguna rama muestra la fecha. `DocumentListRow.tsx:140` es el único consumidor en la lista; `DocumentDetailHeader.tsx:67` también lo usa para el badge del detalle, pero esa misma página ya muestra la fecha de "Próx. revisión" por separado en su grid de metadatos (línea 122, con `formatCalendarDateMedium` — ya corregido en `fix-fechas-utc`), así que el detalle no tiene el hueco de UX que sí tiene la lista.

## Goals / Non-Goals

**Goals:**
- Que la fecha de calendario sea siempre visible junto al indicador, en los 4 estados, sin depender de hover.
- Que en ámbar/rojo el texto de días relativo también sea visible sin hover, con pluralización correcta.
- Mantener los mismos umbrales, colores y badges de siempre.

**Non-Goals:**
- Cambiar `DOC_REVISION_ALERT_DAYS`, el corte de 8 días, o cualquier regla de negocio del semáforo.
- Tocar `DocumentDetailHeader.tsx` más allá de confirmar que no lo necesita (ya muestra la fecha por su cuenta).
- Rediseñar la columna "Próx. Revisión" del header de la tabla (`DocumentList.tsx`) — solo cambia el contenido de la celda.

## Decisions

**D1 — Formato de fecha:** `formatCalendarDate(fechaRevisionProxima, i18n.language)` (mismo helper que ya usa `DeadlineBadge`/`NCList`, formato corto "29 sept 2026"), no `formatCalendarDateMedium` (más largo, mejor para el detalle que para una celda de tabla) ni `new Date(...)` local.

**D2 — Texto relativo, claves i18n nuevas** en el namespace `documents`, junto a `semaforo.proximo`/`semaforo.vencido` existentes:
- `semaforo.hoy`: "Hoy" / "Today" — cuando `diasRestantes === 0`.
- `semaforo.enDias_one`/`semaforo.enDias_other`: "en {{count}} día" / "en {{count}} días" — `es-PE`; "in {{count}} day" / "in {{count}} days" — `en-US`. Usado cuando `diasRestantes >= 1`.
- `semaforo.haceDias_one`/`semaforo.haceDias_other`: "hace {{count}} día" / "hace {{count}} días" — `es-PE`; "{{count}} day ago" / "{{count}} days ago" — `en-US`. Usado cuando `diasRestantes < 0`, con `count = Math.abs(diasRestantes)`.

La clave existente `semaforo.diasRestantes` ("{{dias}} día(s) restante(s)") queda huérfana (era solo para el tooltip); se elimina junto con el tooltip para no dejar dos formas de decir lo mismo. Los tooltips (`role="tooltip"`, `aria-describedby`) se quitan por completo — el texto visible los reemplaza, no coexiste con ellos (más simple que mantener un tooltip redundante para una celda de tabla).

**D3 — Layout de la celda:** fecha y texto relativo en dos líneas (`flex flex-col`), fecha arriba en el tono normal del texto, relativo abajo en `text-xs text-muted`. El punto de color se mantiene a la izquierda, alineado verticalmente con la fecha. Verde solo lleva la fecha (una línea) — sin línea vacía de "días" debajo. `DocumentListRow.tsx`'s `<td>` tiene `whitespace-nowrap`; con fecha corta ("29 sept 2026") y texto relativo corto ("en 5 días") no debería romper el layout en anchos normales de tabla — confirmado visualmente en la prueba manual, no se toca el `<td>`.

**D4 — `DocumentDetailHeader.tsx`:** confirmado (D1 del contexto) que ya muestra la fecha de "Próx. revisión" en su propio grid con `formatCalendarDateMedium`, independiente del badge de `RevisionSemaforo` que usa para el semáforo junto al título. Con este cambio, el detalle mostrará la fecha DOS veces (una vez en el badge del header, otra en el grid) — es aceptable y no confuso (el badge es un indicador rápido junto al título; el grid es la ficha de datos), no se quita ninguna de las dos. No se modifica este archivo.

## Riesgos / Trade-offs

- Quitar el tooltip elimina la única fuente de "días restantes" en pantallas muy angostas si el texto relativo se trunca — mitigado por D3 (el texto es corto y va en su propia línea, no depende de espacio horizontal extra).
- Ninguno de negocio: no se toca ninguna regla, solo presentación.
