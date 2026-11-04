## ADDED Requirements

### Requirement: Badge "Sin QE vinculado" explica el plazo para vincular un QE (RN-INC-006)
`IncidentList` SHALL renderizar `IncidentSinQEBadge` para cada fila, pasando el nivel calculado por `getIncidentQEAlertLevel(inc)` y el detalle del plazo calculado por `getIncidentQEPlazoInfo(inc)`. `getIncidentQEPlazoInfo(incidente, now)` SHALL ser una función pura en `features/incidents/utils/incidentQEAlert.ts` que devuelva `{ plazoHoras, horasRestantes }`: `plazoHoras = PLAZO_QE_HORAS[tipo]`, y `horasRestantes = Math.floor(plazoHoras - horasTranscurridasDesde(fechaEvento))`, negativo cuando el plazo ya venció. La firma y el resultado de `getIncidentQEAlertLevel` SHALL NOT cambiar. El badge SHALL mostrar el mismo texto en `title` y en `aria-label`: con AMARILLO, `t('incidents:list.sinQEBadge.tooltip.AMARILLO', { plazo, restante })`; con ROJO, `t('incidents:list.sinQEBadge.tooltip.ROJO', { plazo, vencido })`. La duración SHALL formatearse como `X h` si es menor a 48 h y como `X d Y h` si es de 48 h o más, usando claves i18n, sin librerías nuevas. El texto SHALL referirse al plazo para vincular un QE, nunca al "plazo de investigación".

#### Scenario: Plazo por tipo
- **WHEN** se llama `getIncidentQEPlazoInfo` con un incidente de cada tipo
- **THEN** `plazoHoras` es 24 para ACCIDENTE, 48 para INCIDENTE, 72 para CUASI_ACCIDENTE y 48 para CONDICION_INSEGURA

#### Scenario: Horas restantes antes y después del vencimiento
- **WHEN** un INCIDENTE (48 h) tiene `fechaEvento` hace 40 h con un `now` fijo
- **THEN** `horasRestantes` es 8
- **WHEN** el mismo incidente tiene `fechaEvento` hace 50 h
- **THEN** `horasRestantes` es -2

#### Scenario: Tooltip AMARILLO
- **WHEN** el badge se renderiza con nivel AMARILLO para un INCIDENTE al que le faltan 8 h
- **THEN** `title` y `aria-label` dicen "Plazo para vincular un QE: 48 h · vence en 8 h"

#### Scenario: Tooltip ROJO con días
- **WHEN** el badge se renderiza con nivel ROJO para un ACCIDENTE vencido hace 50 h
- **THEN** `title` y `aria-label` dicen "Plazo para vincular un QE: 24 h · vencido hace 2 d 2 h"

#### Scenario: Sin alerta no hay badge
- **WHEN** el nivel es NONE
- **THEN** el badge no renderiza nada
