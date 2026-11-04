# Spec: empresa-form

## Purpose

Define `EmpresaFormModal`, the reusable create/edit modal for the `Empresa` entity, and its logo upload field — which reuses the existing `validateAvatarFile` base64-conversion pattern already used for user avatars, adapted for a company logo with preview.

---

## Requirements

### Requirement: EmpresaFormModal crea y edita empresas en un único modal reutilizado
`src/features/empresas/components/EmpresaFormModal.tsx` SHALL renderizar un modal con React Hook Form + `empresaFormSchema` (Zod), reutilizado tanto para alta como para edición según reciba o no una `Empresa` por prop — mismo patrón que `AreaFormModal` (`formEmpresa: Empresa | null | undefined`: `undefined` cierra el modal, `null` es alta, una `Empresa` es edición). El formulario SHALL incluir campos `razonSocial`, `ruc`, `estado` y el campo de logo (ver siguiente requirement).

#### Scenario: Abrir el modal en modo alta no precarga campos
- **WHEN** el admin hace click en "Nueva empresa"
- **THEN** el modal se abre con todos los campos vacíos y `estado` por defecto en `ACTIVA`

#### Scenario: Abrir el modal en modo edición precarga los datos existentes
- **WHEN** el admin hace click en "Editar" sobre una fila de `EmpresaList`
- **THEN** el modal se abre con `razonSocial`, `ruc`, `estado` y el logo actual precargados

#### Scenario: Errores de validación se muestran localizados
- **WHEN** el admin envía el formulario con un `ruc` inválido
- **THEN** el mensaje de error localizado (`t('empresas:form.validation.rucInvalido')`) aparece bajo el campo, sin enviar la solicitud

### Requirement: Campo de logo reutiliza el patrón de conversión a base64 de avatar de Usuario
El campo de logo SHALL validar el archivo con `validateAvatarFile` (mismo límite 2MB, mismos tipos `image/jpeg`/`image/png` que `avatarFile.schema.ts`) y convertirlo a data URI en el cliente antes de incluirlo en el body como `logoBase64`, siguiendo exactamente el patrón ya usado por `avatarBase64` en `UserFormModal.tsx` — no el patrón `FormData`/`File` crudo de `PlanoUploadField`. El campo SHALL mostrar una previsualización del logo actual o recién seleccionado.

#### Scenario: Subir un logo válido muestra previsualización
- **WHEN** el admin selecciona un archivo `image/png` de 500KB como logo
- **THEN** se muestra la previsualización de la imagen antes de guardar

#### Scenario: Archivo de formato inválido es rechazado
- **WHEN** el admin selecciona un archivo `application/pdf` como logo
- **THEN** se muestra un error localizado y el archivo no se acepta

#### Scenario: Guardar sin cambiar el logo conserva el existente
- **WHEN** el admin edita `razonSocial` sin tocar el campo de logo de una empresa que ya tiene uno
- **THEN** el `logoUrl` existente se conserva sin cambios en la solicitud de actualización


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
