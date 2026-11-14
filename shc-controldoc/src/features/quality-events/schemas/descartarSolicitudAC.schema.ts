import { z } from 'zod'

// Descartar una solicitud de AC exige motivo de 20 a 500 caracteres (solicitudes-ac-y-ac-del-qe-en-origen).
export const descartarSolicitudACSchema = z.object({
  motivo: z
    .string()
    .trim()
    .min(20, 'El motivo debe tener al menos 20 caracteres.')
    .max(500, 'El motivo no debe superar 500 caracteres.'),
})

export type DescartarSolicitudACInput = z.infer<typeof descartarSolicitudACSchema>
