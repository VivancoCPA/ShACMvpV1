import { z } from 'zod'

export const firmarCierreSchema = z.object({
  rol: z.enum(['JEFE_CALIDAD_SYST', 'SUPERVISOR', 'ALTA_DIRECCION']),
  pin: z.string().length(4, 'El PIN debe tener 4 dígitos'),
})

export type FirmarCierreInput = z.infer<typeof firmarCierreSchema>
