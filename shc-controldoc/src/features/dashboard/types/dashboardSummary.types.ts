import type {
  QEStatus,
  QESeverity,
  QEType,
  QEOrigin,
  SolicitudAjustePlazoAC,
} from '../../quality-events/types/qualityEvent.types'
import type { IncidentType, IncidentStatus, IncidentSeveridad } from '../../incidents/types/incident.types'
import type { NCStatus, NCSeveridad, NCTipo } from '../../nonconformities/types/nonconformity.types'
import type { DocStatus, DocType } from '../../../types/documents.types'

export interface QEResumen {
  id: string
  numero: string
  estado: QEStatus
  severidad: QESeverity
  tipo: QEType
  origen: QEOrigin
  areaId: string
  fechaHoraReporte: string
  fechaVerificacionProgramada?: string
}

export interface IncidenteResumen {
  id: string
  numero: string
  tipo: IncidentType
  estado: IncidentStatus
  severidad: IncidentSeveridad
  fechaEvento: string
  areaId: string
}

export interface NCResumen {
  id: string
  numero: string
  estado: NCStatus
  severidad: NCSeveridad
  tipo: NCTipo
  areaId: string
  fechaDeteccion: string
}

export interface DocumentoResumen {
  id: string
  codigo: string
  titulo: string
  tipo: DocType
  estado: DocStatus
  areaId: string
  fechaRevisionProxima?: string
}

export interface AccionCorrectivaResumen {
  id: string
  origenTipo: 'QE' | 'NC' | 'INCIDENTE'
  origenId: string
  descripcion: string
  responsableId: string
  responsableNombre: string
  plazoFecha: string
  estado: string
}

export interface QEReaperturaResumen extends QEResumen {
  ciclo: number
  fechaReapertura: string
}

export interface ACSolicitudAjustePlazoResumen {
  qeId: string
  qeNumero: string
  qeSeveridad: QESeverity
  acId: string
  acDescripcion: string
  plazoFechaActual: string
  solicitudesAjustePlazo: SolicitudAjustePlazoAC[]
}
