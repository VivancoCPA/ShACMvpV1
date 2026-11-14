# ac-del-qe-en-origen Specification

## Purpose
TBD - created by archiving change solicitudes-ac-y-ac-del-qe-en-origen. Update Purpose after archive.

## Requirements
### Requirement: Lectura de las AC del QE desde el origen
`GET /api/quality-events/{id}/acciones-correctivas` SHALL responder 200 a cualquier usuario autenticado de la empresa activa del QE —incluido `OPERARIO`— y 404 si el QE es de otra empresa. Cada AC SHALL incluir `id`, `descripcion`, `tipo`, `responsableNombre`, `estado`, `plazoFecha`, `verificadaPorNombre` y `verificadaEn`, con nombres resueltos (nunca solo ids).

#### Scenario: OPERARIO lee las AC del QE de su incidente
- **WHEN** un OPERARIO de la empresa solicita las AC de un QE con 1 AC verificada
- **THEN** responde 200 con la AC, su `responsableNombre` y su `verificadaPorNombre`

#### Scenario: Otra empresa
- **WHEN** un usuario de otra empresa solicita las AC del QE
- **THEN** responde 404

### Requirement: Fila compartida de AC en solo lectura
`components/shared/AccionCorrectivaReadOnlyRow.tsx` SHALL renderizar una AC en solo lectura con: descripción (y título si existe), badge de tipo, nombre del responsable, badge de estado (`PENDIENTE`, `EN_EJECUCION`, "Pendiente de verificación" para `COMPLETADA`, `CERRADA`), plazo con `DeadlineBadge` (semáforo) y, si se pasa `href`, un enlace. No SHALL renderizar botones de acción.

#### Scenario: AC completada
- **WHEN** la fila recibe una AC en `COMPLETADA`
- **THEN** muestra el badge "Pendiente de verificación" y ningún botón

### Requirement: El incidente con QE muestra las AC del QE
Cuando el incidente tiene `qeId`, `IncidentACSection` SHALL:
- titular la sección "Acciones correctivas del {numero}" con enlace a `/quality-events/{qeId}`;
- listar las AC de `useQEAcciones(qeId)` con `AccionCorrectivaReadOnlyRow`, cada una enlazando a `/quality-events/{qeId}#qe-ac-section`;
- mostrar "El QE aún no tiene acciones correctivas." si la lista está vacía;
- mantener el botón "Solicitar AC en el QE" (mismas reglas de visibilidad) y mostrar "Solicitudes pendientes en el QE: {n}" cuando `solicitudesAC > 0`;
- si el incidente tiene AC propias, mostrarlas debajo en un bloque colapsado "Acciones correctivas anteriores (registradas en el incidente)", en solo lectura.

Sin `qeId`, el comportamiento SHALL ser el previo a este cambio. Las acciones del flujo de AC del QE (iniciar, ejecutar, verificar) SHALL refrescar esta lista vía la invalidación de `['quality-events']`.

#### Scenario: Incidente con QE y AC
- **WHEN** el incidente tiene `qeId` y el QE tiene 2 AC y `solicitudesAC = 1`
- **THEN** el título dice "Acciones correctivas del QE-…", se listan las 2 AC con sus badges y se lee "Solicitudes pendientes en el QE: 1"

#### Scenario: Incidente con QE sin AC
- **WHEN** el QE vinculado no tiene AC
- **THEN** se muestra "El QE aún no tiene acciones correctivas."

#### Scenario: AC propias anteriores
- **WHEN** el incidente con QE tiene 1 AC propia
- **THEN** aparece el bloque "Acciones correctivas anteriores (registradas en el incidente)" con esa AC y sin botones

#### Scenario: OPERARIO en solo lectura
- **WHEN** un OPERARIO abre el incidente con QE
- **THEN** ve las AC del QE sin botones de edición ni el botón de solicitar

#### Scenario: Sin QE no cambia
- **WHEN** el incidente no tiene `qeId`
- **THEN** la sección se comporta como antes (aviso de QE requerido y AC propias)

### Requirement: La NC con QE muestra las AC del QE
`ACSection` de NC SHALL aplicar el mismo tratamiento que el incidente usando `qeGeneradoId`, con claves equivalentes en el namespace `nonconformities`. El número del QE SHALL resolverse con `useQualityEvent`, nunca importando fixtures MSW desde el componente.

#### Scenario: NC con QE y AC
- **WHEN** la NC tiene `qeGeneradoId` y el QE tiene 2 AC
- **THEN** se listan las 2 AC del QE en solo lectura bajo "Acciones correctivas del QE-…"

#### Scenario: NC sin QE no cambia
- **WHEN** la NC no tiene `qeGeneradoId`
- **THEN** la sección se comporta como antes
