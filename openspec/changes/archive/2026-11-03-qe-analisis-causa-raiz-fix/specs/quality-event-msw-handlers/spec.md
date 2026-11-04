## ADDED Requirements

### Requirement: MSW replica el análisis tipado y la aprobación con PIN
`PATCH /api/quality-events/:id` en `quality-events.handlers.ts` SHALL aceptar `cincoPorques`/`ishikawa` como listas y devolverlas como listas. Al guardar con un `metodoAnalisis`, SHALL poner en null la lista de la otra herramienta, y SHALL ignorar `causaRaizAprobadaPorId` y `causaRaizFirmadaEn` del body.

`POST /api/quality-events/:id/aprobar-causa-raiz` SHALL responder:
- 404 si el QE no existe o es de otra empresa;
- 403 si el usuario mock no es `JEFE_CALIDAD_SYST`;
- 422 `CAUSA_RAIZ_INVALIDA` si la causa raíz guardada no tiene entre 100 y 500 caracteres;
- 422 `CAUSA_RAIZ_FIRMADA` si ya está firmada;
- 422 `PIN_NO_CONFIGURADO` si el firmante no tiene PIN en `getUsersStore()`;
- 401 `PIN_INCORRECTO` si el PIN no coincide.

En éxito, SHALL fijar `causaRaizAprobadaPorId` y `causaRaizFirmadaEn`, agregar `CAUSA_RAIZ_APROBADA` al audit trail y responder 200 con el QE. Los fixtures de QE SHALL mantener `cincoPorques` e `ishikawa` como arrays.

#### Scenario: PIN del fixture
- **WHEN** con MSW activo un JCA aprueba con el PIN de su usuario mock
- **THEN** el handler responde 200 y el QE queda con `causaRaizFirmadaEn`

#### Scenario: PIN distinto
- **WHEN** se envía otro PIN
- **THEN** el handler responde 401 con `errorCode = PIN_INCORRECTO`

#### Scenario: No JCA
- **WHEN** un SUPERVISOR llama al endpoint
- **THEN** el handler responde 403

#### Scenario: PATCH ignora la firma
- **WHEN** el body de `PATCH /:id` trae `causaRaizFirmadaEn`
- **THEN** el QE devuelto conserva el valor previo de `causaRaizFirmadaEn`
