## ADDED Requirements

### Requirement: areaFormSchema valida los campos del formulario de Área

El sistema SHALL exportar `areaFormSchema` (y su tipo inferido `AreaFormInput`) desde `src/features/areas/schemas/areaForm.schema.ts`, con los siguientes campos:
- `nombre`: `string`, requerido, mínimo 3 caracteres.
- `descripcion`: `string`, opcional.

#### Scenario: Área válida con solo nombre pasa la validación

- **WHEN** se valida `{ nombre: 'Patio de Concentrado' }`
- **THEN** `areaFormSchema.safeParse(...)` retorna `success: true`

#### Scenario: Área válida con nombre y descripcion pasa la validación

- **WHEN** se valida `{ nombre: 'Patio de Concentrado', descripcion: 'Zona de acopio temporal de concentrado antes de despacho' }`
- **THEN** `areaFormSchema.safeParse(...)` retorna `success: true`

#### Scenario: nombre con menos de 3 caracteres es rechazado

- **WHEN** se valida `{ nombre: 'Pa' }`
- **THEN** `areaFormSchema.safeParse(...)` retorna `success: false` con un error asociado al campo `nombre`

#### Scenario: nombre vacío es rechazado

- **WHEN** se valida `{ nombre: '' }`
- **THEN** `areaFormSchema.safeParse(...)` retorna `success: false` con un error asociado al campo `nombre`

---

### Requirement: Validación de unicidad de nombre no case-sensitive (RN-ARE-004)

El flujo de alta y edición de Área SHALL validar que `nombre` no exista ya en el store de áreas, comparando sin distinguir mayúsculas/minúsculas (p. ej. `'Almacén Norte'` y `'almacén norte'` SHALL considerarse duplicados). Esta validación SHALL ocurrir en el handler MSW de creación/edición (`POST /api/areas`, `PATCH /api/areas/:id`), no solo client-side, retornando un error `409` con un mensaje descriptivo si el nombre ya existe. La comparación SHALL excluir el propio registro cuando se trata de una edición (un Área puede guardarse sin cambiar su propio nombre).

#### Scenario: Crear un Área con nombre duplicado (distinta capitalización) es rechazada

- **WHEN** ya existe un Área con `nombre: 'Almacén Norte'` y se realiza `POST /api/areas` con `{ nombre: 'almacén norte' }`
- **THEN** la respuesta es `409` con un mensaje indicando que el nombre ya está en uso

#### Scenario: Editar un Área conservando su propio nombre no es rechazado

- **WHEN** se realiza `PATCH /api/areas/:id` sobre un Área existente con `{ nombre: 'Almacén Norte', descripcion: 'Descripción actualizada' }`, sin cambiar el `nombre` respecto al valor actual
- **THEN** la respuesta es `200`, no `409`

#### Scenario: Crear un Área con nombre no duplicado es aceptada

- **WHEN** no existe ningún Área con `nombre: 'Patio de Concentrado'` (en ninguna capitalización) y se realiza `POST /api/areas` con ese nombre
- **THEN** la respuesta es `201`
