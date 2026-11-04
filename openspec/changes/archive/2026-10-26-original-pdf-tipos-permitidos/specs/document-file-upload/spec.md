## ADDED Requirements

### Requirement: Variante `original` acepta PDF nativo según el tipo de documento (RN-DOC-021)
`FileUploadField` en su variante `original` SHALL recibir el `tipo` de documento vigente (o una prop derivada de él) y ampliar sus tipos aceptados y su atributo `accept` para incluir `.pdf`/`application/pdf` únicamente cuando ese `tipo` está en la lista `TIPOS_CON_ORIGINAL_PDF` (`INF`, `MAT`, `PLAN`; espejo de `DocumentoFormatosPermitidos.TiposConOriginalPdf` en el backend). Para cualquier otro `tipo`, la variante `original` SHALL seguir aceptando únicamente `.docx`/`.xlsx`, sin cambios respecto al comportamiento actual.

#### Scenario: PDF aceptado en la variante original para un tipo con PDF permitido
- **WHEN** el usuario selecciona un archivo `.pdf` en `FileUploadField` variante `original` con `tipo: PLAN`
- **THEN** el archivo es aceptado, su nombre y tamaño se muestran, y no aparece ningún error

#### Scenario: PDF rechazado en la variante original para un tipo sin PDF permitido
- **WHEN** el usuario selecciona un archivo `.pdf` en `FileUploadField` variante `original` con `tipo: PRC`
- **THEN** el archivo es rechazado con el mismo error inline que un tipo de archivo no soportado (`t('documents:form.error_file_type')`)

#### Scenario: .docx sigue aceptado en la variante original sin importar el tipo
- **WHEN** el usuario selecciona un archivo `.docx` en `FileUploadField` variante `original` con `tipo: PLAN` o `tipo: PRC`
- **THEN** el archivo es aceptado en ambos casos

#### Scenario: El atributo accept del input refleja los tipos permitidos
- **WHEN** `FileUploadField` variante `original` se renderiza con `tipo: MAT`
- **THEN** el atributo `accept` del `<input type="file">` incluye `.pdf` además de `.docx,.xlsx`
