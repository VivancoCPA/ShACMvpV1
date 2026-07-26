import { z } from 'zod'

export const empresaFormSchema = z.object({
  razonSocial: z.string().min(1, 'empresas:form.validation.razonSocialRequired'),
  ruc: z.string().regex(/^\d{11}$/, 'empresas:form.validation.rucInvalido'),
  estado: z.enum(['ACTIVA', 'INACTIVA']),
  logoBase64: z.string().optional(),
})

export type EmpresaFormInput = z.infer<typeof empresaFormSchema>
