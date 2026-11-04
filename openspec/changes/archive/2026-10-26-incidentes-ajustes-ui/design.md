## Context

Este change hace tres ajustes de UI en M3 a partir de la prueba manual del 2026-10-21. Ver `proposal.md` y las instrucciones en `Claude outputs/INSTRUCCIONES-CLAUDE-CODE-incidentes-ajustes-ui-2026-10-21.md`. Es solo frontend + i18n.

Estado actual:
- `getIncidentQEAlertLevel` (`utils/incidentQEAlert.ts`) calcula NONE/AMARILLO/ROJO con `PLAZO_QE_HORAS` y un umbral del 75 %. `IncidentSinQEBadge` recibe solo `nivel`, y su `title` es un texto fijo que menciona el "plazo de investigación".
- `IncidentMapCanvas`: el `<img>` usa `h-full w-full object-contain` dentro de un contenedor `flex-1` sin alto definido. Los marcadores son hermanos del `<img>`, con porcentajes calculados sobre el contenedor.
- `IncidentForm`: las acciones son un `div` normal al final del `<form>`.

## Goals / Non-Goals

**Goals:** que el tooltip explique la regla; que el plano no pase de 70vh y los puntos coincidan con el plano; que Guardar esté siempre visible.

**Non-Goals:** cambiar RN-INC-006, sus umbrales o la notificación; tocar `IncidentQuickReportForm`; tocar backend o MSW.

## Decisions

1. **`getIncidentQEPlazoInfo` aparte de `getIncidentQEAlertLevel`.** `getIncidentQEAlertLevel` se usa también en `notificationGeneration.ts`, así que cambiar su firma o su resultado afectaría a la notificación. La nueva función comparte `PLAZO_QE_HORAS` y la misma fórmula de horas transcurridas, y redondea hacia abajo (`Math.floor`) sobre las horas restantes.
   - *Consecuencia del floor:* un incidente vencido hace 0,5 h da `horasRestantes = -1`, y el tooltip dice "vencido hace 1 h". Es preferible a "vencido hace 0 h". Para los números negativos, el tooltip usa el valor absoluto.
2. **El badge recibe el incidente** (`Pick<Incidente, 'tipo' | 'fechaEvento'>`) y un `now` opcional, no un `plazoInfo` ya calculado. Así `IncidentList` solo pasa `incidente={inc}` y el cálculo queda encapsulado en el badge. `nivel` sigue siendo una prop: la lista ya lo calcula, y el contrato existente "NONE → null" no cambia.
3. **Formato de duración con i18n.** Se usan las claves `list.sinQEBadge.duracion.horas` (`{{h}} h`) y `duracion.diasHoras` (`{{d}} d {{h}} h`), con un helper local `formatDuracion(horas, t)`. Por debajo de 48 h se muestra solo `X h`. Sin librerías nuevas.
4. **Mapa: envoltorio del tamaño de la imagen.** El root mantiene borde, fondo y `overflow-hidden`, y suma `flex items-center justify-center`. Dentro va `relative inline-block max-w-full` con el `<img className="block h-auto max-h-[70vh] w-auto max-w-full">` y los marcadores. Así, los porcentajes del marcador se calculan sobre la imagen renderizada. Es el mismo modelo que ya funciona en el plano del formulario y del detalle.
   - *Tooltips de marcadores:* el envoltorio **no** lleva `overflow-hidden`, para que el tooltip, que se abre hacia arriba, pueda salir del área de la imagen. Solo lo recorta el `overflow-hidden` del root cuando el marcador está pegado al borde superior del plano, y en ese caso el root tiene el mismo alto que la imagen. Se acepta ese recorte marginal: es el mismo comportamiento de antes, y voltear el tooltip queda fuera de alcance.
   - *Sin plano:* no se renderizan ni el envoltorio ni los marcadores. Esto ya lo exige la spec vigente ("No markers SHALL be rendered in this state"), pero el código actual seguía pintando marcadores sobre el overlay. Con la nueva estructura queda corregido sin costo adicional. El overlay "plano no disponible" se mantiene.
   - *Leyenda:* `IncidentMapLegend` queda en el root (esquina inferior izquierda), como antes.
5. **`HeatmapIncidentesWidget` reutiliza `IncidentMapCanvas`**, envuelto en `<div className="flex min-h-[500px]">`. Con el cambio, el plano se centra dentro de ese alto mínimo y queda limitado a 70vh. No se toca el widget en este change. Su `min-h-[500px]` puede dejar franjas arriba y abajo con planos apaisados, pero los puntos ahora quedan alineados. Queda como posible ajuste futuro.
6. **Barra sticky dentro del `<form>`.** Así se conserva `type="submit"` sin `form=` externo. Clases: `sticky bottom-0 z-10 -mx-6 mt-6 flex items-center justify-end gap-3 border-t border-hairline bg-canvas/95 px-6 py-3 backdrop-blur dark:border-hairline/20 dark:bg-surface-dark/95`. El `-mx-6`/`px-6` compensa el `p-6` de `PageWrapper`. La barra está en el flujo normal: cuando el scroll llega al final, queda debajo del último campo y no lo tapa. Por eso alcanza con el `mt-6` y no hace falta un `pb` extra. El `pb-6` de `PageWrapper` deja un pequeño hueco bajo la barra en el tope del scroll; es aceptable.

## Risks / Trade-offs

- [El `-mx-6` no coincide si `IncidentForm` se usa dentro de otro contenedor con otro padding] → Hoy solo lo usan `IncidentNewPage` e `IncidentEditPage`, ambas dentro de `PageWrapper` (`p-6`). Se verifica en la prueba manual.
- [`sticky` no funciona si algún ancestro entre el form y `main` tiene `overflow` distinto de visible] → Se revisan los ancestros. `main` es el contenedor con scroll.
- [Los tests usan jsdom, sin layout real] → Los tests verifican la estructura y las clases (sticky, descendencia de marcadores). La geometría se valida en la prueba manual.

## Notas de implementación (divergencias)

- **Barra sticky y `-mx-6`:** `IncidentNewPage` e `IncidentEditPage` envuelven el form en `mx-auto max-w-3xl` dentro de `PageWrapper` (`p-6`). En pantallas anchas, la barra cubre el ancho del form más 24 px por lado, no todo el `main`. En pantallas angostas llega a los bordes. Se mantiene así: la barra queda alineada con la columna del formulario. `mt-6` duplica el `space-y-6` del form, pero es inocuo.
- **Envoltorio del plano:** se agregó `min-w-0` al envoltorio (`relative inline-block min-w-0 max-w-full`) para que, como flex item, nunca imponga el ancho intrínseco de la imagen por encima de `max-w-full`. También se agregó `data-testid="incident-map-plano"` para el test de estructura, y `data-testid="incident-form-actions"` en la barra.
- **Sin plano:** ya no se pintan marcadores (decisión 4). Antes la spec vigente se incumplía.
- **Verificación, línea base del repo (2026-10-21):** el árbol de trabajo trae cambios sin archivar de otros changes. El resultado de las verificaciones queda así:
  - `vitest run`: 1705 ok y 1 fallo determinista, ajeno a este change: `src/router/documentReplaceOriginal.test.tsx` (RN-DOC-013, SUPERVISOR revisor). Hay además 3 *unhandled errors* en `IncidentQuickReportForm.test.tsx` (`useAuthStore.getState is not a function`): `offlineQueueStore.refresh` lo usa desde `sesion-timeout-inactividad`, pero el mock de `authStore` de ese test no lo define.
  - `tsc --noEmit -p tsconfig.app.json`: 0 errores en los archivos de este change; hay errores preexistentes en `documents.fixtures.ts`, `documents.handlers.ts` y `documents.types.test.ts` (`archivoUrl`, `string | null`).
  - `npm run lint`: 58 errores preexistentes en el repo. En los archivos de este change, el único es `react-refresh/only-export-components` en `IncidentMapCanvas.tsx:16` (export de `computeClusters`), que ya existía antes. Moverlo a `utils/` queda fuera de alcance.
  - `dotnet test`: no se pudo correr, porque el backend en ejecución (PID 32032) bloquea las DLL. Este change no toca backend.
- **Cierre de verificaciones (2026-10-21, decisión de Toño):** suite, `tsc` y lint se dan por cumplidos con el criterio "cero errores en los archivos del change", con la línea base de arriba (sin cambios al repetirla). Este change no toca el backend; la corrida de `dotnet test` con el backend detenido la cortó el sistema por falta de memoria, y hasta ahí solo se vio un fallo ajeno, en `DocumentosPdfConversionTests`.
