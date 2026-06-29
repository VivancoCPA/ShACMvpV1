## ADDED Requirements

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
La sección de cabecera SHALL mostrar: número del incidente en tipografía grande, `IncidentTypeBadge` + `IncidentStatusBadge` + `SeverityBadge` en línea horizontal, y los metadatos: fecha de evento, área, turno, reportado por, y fecha de reporte.

#### Scenario: Cabecera con metadatos completos
- **WHEN** se carga el detalle de un incidente
- **THEN** el número, badges y todos los metadatos se muestran en la cabecera

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

### Requirement: Bloque "Descripción del evento" con datos del reporte
La sección de detalle SHALL incluir un bloque "Descripción del evento" (expandido por defecto) con: `descripcion`, indicador de lesionados y número si aplica, `condicionesEntorno` como badges, `equiposInvolucrados` / `personalInvolucrado` / `testigos` cuando tienen valor, y `atencionMedicaRequerida` + `descripcionAtencionMedica` si aplica. Si `informeMedicoAdjunto` existe, se muestra como enlace de descarga con ícono FileText.

#### Scenario: Descripción completa visible
- **WHEN** se carga el detalle de un incidente con todos los campos de descripción
- **THEN** todos los campos con valor se muestran en el bloque

#### Scenario: condicionesEntorno como badges
- **WHEN** el incidente tiene `condicionesEntorno = ['ILUMINACION', 'EPP']`
- **THEN** cada condición se muestra como un badge individual

#### Scenario: Enlace de informe médico
- **WHEN** el incidente tiene `informeMedicoAdjunto` con URL
- **THEN** se muestra un enlace de descarga con ícono FileText y texto "Informe médico"

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
La sección de ACs SHALL listar `incidente.accionesCorrectivas` mostrando: descripción, responsable, `fechaVencimiento` con `DeadlineBadge`, y estado de cada AC. El botón "+ Agregar AC" SHALL ser visible únicamente para usuarios con `canAddAC = true` (SUPERVISOR y JEFE_CALIDAD_SYST). Las ACs se asocian con `incidenteId`; el campo `qeId` queda undefined hasta M4.

#### Scenario: Lista de ACs existentes
- **WHEN** el incidente tiene 2 ACs en `accionesCorrectivas`
- **THEN** se muestran las 2 ACs con descripción, responsable, fecha vencimiento y estado

#### Scenario: Botón agregar AC visible para SUPERVISOR
- **WHEN** un SUPERVISOR ve el detalle de un incidente
- **THEN** el botón "+ Agregar AC" es visible

#### Scenario: Botón agregar AC oculto para OPERARIO
- **WHEN** un OPERARIO ve el detalle de un incidente
- **THEN** el botón "+ Agregar AC" no aparece

#### Scenario: DeadlineBadge con fecha vencida
- **WHEN** una AC tiene `fechaVencimiento` en el pasado
- **THEN** `DeadlineBadge` muestra la fecha en color rojo

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

### Requirement: Bloque "Ubicación" en detalle de incidente (ADD-03)
La sección de detalle SHALL incluir un bloque "Ubicación" posicionado en la misma posición relativa que en el formulario (después del bloque "Descripción del evento" y antes de "Información de investigación"). El bloque SHALL renderizarse únicamente cuando `incidente.localId` tiene valor; si `localId` es `undefined`, el bloque no se muestra.

Cuando `localId` está presente, el bloque SHALL mostrar el nombre del local (`localNombre`) y, si `zonaId` está definido, el nombre de la zona (`zonaNombre`). Si el local tiene `planoPngUrl` Y `incidente.ubicacion` está definido, el bloque SHALL mostrar una miniatura del plano PNG con un pin posicionado mediante `position: absolute; left: x%; top: y%` usando los valores de `ubicacion.x` y `ubicacion.y`. El contenedor del plano SHALL tener `position: relative` para que el pin se posicione correctamente. El pin SHALL renderizarse como un punto con clase `bg-coral`. Si `localId` está definido pero `ubicacion` está ausente, el bloque muestra solo los nombres de local y zona sin imagen de plano.

#### Scenario: Bloque oculto sin localId
- **WHEN** se carga el detalle de un incidente que no tiene `localId`
- **THEN** el bloque "Ubicación" no se renderiza en el DOM

#### Scenario: Nombres de local y zona visibles
- **WHEN** se carga el detalle de un incidente con `localId = 'loc-001'`, `localNombre = 'Almacén Principal'`, `zonaId = 'zon-001'`, `zonaNombre = 'Zona de Recepción'`
- **THEN** el bloque muestra "Almacén Principal" y "Zona de Recepción"

#### Scenario: Solo nombre de local sin zona
- **WHEN** se carga el detalle de un incidente con `localId` definido pero `zonaId` ausente
- **THEN** el bloque muestra el `localNombre` sin ningún texto de zona

#### Scenario: Miniatura con pin cuando hay ubicacion y planoPngUrl
- **WHEN** se carga el detalle de un incidente con `ubicacion = { x: 45, y: 30 }` y el local tiene `planoPngUrl`
- **THEN** se muestra el PNG del plano con un punto `bg-coral` posicionado en `left: 45%; top: 30%` (position absolute dentro de contenedor relative)

#### Scenario: Sin plano cuando ubicacion está ausente
- **WHEN** se carga el detalle de un incidente con `localId` definido pero `ubicacion` ausente
- **THEN** el bloque muestra el nombre del local/zona pero NO muestra la imagen del plano

---

## MODIFIED Requirements

### Requirement: Bloque "Descripción del evento" con datos del reporte
#### Scenario: Sub-bloque de evidencias para incidente con fotos
- **WHEN** el incidente tiene `evidencias` con al menos 1 elemento
- **THEN** se muestra el sub-bloque "Evidencias adjuntas" con ícono Paperclip, thumbnails 80×80 px para imágenes y lista de PDFs con nombre y peso en KB

#### Scenario: Lightbox al hacer clic en thumbnail de evidencia
- **WHEN** el usuario hace clic en un thumbnail de imagen en el sub-bloque de evidencias
- **THEN** se abre un lightbox con overlay oscuro mostrando la imagen a tamaño completo con botón cerrar

#### Scenario: Alerta amarilla para ACCIDENTE sin evidencias
- **WHEN** el incidente tiene `tipo = ACCIDENTE` y `evidencias` está vacío o ausente
- **THEN** se muestra una alerta amarilla "Sin evidencia fotográfica — requerida para cerrar este incidente (RN-INC-002)"

#### Scenario: Sin alerta para CUASI_ACCIDENTE sin evidencias
- **WHEN** el incidente tiene `tipo = CUASI_ACCIDENTE` y no tiene evidencias
- **THEN** no se muestra ninguna alerta amarilla
