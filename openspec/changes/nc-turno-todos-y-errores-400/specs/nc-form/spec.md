## ADDED Requirements

### Requirement: NCForm muestra el mensaje del servidor ante un 400
Cuando crear o editar una NC falla con **400** y la respuesta trae `message`, el formulario (y los hooks `useCreateNonconformity`/`useUpdateNonconformity`) SHALL mostrar ese `message` en el toast de error de Sonner. Para cualquier otro error (sin respuesta, 5xx, sin `message`) SHALL mostrar el mensaje genérico localizado (`toasts.createError` / `toasts.updateError`).

#### Scenario: 400 con mensaje del servidor
- **WHEN** el usuario envía el formulario y `POST /api/nonconformities` responde 400 con `message: "Valor inválido en el campo 'turno'."`
- **THEN** se muestra `toast.error("Valor inválido en el campo 'turno'.")`

#### Scenario: Error de servidor genérico
- **WHEN** `POST /api/nonconformities` responde 500
- **THEN** se muestra `toast.error(t('toasts.createError'))`
