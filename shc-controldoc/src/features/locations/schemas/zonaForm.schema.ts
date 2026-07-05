import { z } from 'zod'

export const zonaFormSchema = z.object({
  nombre: z.string().min(3),
  descripcion: z.string().optional(),
})

export type ZonaFormInput = z.infer<typeof zonaFormSchema>
