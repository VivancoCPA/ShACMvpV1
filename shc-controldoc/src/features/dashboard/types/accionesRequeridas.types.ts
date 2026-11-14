export type AccionRequeridaDominio = 'QE' | 'AC' | 'DOCUMENTO'

export type AccionRequeridaTipo =
  | 'QE_INICIAR_INVESTIGACION'
  | 'QE_COMPLETAR_ANALISIS'
  | 'QE_ASIGNAR_RESPONSABLE'
  | 'QE_APROBAR_CAUSA_RAIZ'
  | 'QE_REGISTRAR_CIERRE'
  | 'QE_FIRMAR_CIERRE_JCA'
  | 'QE_FIRMAR_CIERRE'
  | 'QE_VERIFICAR'
  | 'AC_EJECUTAR'
  | 'AC_VERIFICAR'
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
