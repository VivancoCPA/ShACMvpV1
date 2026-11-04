# INSTRUCCIONES PARA CLAUDE CODE — Incidentes: tooltip "Sin QE", tamaño del mapa y barra fija con Guardar

- **Fecha:** 2026-10-21
- **Autor:** Cowork (para Toño)
- **Origen:** observaciones de Toño en la prueba manual de M3 Incidentes:
  1. INC-2026-003 muestra "Sin QE vinculado" y los demás registros no. ¿Qué lo hace distinto?
  2. Al pasar la lista a vista MAPA, el mapa sale demasiado grande.
  3. En el alta, el scroll de la pantalla deja oculto el botón GUARDAR.
- **Change OpenSpec:** `incidentes-ajustes-ui`. Es un change aparte, independiente de `fix-incidentes-detalle-nombres-ubicacion`. Si los dos se implementan a la vez, `IncidentForm.tsx` puede tener conflictos: aplicar este **después** de archivar aquel.
- **Flujo:** `/opsx:sync → /opsx:propose → /opsx:apply → /opsx:archive`
- **Solo frontend + i18n.** No toca backend, MSW ni migraciones.

---

## 1. Diagnóstico confirmado leyendo el código

### 1.1 "Sin QE vinculado" funciona bien (RN-INC-006), pero el tooltip confunde

- El nivel lo calcula `getIncidentQEAlertLevel` en `shc-controldoc/src/features/incidents/utils/incidentQEAlert.ts`. La etiqueta aparece cuando se cumplen tres condiciones:
  - el incidente no tiene `qeId`;
  - no está eliminado y su estado está en `ACTIVE_STATES` (`ABIERTO`, `EN_INVESTIGACION`, `ANALISIS_COMPLETADO`, `EN_EJECUCION`, `PENDIENTE_CIERRE`);
  - ya transcurrió al menos el 75 % de `PLAZO_QE_HORAS[tipo]`, contado desde `fechaEvento`. Los plazos son: ACCIDENTE 24 h, INCIDENTE 48 h, CUASI_ACCIDENTE 72 h y CONDICION_INSEGURA 48 h.
- El nivel es AMARILLO entre el 75 % y el 100 % del plazo, y ROJO desde el 100 %.
- Lo muestra `IncidentSinQEBadge.tsx`, que solo se usa en `IncidentList.tsx:558`, con un `title` nativo.
- **El problema es el texto.** Los tooltips (`incidents:list.sinQEBadge.tooltip.AMARILLO/ROJO`) hablan del "plazo de **investigación**", pero el plazo que se calcula es el de **vincular un QE** (`PLAZO_QE_HORAS`). Además no dicen cuántas horas son ni cuánto falta, así que el usuario no puede saber por qué un registro tiene la etiqueta y otro no.

### 1.2 El mapa sale demasiado grande y los puntos quedan corridos

- En `pages/IncidentMapView.tsx:69`, el contenedor es `relative flex min-h-[500px]` y no tiene alto máximo.
- En `components/IncidentMapCanvas.tsx:81–90`:
  - el contenedor es `relative flex-1 overflow-hidden …`;
  - el `<img>` lleva `className="h-full w-full object-contain"`.
  
  Como el contenedor no tiene un alto definido, la imagen ocupa todo el ancho y crece en alto según su proporción natural. Con un plano grande, la vista se vuelve enorme.
- **Segundo defecto, en la misma zona:** los marcadores se posicionan con `left/top` en **% del contenedor** (líneas 130–133). Cuando `object-contain` deja franjas vacías, el área de la imagen ya no coincide con el contenedor y los puntos quedan desplazados respecto del plano.
- Comparación: el plano del formulario y el del detalle funcionan bien. Ahí el contenedor del marcador envuelve exactamente a la imagen (`relative` + `<img className="w-full">`, sin `object-contain`).

### 1.3 El botón Guardar no se ve en el alta y la edición

- El layout está bien:
  - `AppShell.tsx` usa `flex h-screen` con `<main className="flex-1 overflow-y-auto">`;
  - el Toaster va en `top-right`;
  - no hay ningún elemento fijo que tape el botón.
- Las acciones (Cancelar / Guardar) están **solo al final** del `<form>` en `components/IncidentForm.tsx`, alrededor de la línea 955. El formulario es largo (reporte inicial, ubicación con plano, evidencias y, en edición, investigación), así que el botón queda fuera de la vista hasta llegar al fondo.

---

## 2. Decisiones de Toño

- **D1:** la regla RN-INC-006 no se toca. Se hace un **tooltip más claro**, que diga cuál es el plazo para vincular el QE y cuánto falta o cuánto lleva vencido.
- **D2:** en la vista de mapa, el plano se ajusta para verse completo, con un **alto máximo del 70 % de la ventana**. Los puntos se calculan **sobre la imagen**.
- **D3:** **barra de acciones fija abajo** (sticky), con Cancelar y Guardar siempre visibles, en alta **y** en edición.
- **D4:** change aparte (`incidentes-ajustes-ui`).

---

## 3. Qué implementar (todo en `shc-controldoc/src/`)

### 3.1 Tooltip "Sin QE vinculado" (D1)

- En `features/incidents/utils/incidentQEAlert.ts`, agregar una función pura y testeable que devuelva el detalle del plazo, sin cambiar la firma ni el resultado de `getIncidentQEAlertLevel`:
  ```ts
  export function getIncidentQEPlazoInfo(
    incidente: Pick<Incidente, 'tipo' | 'fechaEvento'>,
    now: Date = new Date(),
  ): { plazoHoras: number; horasRestantes: number }
  ```
  `horasRestantes` puede salir negativo cuando el plazo ya venció. Redondear hacia abajo.
- `IncidentSinQEBadge` recibe el incidente, o el `plazoInfo`, además del `nivel`, y arma el texto así:
  - AMARILLO: `Plazo para vincular un QE: {{plazo}} h · vence en {{restante}}`
  - ROJO: `Plazo para vincular un QE: {{plazo}} h · vencido hace {{vencido}}`
- `{{restante}}` / `{{vencido}}` se formatean como `X h` si son menos de 48 h, y como `X d Y h` si son 48 h o más. Hacerlo con un helper pequeño o con i18n plurals, sin librerías nuevas.
- **Accesibilidad:** además del `title`, poner el mismo texto en `aria-label` del `<span>`, para lectores de pantalla y para que se pueda probar.
- Actualizar `IncidentList.tsx:558` para pasar lo que el badge necesite.

**i18n (`i18n/es-PE.json` y `i18n/en-US.json`, `incidents:list.sinQEBadge.tooltip`).** Reemplazar los dos textos actuales:

| Clave | es-PE | en-US |
|---|---|---|
| `tooltip.AMARILLO` | Plazo para vincular un QE: {{plazo}} h · vence en {{restante}} | Deadline to link a QE: {{plazo}} h · due in {{restante}} |
| `tooltip.ROJO` | Plazo para vincular un QE: {{plazo}} h · vencido hace {{vencido}} | Deadline to link a QE: {{plazo}} h · overdue by {{vencido}} |

### 3.2 Tamaño del mapa y posición de los puntos (D2)

En `features/incidents/components/IncidentMapCanvas.tsx`:

- Mantener el contenedor exterior (borde, fondo y `overflow-hidden`), ahora con `flex items-center justify-center`.
- Dentro, un **envoltorio que mida exactamente lo mismo que la imagen**:
  ```tsx
  <div className="relative inline-block max-w-full">
    <img
      src={planoPngUrl}
      className="block h-auto max-h-[70vh] w-auto max-w-full"
      …
    />
    {/* marcadores aquí, con left/top en % de ESTE envoltorio */}
  </div>
  ```
  Así el plano se ve completo, no pasa del 70 % del alto de la ventana ni del ancho disponible, y no se deforma.
- Mover los marcadores y sus tooltips hover **dentro de ese envoltorio**, para que los porcentajes se calculen sobre la imagen. Los overlays "plano no disponible" y "sin incidentes" pueden quedarse en el contenedor exterior.
- Los tooltips de los marcadores no deben quedar recortados por el `overflow-hidden` del envoltorio. Si pasa, quitar `overflow-hidden` del envoltorio (el exterior lo conserva) o ajustar la dirección del tooltip cerca del borde superior. Dejarlo anotado en `design.md`.

En `features/incidents/pages/IncidentMapView.tsx:69`:
- Reemplazar `min-h-[500px]` por un alto mínimo razonable para el caso sin plano, por ejemplo `min-h-[320px]`.
- El panel lateral (`IncidentMapSidePanel`, `w-80`) debe ocupar como máximo el alto del canvas, con `max-h-[70vh]` y el scroll interno que ya tiene.
- Revisar `features/dashboard/components/HeatmapIncidentesWidget.tsx`, que también usa `usePlanoBlob`. Si reutiliza `IncidentMapCanvas`, verificar que el widget se siga viendo bien con el cambio. Si tiene su propio render con el mismo patrón `object-contain` y porcentajes del contenedor, **anotarlo en `design.md` y no tocarlo** en este change.

### 3.3 Barra de acciones fija (D3)

En `features/incidents/components/IncidentForm.tsx`, en el bloque `{/* ─── Actions ─── */}` (alrededor de la línea 955):

- Convertirlo en una barra **sticky** al pie del área con scroll (`main`):
  ```
  sticky bottom-0 z-10 -mx-6 mt-6 flex items-center justify-end gap-3
  border-t border-hairline bg-canvas/95 px-6 py-3 backdrop-blur
  dark:border-hairline/20 dark:bg-surface-dark/95
  ```
  El `-mx-6` / `px-6` sirve para que la barra cubra el ancho del `p-6` de `PageWrapper`. Ajustarlo si visualmente no coincide.
- La barra sigue **dentro del `<form>`**, así el botón Guardar mantiene `type="submit"` sin cambios. Se conservan los estados `disabled` y "Guardando…".
- Con `bg-canvas/95` y el borde superior, la barra no debe tapar el último campo: agregar `pb-2` al final del form o el espacio que haga falta.
- Aplica a alta y edición, porque las dos usan `IncidentForm`.
- **Fuera de alcance:** el reporte rápido móvil (`IncidentQuickReportForm`) tiene su propio layout; no tocarlo.

---

## 4. Tests (Vitest)

- `incidentQEAlert.test.ts`:
  - `getIncidentQEPlazoInfo` da el plazo correcto por cada tipo;
  - `horasRestantes` es positivo antes del vencimiento y negativo después, con `now` fijo;
  - `getIncidentQEAlertLevel` no cambia: los tests existentes siguen en verde.
- `IncidentSinQEBadge`:
  - AMARILLO muestra "vence en …" y ROJO "vencido hace …";
  - el `aria-label` coincide con el `title`;
  - con NONE no se renderiza.
- `IncidentMapCanvas`: los marcadores se renderizan **dentro** del envoltorio de la imagen. Verificar por estructura del DOM: el marcador es descendiente del elemento que contiene el `<img>`.
- `IncidentForm`: el contenedor de las acciones tiene la clase `sticky` y el botón submit sigue dentro del `<form>`.

---

## 5. Reglas de siempre

- Toda divergencia entre esta instrucción y el código real va en `design.md`, con su motivo.
- Correr la **suite completa** (frontend y backend) + `tsc --noEmit` + **`npm run lint` con cero errores**.
- No hay cambios de backend. Si el backend estaba corriendo, no hace falta reiniciarlo. Si se reinicia por otro motivo: detener → `dotnet build` → `dotnet run` → Ctrl+F5.
- **Prueba manual con MSW apagado:**
  1. **Lista:** pasar el mouse sobre "Sin QE vinculado" en INC-2026-003. El tooltip dice el plazo del tipo y cuánto falta o cuánto lleva vencido.
  2. **Mapa:** elegir un local con plano. El plano se ve completo, sin pasar del 70 % de la ventana. Comparar un punto con el detalle de ese incidente: está en el mismo lugar del plano. Probar también achicando la ventana.
  3. **Alta:** en "Nuevo incidente", sin bajar, Cancelar y Guardar se ven al pie de la pantalla. Al hacer scroll siguen fijos y no tapan el último campo.
  4. **Edición:** lo mismo que en el paso 3.
  5. **Modo oscuro:** la barra y el mapa se ven bien.
- Toño avisa con **"listo"** para que Cowork verifique.
