## MODIFIED Requirements

### Requirement: Trazabilidad de sugerencias IA en el PATCH genérico
`PATCH /api/quality-events/:id` SHALL aceptar un campo opcional `origenIA: { causaRaiz?: 'IA' | 'IA_EDITADO', cincoPorques?: 'IA' | 'IA_EDITADO', ishikawa?: 'IA' | 'IA_EDITADO' }`; cualquier otro valor SHALL responder 400. Al registrar `CAMPO_EDITADO` de `causaRaizDefinitiva`, `cincoPorques` o `ishikawa`:
- con origen `IA`, la entrada SHALL tener `GeneradoPorIA = true`;
- con `IA_EDITADO`, SHALL tener `GeneradoPorIA = false` y un `ValorNuevo` terminado en " (sugerencia IA editada)";
- sin origen, el comportamiento no cambia (`GeneradoPorIA = false`).

`origenIA` SHALL NOT alterar los permisos ni las validaciones del análisis (JCA o responsable, estado editable, causa raíz no firmada). RNG-004: la sugerencia solo se vuelve definitiva con la aprobación con PIN del JCA (`aprobar-causa-raiz`).

#### Scenario: Causa raíz sugerida sin editar
- **WHEN** se guarda `causaRaizDefinitiva` con `origenIA.causaRaiz = 'IA'`
- **THEN** la entrada `CAMPO_EDITADO` de `causaRaizDefinitiva` tiene `generadoPorIA: true`

#### Scenario: Sugerencia editada
- **WHEN** se guarda `cincoPorques` con `origenIA.cincoPorques = 'IA_EDITADO'`
- **THEN** la entrada tiene `generadoPorIA: false` y `valorNuevo` termina en "(sugerencia IA editada)"

#### Scenario: Ishikawa sugerido sin editar
- **WHEN** se guarda `ishikawa` con `metodoAnalisis = ISHIKAWA` y `origenIA.ishikawa = 'IA'`
- **THEN** la entrada `CAMPO_EDITADO` de `ishikawa` tiene `generadoPorIA: true`

#### Scenario: Ishikawa editado
- **WHEN** se guarda `ishikawa` con `origenIA.ishikawa = 'IA_EDITADO'`
- **THEN** la entrada tiene `generadoPorIA: false` y `valorNuevo` termina en "(sugerencia IA editada)"

#### Scenario: Valor inválido
- **WHEN** `origenIA.causaRaiz = 'OTRO'` u `origenIA.ishikawa = 'OTRO'`
- **THEN** responde 400 y el QE no cambia
