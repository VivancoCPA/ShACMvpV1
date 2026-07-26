## ADDED Requirements

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
