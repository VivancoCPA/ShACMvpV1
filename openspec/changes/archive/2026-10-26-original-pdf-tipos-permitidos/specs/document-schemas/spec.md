## ADDED Requirements

### Requirement: documentFormSchema valida la compatibilidad entre tipo y archivo original (RN-DOC-021)
`documentFormSchema` (`src/features/documents/schemas/documentForm.schema.ts`) SHALL, dentro de su `superRefine` existente, rechazar la combinación donde `archivoOriginalFile` es un `File` con tipo MIME `application/pdf` y `tipo` no está en `TIPOS_CON_ORIGINAL_PDF` (`INF`, `MAT`, `PLAN`), agregando un issue en el path `archivoOriginalFile` con un mensaje que indica los formatos aceptados para ese `tipo`. Esta validación SHALL re-evaluarse con cualquier combinación de valores del formulario, de forma que cambiar `tipo` después de seleccionar el archivo (o viceversa) sea detectado igual.

#### Scenario: PDF compatible con el tipo pasa la validación
- **WHEN** `documentFormSchema.safeParse` recibe `{ tipo: 'PLAN', archivoOriginalFile: <File application/pdf> }` junto con el resto de campos válidos
- **THEN** `success` es `true`

#### Scenario: PDF incompatible con el tipo falla la validación
- **WHEN** `documentFormSchema.safeParse` recibe `{ tipo: 'PRC', archivoOriginalFile: <File application/pdf> }` junto con el resto de campos válidos
- **THEN** `success` es `false` y el error path incluye `archivoOriginalFile`

#### Scenario: .docx siempre pasa la validación sin importar el tipo
- **WHEN** `documentFormSchema.safeParse` recibe `{ tipo: 'PRC', archivoOriginalFile: <File .docx> }` o `{ tipo: 'PLAN', archivoOriginalFile: <File .docx> }`
- **THEN** `success` es `true` en ambos casos

#### Scenario: archivoOriginalFile ausente no dispara esta validación
- **WHEN** `documentFormSchema.safeParse` recibe `{ tipo: 'PRC', archivoOriginalFile: null }` junto con el resto de campos válidos
- **THEN** `success` es `true`
