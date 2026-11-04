## ADDED Requirements

### Requirement: Nombre de quien reportó en `Incidente`
La interfaz `Incidente` SHALL declarar `reportadoPorNombre?: string`, junto a los campos ya existentes `localNombre?` y `zonaNombre?`. Los tres son campos de lectura que entrega la API y nunca se envían al crear o actualizar.

#### Scenario: Tipo acepta los nombres
- **WHEN** se tipa un objeto `Incidente` con `reportadoPorNombre`, `localNombre` y `zonaNombre`
- **THEN** TypeScript compila sin error, y también compila si los tres faltan
