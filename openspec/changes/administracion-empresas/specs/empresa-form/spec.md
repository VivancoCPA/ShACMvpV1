## ADDED Requirements

### Requirement: Contrato de logo en la actualización de empresa
En `PATCH /api/empresas/:id`, `logoBase64` SHALL interpretarse así: omitido o `null` = no cambiar el logo; `""` (string vacío) = quitar el logo (`logo_url = null`); data URI = reemplazar. Este contrato SHALL reflejarse a la vez en backend, handler MSW, tipos/schema TS y tests. Al editar sin tocar el logo, el formulario SHALL NOT reenviar `logoBase64`.

#### Scenario: Quitar logo contra el backend real
- **WHEN** el admin edita una empresa con logo, pulsa "Quitar logo" y guarda
- **THEN** el PATCH envía `logoBase64: ""` y la empresa queda sin logo

#### Scenario: Editar sin tocar el logo no reenvía la imagen
- **WHEN** el admin edita solo `razonSocial`
- **THEN** el body del PATCH no incluye `logoBase64` y el logo existente se conserva

### Requirement: El formulario muestra error visible ante cualquier fallo y no queda sin salida
`EmpresaForm` SHALL mostrar un mensaje de error visible dentro del modal para cualquier respuesta de error (no solo 409), y el modal SHALL permitir siempre reintentar o cancelar.

#### Scenario: El backend responde 500 al actualizar
- **WHEN** el PATCH devuelve 500
- **THEN** el modal permanece abierto mostrando un error visible, el botón de guardar vuelve a estar habilitado y Cancelar cierra el modal
