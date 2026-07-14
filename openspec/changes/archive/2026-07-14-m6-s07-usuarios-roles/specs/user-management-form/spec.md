## ADDED Requirements

### Requirement: Formulario único de alta y edición de usuario
`src/features/users/components/UserFormModal.tsx` SHALL implementar un único formulario (React Hook Form + Zod) reutilizado tanto para alta como para edición, distinguiendo el modo por la presencia de un `userId` inicial. El campo de contraseña inicial SHALL mostrarse únicamente en modo alta; en modo edición no SHALL existir ningún campo de contraseña.

#### Scenario: Modo alta no precarga campos
- **WHEN** el admin abre el formulario para crear un usuario nuevo
- **THEN** todos los campos aparecen vacíos y el formulario está en modo alta

#### Scenario: Modo edición precarga los datos del usuario
- **WHEN** el admin abre el formulario para editar un usuario existente
- **THEN** los campos `nombre`, `apellido`, `email`, `rol`, `area` y `areasAsignadas` aparecen precargados con los valores actuales del usuario

#### Scenario: Campo areasAsignadas solo aparece para rol SUPERVISOR
- **WHEN** el admin selecciona `rol: 'SUPERVISOR'` en el formulario (alta o edición)
- **THEN** los campos `area` y `areasAsignadas` se vuelven visibles y requeridos

### Requirement: Alta muestra la contraseña temporal generada en el modal reutilizable de CA-USR-08 (RN-USR-005)
Al enviar el formulario en modo alta, tras la respuesta exitosa de `useCreateUser()`, la UI SHALL mostrar la `temporaryPassword` recibida reutilizando el mismo modal persistente con botón "Copiar" (`navigator.clipboard.writeText` + feedback visual temporal) ya implementado para el reset de contraseña (RN-USR-004/CA-USR-08) — no un componente nuevo. El toast de confirmación de alta ("Usuario creado correctamente") SHALL poder mantenerse como notificación adicional, pero nunca como el único lugar donde se muestra la contraseña. El nuevo usuario SHALL aparecer inmediatamente en el listado sin recargar la página.

#### Scenario: Alta exitosa muestra la contraseña temporal en el modal reutilizable con botón Copiar (CA-USR-09)
- **WHEN** el admin completa el formulario de alta con datos válidos y lo envía
- **THEN** se muestra la contraseña temporal generada en el mismo modal persistente con botón "Copiar" usado para el reset de contraseña, y el nuevo usuario aparece en la tabla de `/usuarios`

#### Scenario: El botón Copiar del modal de alta copia la contraseña con feedback visual
- **WHEN** el admin hace click en el botón "Copiar" del modal de contraseña temporal tras un alta exitosa
- **THEN** `navigator.clipboard.writeText` se invoca con la `temporaryPassword` mostrada, y el botón muestra feedback visual temporal antes de volver a su estado original

### Requirement: Errores de validación Zod localizados en el formulario
El formulario SHALL mostrar los errores de validación Zod de `createUserSchema`/`updateUserSchema` de forma localizada (`t('users:...')`) junto a cada campo, sin bloquear la edición de los demás campos.

#### Scenario: Email inválido muestra error localizado sin bloquear otros campos
- **WHEN** el admin ingresa un email con formato inválido y intenta enviar el formulario
- **THEN** se muestra un mensaje de error localizado bajo el campo email, y los demás campos conservan sus valores ingresados

### Requirement: Carga de avatar con preview antes de guardar (RN-USR-007)
El formulario SHALL incluir un input de archivo (`accept="image/jpeg,image/png"`) para avatar. Al seleccionar un archivo válido, SHALL mostrarse un preview de la imagen antes de guardar el formulario, usando `FileReader.readAsDataURL` para la conversión a base64 que se envía en el payload de alta/edición.

#### Scenario: Seleccionar avatar válido muestra preview
- **WHEN** el admin selecciona una imagen `.png` válida (≤2MB) en el input de avatar
- **THEN** se muestra un preview de esa imagen dentro del formulario antes de enviar

#### Scenario: Guardar con avatar actualiza avatarUrl
- **WHEN** el admin guarda el formulario (alta o edición) con un avatar válido seleccionado
- **THEN** el usuario resultante tiene `avatarUrl` con el valor `data:image/...` generado a partir del archivo

#### Scenario: Edición permite reemplazar el avatar existente
- **WHEN** el admin edita un usuario que ya tiene `avatarUrl` y selecciona un nuevo archivo de avatar
- **THEN** el preview se actualiza al nuevo archivo, y al guardar el `avatarUrl` del usuario se reemplaza por el nuevo valor

### Requirement: Avatar actualizado se refleja en TopNav
Cuando el `avatarUrl` de un usuario se actualiza vía este formulario, la próxima vez que ese usuario inicie sesión (o cualquier usuario visualice el listado), el `TopNav`/`UserAvatar` SHALL mostrar la imagen actualizada, consumiendo el mismo campo `avatarUrl` que ya usa el componente existente.

#### Scenario: Avatar nuevo aparece en TopNav tras el siguiente login
- **WHEN** un admin actualiza el `avatarUrl` de un usuario y ese usuario inicia sesión posteriormente
- **THEN** el `TopNav` de esa sesión muestra el nuevo avatar en vez de las iniciales o el avatar anterior
