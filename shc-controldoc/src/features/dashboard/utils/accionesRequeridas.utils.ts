import { resolveRolSegundaFirma } from '../../quality-events/utils/qualityEventPermissions'
import { calcularEstadoSemaforoDesdeFecha } from './semaforoPendientes'
import type { QualityEvent } from '../../quality-events/types/qualityEvent.types'
import type { NoConformidad, AccionCorrectiva } from '../../nonconformities/types/nonconformity.types'
import type { Incidente, AccionCorrectivaIncidente } from '../../incidents/types/incident.types'
import type { Documento } from '../../../types/documents.types'
import type { User } from '../../../types/auth.types'
import type { AccionRequerida, AccionRequeridaDominio, AccionRequeridaPrioridad } from '../types/accionesRequeridas.types'

const SEVERIDAD_ALTA = ['ALTA', 'CRITICA']

function qeSeveridadPrioridad(qe: QualityEvent): AccionRequeridaPrioridad {
  return SEVERIDAD_ALTA.includes(qe.severidad) ? 'alta' : 'normal'
}

export function extraerAccionesQE(qes: QualityEvent[], user: User): AccionRequerida[] {
  const items: AccionRequerida[] = []

  for (const qe of qes) {
    const prioridad = qeSeveridadPrioridad(qe)
    const ruta = `/quality-events/${qe.id}`

    if (user.rol === 'JEFE_CALIDAD_SYST') {
      const puedeEditarCausaRaiz =
        (qe.estado === 'EN_INVESTIGACION' || qe.estado === 'ANALISIS_COMPLETADO') && !qe.causaRaizFirmadaEn
      if (puedeEditarCausaRaiz) {
        items.push({
          id: `QE-QE_CAUSA_RAIZ-${qe.id}`,
          dominio: 'QE',
          tipo: 'QE_CAUSA_RAIZ',
          codigo: qe.numero,
          descripcion: qe.descripcion,
          prioridad,
          ruta,
        })
      }

      const puedeCerrar =
        qe.estado === 'PENDIENTE_CIERRE' &&
        !qe.cierreFirmaSupervisorId &&
        (!qe.resultadoCierre || !qe.cerradoPorId)
      if (puedeCerrar) {
        items.push({
          id: `QE-QE_CERRAR-${qe.id}`,
          dominio: 'QE',
          tipo: 'QE_CERRAR',
          codigo: qe.numero,
          descripcion: qe.descripcion,
          prioridad,
          ruta,
        })
      }

      if (qe.estado === 'EN_VERIFICACION') {
        items.push({
          id: `QE-QE_VERIFICAR-${qe.id}`,
          dominio: 'QE',
          tipo: 'QE_VERIFICAR',
          codigo: qe.numero,
          descripcion: qe.descripcion,
          fechaLimite: qe.fechaVerificacionProgramada,
          prioridad,
          ruta,
        })
      }
    }

    if (user.rol === 'SUPERVISOR' || user.rol === 'ALTA_DIRECCION') {
      const puedeFirmarCierre =
        qe.estado === 'PENDIENTE_CIERRE' &&
        !!qe.cerradoPorId &&
        !qe.cierreFirmaSupervisorId &&
        user.rol === resolveRolSegundaFirma(qe.cerradoPorId, qe.areaId)
      if (puedeFirmarCierre) {
        items.push({
          id: `QE-QE_FIRMAR_CIERRE-${qe.id}`,
          dominio: 'QE',
          tipo: 'QE_FIRMAR_CIERRE',
          codigo: qe.numero,
          descripcion: qe.descripcion,
          prioridad,
          ruta,
        })
      }
    }

    if (user.rol === 'AUDITOR_INTERNO' && qe.estado === 'EN_VERIFICACION' && qe.auditorAsignadoId === user.id) {
      items.push({
        id: `QE-QE_VERIFICAR-${qe.id}`,
        dominio: 'QE',
        tipo: 'QE_VERIFICAR',
        codigo: qe.numero,
        descripcion: qe.descripcion,
        fechaLimite: qe.fechaVerificacionProgramada,
        prioridad,
        ruta,
      })
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

function toACItem(ac: ACOrigen, ruta: string): AccionRequerida {
  const { estado: estadoSemaforo } = calcularEstadoSemaforoDesdeFecha(ac.plazoFecha)
  return {
    id: `AC-AC_EJECUTAR-${ac.id}`,
    dominio: 'AC',
    tipo: 'AC_EJECUTAR',
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
      .filter((ac) => ac.responsableId === user.id && acPendienteSinEvidencia(ac))
      .map((ac) => toACItem(ac, `/quality-events/${qe.id}`)),
  )

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

  return [...deQE, ...deNC, ...deIncidente]
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
        fechaLimite: doc.fechaRevisionProxima,
        prioridad: vencida ? 'alta' : 'normal',
        ruta,
      })
    }
  }

  return items
}

const DOMINIO_ORDEN: AccionRequeridaDominio[] = ['QE', 'AC', 'DOCUMENTO']

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
