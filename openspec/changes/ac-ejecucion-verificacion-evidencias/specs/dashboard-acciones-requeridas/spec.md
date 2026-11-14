## MODIFIED Requirements

### Requirement: Ítems de AC agregan los tres orígenes (QE, NC, Incidente)
El hook SHALL recorrer las `accionesCorrectivas` embebidas en los tres dominios (`QualityEvent.accionesCorrectivas`, `NoConformidad.accionesCorrectivas` e `Incidente.accionesCorrectivas`).

- **AC de QE:** SHALL incluir un ítem `AC_EJECUTAR` (`dominio: 'AC'`) cuando `ac.responsableId === user.id` y `ac.estado ∈ {'PENDIENTE', 'EN_EJECUCION'}`, sin mirar `descripcionEvidencia`. Una AC devuelta vuelve a `EN_EJECUCION` con su descripción anterior y debe seguir apareciendo.
- **AC de NC e incidente:** se mantiene la condición previa: `ac.estado ∈ {'PENDIENTE', 'EN_EJECUCION'}` y sin `descripcionEvidencia`.

`prioridad` SHALL ser `'alta'` cuando la AC está vencida (el mismo criterio de `calcularEstadoSemaforoDesdeFecha` que ya usan `MisACsWidget` y `ACsPorVencerWidget`) y `'normal'` en otro caso. `href` SHALL apuntar al detalle del dominio de origen: `/quality-events/:id`, `/nonconformities/:id` o `/incidents/:id`.

#### Scenario: AC de origen NC aparece en el panel
- **WHEN** una `NoConformidad` tiene una AC con `responsableId === user.id`, `estado: 'PENDIENTE'` y sin `descripcionEvidencia`
- **THEN** el panel incluye un ítem `dominio: 'AC'` con `href` apuntando a `/nonconformities/:ncId`

#### Scenario: AC de QE devuelta sigue pendiente
- **WHEN** una AC de QE tiene `responsableId === user.id`, `estado: 'EN_EJECUCION'`, `descripcionEvidencia` no vacía y `motivoDevolucion`
- **THEN** el panel incluye un ítem `AC_EJECUTAR` para esa AC

#### Scenario: AC de QE ejecutada no aparece para el responsable
- **WHEN** una AC de QE del usuario está en `COMPLETADA`
- **THEN** no genera un ítem `AC_EJECUTAR`

#### Scenario: AC vencida se marca con prioridad alta
- **WHEN** una AC asignada al usuario tiene `plazoFecha` en el pasado según `calcularEstadoSemaforoDesdeFecha`
- **THEN** el ítem correspondiente tiene `prioridad: 'alta'`

## ADDED Requirements

### Requirement: Ítem AC_VERIFICAR para el Jefe de Calidad
Para un usuario con rol `JEFE_CALIDAD_SYST`, el hook SHALL incluir un ítem `AC_VERIFICAR` ("Verificar acción correctiva", `dominio: 'AC'`, `href` `/quality-events/:id`) por cada AC de QE en `COMPLETADA`, sin importar el responsable.

La tarjeta "Aprobaciones y cierres pendientes" de `JefeCalidadDashboard` SHALL contar `AC_VERIFICAR` junto con `QE_APROBAR_CAUSA_RAIZ`, `QE_FIRMAR_CIERRE_JCA` y `QE_REGISTRAR_CIERRE`, filtrando con el mismo conjunto de tipos para que el número y la lista coincidan.

Las mutaciones de iniciar, ejecutar y verificar SHALL invalidar `['dashboard']` y la lista de QE.

#### Scenario: JCA ve AC por verificar
- **WHEN** un QE tiene 2 AC en `COMPLETADA` y el usuario es JEFE_CALIDAD_SYST
- **THEN** el panel incluye 2 ítems `AC_VERIFICAR`

#### Scenario: Tarjeta de aprobaciones cuenta AC_VERIFICAR
- **WHEN** `useAccionesRequeridas` devuelve 1 `QE_APROBAR_CAUSA_RAIZ` y 2 `AC_VERIFICAR`
- **THEN** la tarjeta "Aprobaciones y cierres pendientes" muestra `3` y, al hacer clic, la lista muestra exactamente 3 filas

#### Scenario: Otros roles no ven AC_VERIFICAR
- **WHEN** un SUPERVISOR carga el panel con AC en `COMPLETADA`
- **THEN** no hay ítems `AC_VERIFICAR`
