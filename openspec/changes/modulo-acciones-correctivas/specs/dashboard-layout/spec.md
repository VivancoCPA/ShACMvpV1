## ADDED Requirements

### Requirement: AlertaCard admite el nivel success
`AlertaNivel` SHALL incluir `'success'`. Con `valor > 0`, una `AlertaCard` de nivel `success` SHALL usar:
- fondo `bg-success/10` (`dark:bg-success/15`);
- número `text-success` (con variante `dark:`);
- anillo de seleccionada `ring-success`.

Con `valor === 0` usa el estilo neutro, como los demás niveles.

#### Scenario: Nivel success
- **WHEN** `AlertaCard` recibe `valor: 4`, `nivel: 'success'`
- **THEN** la tarjeta usa `bg-success/10` y `data-nivel="success"`
