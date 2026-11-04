# INSTRUCCIONES PARA CLAUDE CODE — Incidentes: detalle que se cae, nombres en lugar de códigos y ubicación en el plano

- **Fecha:** 2026-10-20
- **Autor:** Cowork (para Toño)
- **Origen:** Toño reportó lo siguiente en la prueba manual de M3 Incidentes:
  1. "Al grabar un incidente da error; al refrescar ya lo veo en la lista."
  2. "Al editar se muestran códigos en Reportado por, Local y Zona."
  
  Al revisar el código aparecieron además el defecto A (la ubicación en el plano nunca se guarda) y el pedido de Toño de que el plano se vea en el detalle.
- **Change OpenSpec:** `fix-incidentes-detalle-nombres-ubicacion`
- **Flujo:** `/opsx:sync → /opsx:propose → /opsx:apply → /opsx:archive`
- **Siguiente change (no entra aquí):** `incidentes-edicion-campos-basicos`, que hará editables en ABIERTO, con auditoría, los campos tipo, descripción, área, turno, fecha y lesionados. Cowork lo escribirá cuando este quede "listo".

---

## 1. Diagnóstico confirmado leyendo el código

### 1.1 "Error al grabar": en realidad se cae el detalle, no el guardado

- `POST /api/incidents` funciona: `CrearIncidenteHandler` hace commit y el endpoint responde 201. No hay ciclo de serialización, porque las navegaciones inversas tienen `[JsonIgnore]`.
- Después del alta, `IncidentForm.onSubmit` navega a `/incidents/{id}`, y ahí `IncidentDetailPage` lanza la excepción que Toño capturó en la consola:
  ```
  Error: Rendered more hooks than during the previous render.
    at usePlanoBlob (useLocales.ts)
    at IncidentDetailPage (IncidentDetailPage.tsx)
  ```
- **Causa:** en `shc-controldoc/src/features/incidents/pages/IncidentDetailPage.tsx`, el hook `usePlanoBlob` (línea 248 aprox.) y el cálculo de `selectedLocal` del que depende están **después** de los `return` anticipados: `if (isLoading) return <SkeletonBlock />` en la línea 220 y `if (isError || !incident)` en la 222.
  - En el primer render el incidente todavía está cargando, la página sale por el skeleton y React registra N hooks.
  - Cuando llegan los datos, React registra N+1 y se cae.
  - Pasa siempre que el detalle se abre sin caché, por ejemplo justo después de crear.
- El bug entró con `proteccion-documental` (design.md D7), cuando el plano pasó a cargarse como blob autenticado.
- ESLint ya tiene configurado `eslint-plugin-react-hooks` (`eslint.config.js`) y lo habría detectado, pero `lint` no forma parte de las verificaciones del change.

### 1.2 Códigos en lugar de nombres

- La entidad `Incidente` (`ShcMvpEndPoint.Domain/Entities/Incidente.cs`) solo tiene `ReportadoPorId`, `LocalId` y `ZonaId`. `ObtenerIncidenteHandler` y `ListarIncidentesHandler` leen únicamente de `incidentes`, sin JOIN.
- El frontend (`types/incident.types.ts`) declara `localNombre?` y `zonaNombre?`, pero el backend nunca los manda; solo existían en MSW. No hay ningún campo para el nombre de quien reportó.
- Dónde se nota:
  - `IncidentDetailPage.tsx:367` pinta `incident.reportadoPorId`, o sea el GUID.
  - `IncidentDetailPage.tsx:508` y `:515` hacen `localNombre ?? localId` y `zonaNombre ?? zonaId`, así que se ven GUIDs.
  - `IncidentMapSidePanel.tsx` (106–115) y `IncidentMapCanvas.tsx:118` usan `zonaNombre` y `localNombre`, que llegan vacíos.

### 1.3 Defecto A: la ubicación en el plano nunca se guarda

- El formulario (`incidentForm.schema.ts:74`, `createIncident.schema.ts:17` y `:48`) envía `ubicacion: { x, y }`.
- El backend espera `UbicacionX` / `UbicacionY`, tanto en `CrearIncidenteCommand` como en `ActualizarInvestigacionCommand`. En todo el frontend no aparece `ubicacionX` en ningún lado.
- **Resultado:** el clic en el plano se descarta al crear y al editar. Por eso el bloque del plano del detalle (`IncidentDetailPage.tsx`, alrededor de la línea 520) nunca se dibuja: su condición exige `incident.ubicacion`.
- La lectura sí funciona: la entidad expone `ubicacion: { x, y }` armada con `UbicacionX` / `UbicacionY`.

---

## 2. Decisiones de Toño

- **D1:** dos changes. Este incluye el detalle que se cae, los nombres, la ubicación y la mejora del plano. La edición de los campos básicos va en el siguiente.
- **D2:** los nombres **los devuelve el backend** con JOIN, para que funcionen con cualquier rol (un OPERARIO no puede listar usuarios).
- **D3** (para el siguiente change): los campos básicos serán editables solo en ABIERTO, con auditoría.
- **D4:** `npm run lint` pasa a ser parte de las "reglas de siempre", con **cero errores**.
- **Mapa:** se trata del **plano del local con el punto**, que debe verse en el detalle y en la edición. No es un mapa GPS.

---

## 3. Qué implementar

### 3.1 Backend (`ShcMvpEndPoint/`)

**a) Nombres en la lectura**

- Agregar a la entidad `Incidente` tres propiedades de solo lectura que **no se persisten**, todas `string?`: `ReportadoPorNombre`, `LocalNombre` y `ZonaNombre`. Excluirlas de EF con `[NotMapped]` o con `builder.Ignore(...)` en la configuración de la entidad. **No debe generarse ninguna migración**; si `dotnet ef migrations add` detecta cambios, algo quedó mal.
- En `ObtenerIncidenteHandler` (SQL principal) y en `ListarIncidentesHandler` (SQL de items, no el de COUNT), agregar:
  ```sql
  LEFT JOIN asp_net_users u ON u.id = i.reportado_por_id
  LEFT JOIN locales l      ON l.id = i.local_id
  LEFT JOIN zonas z        ON z.id = i.zona_id
  ```
  y seleccionar `TRIM(u.nombre || ' ' || u.apellido) AS "ReportadoPorNombre"`, `l.nombre AS "LocalNombre"` y `z.nombre AS "ZonaNombre"`.
  - Antes de escribirlo, confirmar en las configuraciones de EF los nombres reales de las columnas de `locales` y `zonas`. Usarlos tal cual (ver `ListarLocalesHandler` y `ListarZonasPorLocalHandler`).
  - Calificar con alias (`i.`) todas las columnas actuales del SELECT y del WHERE dinámico de `ListarIncidentesHandler`. Al agregar JOINs, `id`, `empresa_id`, `nombre` y `deleted_at` se vuelven ambiguos. Revisar con cuidado el `whereClause` que se arma dinámicamente.
- **Multi-empresa:** los JOIN no cambian el filtro. Sigue siendo `i.empresa_id = @EmpresaId` (el `empresaId` viene de la sesión), y el 404 se mantiene igual.
- Los endpoints de escritura (crear, actualizar, cambiar estado) pueden devolver esos tres campos en `null`: el frontend invalida la caché y vuelve a pedir el detalle. Si Claude Code prefiere que también los devuelvan, puede reutilizar `ObtenerIncidenteHandler` al final de cada uno, dejándolo anotado en `design.md`. **No es obligatorio.**

**b) Ubicación:** no hace falta tocar el backend. Los comandos ya aceptan `UbicacionX` / `UbicacionY`.

### 3.2 Frontend (`shc-controldoc/src/features/incidents/`)

**a) Detalle que se cae (`pages/IncidentDetailPage.tsx`)**

- Subir `selectedLocal` y la llamada a `usePlanoBlob` **antes** del primer `return` anticipado, usando datos opcionales:
  ```ts
  const selectedLocal = locales.find((l) => l.id === incident?.localId)
  const { planoUrl: selectedLocalPlanoUrl } = usePlanoBlob(selectedLocal?.planoPngUrl ? selectedLocal.id : undefined)
  ```
- Revisar el resto del componente y de los subcomponentes del archivo: **ningún hook puede quedar después de un `return`**. Hacer la misma revisión en `IncidentForm.tsx`, `IncidentEditPage.tsx` y `IncidentMapView.tsx`.

**b) Nombres**

- En `types/incident.types.ts`, agregar `reportadoPorNombre?: string` a `Incidente`.
- En el detalle:
  - "Reportado por" muestra `reportadoPorNombre`, y si no viene, un texto nuevo `detail.fields.usuarioDesconocido`. **Nunca el GUID.**
  - Local y Zona muestran `localNombre` / `zonaNombre`, y si no vienen, `—`. **Nunca el GUID.**
  - El `alt` del plano usa `localNombre ?? t('detail.fields.local')`.
- Buscar en el resto de M3 (lista, panel y canvas del mapa, dashboard `HeatmapIncidentesWidget`) cualquier otro lugar donde se pinte `reportadoPorId`, `localId` o `zonaId` como texto visible, y aplicar el mismo criterio.

**c) Ubicación (defecto A)**

- La traducción de formato va **en la capa de API** (`api/incidents.api.ts`), así formularios y schemas quedan iguales:
  - En `createIncident`, `createIncidentOfflineSync` y `updateIncident`: si `data.ubicacion` viene, enviar `ubicacionX: data.ubicacion.x` y `ubicacionY: data.ubicacion.y`, y **no** enviar `ubicacion`.
  - Hacerlo con un helper chico, por ejemplo `toUbicacionPayload`.
- Revisar si el reporte rápido (`IncidentQuickReportForm` / `mobileIncidentReport.schema.ts`) captura `ubicacion`. Si la captura, el helper lo cubre; si no, no hay que tocar nada.
- **Fuera de alcance:** "Limpiar ubicación" en edición no puede borrarla hoy, porque `ActualizarInvestigacionHandler` ignora los valores nulos. Va en el siguiente change; anotarlo en `design.md`.

**d) Plano del local en el detalle y en la edición**

*Detalle, bloque Ubicación:*
- Subir el ancho máximo del plano de 240 px a **480 px**, con `w-full` para que en móvil ocupe todo el ancho. El marcador se mantiene igual.
- Casos:
  - Local con plano y con ubicación: plano con el punto.
  - Local con plano y sin ubicación: plano sin punto, con el texto `detail.ubicacion.sinPunto` debajo.
  - Local sin plano: texto `detail.ubicacion.sinPlano`, sin imagen.
  - Sin local: el bloque sigue la condición actual.
- Mientras carga el blob, mostrar un skeleton del tamaño del plano para que la página no salte.

*Edición (`components/IncidentForm.tsx`, alrededor de la línea 691):*
- Hoy, si el local elegido no tiene plano, no se muestra nada. Debe mostrarse `form.ubicacion.sinPlano`.
- Mantener el plano clicable a 360 px. En modo edición tiene que aparecer el punto ya guardado; con el defecto A corregido, `defaultValues.ubicacion` lo trae.

**e) i18n (`i18n/es-PE.json` y `i18n/en-US.json`, namespace `incidents`)**

| Clave | es-PE | en-US |
|---|---|---|
| `detail.fields.usuarioDesconocido` | Usuario no disponible | User not available |
| `detail.ubicacion.sinPunto` | No se marcó la ubicación en el plano. | No location was marked on the floor plan. |
| `detail.ubicacion.sinPlano` | Este local no tiene plano cargado. | This site has no floor plan uploaded. |
| `form.ubicacion.sinPlano` | Este local no tiene plano cargado; no se puede marcar la ubicación. | This site has no floor plan uploaded; the location can't be marked. |

### 3.3 MSW (`shc-controldoc/src/mocks/`)

- En los fixtures y handlers de incidentes, agregar `reportadoPorNombre` y asegurar que `localNombre` / `zonaNombre` vengan en el detalle **y** en el listado, igual que el backend real.
- En los handlers `POST /api/incidents` y `PATCH /api/incidents/:id`: aceptar `ubicacionX` / `ubicacionY` y devolver `ubicacion: { x, y }`, igual que el backend real. Dejar de leer `body.ubicacion`.

---

## 4. Tests

**Backend (`ShcMvpEndPoint.Tests`)**
- `GET /api/incidents/{id}` devuelve `reportadoPorNombre`, `localNombre` y `zonaNombre` correctos.
- Sin local ni zona, esos dos campos vienen en `null` y la respuesta es 200.
- `GET /api/incidents` (listado) también trae los tres campos, y los filtros existentes siguen funcionando: estado, tipo, fechas, búsqueda, paginación y `deleted`. Esto prueba que no quedaron columnas ambiguas.
- Un incidente de otra empresa sigue devolviendo 404.
- `POST` con `ubicacionX` / `ubicacionY` y después `GET`: devuelve `ubicacion: { x, y }`.

**Frontend (Vitest)**
- `IncidentDetailPage`: se renderiza primero en estado de carga y luego con datos **sin lanzar error**. Simular la transición `isLoading` true → false; este es el test de regresión del bug.
- Detalle: no aparece ningún GUID en "Reportado por", Local ni Zona. Con nombres, se ven los nombres; sin nombres, se ven el fallback y `—`.
- Detalle del plano: los tres casos (con punto, sin punto, sin plano).
- `incidents.api`: `createIncident` y `updateIncident` traducen `ubicacion` a `ubicacionX` / `ubicacionY` y no envían `ubicacion`.
- `IncidentForm` en edición: con ubicación guardada se ve el punto; con un local sin plano aparece el aviso.

---

## 5. Reglas de siempre

- Toda divergencia entre esta instrucción y el código real va en `design.md`, con su motivo.
- Correr la **suite completa** (frontend y backend), `tsc --noEmit` y **`npm run lint` con cero errores** (nuevo desde hoy, decisión D4).
  - Si `lint` ya tenía errores antes de este change: corregir **todos** los de `react-hooks/rules-of-hooks`, porque son bugs reales como este.
  - Del resto, corregir solo los de los archivos que este change toque. Dejar en `design.md` la cuenta de los que quedan.
- Antes de la prueba manual: **detener el backend → `dotnet build`** (este change **no** lleva migración; si `dotnet ef` detecta cambios en el modelo, revisar el `[NotMapped]`) → `dotnet run` → Ctrl+F5. Si aparece un 404 o un comportamiento viejo, cerrar el `ShcMvpEndPoint.exe` que quedó colgado.
- **Prueba manual con MSW apagado:**
  1. Crear un incidente desde escritorio, eligiendo un local **con plano** y marcando un punto. Debe abrir el detalle **sin error**, con el plano, el punto y los nombres de quien reportó, el local y la zona.
  2. Abrir ese incidente directamente por URL y con F5: sin error.
  3. Editarlo: el punto guardado aparece en el plano. Moverlo, guardar y comprobar en el detalle que quedó en la nueva posición.
  4. Crear un incidente en un local **sin plano**: en el formulario aparece el aviso y en el detalle aparece "Este local no tiene plano cargado."
  5. En el listado y en el mapa de incidentes, los nombres de local y zona aparecen bien en el panel lateral.
  6. Repetir el paso 1 con un usuario OPERARIO: "Reportado por" muestra su nombre.
- Toño avisa con **"listo"** para que Cowork verifique.
