## MODIFIED Requirements

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

## ADDED Requirements

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
