export type AccionRequeridaDominio = 'QE' | 'AC' | 'DOCUMENTO'

export type AccionRequeridaTipo =
  | 'QE_CAUSA_RAIZ'
  | 'QE_CERRAR'
  | 'QE_FIRMAR_CIERRE'
  | 'QE_VERIFICAR'
  | 'AC_EJECUTAR'
  | 'DOC_REVISAR'
  | 'DOC_APROBAR'
  | 'DOC_REVISION_PERIODICA'

export type AccionRequeridaPrioridad = 'alta' | 'normal'

export interface AccionRequerida {
  id: string
  dominio: AccionRequeridaDominio
  tipo: AccionRequeridaTipo
  codigo: string
  descripcion: string
  fechaLimite?: string
  prioridad: AccionRequeridaPrioridad
  ruta: string
}
