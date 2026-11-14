import { z } from 'zod'
import { AC_TIPOS } from '../../../constants/accionCorrectivaTipo.constants'

export const createQEAccionSchema = z.object({
  titulo: z.string().max(200).optional(),
  descripcion: z.string().min(5, 'La descripción debe tener al menos 5 caracteres.').max(2000),
  // PRD §2.2: obligatorio al crear y no editable (ac-tipo-responsables). '' → undefined para que el
  // select vacío muestre el mensaje de requerido en vez de un error de enum.
  tipo: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.enum(AC_TIPOS, { message: 'Selecciona el tipo de acción.' }),
  ),
  responsableId: z.string().min(1, 'El responsable es obligatorio.'),
  prioridad: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']).optional(),
  ),
  plazoFecha: z.string().min(1, 'La fecha límite es obligatoria.'),
})

export type CreateQEACInput = z.infer<typeof createQEAccionSchema>
