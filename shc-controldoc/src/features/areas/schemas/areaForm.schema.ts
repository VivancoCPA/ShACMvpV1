import { z } from 'zod'

export const areaFormSchema = z.object({
  nombre: z.string().min(3),
  descripcion: z.string().optional(),
})

export type AreaFormInput = z.infer<typeof areaFormSchema>
