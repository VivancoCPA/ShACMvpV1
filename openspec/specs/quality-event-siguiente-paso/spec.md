# quality-event-siguiente-paso Specification

## Purpose
Indicador "Siguiente paso" del detalle del Quality Event: qué falta, quién debe hacerlo, desde cuándo y con qué plazo (cálculo backend, banner frontend y versión MSW).

## Requirements

### Requirement: Cálculo del siguiente paso del QE
El backend SHALL calcular, con `QESiguientePasoResolver` (función pura sobre el QE ya cargado con AC, nombres, supervisores del área y audit trail, más la lista de JCA activos de la empresa), un `QESiguientePaso { paso, responsables[], estadoDesde, plazoFecha?, plazoRegla?, progreso?, total? }`, donde cada responsable es `{ id, nombreCompleto, rol, avatarUrl? }`. "JCA" SHALL significar los usuarios con asignación `JEFE_CALIDAD_SYST` **ACTIVA** en la empresa del QE y usuario activo. El `paso` SHALL resolverse así (la primera fila que aplique):

| Estado (y condición) | `paso` | Responsables | Plazo |
|---|---|---|---|
| ABIERTO sin responsable de investigación | `ASIGNAR_RESPONSABLE` | JCA | `estadoDesde + 48 h` |
| ABIERTO con responsable | `INICIAR_INVESTIGACION` | Responsable de investigación + JCA | `estadoDesde + 48 h` |
| EN_INVESTIGACION o ANALISIS_COMPLETADO con `causaRaizDefinitiva` de ≥ 100 caracteres y sin `causaRaizFirmadaEn` | `APROBAR_CAUSA_RAIZ` | JCA | ANALISIS_COMPLETADO: `estadoDesde + 2 días hábiles`; EN_INVESTIGACION: el de `COMPLETAR_ANALISIS` |
| EN_INVESTIGACION | `COMPLETAR_ANALISIS` | Responsable de investigación | `estadoDesde` + BAJA 15 · MEDIA 10 · ALTA 7 · CRITICA 3 días hábiles |
| ANALISIS_COMPLETADO con causa raíz firmada | `INICIAR_EJECUCION` | JCA | `estadoDesde + 2 días hábiles` |
| EN_EJECUCION | `EJECUTAR_ACS` | Responsables distintos de las AC no CERRADA; + JCA si alguna está COMPLETADA | Mayor `plazoFecha` de las AC no CERRADA |
| PENDIENTE_CIERRE sin `resultadoCierre` | `REGISTRAR_RESULTADO_CIERRE` | JCA | `estadoDesde + 5 días hábiles` |
| PENDIENTE_CIERRE con resultado y sin `cerradoPorId` | `FIRMA_JCA` | JCA | `estadoDesde + 5 días hábiles` |
| PENDIENTE_CIERRE con `cerradoPorId` y sin `cierreFirmaSupervisorId` | `FIRMA_SUPERVISOR` | `supervisoresArea` | Última `FIRMA_CIERRE_JEFE_CALIDAD` + 3 días hábiles |
| CERRADO | `ESPERA_VERIFICACION` | JCA | `fechaVerificacionProgramada` |
| EN_VERIFICACION | `VERIFICAR_EFICACIA` | JCA | `estadoDesde + 10 días hábiles` |
| VERIFICADO | `FINALIZADO` | — (lista vacía) | — |

`progreso`/`total` SHALL venir solo en `EJECUTAR_ACS` (AC CERRADA / total de AC). Los responsables SHALL llevar siempre nombre, nunca solo id, SHALL excluir usuarios inactivos, no se repiten, y la lista SHALL quedar vacía cuando no hay nadie disponible (p. ej. área sin supervisor). `plazoRegla` SHALL ser un texto corto de la regla del PRD (p. ej. "PRD §1.3 · 5 días hábiles"). El plazo es solo informativo: no genera notificaciones ni bloquea acciones.

#### Scenario: EN_INVESTIGACION crítica salta el fin de semana
- **WHEN** un QE CRITICA entró a EN_INVESTIGACION un jueves
- **THEN** `paso` es `COMPLETAR_ANALISIS`, el responsable es el responsable de investigación y `plazoFecha` cae el martes siguiente (3 días hábiles)

#### Scenario: EN_EJECUCION con AC mixtas
- **WHEN** el QE en EN_EJECUCION tiene 3 AC: una CERRADA, una COMPLETADA y una EN_EJECUCION
- **THEN** `paso` es `EJECUTAR_ACS`, los responsables son los de las AC COMPLETADA y EN_EJECUCION más el JCA, `progreso` es 1, `total` es 3 y `plazoFecha` es el mayor `plazoFecha` de esas dos AC

#### Scenario: PENDIENTE_CIERRE sin resultado
- **WHEN** el QE está en PENDIENTE_CIERRE sin `resultadoCierre`
- **THEN** `paso` es `REGISTRAR_RESULTADO_CIERRE`, con los JCA activos como responsables y `plazoFecha = estadoDesde + 5 días hábiles`

#### Scenario: Firma del supervisor pendiente
- **WHEN** el QE en PENDIENTE_CIERRE tiene `cerradoPorId` y una entrada `FIRMA_CIERRE_JEFE_CALIDAD`
- **THEN** `paso` es `FIRMA_SUPERVISOR`, los responsables son `supervisoresArea` y `plazoFecha` es la fecha de esa firma + 3 días hábiles

#### Scenario: Área sin supervisor
- **WHEN** el paso es `FIRMA_SUPERVISOR` y el área no tiene supervisores activos
- **THEN** `responsables` es una lista vacía

#### Scenario: Usuarios inactivos excluidos
- **WHEN** uno de los JCA de la empresa está inactivo o con asignación no ACTIVA
- **THEN** no aparece en `responsables`

#### Scenario: VERIFICADO
- **WHEN** el QE está en VERIFICADO
- **THEN** `paso` es `FINALIZADO`, sin responsables ni plazo

### Requirement: Fecha de entrada al estado actual
`estadoDesde` SHALL ser el `timestamp` de la entrada **más reciente** del audit trail del QE cuyo `estadoNuevo` sea igual a `qe.estado`, sin importar la `accion` (incluye `ESTADO_CAMBIADO`, `FIRMA_CIERRE_SUPERVISOR`, `CIERRE_RECHAZADO`, `REABIERTO`, `VERIFICACION_EFICACIA` y la transición automática a PENDIENTE_CIERRE), excluyendo las entradas propias de acciones correctivas (`accion` que empieza con `AC_`), cuyo `estadoNuevo` es el estado de la AC. Si no existe ninguna, SHALL usarse `creadoEn`.

#### Scenario: Toma la última entrada del estado
- **WHEN** el QE en PENDIENTE_CIERRE tiene dos entradas con `estadoNuevo: 'PENDIENTE_CIERRE'` (antes y después de un rechazo del cierre)
- **THEN** `estadoDesde` es el timestamp de la más reciente

#### Scenario: QE recién creado
- **WHEN** el QE está en ABIERTO y su audit trail no tiene entradas con `estadoNuevo: 'ABIERTO'`
- **THEN** `estadoDesde` es `creadoEn`

#### Scenario: Entradas de AC no cuentan
- **WHEN** el QE está en EN_EJECUCION y la entrada más reciente con `estadoNuevo: 'EN_EJECUCION'` es un `AC_INICIADA`
- **THEN** `estadoDesde` es la entrada `ESTADO_CAMBIADO` que llevó el QE a EN_EJECUCION

### Requirement: Suma de días hábiles
`DiasHabiles.Sumar(desde, dias)` SHALL sumar `dias` días hábiles a `desde` saltando sábados y domingos, evaluando el día de la semana en hora de Lima (America/Lima) y conservando la hora del día. No modela feriados.

#### Scenario: Viernes + 1 día hábil
- **WHEN** `desde` es un viernes 10:00 hora de Lima y `dias` es 1
- **THEN** el resultado es el lunes siguiente a las 10:00 hora de Lima

### Requirement: Banner "Siguiente paso" en el detalle del QE
`QESiguientePasoBanner` SHALL mostrarse en la parte superior de `QEHeaderSection` para todos los usuarios cuando `qe.siguientePaso` existe, y SHALL ser solo informativo (sin botones de acción). Contenido:
- Línea 1: `detail.siguientePaso.titulo` + `detail.siguientePaso.paso.{paso}`, con un ícono según el paso.
- Línea 2: `detail.siguientePaso.responsable` + avatar/iniciales y nombre de hasta 3 responsables y "+N" para el resto; con la lista vacía, `detail.siguientePaso.sinResponsable` en ámbar.
- Línea 3 (texto chico): `detail.siguientePaso.desde` con la fecha y los días transcurridos; si hay `plazoFecha`, " · " + `detail.siguientePaso.plazo` con semáforo (verde; ámbar si falta 1 día hábil o menos; rojo si venció) y `plazoRegla` como tooltip (`title`); en `EJECUTAR_ACS`, `detail.siguientePaso.progresoAC`.
- `FINALIZADO`: banner neutro con `detail.siguientePaso.finalizado` y la fecha de `estadoDesde`.
- Si el usuario actual está entre los responsables, borde coral y el texto `detail.siguientePaso.teToca`.

Las fechas SHALL formatearse con `Intl.DateTimeFormat(i18n.language, …)`.

#### Scenario: Muestra paso, responsables, desde y plazo
- **WHEN** `siguientePaso` es `REGISTRAR_RESULTADO_CIERRE` con un JCA "Ana Pérez" y un `plazoFecha` futuro a más de un día hábil
- **THEN** el banner muestra "Siguiente paso: Registrar el resultado del cierre", "Responsable: Ana Pérez", "En este estado desde …" y "Plazo: vence el …" en verde

#### Scenario: Te toca a ti
- **WHEN** el usuario actual es uno de los responsables
- **THEN** el banner tiene borde coral y muestra "Te toca a ti"

#### Scenario: Más de 3 responsables
- **WHEN** hay 5 responsables
- **THEN** se muestran 3 nombres y "+2"

#### Scenario: Sin responsable disponible
- **WHEN** la lista de responsables está vacía y el paso no es `FINALIZADO`
- **THEN** se muestra "Sin responsable disponible" en ámbar

#### Scenario: Plazo vencido
- **WHEN** `plazoFecha` es anterior a ahora
- **THEN** el plazo se muestra en rojo

#### Scenario: Proceso finalizado
- **WHEN** `paso` es `FINALIZADO`
- **THEN** el banner neutro muestra "Proceso finalizado — verificado el {fecha}"

### Requirement: MSW devuelve siguientePaso en el detalle
El handler MSW de `GET /api/quality-events/:id` SHALL devolver un `siguientePaso` coherente con el estado del QE, usando una versión simplificada del resolver. Los fixtures SHALL incluir un QE en PENDIENTE_CIERRE sin `resultadoCierre` y otro en PENDIENTE_CIERRE con la firma del JCA y sin la del supervisor.

#### Scenario: Detalle mock en PENDIENTE_CIERRE sin resultado
- **WHEN** se pide el detalle del fixture en PENDIENTE_CIERRE sin resultado
- **THEN** `data.siguientePaso.paso` es `REGISTRAR_RESULTADO_CIERRE`
