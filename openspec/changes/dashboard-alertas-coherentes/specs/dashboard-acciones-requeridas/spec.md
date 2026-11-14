## MODIFIED Requirements

### Requirement: Ítems de QE replican la lógica real de gating de cada componente de detalle
El hook SHALL derivar ítems de dominio `QE` (vía `extraerAccionesQE`, en `src/features/dashboard/utils/accionesRequeridas.utils.ts`) calculados **por asignación del responsable de investigación**, más las tareas propias del `JEFE_CALIDAD_SYST`, reproduciendo las condiciones que ya usan los componentes de detalle correspondientes y no una versión simplificada de `getQualityEventPermissions`. Los QE con `deletedAt` SHALL quedar excluidos.

Reglas por asignación: se evalúan antes que las reglas por rol y con independencia de ellas, para cualquier rol.
- Responsable asignado, iniciar investigación (`QE_INICIAR_INVESTIGACION`): `qe.estado === 'ABIERTO' && qe.responsableInvestigacionId === user.id`.
- Responsable asignado, completar análisis (`QE_COMPLETAR_ANALISIS`): `qe.estado === 'EN_INVESTIGACION' && qe.responsableInvestigacionId === user.id`.

Reglas por rol:
- `JEFE_CALIDAD_SYST`, asignar responsable (`QE_ASIGNAR_RESPONSABLE`): `qe.estado === 'ABIERTO' && !qe.responsableInvestigacionId`.
- `JEFE_CALIDAD_SYST`, aprobar causa raíz (`QE_APROBAR_CAUSA_RAIZ`): `qe.estado ∈ {'EN_INVESTIGACION', 'ANALISIS_COMPLETADO'} && (qe.causaRaizDefinitiva?.trim().length ?? 0) >= 100 && !qe.causaRaizFirmadaEn`, sobre cualquier QE, sea o no su responsable.
- `JEFE_CALIDAD_SYST`, registrar resultado de cierre (`QE_REGISTRAR_CIERRE`): `qe.estado === 'PENDIENTE_CIERRE' && !qe.resultadoCierre`. Es la misma condición que `showClosureForm` en `QECierreSection`.
- `JEFE_CALIDAD_SYST`, firmar cierre como Jefe de Calidad (`QE_FIRMAR_CIERRE_JCA`): `qe.estado === 'PENDIENTE_CIERRE' && !!qe.resultadoCierre && !qe.cerradoPorId`. Es la misma condición que el botón de firma del JCA en `QECierreSection`.
- `SUPERVISOR` o `ALTA_DIRECCION`, firmar cierre (`QE_FIRMAR_CIERRE`): `qe.estado === 'PENDIENTE_CIERRE' && !!qe.cerradoPorId && !qe.cierreFirmaSupervisorId && user.rol === resolveRolSegundaFirma(qe.cerradoPorId, qe.areaId) && (user.areaIds ?? []).includes(qe.areaId)`.
- `JEFE_CALIDAD_SYST`, verificar (`QE_VERIFICAR`): `qe.estado === 'EN_VERIFICACION'`.
- `AUDITOR_INTERNO`, verificar (`QE_VERIFICAR`): `qe.estado === 'EN_VERIFICACION' && qe.auditorAsignadoId === user.id`.

Los tipos `QE_CERRAR` y `QE_CAUSA_RAIZ` NO SHALL existir.

Un mismo QE MAY generar más de un ítem para el mismo usuario. Por ejemplo, un JCA responsable de un QE en `EN_INVESTIGACION` con causa raíz de 100 caracteres o más ve `QE_COMPLETAR_ANALISIS` y `QE_APROBAR_CAUSA_RAIZ`. El `id` de cada ítem SHALL ser `QE-{tipo}-{qe.id}`, único por par tipo/QE.

La `prioridad` SHALL ser la de `qeSeveridadPrioridad(qe)` (`'alta'` para severidad `ALTA` o `CRITICA`). Además, para `QE_ASIGNAR_RESPONSABLE` y `QE_INICIAR_INVESTIGACION` SHALL ser `'alta'` cuando han transcurrido más de 48 h desde `qe.fechaHoraReporte` (o desde `qe.creadoEn`, si falta), que es el plazo de asignación del PRD §1.3. Esto solo afecta el orden visual y no genera notificaciones.

Un QE que no cumple ninguna condición para el usuario actual SHALL quedar fuera del panel. El hook NUNCA SHALL usar `getQualityEventPermissions(...).puedeCerrar` ni `.puedeFirmarCierre` directamente para decidir la inclusión, porque ambos flags son más amplios que la acción que realmente está pendiente en ese momento.

#### Scenario: JCA responsable de un QE ABIERTO ve iniciar investigación, no asignar
- **WHEN** un QE está en `ABIERTO` con `responsableInvestigacionId` igual al id del JCA autenticado
- **THEN** el panel del JCA incluye `QE_INICIAR_INVESTIGACION` para ese QE y no incluye `QE_ASIGNAR_RESPONSABLE`

#### Scenario: QE ABIERTO sin responsable
- **WHEN** un QE está en `ABIERTO` sin `responsableInvestigacionId`
- **THEN** el panel del JCA incluye `QE_ASIGNAR_RESPONSABLE` y el panel de un `SUPERVISOR` no incluye ningún ítem de ese QE

#### Scenario: Solo el Supervisor asignado ve iniciar investigación
- **WHEN** un QE está en `ABIERTO` con `responsableInvestigacionId` = Supervisor A
- **THEN** el panel de A incluye `QE_INICIAR_INVESTIGACION`, el de otro Supervisor B no lo incluye, y el del JCA no incluye `QE_INICIAR_INVESTIGACION` ni `QE_ASIGNAR_RESPONSABLE`

#### Scenario: Investigación de un Supervisor con causa raíz lista para aprobar
- **WHEN** un QE está en `EN_INVESTIGACION` con responsable Supervisor A, `causaRaizDefinitiva` de 100 caracteres o más y sin `causaRaizFirmadaEn`
- **THEN** A recibe `QE_COMPLETAR_ANALISIS`, y el JCA no recibe `QE_COMPLETAR_ANALISIS` pero sí `QE_APROBAR_CAUSA_RAIZ`

#### Scenario: Causa raíz firmada no genera aprobar causa raíz
- **WHEN** un QE en `ANALISIS_COMPLETADO` tiene `causaRaizFirmadaEn`
- **THEN** ningún usuario recibe `QE_APROBAR_CAUSA_RAIZ` para ese QE

#### Scenario: QE ABIERTO hace más de 48 h tiene prioridad alta
- **WHEN** un QE de severidad `BAJA` está en `ABIERTO` sin responsable y su `fechaHoraReporte` es de hace 50 h
- **THEN** el ítem `QE_ASIGNAR_RESPONSABLE` del JCA tiene `prioridad: 'alta'`

#### Scenario: QE eliminado no genera ítems
- **WHEN** un QE tiene `deletedAt`
- **THEN** no genera ningún ítem para ningún usuario

#### Scenario: PENDIENTE_CIERRE sin resultado genera registrar cierre
- **WHEN** un QE está en `PENDIENTE_CIERRE` sin `resultadoCierre`
- **THEN** el panel del JCA incluye `QE_REGISTRAR_CIERRE` para ese QE y no incluye `QE_FIRMAR_CIERRE_JCA`

#### Scenario: Resultado registrado sin firma del JCA genera firmar cierre JCA
- **WHEN** un QE está en `PENDIENTE_CIERRE` con `resultadoCierre` y sin `cerradoPorId`
- **THEN** el panel del JCA incluye `QE_FIRMAR_CIERRE_JCA` para ese QE y no incluye `QE_REGISTRAR_CIERRE`

#### Scenario: JEFE_CALIDAD_SYST no ve un QE PENDIENTE_CIERRE que ya firmó
- **WHEN** un QE está en `PENDIENTE_CIERRE` con `resultadoCierre` y `cerradoPorId` ya establecidos (solo falta la segunda firma)
- **THEN** ese QE no aparece en el panel de un usuario `JEFE_CALIDAD_SYST`, porque la acción pendiente ya no es suya

#### Scenario: SUPERVISOR ve el QE cuando le corresponde la segunda firma
- **WHEN** un QE está en `PENDIENTE_CIERRE` con `cerradoPorId` establecido, `resolveRolSegundaFirma(cerradoPorId, areaId)` retorna `'SUPERVISOR'` y el área del QE está en `user.areaIds`
- **THEN** ese QE aparece en el panel de ese `SUPERVISOR` con `tipo: 'QE_FIRMAR_CIERRE'`

#### Scenario: AUDITOR_INTERNO solo ve QE donde es el auditor asignado
- **WHEN** existen dos QE en `EN_VERIFICACION`, uno con `auditorAsignadoId === user.id` y otro con el `auditorAsignadoId` de otro usuario
- **THEN** el panel del `AUDITOR_INTERNO` autenticado incluye solo el primero

### Requirement: AccionesRequeridasWidget agrupa por dominio, ordena por prioridad y fecha, limita a 10
El sistema SHALL exportar `AccionesRequeridasWidget` en `src/features/dashboard/components/AccionesRequeridasWidget.tsx`. El widget SHALL consumir `useAccionesRequeridas()` internamente, sin recibir `acciones` por props, y SHALL aceptar las props opcionales `filtroTipos?: AccionRequeridaTipo[]`, `etiquetaFiltro?: string` y `onQuitarFiltro?: () => void`.

SHALL agrupar los ítems por `dominio` en el orden `QE`, `AC`, `DOCUMENTO`. Dentro de cada grupo, SHALL ordenarlos por `prioridad` (`'alta'` antes que `'normal'`) y luego por `fechaLimite` ascendente, con los ítems sin `fechaLimite` al final del grupo.

**Sin filtro**, SHALL mostrar como máximo 10 ítems en total, con un enlace "ver todos" cuando `acciones.length > 10`.

**Con `filtroTipos`**, SHALL:
- mostrar **todos** los ítems cuyo `tipo` está en `filtroTipos`, sin el corte de 10 y sin el enlace "ver todos";
- filtrar con `filtrarAccionesPorTipo(items, filtroTipos)`, la misma función pura exportada desde `accionesRequeridas.utils.ts` que usan las páginas para calcular el número de la tarjeta;
- mostrar arriba de la lista un chip con `t('dashboard:accionesRequeridas.mostrando', { etiqueta, n })` y un botón ✕ con `aria-label` `t('dashboard:accionesRequeridas.quitarFiltro')`, que llama a `onQuitarFiltro`.

Cuando la lista que corresponde mostrar está vacía y `!isLoading`, SHALL mostrar un estado vacío explícito, nunca un widget en blanco. Cada fila SHALL navegar a su `ruta` al hacer clic. Todas las clases Tailwind visibles SHALL tener su variante `dark:` correspondiente.

#### Scenario: Agrupación por dominio en el orden QE, AC, Documento
- **WHEN** existen ítems de los tres dominios
- **THEN** el DOM renderiza primero el grupo `QE`, luego `AC` y luego `DOCUMENTO`

#### Scenario: Límite de 10 ítems con enlace ver todos
- **WHEN** `useAccionesRequeridas()` retorna 14 ítems y no hay filtro
- **THEN** se renderizan exactamente 10 filas y un enlace "ver todos"

#### Scenario: Con filtro se muestran todos los ítems del filtro
- **WHEN** `useAccionesRequeridas()` retorna 12 ítems `QE_APROBAR_CAUSA_RAIZ` y 5 `AC_EJECUTAR`, y el widget recibe `filtroTipos: ['QE_APROBAR_CAUSA_RAIZ']` con `etiquetaFiltro: 'Aprobaciones y cierres pendientes'`
- **THEN** se renderizan exactamente 12 filas, sin enlace "ver todos", y el chip "Mostrando: Aprobaciones y cierres pendientes (12)"

#### Scenario: Quitar el filtro desde el chip
- **WHEN** el widget está filtrado y el usuario pulsa el ✕ del chip
- **THEN** se llama a `onQuitarFiltro`

#### Scenario: Estado vacío explícito
- **WHEN** `useAccionesRequeridas()` retorna `{ acciones: [], isLoading: false }`
- **THEN** se muestra el texto localizado de "no tienes acciones pendientes", no un contenedor vacío

#### Scenario: Click en un ítem navega a su ruta
- **WHEN** el usuario hace clic en un ítem de dominio `DOCUMENTO` con `ruta: '/documentos/doc-123'`
- **THEN** el router navega a `/documentos/doc-123`
