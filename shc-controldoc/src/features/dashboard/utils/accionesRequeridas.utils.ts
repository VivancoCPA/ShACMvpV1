import { resolveRolSegundaFirma } from '../../quality-events/utils/qualityEventPermissions'
import { calcularEstadoSemaforoDesdeFecha } from './semaforoPendientes'
import type { QualityEvent } from '../../quality-events/types/qualityEvent.types'
import type { NoConformidad, AccionCorrectiva } from '../../nonconformities/types/nonconformity.types'
import type { Incidente, AccionCorrectivaIncidente } from '../../incidents/types/incident.types'
import type { Documento } from '../../../types/documents.types'
import type { User } from '../../../types/auth.types'
import type {
  AccionRequerida,
  AccionRequeridaDominio,
  AccionRequeridaPrioridad,
  AccionRequeridaTipo,
} from '../types/accionesRequeridas.types'

const SEVERIDAD_ALTA = ['ALTA', 'CRITICA']
// PRD §1.3: un QE tiene 48 h para ser asignado a investigación. Solo sube la prioridad visual.
const PLAZO_ASIGNACION_MS = 48 * 60 * 60 * 1000
// Mismo umbral que causaRaizSchema en QEInvestigationSection (min 100 tras trim).
const CAUSA_RAIZ_MIN_CHARS = 100

function qeSeveridadPrioridad(qe: QualityEvent): AccionRequeridaPrioridad {
  return SEVERIDAD_ALTA.includes(qe.severidad) ? 'alta' : 'normal'
}

function qeAbiertoVencido(qe: QualityEvent): boolean {
  const desde = qe.fechaHoraReporte ?? qe.creadoEn
  return !!desde && Date.now() - new Date(desde).getTime() > PLAZO_ASIGNACION_MS
}

export function extraerAccionesQE(qes: QualityEvent[], user: User): AccionRequerida[] {
  const items: AccionRequerida[] = []

  for (const qe of qes) {
    if (qe.deletedAt) continue
    const prioridad = qeSeveridadPrioridad(qe)
    const ruta = `/quality-events/${qe.id}`
    const push = (tipo: AccionRequeridaTipo, extra: Partial<AccionRequerida> = {}) => {
      items.push({
        id: `QE-${tipo}-${qe.id}`,
        dominio: 'QE',
        tipo,
        codigo: qe.numero,
        descripcion: qe.descripcion,
        prioridad,
        ruta,
        ...extra,
      })
    }
    const prioridadAbierto: AccionRequeridaPrioridad = qeAbiertoVencido(qe) ? 'alta' : prioridad

    // Por asignación (pendientes-qe-asignacion-y-menus D1): vale para cualquier rol.
    if (qe.responsableInvestigacionId === user.id) {
      if (qe.estado === 'ABIERTO') push('QE_INICIAR_INVESTIGACION', { prioridad: prioridadAbierto })
      if (qe.estado === 'EN_INVESTIGACION') push('QE_COMPLETAR_ANALISIS')
    }

    if (user.rol === 'JEFE_CALIDAD_SYST') {
      if (qe.estado === 'ABIERTO' && !qe.responsableInvestigacionId) {
        push('QE_ASIGNAR_RESPONSABLE', { prioridad: prioridadAbierto })
      }

      const puedeAprobarCausaRaiz =
        (qe.estado === 'EN_INVESTIGACION' || qe.estado === 'ANALISIS_COMPLETADO') &&
        (qe.causaRaizDefinitiva?.trim().length ?? 0) >= CAUSA_RAIZ_MIN_CHARS &&
        !qe.causaRaizFirmadaEn
      if (puedeAprobarCausaRaiz) push('QE_APROBAR_CAUSA_RAIZ')

      // Mismas condiciones que showClosureForm y la firma del JCA en QECierreSection
      // (dashboard-alertas-coherentes D3).
      if (qe.estado === 'PENDIENTE_CIERRE' && !qe.resultadoCierre) push('QE_REGISTRAR_CIERRE')
      if (qe.estado === 'PENDIENTE_CIERRE' && !!qe.resultadoCierre && !qe.cerradoPorId) push('QE_FIRMAR_CIERRE_JCA')

      if (qe.estado === 'EN_VERIFICACION') {
        push('QE_VERIFICAR', { fechaLimite: qe.fechaVerificacionProgramada })
      }
    }

    if (user.rol === 'SUPERVISOR' || user.rol === 'ALTA_DIRECCION') {
      const puedeFirmarCierre =
        qe.estado === 'PENDIENTE_CIERRE' &&
        !!qe.cerradoPorId &&
        !qe.cierreFirmaSupervisorId &&
        user.rol === resolveRolSegundaFirma(qe.cerradoPorId, qe.areaId) &&
        // Solo los supervisores del área del QE (qe-cierre-firma-supervisor-area D9): el listado
        // no trae supervisoresArea, se usa el áreaIds del propio usuario (mismo criterio del backend).
        (user.areaIds ?? []).includes(qe.areaId)
      if (puedeFirmarCierre) push('QE_FIRMAR_CIERRE')
    }

    if (user.rol === 'AUDITOR_INTERNO' && qe.estado === 'EN_VERIFICACION' && qe.auditorAsignadoId === user.id) {
      push('QE_VERIFICAR', { fechaLimite: qe.fechaVerificacionProgramada })
    }
  }

  return items
}

interface ACOrigen {
  id: string
  descripcion: string
  responsableId: string
  plazoFecha: string
  estado: string
  descripcionEvidencia?: string
}

function acPendienteSinEvidencia(ac: ACOrigen): boolean {
  return (ac.estado === 'PENDIENTE' || ac.estado === 'EN_EJECUCION') && !ac.descripcionEvidencia
}

// AC de QE (ac-ejecucion-verificacion-evidencias): pendiente para el responsable mientras no la
// marque como ejecutada, aunque tenga descripción de una ejecución devuelta por el JCA.
function acQEPorEjecutar(ac: ACOrigen): boolean {
  return ac.estado === 'PENDIENTE' || ac.estado === 'EN_EJECUCION'
}

function toACItem(ac: ACOrigen, ruta: string, tipo: AccionRequeridaTipo = 'AC_EJECUTAR'): AccionRequerida {
  const { estado: estadoSemaforo } = calcularEstadoSemaforoDesdeFecha(ac.plazoFecha)
  return {
    id: `AC-${tipo}-${ac.id}`,
    dominio: 'AC',
    tipo,
    codigo: ac.descripcion,
    descripcion: ac.descripcion,
    fechaLimite: ac.plazoFecha,
    prioridad: estadoSemaforo === 'ROJO' ? 'alta' : 'normal',
    ruta,
  }
}

export function extraerAccionesAC(
  qes: QualityEvent[],
  ncs: NoConformidad[],
  incidentes: Incidente[],
  user: User,
): AccionRequerida[] {
  const deQE = qes.flatMap((qe) =>
    qe.accionesCorrectivas
      .filter((ac) => ac.responsableId === user.id && acQEPorEjecutar(ac))
      .map((ac) => toACItem(ac, `/quality-events/${qe.id}`)),
  )

  // El JCA verifica y cierra las AC de QE ya ejecutadas por su responsable.
  const porVerificar =
    user.rol === 'JEFE_CALIDAD_SYST'
      ? qes
          .filter((qe) => !qe.deletedAt)
          .flatMap((qe) =>
            qe.accionesCorrectivas
              .filter((ac) => ac.estado === 'COMPLETADA')
              .map((ac) => toACItem(ac, `/quality-events/${qe.id}`, 'AC_VERIFICAR')),
          )
      : []

  const deNC = ncs.flatMap((nc) =>
    nc.accionesCorrectivas
      .filter((ac: AccionCorrectiva) => ac.responsableId === user.id && acPendienteSinEvidencia(ac))
      .map((ac) => toACItem(ac, `/nonconformities/${nc.id}`)),
  )

  const deIncidente = incidentes.flatMap((inc) =>
    (inc.accionesCorrectivas ?? [])
      .filter((ac: AccionCorrectivaIncidente) => ac.responsableId === user.id && acPendienteSinEvidencia(ac))
      .map((ac) => toACItem(ac, `/incidents/${inc.id}`)),
  )

  return [...deQE, ...porVerificar, ...deNC, ...deIncidente]
}

export function extraerAccionesDocumento(documentos: Documento[], user: User): AccionRequerida[] {
  const items: AccionRequerida[] = []

  for (const doc of documentos) {
    if (doc.deletedAt) continue
    const ruta = `/documentos/${doc.id}`

    if (doc.revisorId === user.id && doc.estado === 'EN_REVISION') {
      items.push({
        id: `DOCUMENTO-DOC_REVISAR-${doc.id}`,
        dominio: 'DOCUMENTO',
        tipo: 'DOC_REVISAR',
        codigo: doc.codigo,
        descripcion: doc.titulo,
        prioridad: 'normal',
        ruta,
      })
    }

    if (doc.aprobadorId === user.id && doc.estado === 'EN_APROBACION') {
      items.push({
        id: `DOCUMENTO-DOC_APROBAR-${doc.id}`,
        dominio: 'DOCUMENTO',
        tipo: 'DOC_APROBAR',
        codigo: doc.codigo,
        descripcion: doc.titulo,
        prioridad: 'normal',
        ruta,
      })
    }

    if (doc.autorId === user.id && doc.estado === 'EN_REVISION_PERIODICA') {
      const vencida = !!doc.fechaRevisionProxima && new Date(doc.fechaRevisionProxima).getTime() < Date.now()
      items.push({
        id: `DOCUMENTO-DOC_REVISION_PERIODICA-${doc.id}`,
        dominio: 'DOCUMENTO',
        tipo: 'DOC_REVISION_PERIODICA',
        codigo: doc.codigo,
        descripcion: doc.titulo,
        fechaLimite: doc.fechaRevisionProxima ?? undefined,
        prioridad: vencida ? 'alta' : 'normal',
        ruta,
      })
    }
  }

  return items
}

const DOMINIO_ORDEN: AccionRequeridaDominio[] = ['QE', 'AC', 'DOCUMENTO']

// Una sola función para el número de una tarjeta de alerta y las filas de la lista filtrada
// (dashboard-alertas-coherentes D2): así nunca divergen.
export function filtrarAccionesPorTipo(
  items: AccionRequerida[],
  tipos: readonly AccionRequeridaTipo[],
): AccionRequerida[] {
  return items.filter((item) => tipos.includes(item.tipo))
}

function compararPorPrioridadYFecha(a: AccionRequerida, b: AccionRequerida): number {
  if (a.prioridad !== b.prioridad) return a.prioridad === 'alta' ? -1 : 1
  if (!a.fechaLimite && !b.fechaLimite) return 0
  if (!a.fechaLimite) return 1
  if (!b.fechaLimite) return -1
  return new Date(a.fechaLimite).getTime() - new Date(b.fechaLimite).getTime()
}

export function ordenarAccionesRequeridas(items: AccionRequerida[]): AccionRequerida[] {
  return DOMINIO_ORDEN.flatMap((dominio) =>
    items.filter((item) => item.dominio === dominio).sort(compararPorPrioridadYFecha),
  )
}
