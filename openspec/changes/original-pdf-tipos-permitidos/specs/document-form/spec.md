## ADDED Requirements

### Requirement: Texto de ayuda y bloqueo de guardado según compatibilidad tipo/archivo original (RN-DOC-021)
`DocumentForm` SHALL mostrar un texto de ayuda distinto para el campo de archivo original según el `tipo` seleccionado: para `INF`, `MAT` y `PLAN`, un texto que indica que se acepta Word, Excel o PDF (aclarando que un PDF no puede editarse en una nueva versión); para los demás tipos, un texto que indica que solo se acepta Word o Excel. En modo creación, si el usuario cambia `tipo` a un valor que no admite PDF mientras ya hay un `archivoOriginalFile` de tipo PDF seleccionado en el formulario (aún no persistido), el formulario SHALL mostrar el error de validación correspondiente en el campo y SHALL bloquear el envío hasta que se resuelva (quitando el PDF o eligiendo un `tipo` compatible). Esta validación no aplica en edición: `tipo` es inmutable después de la creación del documento (el backend no lo acepta en `PUT /api/documents/:id`), por lo que no existe un escenario de "cambiar tipo con PDF ya cargado" fuera del formulario de creación.

#### Scenario: Texto de ayuda para un tipo con PDF permitido
- **WHEN** el formulario de creación tiene `tipo: PLAN` seleccionado
- **THEN** el texto de ayuda del archivo original menciona Word, Excel o PDF

#### Scenario: Texto de ayuda para un tipo sin PDF permitido
- **WHEN** el formulario de creación tiene `tipo: PRC` seleccionado
- **THEN** el texto de ayuda del archivo original menciona solo Word o Excel

#### Scenario: Cambiar a un tipo incompatible con un PDF ya seleccionado bloquea el guardado
- **WHEN** el usuario selecciona un archivo `.pdf` con `tipo: PLAN` y luego cambia `tipo` a `PRC` sin quitar el archivo, en el formulario de creación
- **THEN** el formulario muestra un error de validación en el campo de archivo original y el botón de guardar no completa el envío

#### Scenario: Quitar el PDF antes de cambiar a un tipo incompatible no bloquea el guardado
- **WHEN** el usuario selecciona un archivo `.pdf` con `tipo: PLAN`, lo quita, y luego cambia `tipo` a `PRC`
- **THEN** el formulario no muestra error y permite el envío
