# Spec: location-schemas

## Purpose

Define los schemas Zod que validan los formularios de creación/edición de Locales y Zonas dentro del catálogo administrado en M6.

---

## Requirements

### Requirement: localFormSchema valida los campos del formulario de Local
El sistema SHALL exportar `localFormSchema` (y su tipo inferido `LocalFormInput`) desde `src/features/locations/schemas/localForm.schema.ts`, con los siguientes campos:
- `nombre`: `string`, requerido, mínimo 3 caracteres.
- `direccion`: `string`, requerido (mínimo 1 carácter).
- `planoUrl`: validación de archivo `File`, opcional a nivel de tipo pero cuando se provee SHALL cumplir: tipo MIME `image/png` únicamente, y tamaño máximo de 2 MB (RN-LOC-003).
- `planoAncho`: `number`, entero positivo, auto-calculado a partir de las dimensiones naturales de la imagen cargada. No SHALL ser editable por el usuario (no se expone un input para este campo; el formulario lo asigna programáticamente al leer el archivo).
- `planoAlto`: `number`, entero positivo, auto-calculado igual que `planoAncho`.

#### Scenario: Local válido con plano PNG de 1.5MB pasa la validación
- **WHEN** se valida `{ nombre: 'Almacén Sur', direccion: 'Av. Industrial 450', planoUrl: <File png, 1.5MB>, planoAncho: 1200, planoAlto: 800 }`
- **THEN** `localFormSchema.safeParse(...)` retorna `success: true`

#### Scenario: nombre con menos de 3 caracteres es rechazado
- **WHEN** se valida `{ nombre: 'Al', direccion: 'Av. Industrial 450' }`
- **THEN** `localFormSchema.safeParse(...)` retorna `success: false` con un error asociado al campo `nombre`

#### Scenario: direccion vacía es rechazada
- **WHEN** se valida `{ nombre: 'Almacén Sur', direccion: '' }`
- **THEN** `localFormSchema.safeParse(...)` retorna `success: false` con un error asociado al campo `direccion`

#### Scenario: planoUrl que no es PNG es rechazado (RN-LOC-003)
- **WHEN** se valida un `planoUrl` con `File` de tipo `image/jpeg`
- **THEN** `localFormSchema.safeParse(...)` retorna `success: false` con un mensaje indicando que solo se acepta PNG

#### Scenario: planoUrl mayor a 2MB es rechazado (RN-LOC-003)
- **WHEN** se valida un `planoUrl` con `File` de tipo `image/png` y tamaño de 2.1 MB
- **THEN** `localFormSchema.safeParse(...)` retorna `success: false` con un mensaje indicando el límite de 2 MB

#### Scenario: planoUrl de exactamente 2MB pasa la validación
- **WHEN** se valida un `planoUrl` con `File` de tipo `image/png` y tamaño de exactamente 2 * 1024 * 1024 bytes
- **THEN** `localFormSchema.safeParse(...)` retorna `success: true`

---

### Requirement: zonaFormSchema valida los campos del formulario de Zona
El sistema SHALL exportar `zonaFormSchema` (y su tipo inferido `ZonaFormInput`) desde `src/features/locations/schemas/zonaForm.schema.ts`, con los siguientes campos:
- `nombre`: `string`, requerido, mínimo 3 caracteres.
- `descripcion`: `string`, opcional.

#### Scenario: Zona válida con solo nombre pasa la validación
- **WHEN** se valida `{ nombre: 'Zona de Carga' }`
- **THEN** `zonaFormSchema.safeParse(...)` retorna `success: true`

#### Scenario: Zona válida con nombre y descripcion pasa la validación
- **WHEN** se valida `{ nombre: 'Zona de Carga', descripcion: 'Área de carga y descarga de camiones' }`
- **THEN** `zonaFormSchema.safeParse(...)` retorna `success: true`

#### Scenario: nombre con menos de 3 caracteres es rechazado
- **WHEN** se valida `{ nombre: 'Zo' }`
- **THEN** `zonaFormSchema.safeParse(...)` retorna `success: false` con un error asociado al campo `nombre`
