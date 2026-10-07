import { z } from 'zod'

// Mismo formato que SetPinValidator en el backend real (`^\d{4}$`) — ver be-firma-pin.
const pinField = z
  .string()
  .regex(/^\d{4}$/, 'auth:validation.pinFormat')

export const setPinSchema = z
  .object({
    password: z.string().min(1, 'auth:validation.passwordRequired'),
    pin: pinField,
    confirmPin: pinField,
  })
  .refine((data) => data.pin === data.confirmPin, {
    message: 'auth:validation.pinMismatch',
    path: ['confirmPin'],
  })

export type SetPinInput = z.infer<typeof setPinSchema>
