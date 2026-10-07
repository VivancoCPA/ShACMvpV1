## ADDED Requirements

### Requirement: Helper compartido de nivel de alerta de revisión periódica
El sistema SHALL exponer `getRevisionPeriodicaNivel(diasRestantes: number): 'ok' | 'proximo' | 'vencido'` (en `features/documents/utils/`, o módulo equivalente), con el mismo umbral que `RevisionSemaforo` (`DOC_REVISION_ALERT_DAYS`, 30 días): `'ok'` si `diasRestantes > 30`, `'vencido'` si `diasRestantes <= 0`, `'proximo'` en cualquier otro caso. `RevisionSemaforo` y el aviso del detalle (`document-detail`, "DocumentDetailHeader contextual banners") SHALL consumir este helper en vez de reimplementar los umbrales por separado.

#### Scenario: Más de 30 días es 'ok'
- **WHEN** `diasRestantes` es 31 o más
- **THEN** `getRevisionPeriodicaNivel` retorna `'ok'`

#### Scenario: Entre 1 y 30 días es 'proximo'
- **WHEN** `diasRestantes` está entre 1 y 30
- **THEN** `getRevisionPeriodicaNivel` retorna `'proximo'`

#### Scenario: Cero o negativo es 'vencido'
- **WHEN** `diasRestantes` es 0 o negativo
- **THEN** `getRevisionPeriodicaNivel` retorna `'vencido'`

#### Scenario: RevisionSemaforo usa el helper para su primer corte
- **WHEN** `RevisionSemaforo` calcula el color verde (más de 30 días)
- **THEN** usa `getRevisionPeriodicaNivel(diasRestantes) === 'ok'`, no una comparación duplicada contra `DOC_REVISION_ALERT_DAYS`
