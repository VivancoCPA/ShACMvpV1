## MODIFIED Requirements

### Requirement: Ítems de QE replican la lógica real de gating de cada componente de detalle
El hook SHALL derivar ítems de dominio `QE` (vía `extraerAccionesQE` en `src/features/dashboard/utils/accionesRequeridas.utils.ts`) calculados **por asignación del responsable de investigación** más las tareas propias del `JEFE_CALIDAD_SYST`, reproduciendo las condiciones ya usadas por los componentes de detalle correspondientes y no una versión simplificada de `getQualityEventPermissions`. Los QE con `deletedAt` SHALL quedar excluidos.

Reglas por asignación — se evalúan antes y con independencia de la regla por rol, para cualquier rol:
- Responsable asignado, iniciar investigación (`QE_INICIAR_INVESTIGACION`): `qe.estado === 'ABIERTO' && qe.responsableInvestigacionId === user.id`.
- Responsable asignado, completar análisis (`QE_COMPLETAR_ANALISIS`): `qe.estado === 'EN_INVESTIGACION' && qe.responsableInvestigacionId === user.id`.

Reglas por rol:
- `JEFE_CALIDAD_SYST`, asignar responsable (`QE_ASIGNAR_RESPONSABLE`): `qe.estado === 'ABIERTO' && !qe.responsableInvestigacionId`.
- `JEFE_CALIDAD_SYST`, aprobar causa raíz (`QE_APROBAR_CAUSA_RAIZ`): `qe.estado ∈ {'EN_INVESTIGACION', 'ANALISIS_COMPLETADO'} && (qe.causaRaizDefinitiva?.trim().length ?? 0) >= 100 && !qe.causaRaizFirmadaEn` — sobre cualquier QE, sea o no responsable.
- `JEFE_CALIDAD_SYST`, cerrar (`QE_CERRAR`): `qe.estado === 'PENDIENTE_CIERRE' && !qe.cierreFirmaSupervisorId && (!qe.resultadoCierre || !qe.cerradoPorId)`.
- `SUPERVISOR` o `ALTA_DIRECCION`, firmar cierre (`QE_FIRMAR_CIERRE`): `qe.estado === 'PENDIENTE_CIERRE' && !!qe.cerradoPorId && !qe.cierreFirmaSupervisorId && user.rol === resolveRolSegundaFirma(qe.cerradoPorId, qe.areaId) && (user.areaIds ?? []).includes(qe.areaId)`.
- `JEFE_CALIDAD_SYST`, verificar (`QE_VERIFICAR`): `qe.estado === 'EN_VERIFICACION'`.
- `AUDITOR_INTERNO`, verificar (`QE_VERIFICAR`): `qe.estado === 'EN_VERIFICACION' && qe.auditorAsignadoId === user.id`.

Un mismo QE MAY generar más de un ítem para el mismo usuario (p.ej. un JCA responsable de un QE en `EN_INVESTIGACION` con causa raíz ≥ 100 caracteres ve `QE_COMPLETAR_ANALISIS` y `QE_APROBAR_CAUSA_RAIZ`); el `id` de cada ítem SHALL ser `QE-{tipo}-{qe.id}`, único por par tipo/QE. El tipo `QE_CAUSA_RAIZ` NO SHALL existir.

La `prioridad` SHALL ser la de `qeSeveridadPrioridad(qe)` (`'alta'` para severidad `ALTA`/`CRITICA`); además, para `QE_ASIGNAR_RESPONSABLE` y `QE_INICIAR_INVESTIGACION` SHALL ser `'alta'` cuando han transcurrido más de 48 h desde `qe.fechaHoraReporte` (o `qe.creadoEn` si falta) — plazo de asignación del PRD §1.3. Esto solo afecta el orden visual; no genera notificaciones.

Un QE que no cumple ninguna condición para el usuario actual SHALL quedar excluido del panel — el hook NUNCA SHALL usar `getQualityEventPermissions(...).puedeCerrar` ni `.puedeFirmarCierre` directamente para decidir inclusión, dado que ambos flags son más amplios que la acción real pendiente en ese momento.

#### Scenario: JCA responsable de un QE ABIERTO ve iniciar investigación, no asignar
- **WHEN** un QE está en `ABIERTO` con `responsableInvestigacionId` igual al id del JCA autenticado
- **THEN** el panel del JCA incluye `QE_INICIAR_INVESTIGACION` para ese QE y no incluye `QE_ASIGNAR_RESPONSABLE`

#### Scenario: QE ABIERTO sin responsable
- **WHEN** un QE está en `ABIERTO` sin `responsableInvestigacionId`
- **THEN** el panel del JCA incluye `QE_ASIGNAR_RESPONSABLE` y el panel de un `SUPERVISOR` no incluye ningún ítem de ese QE

#### Scenario: Solo el Supervisor asignado ve iniciar investigación
- **WHEN** un QE está en `ABIERTO` con `responsableInvestigacionId` = Supervisor A
- **THEN** el panel de A incluye `QE_INICIAR_INVESTIGACION`; el de otro Supervisor B no; el del JCA no incluye `QE_INICIAR_INVESTIGACION` ni `QE_ASIGNAR_RESPONSABLE`

#### Scenario: Investigación de un Supervisor con causa raíz lista para aprobar
- **WHEN** un QE está en `EN_INVESTIGACION` con responsable Supervisor A, `causaRaizDefinitiva` de 100 caracteres o más y sin `causaRaizFirmadaEn`
- **THEN** A recibe `QE_COMPLETAR_ANALISIS`; el JCA no recibe `QE_COMPLETAR_ANALISIS` pero sí `QE_APROBAR_CAUSA_RAIZ`

#### Scenario: Causa raíz firmada no genera aprobar causa raíz
- **WHEN** un QE en `ANALISIS_COMPLETADO` tiene `causaRaizFirmadaEn`
- **THEN** ningún usuario recibe `QE_APROBAR_CAUSA_RAIZ` para ese QE

#### Scenario: QE ABIERTO hace más de 48 h tiene prioridad alta
- **WHEN** un QE de severidad `BAJA` está en `ABIERTO` sin responsable y su `fechaHoraReporte` es de hace 50 h
- **THEN** el ítem `QE_ASIGNAR_RESPONSABLE` del JCA tiene `prioridad: 'alta'`

#### Scenario: QE eliminado no genera ítems
- **WHEN** un QE tiene `deletedAt`
- **THEN** no genera ningún ítem para ningún usuario

#### Scenario: JEFE_CALIDAD_SYST no ve un QE PENDIENTE_CIERRE que ya firmó
- **WHEN** un QE está en `PENDIENTE_CIERRE` con `resultadoCierre` y `cerradoPorId` ya establecidos (falta solo la segunda firma)
- **THEN** ese QE no aparece en el panel de un usuario `JEFE_CALIDAD_SYST` (la acción pendiente ya no es suya)

#### Scenario: SUPERVISOR ve el QE cuando le corresponde la segunda firma
- **WHEN** un QE está en `PENDIENTE_CIERRE` con `cerradoPorId` establecido, `resolveRolSegundaFirma(cerradoPorId, areaId)` retorna `'SUPERVISOR'` y el área del QE está en `user.areaIds`
- **THEN** ese QE aparece en el panel de ese `SUPERVISOR` con `tipo: 'QE_FIRMAR_CIERRE'`

#### Scenario: AUDITOR_INTERNO solo ve QE donde es el auditor asignado
- **WHEN** existen dos QE en `EN_VERIFICACION`, uno con `auditorAsignadoId === user.id` y otro con `auditorAsignadoId` de otro usuario
- **THEN** el panel del `AUDITOR_INTERNO` autenticado incluye solo el primero
