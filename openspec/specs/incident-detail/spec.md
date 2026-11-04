# Spec: incident-detail

## Purpose

Vista de detalle para incidentes SyST con cabecera de badges, banner de escalado por severidad, secciones colapsables, galería de evidencias con lightbox, alertas de documentación pendiente, y lista de acciones correctivas provisionales.

---

## Requirements

### Requirement: Página de detalle de incidente
El sistema SHALL proveer una vista de detalle en `/incidents/:id` accesible para todos los roles con acceso a M3 (OPERARIO, SUPERVISOR, JEFE_CALIDAD_SYST, AUDITOR_INTERNO, ALTA_DIRECCION). Si el incidente no existe, el sistema SHALL mostrar un estado vacío con mensaje explicativo y botón "Volver a Incidentes". Si `deletedAt` está presente, el sistema SHALL redirigir a `/incidents`.

#### Scenario: Acceso a detalle existente
- **WHEN** un usuario con rol SUPERVISOR navega a `/incidents/inc-001`
- **THEN** el sistema muestra la página de detalle con los datos del incidente

#### Scenario: Incidente no encontrado
- **WHEN** un usuario navega a `/incidents/id-inexistente`
- **THEN** el sistema muestra un estado vacío con mensaje y botón de regreso

#### Scenario: Incidente eliminado redirige a lista
- **WHEN** un usuario navega a `/incidents/:id` y el incidente tiene `deletedAt` poblado
- **THEN** el sistema redirige a `/incidents`

### Requirement: Cabecera del incidente con badges y metadatos
La sección de cabecera SHALL mostrar: número del incidente en tipografía grande, `IncidentTypeBadge` + `IncidentStatusBadge` + `SeverityBadge` en línea horizontal, y los metadatos: fecha de evento, área, turno, reportado por, y fecha de reporte. "Reportado por" SHALL mostrar `reportadoPorNombre`. Si no viene, SHALL mostrar el texto `incidents:detail.fields.usuarioDesconocido` ("Usuario no disponible") y nunca `reportadoPorId`.

#### Scenario: Cabecera con metadatos completos
- **WHEN** se carga el detalle de un incidente
- **THEN** el número, badges y todos los metadatos se muestran en la cabecera

#### Scenario: Reportado por muestra el nombre
- **WHEN** el incidente tiene `reportadoPorNombre = 'Juan Pérez'`
- **THEN** "Reportado por" muestra "Juan Pérez" y el GUID de `reportadoPorId` no aparece en la página

#### Scenario: Reportado por sin nombre
- **WHEN** el incidente no trae `reportadoPorNombre`
- **THEN** "Reportado por" muestra "Usuario no disponible" y nunca el GUID

#### Scenario: Breadcrumb de navegación
- **WHEN** se carga el detalle de un incidente INC-2026-003
- **THEN** el breadcrumb muestra "Incidentes / INC-2026-003"

### Requirement: Banner de escalado visual por severidad
El sistema SHALL mostrar un `EscaladoBanner` en la cabecera cuando `severidad` es `CRITICA` (fondo rojo, ícono AlertTriangle) o `ALTA` (fondo naranja, ícono AlertTriangle) con el texto "Incidente de severidad [CRÍTICA/ALTA] — Requiere atención inmediata". Para otras severidades no se muestra banner.

#### Scenario: Banner rojo para severidad CRITICA
- **WHEN** se carga el detalle de un incidente con `severidad = CRITICA`
- **THEN** aparece un banner rojo con el texto correspondiente

#### Scenario: Banner naranja para severidad ALTA
- **WHEN** se carga el detalle de un incidente con `severidad = ALTA`
- **THEN** aparece un banner naranja con el texto correspondiente

#### Scenario: Sin banner para severidad MEDIA o BAJA
- **WHEN** se carga el detalle de un incidente con `severidad = MEDIA`
- **THEN** no aparece ningún banner de escalado

### Requirement: Botones de acción según permisos
La cabecera SHALL mostrar botones de acción según `getIncidentPermissions()`: botón "Editar" (ícono Pencil, navega a `/incidents/:id/editar`) visible si `canEdit = true`, y botón "Eliminar" (ícono Trash2) visible si `canDelete = true`. El botón Eliminar SHALL abrir un modal de confirmación antes de ejecutar la eliminación.

#### Scenario: Botones visibles para SUPERVISOR
- **WHEN** un SUPERVISOR ve el detalle de un incidente en estado EN_INVESTIGACION
- **THEN** los botones Editar y Eliminar son visibles

#### Scenario: Sin botones para incidente ANULADO
- **WHEN** se carga el detalle de un incidente con `estado = ANULADO`
- **THEN** no se muestran botones de edición ni eliminación

#### Scenario: Modal de confirmación antes de eliminar
- **WHEN** el usuario hace clic en "Eliminar"
- **THEN** aparece un modal de confirmación antes de ejecutar la acción

### Requirement: Botón "Crear QE" visible cuando el incidente no tiene QE vinculado
El sistema SHALL renderizar un botón "Crear QE" en la cabecera de acciones de la página de detalle del incidente cuando `getIncidentPermissions(incidente, userRole).canCrearQE === true`. Al hacer clic, el sistema SHALL navegar a `/quality-events/nuevo?origen=O1_INCIDENTE_CAMPO&incidenteId={incidente.id}&incidenteNumero={incidente.numero}&incidenteArea={incidente.areaId}` (con los valores codificados para URL). El botón SHALL estar ausente del DOM — no solo deshabilitado — cuando `canCrearQE` es `false`. Este botón es independiente del enlace "Ver en QE" y del botón "Solicitar AC en QE", los cuales solo aparecen cuando `incidente.qeId` YA está poblado.

#### Scenario: Botón Crear QE visible para SUPERVISOR en incidente activo sin QE vinculado
- **WHEN** un usuario con rol `SUPERVISOR` ve el detalle de un incidente en estado `EN_INVESTIGACION` sin `qeId`
- **THEN** el botón "Crear QE" es visible

#### Scenario: Botón Crear QE ausente cuando el incidente ya tiene un QE vinculado
- **WHEN** `incidente.qeId` está poblado
- **THEN** el botón "Crear QE" no aparece, independientemente del rol, y en su lugar se muestra el enlace "Ver en QE" según la regla existente

#### Scenario: Botón Crear QE ausente para OPERARIO
- **WHEN** un usuario con rol `OPERARIO` ve el detalle de cualquier incidente
- **THEN** el botón "Crear QE" no aparece

#### Scenario: Clic en Crear QE navega con los query params de vinculación
- **WHEN** un usuario autorizado hace clic en "Crear QE" en el incidente `INC-2026-003` (`id: 'inc-003'`, `areaId: 'SyST'`)
- **THEN** el router navega a `/quality-events/nuevo?origen=O1_INCIDENTE_CAMPO&incidenteId=inc-003&incidenteNumero=INC-2026-003&incidenteArea=SyST`

### Requirement: Bloque "Descripción del evento" con datos del reporte
La sección de detalle SHALL incluir un bloque "Descripción del evento" (expandido por defecto) con: `descripcion`, indicador de lesionados y número si aplica, `condicionesEntorno` como badges, `equiposInvolucrados` / `personalInvolucrado` / `testigos` cuando tienen valor, y `atencionMedicaRequerida` + `descripcionAtencionMedica` si aplica. (`informeMedicoAdjunto`/el enlace de informe médico no se modifican en este change — confirmado que el campo no existe en el backend real, nunca se puebla, y el enlace nunca se renderiza en producción; fuera de alcance retirarlo, ver `private-file-storage`.) Después de `condicionesEntorno`, SHALL renderizar un sub-bloque "Evidencias adjuntas" (solo si `incidente.evidencias?.length > 0`) con ícono Paperclip, grid de thumbnails 80×80 px para imágenes, y lista de PDFs con ícono FileText + nombre + peso en KB. Cada evidencia (imagen o PDF) SHALL cargarse vía `GET /api/incidents/{incidenteId}/evidencias/{evidenciaId}/archivo` (autenticado, `private-file-storage`) en vez de usar `ev.url` directamente como `src`/`href` — el `<img>` del thumbnail y el `<a>` de descarga de PDF SHALL resolver un object URL (`URL.createObjectURL`) a partir del blob obtenido, revocado al desmontar. Cuando una evidencia de imagen tiene `descripcion` (caption), SHALL mostrarse como texto pequeño bajo su thumbnail, truncado a 2 líneas si excede el ancho disponible; el `alt` del thumbnail SHALL seguir siendo `nombre` del archivo, no el caption. Si `tipo = ACCIDENTE` y no hay evidencias, SHALL mostrar alerta amarilla "Sin evidencia fotográfica — requerida para cerrar este incidente (RN-INC-002)".

#### Scenario: Descripción completa visible
- **WHEN** se carga el detalle de un incidente con todos los campos de descripción
- **THEN** todos los campos con valor se muestran en el bloque

#### Scenario: condicionesEntorno como badges
- **WHEN** el incidente tiene `condicionesEntorno = ['ILUMINACION', 'EPP']`
- **THEN** cada condición se muestra como un badge individual

#### Scenario: Enlace de informe médico
- **WHEN** el incidente tiene `informeMedicoAdjunto` con URL
- **THEN** se muestra un enlace de descarga con ícono FileText y texto "Informe médico"

#### Scenario: Sub-bloque de evidencias para incidente con fotos
- **WHEN** el incidente tiene `evidencias` con al menos 1 elemento
- **THEN** cada thumbnail se carga vía una petición autenticada a `GET /api/incidents/{incidenteId}/evidencias/{evidenciaId}/archivo`, no desde `ev.url` directamente

#### Scenario: Lightbox al hacer clic en thumbnail de evidencia
- **WHEN** el usuario hace clic en un thumbnail de imagen en el sub-bloque de evidencias
- **THEN** el lightbox se abre mostrando el mismo object URL ya resuelto para el thumbnail, sin hacer una segunda solicitud

#### Scenario: Alerta amarilla para ACCIDENTE sin evidencias
- **WHEN** el incidente tiene `tipo = ACCIDENTE` y `evidencias` está vacío o ausente
- **THEN** se muestra una alerta amarilla "Sin evidencia fotográfica — requerida para cerrar este incidente (RN-INC-002)"

#### Scenario: Sin alerta para CUASI_ACCIDENTE sin evidencias
- **WHEN** el incidente tiene `tipo = CUASI_ACCIDENTE` y no tiene evidencias
- **THEN** no se muestra ninguna alerta de evidencia faltante

#### Scenario: Caption visible bajo el thumbnail cuando existe descripción
- **WHEN** una evidencia de imagen tiene `descripcion` definida
- **THEN** el texto de `descripcion` se muestra bajo el thumbnail, truncado a 2 líneas, sin afectar el `alt` (que sigue siendo `nombre`)

#### Scenario: Sin caption cuando no hay descripción
- **WHEN** una evidencia de imagen no tiene `descripcion`
- **THEN** no se muestra ningún texto bajo el thumbnail

### Requirement: Bloque "Ubicación" en detalle de incidente (ADD-03)
La sección de detalle SHALL incluir un bloque "Ubicación" posicionado en la misma posición relativa que en el formulario (después del bloque "Descripción del evento" y antes de "Información de investigación"). El bloque SHALL renderizarse únicamente cuando `incidente.localId` tiene valor. Si `localId` es `undefined`, el bloque no se muestra.

Cuando `localId` está presente, el bloque SHALL mostrar el nombre del local (`localNombre`) y, si `zonaId` está definido, el nombre de la zona (`zonaNombre`). Si alguno de los nombres no viene, SHALL mostrarse `—` en su lugar, nunca `localId` ni `zonaId`.

El plano SHALL mostrarse según estos casos:
- **Local con `planoPngUrl` y con `ubicacion`:** imagen del plano con un pin `bg-coral` posicionado mediante `position: absolute; left: x%; top: y%`, dentro de un contenedor `position: relative`.
- **Local con `planoPngUrl` y sin `ubicacion`:** imagen del plano sin pin, con el texto `incidents:detail.ubicacion.sinPunto` debajo.
- **Local sin `planoPngUrl`:** sin imagen, con el texto `incidents:detail.ubicacion.sinPlano`.

La imagen del plano SHALL ocupar `w-full` con un ancho máximo de 480 px. Mientras se carga el blob autenticado del plano, SHALL mostrarse un skeleton con ese mismo tamaño máximo. El `alt` de la imagen SHALL ser `localNombre` o, si no viene, el texto `incidents:detail.fields.local`.

#### Scenario: Bloque oculto sin localId
- **WHEN** se carga el detalle de un incidente que no tiene `localId`
- **THEN** el bloque "Ubicación" no se renderiza en el DOM

#### Scenario: Nombres de local y zona visibles
- **WHEN** se carga el detalle de un incidente con `localId = 'loc-001'`, `localNombre = 'Almacén Principal'`, `zonaId = 'zon-001'`, `zonaNombre = 'Zona de Recepción'`
- **THEN** el bloque muestra "Almacén Principal" y "Zona de Recepción"

#### Scenario: Nombres ausentes no exponen GUIDs
- **WHEN** el incidente tiene `localId` y `zonaId` pero no trae `localNombre` ni `zonaNombre`
- **THEN** el bloque muestra `—` para local y zona, y ningún GUID

#### Scenario: Solo nombre de local sin zona
- **WHEN** se carga el detalle de un incidente con `localId` definido pero `zonaId` ausente
- **THEN** el bloque muestra el `localNombre` sin ningún texto de zona

#### Scenario: Plano con pin
- **WHEN** se carga el detalle de un incidente con `ubicacion = { x: 45, y: 30 }` y el local tiene `planoPngUrl`
- **THEN** se muestra el plano (máx 480 px) con un punto `bg-coral` en `left: 45%; top: 30%`

#### Scenario: Plano sin punto
- **WHEN** el local tiene `planoPngUrl` y el incidente no tiene `ubicacion`
- **THEN** se muestra el plano sin pin y debajo "No se marcó la ubicación en el plano."

#### Scenario: Local sin plano
- **WHEN** el local del incidente no tiene `planoPngUrl`
- **THEN** no se muestra imagen y aparece "Este local no tiene plano cargado."

#### Scenario: Skeleton mientras carga el plano
- **WHEN** el local tiene `planoPngUrl` pero el blob del plano aún no está disponible
- **THEN** se muestra un skeleton del tamaño del plano en lugar de la imagen

---

### Requirement: Bloque "Información de investigación" colapsable
La sección de detalle SHALL incluir un bloque "Información de investigación" colapsable que muestre el plazo máximo de investigación calculado con `getPlazoInvestigacion(severidad)` y el estado actual del incidente con orientación sobre qué falta para avanzar al siguiente estado.

#### Scenario: Plazo de investigación mostrado
- **WHEN** se carga el detalle de un incidente con `severidad = ALTA`
- **THEN** el bloque muestra el plazo máximo de investigación correspondiente

#### Scenario: Colapso del bloque investigación
- **WHEN** el usuario hace clic en el chevron del bloque "Información de investigación"
- **THEN** el bloque se colapsa

### Requirement: Alerta amarilla para ACCIDENTE sin informe médico
El sistema SHALL mostrar una alerta amarilla en el bloque de investigación cuando `tipo = ACCIDENTE` y `informeMedicoAdjunto` está ausente, con el texto "Falta informe médico — requerido para cerrar este incidente (RN-INC-002)".

#### Scenario: Alerta visible para ACCIDENTE sin informe
- **WHEN** se carga el detalle de un incidente `tipo = ACCIDENTE` sin `informeMedicoAdjunto`
- **THEN** aparece la alerta amarilla con el mensaje de RN-INC-002

#### Scenario: Sin alerta cuando hay informe médico
- **WHEN** se carga el detalle de un ACCIDENTE con `informeMedicoAdjunto` presente
- **THEN** no se muestra la alerta amarilla

#### Scenario: Sin alerta para tipos que no son ACCIDENTE
- **WHEN** se carga el detalle de un incidente `tipo = INCIDENTE`
- **THEN** no se muestra la alerta amarilla aunque no haya informe médico

### Requirement: Sección de Acciones Correctivas provisionales
La sección de ACs SHALL listar `incidente.accionesCorrectivas` mostrando: descripción, responsable, `fechaVencimiento` con `DeadlineBadge`, y estado de cada AC. El botón "+ Agregar AC" SHALL ser visible únicamente para usuarios con `canAddAC = true` (SUPERVISOR y JEFE_CALIDAD_SYST) Y cuando `incidente.qeId` no está poblado. Las ACs se asocian con `incidenteId`. Cuando `incidente.qeId` está poblado, la sección SHALL pasar a modo solo lectura: ni el botón "+ Agregar AC" ni los botones de transición/cierre por AC SHALL renderizarse, independientemente del rol o del `estado` de cada AC.

#### Scenario: Lista de ACs existentes
- **WHEN** el incidente tiene 2 ACs en `accionesCorrectivas`
- **THEN** se muestran las 2 ACs con descripción, responsable, fecha vencimiento y estado

#### Scenario: Botón agregar AC visible para SUPERVISOR
- **WHEN** un SUPERVISOR ve el detalle de un incidente sin `qeId` poblado
- **THEN** el botón "+ Agregar AC" es visible

#### Scenario: Botón agregar AC oculto para OPERARIO
- **WHEN** un OPERARIO ve el detalle de un incidente
- **THEN** el botón "+ Agregar AC" no aparece

#### Scenario: DeadlineBadge con fecha vencida
- **WHEN** una AC tiene `fechaVencimiento` en el pasado
- **THEN** `DeadlineBadge` muestra la fecha en color rojo

#### Scenario: Botón agregar AC oculto cuando el incidente tiene un QE vinculado
- **WHEN** `incidente.qeId` está poblado, independientemente del rol
- **THEN** el botón "+ Agregar AC" no aparece

#### Scenario: Sin botones de transición cuando el incidente tiene un QE vinculado
- **WHEN** `incidente.qeId` está poblado
- **THEN** ningún botón de "Iniciar", "Completar" o "Cerrar con evidencia" se renderiza para ninguna AC, independientemente de su `estado` o del rol del usuario

### Requirement: Enlace "Ver en QE" en cada AC cuando el incidente tiene un Quality Event vinculado
El sistema SHALL renderizar, en cada fila de AC, un enlace "Ver en QE →" que navega a `/quality-events/{incidente.qeId}` siempre que `incidente.qeId` esté poblado. Este enlace SHALL mostrarse además de (no en reemplazo de) los campos de solo lectura de la AC (descripción, responsable, fecha de vencimiento, estado, evidencia). Cuando `incidente.qeId` no está poblado, este enlace NO SHALL aparecer.

#### Scenario: Enlace Ver en QE aparece en cada fila de AC cuando el incidente tiene un QE vinculado
- **WHEN** `incidente.qeId` está poblado y la lista de ACs no está vacía
- **THEN** cada fila de AC muestra un enlace "Ver en QE →" que navega a `/quality-events/{incidente.qeId}`

#### Scenario: Enlace Ver en QE ausente cuando el incidente no tiene QE vinculado
- **WHEN** `incidente.qeId` no está poblado
- **THEN** ninguna fila de AC muestra el enlace "Ver en QE"

### Requirement: Solicitar una nueva AC en el Quality Event vinculado
El sistema SHALL renderizar un botón "Solicitar AC en QE" cuando `incidente.qeId` esté poblado Y `canAddAC === true` para el usuario actual. El botón SHALL aparecer debajo de la lista de ACs, o en el encabezado de la sección cuando `accionesCorrectivas` esté vacío. Al hacer clic, el sistema SHALL invocar `PATCH /api/quality-events/{incidente.qeId}/solicitar-ac`. Al completarse exitosamente, un toast Sonner SHALL mostrar un mensaje indicando que la solicitud fue enviada y que el Jefe de Calidad creará la AC en el QE. El botón SHALL deshabilitarse mientras la mutación esté en curso (`isPending`).

#### Scenario: Botón Solicitar AC en QE visible para rol autorizado con QE vinculado
- **WHEN** `incidente.qeId` está poblado y el usuario actual tiene `canAddAC === true`
- **THEN** el botón "Solicitar AC en QE" es visible

#### Scenario: Botón Solicitar AC en QE oculto sin QE vinculado
- **WHEN** `incidente.qeId` no está poblado
- **THEN** el botón "Solicitar AC en QE" no aparece

#### Scenario: Botón Solicitar AC en QE oculto para rol no autorizado
- **WHEN** `incidente.qeId` está poblado y el usuario actual tiene `canAddAC === false`
- **THEN** el botón "Solicitar AC en QE" no aparece

#### Scenario: Clic en Solicitar AC en QE llama al endpoint del QE y muestra un toast de éxito
- **WHEN** un usuario autorizado hace clic en "Solicitar AC en QE"
- **THEN** se invoca `PATCH /api/quality-events/{incidente.qeId}/solicitar-ac` y se muestra un toast Sonner de éxito al completarse

#### Scenario: Botón Solicitar AC en QE se deshabilita mientras está pendiente
- **WHEN** la mutación de solicitar-ac está en curso (`isPending: true`)
- **THEN** el botón "Solicitar AC en QE" está deshabilitado

#### Scenario: Botón Solicitar AC en QE aparece en el encabezado cuando la lista de ACs está vacía
- **WHEN** `incidente.qeId` está poblado, el usuario tiene `canAddAC === true`, y `accionesCorrectivas` está vacío
- **THEN** el botón "Solicitar AC en QE" se renderiza en el encabezado de la sección en lugar de debajo de una lista

### Requirement: Presentación de incidente ANULADO
El sistema SHALL mostrar incidentes con `estado = ANULADO` con opacidad visual reducida en la card, badge gris de estado, y sin botones de edición ni eliminación.

#### Scenario: Card con opacidad reducida para ANULADO
- **WHEN** se carga el detalle de un incidente con `estado = ANULADO`
- **THEN** la card principal se muestra con opacidad reducida y sin botones de acción

### Requirement: Navegación de retorno desde el detalle
La página de detalle SHALL proveer un botón "Volver a Incidentes" que navega a `/incidents`.

#### Scenario: Botón volver funcional
- **WHEN** el usuario hace clic en "Volver a Incidentes"
- **THEN** el sistema navega a `/incidents`

### Requirement: El detalle se renderiza sin error al pasar de carga a datos
`IncidentDetailPage` (y los subcomponentes del mismo archivo) SHALL llamar todos sus hooks antes de cualquier `return` anticipado (skeleton de carga, error o incidente inexistente), para que el número de hooks no cambie entre renders. En particular, `usePlanoBlob` y el cálculo de `selectedLocal` SHALL ejecutarse con datos opcionales (`incident?.localId`) antes del primer `return`.

#### Scenario: Transición de carga a datos
- **WHEN** la página se renderiza primero con `isLoading = true` y luego con el incidente cargado
- **THEN** la página muestra el detalle sin lanzar "Rendered more hooks than during the previous render"

#### Scenario: Apertura directa por URL
- **WHEN** el usuario abre `/incidents/:id` directamente (sin caché), por ejemplo justo después de crear el incidente o con F5
- **THEN** el detalle se muestra sin error

### Requirement: Badge "Sin QE vinculado" junto al botón "Crear QE"
`IncidentDetailPage` SHALL mostrar `IncidentSinQEBadge` (con el mismo tooltip y `aria-label` del listado) junto al botón "Crear QE" cuando `getIncidentQEAlertLevel(incidente, now)` sea `AMARILLO` o `ROJO`. Todo hook que use la página SHALL invocarse antes de cualquier `return` temprano.

#### Scenario: Incidente sin QE y vencido
- **WHEN** un incidente ACCIDENTE sin `qeId` con `fechaEvento` de hace 30 h se abre en el detalle
- **THEN** el badge "Sin QE vinculado" en rojo aparece junto al botón "Crear QE"

#### Scenario: Incidente dentro del plazo sin alerta
- **WHEN** el incidente sin QE está por debajo del 75 % de su plazo
- **THEN** no se muestra el badge

### Requirement: Aviso de estado gobernado por el Quality Event
Cuando el incidente tenga `qeId`, `IncidentDetailPage` SHALL mostrar un aviso informativo con el texto `t('incidents:detail.qeGobiernaEstado', { numero })` y un enlace a `/quality-events/{qeId}`. En ese caso SHALL NOT mostrar el badge "Sin QE vinculado". El aviso SHALL verse correctamente en modo claro y oscuro.

#### Scenario: Incidente con QE vinculado
- **WHEN** se abre el detalle de un incidente vinculado al QE `QE-2026-010`
- **THEN** se ve el aviso "El estado de este incidente se actualiza con el QE QE-2026-010." con enlace al QE, y no se ve el badge

### Requirement: Etiquetas de las acciones de audit trail generadas por el sistema
El audit trail del incidente SHALL mostrar etiquetas localizadas (`es-PE` y `en-US`) para las acciones `ESTADO_SINCRONIZADO_QE`, `PLAZO_QE_VENCIDO` y `QE_VINCULADO`.

#### Scenario: Entrada de sincronización visible
- **WHEN** el audit trail contiene una entrada `ESTADO_SINCRONIZADO_QE`
- **THEN** se muestra con su etiqueta traducida y el actor "Sistema"
