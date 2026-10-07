## ADDED Requirements

### Requirement: getFileNameFromContentDisposition helper puro
El sistema SHALL exportar `getFileNameFromContentDisposition(header: string | undefined, fallback: string): string` desde `src/utils/contentDisposition.ts`, sin dependencias de Axios ni de componentes React. La función SHALL preferir `filename*=UTF-8''...` (RFC 5987) cuando está presente, decodificándolo con `decodeURIComponent`. Si no hay `filename*`, SHALL aceptar `filename=` con o sin comillas. SHALL devolver `fallback` únicamente si no encuentra ninguno de los dos valores en el header.

#### Scenario: filename con comillas
- **WHEN** el header es `attachment; filename="PRC-CD-001.docx"`
- **THEN** la función retorna `"PRC-CD-001.docx"`

#### Scenario: filename sin comillas
- **WHEN** el header es `attachment; filename=PRC-CD-001.docx`
- **THEN** la función retorna `"PRC-CD-001.docx"`

#### Scenario: Solo filename* con tildes y espacios
- **WHEN** el header es `attachment; filename*=UTF-8''Procedimiento%20de%20Inspecci%C3%B3n.docx` y no hay `filename=`
- **THEN** la función retorna `"Procedimiento de Inspección.docx"` (decodificado)

#### Scenario: Ambos presentes — gana filename*
- **WHEN** el header es `attachment; filename=Procedimiento.docx; filename*=UTF-8''Procedimiento%20de%20Inspecci%C3%B3n.docx`
- **THEN** la función retorna el valor decodificado de `filename*`, no el de `filename`

#### Scenario: Header vacío usa el fallback
- **WHEN** el header es `undefined` o una cadena vacía
- **THEN** la función retorna el valor de `fallback` sin modificarlo
