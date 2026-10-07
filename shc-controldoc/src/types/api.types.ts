export interface PaginationMeta {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export interface ApiResponse<T> {
  data: T
  success: boolean
  message?: string
  errors?: string[]
  /** Código estable opcional para distinguir casos de negocio sin parsear `message`
   *  (ej. `"PIN_NO_CONFIGURADO"`) — ver pin-firma-ui/design.md D1. `undefined` en la
   *  inmensa mayoría de respuestas, que no lo necesitan. */
  errorCode?: string
  pagination?: PaginationMeta
}
