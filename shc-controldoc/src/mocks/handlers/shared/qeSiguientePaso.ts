import { getUsersStore } from '../../fixtures/auth.fixtures'
import { getRolEfectivo } from '../../fixtures/empresas.fixtures'
import type {
  QESiguientePaso,
  QESiguientePasoCodigo,
  QualityEvent,
  ResponsablePasoQE,
} from '../../../features/quality-events/types/qualityEvent.types'

// qe-siguiente-paso-responsable D12 — versión simplificada de QESiguientePasoResolver (backend):
// misma tabla de pasos, días hábiles sin zona horaria ni feriados. Solo para el detalle MSW.

const PLAZO_INVESTIGACION: Record<QualityEvent['severidad'], number> = { BAJA: 15, MEDIA: 10, ALTA: 7, CRITICA: 3 }

function sumarDiasHabiles(desde: Date, dias: number): Date {
  const cursor = new Date(desde)
  let restantes = dias
  while (restantes > 0) {
    cursor.setDate(cursor.getDate() + 1)
    const d = cursor.getDay()
    if (d !== 0 && d !== 6) restantes--
  }
  return cursor
}

function usuarioActivo(id: string | undefined, empresaId: string): ResponsablePasoQE | null {
  if (!id) return null
  const u = getUsersStore().find((x) => x.id === id && x.activo)
  if (!u) return null
  return {
    id: u.id,
    nombreCompleto: `${u.nombre} ${u.apellido}`.trim(),
    rol: getRolEfectivo(u.id, empresaId) ?? null,
    avatarUrl: u.avatarUrl ?? null,
  }
}

function jefesCalidad(empresaId: string): ResponsablePasoQE[] {
  return getUsersStore()
    .filter((u) => u.activo && getRolEfectivo(u.id, empresaId) === 'JEFE_CALIDAD_SYST')
    .map((u) => ({
      id: u.id,
      nombreCompleto: `${u.nombre} ${u.apellido}`.trim(),
      rol: 'JEFE_CALIDAD_SYST',
      avatarUrl: u.avatarUrl ?? null,
    }))
    .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto))
}

function distintos(lista: (ResponsablePasoQE | null)[]): ResponsablePasoQE[] {
  const vistos = new Set<string>()
  return lista.filter((r): r is ResponsablePasoQE => !!r && !vistos.has(r.id) && !!vistos.add(r.id))
}

// Última entrada con estadoNuevo === estado actual, cualquier acción salvo AC_* (estado de la AC).
export function estadoDesdeMock(qe: QualityEvent): string {
  const entradas = qe.auditTrail.filter((e) => e.estadoNuevo === qe.estado && !e.accion.startsWith('AC_'))
  if (entradas.length === 0) return qe.creadoEn
  return entradas.reduce((max, e) => (e.timestamp > max ? e.timestamp : max), entradas[0].timestamp)
}

export function buildSiguientePaso(qe: QualityEvent): QESiguientePaso {
  const estadoDesde = estadoDesdeMock(qe)
  const desde = new Date(estadoDesde)
  const jcas = jefesCalidad(qe.empresaId)
  const responsableInv = usuarioActivo(qe.responsableInvestigacionId, qe.empresaId)
  const causaPendiente = (qe.causaRaizDefinitiva?.trim().length ?? 0) >= 100 && !qe.causaRaizFirmadaEn

  const paso = (
    codigo: QESiguientePasoCodigo,
    responsables: (ResponsablePasoQE | null)[],
    plazo: Date | null,
    plazoRegla: string | null,
    extra: Partial<QESiguientePaso> = {},
  ): QESiguientePaso => ({
    paso: codigo,
    responsables: distintos(responsables),
    estadoDesde,
    plazoFecha: plazo ? plazo.toISOString() : null,
    plazoRegla,
    ...extra,
  })
  const habiles = (dias: number) => [sumarDiasHabiles(desde, dias), `PRD §1.3 · ${dias} días hábiles`] as const

  switch (qe.estado) {
    case 'ABIERTO': {
      const plazo = new Date(desde.getTime() + 48 * 60 * 60 * 1000)
      return qe.responsableInvestigacionId
        ? paso('INICIAR_INVESTIGACION', [responsableInv, ...jcas], plazo, 'PRD §1.3 · 48 h')
        : paso('ASIGNAR_RESPONSABLE', jcas, plazo, 'PRD §1.3 · 48 h')
    }
    case 'EN_INVESTIGACION':
    case 'REABIERTO': {
      const [plazo, regla] = habiles(PLAZO_INVESTIGACION[qe.severidad])
      return causaPendiente
        ? paso('APROBAR_CAUSA_RAIZ', jcas, plazo, regla)
        : paso('COMPLETAR_ANALISIS', [responsableInv], plazo, regla)
    }
    case 'ANALISIS_COMPLETADO': {
      const [plazo, regla] = habiles(2)
      return paso(causaPendiente ? 'APROBAR_CAUSA_RAIZ' : 'INICIAR_EJECUCION', jcas, plazo, regla)
    }
    case 'EN_EJECUCION': {
      const abiertas = qe.accionesCorrectivas.filter((a) => a.estado !== 'CERRADA')
      const responsables = abiertas.map((a) => usuarioActivo(a.responsableId, qe.empresaId))
      if (abiertas.some((a) => a.estado === 'COMPLETADA')) responsables.push(...jcas)
      const plazo = abiertas.length
        ? new Date(Math.max(...abiertas.map((a) => new Date(a.plazoFecha).getTime())))
        : null
      return paso('EJECUTAR_ACS', responsables, plazo, plazo ? 'PRD §1.3 · plazo de cada AC' : null, {
        progreso: qe.accionesCorrectivas.length - abiertas.length,
        total: qe.accionesCorrectivas.length,
      })
    }
    case 'PENDIENTE_CIERRE': {
      const [plazo, regla] = habiles(5)
      if (!qe.resultadoCierre) return paso('REGISTRAR_RESULTADO_CIERRE', jcas, plazo, regla)
      if (!qe.cerradoPorId) return paso('FIRMA_JCA', jcas, plazo, regla)
      // qe-reapertura-reinicia-cierre D3: las dos firmas en PENDIENTE_CIERRE → datos inconsistentes.
      if (qe.cierreFirmaSupervisorId) return paso('CIERRE_INCONSISTENTE', jcas, null, null)
      const firmas = qe.auditTrail.filter(
        (e) =>
          e.accion === 'FIRMA_CIERRE_JEFE_CALIDAD' ||
          (e.accion === 'FIRMA_REGISTRADA' && e.campoModificado === 'cerradoPorId'),
      )
      const firma = firmas.length ? new Date(firmas[firmas.length - 1].timestamp) : desde
      const supervisores = (qe.supervisoresArea ?? []).map((s) => ({
        id: s.id,
        nombreCompleto: s.nombreCompleto,
        rol: 'SUPERVISOR',
        avatarUrl: s.avatarUrl ?? null,
      }))
      return paso(
        'FIRMA_SUPERVISOR',
        supervisores,
        sumarDiasHabiles(firma, 3),
        'PRD §1.5 P4 · 3 días hábiles desde la firma del Jefe de Calidad',
      )
    }
    case 'CERRADO':
      return paso(
        'ESPERA_VERIFICACION',
        jcas,
        qe.fechaVerificacionProgramada ? new Date(qe.fechaVerificacionProgramada) : null,
        qe.fechaVerificacionProgramada ? 'PRD §1.3 · fecha de verificación programada' : null,
      )
    case 'EN_VERIFICACION': {
      const [plazo, regla] = habiles(10)
      return paso('VERIFICAR_EFICACIA', jcas, plazo, regla)
    }
    default:
      return paso('FINALIZADO', [], null, null)
  }
}
