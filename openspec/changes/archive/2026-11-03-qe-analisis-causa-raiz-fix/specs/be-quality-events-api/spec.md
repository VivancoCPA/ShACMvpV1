## MODIFIED Requirements

### Requirement: Edición parcial con `descripcion` bloqueada fuera de ABIERTO
El sistema SHALL exponer `PATCH /api/quality-events/:id` para la actualización parcial de los campos de `QualityEventUpdateInput`: `descripcion`, `areaId`, `turno`, `mineralInvolucrado`, `descripcionAmpliada`, `metodoAnalisis`, `cincoPorques`, `ishikawa`, `causaRaizDefinitiva`, `resultadoCierre`, `plazoVerificacionDias` y `fechaVerificacionProgramada`. El sistema SHALL rechazar cualquier intento de incluir `estado` en el body. El sistema SHALL rechazar con 422 cualquier intento de modificar `descripcion` cuando `estado !== 'ABIERTO'` (RN-QE-006). `causaRaizAprobadaPorId` y `causaRaizFirmadaEn` SHALL NOT formar parte del command: si vienen en el body, se ignoran y no modifican el QE. La única vía para escribirlos es `POST /:id/aprobar-causa-raiz`.

#### Scenario: Actualización parcial exitosa
- **WHEN** un usuario envía un subconjunto de campos permitidos a `PATCH /api/quality-events/:id` de un QE de su empresa
- **THEN** el sistema responde 200 con el QE actualizado y una nueva entrada de audit trail `CAMPO_EDITADO` por cada campo modificado

#### Scenario: Intento de editar `estado` vía PATCH genérico
- **WHEN** el body de `PATCH /:id` incluye `estado`
- **THEN** el sistema ignora ese campo o responde 400, y nunca cambia el `estado` por esta vía

#### Scenario: Edición de `descripcion` fuera de ABIERTO
- **WHEN** un QE en `estado !== 'ABIERTO'` recibe `PATCH /:id` con `descripcion` en el body
- **THEN** el sistema responde 422 sin modificar el QE

#### Scenario: Campos de firma en el PATCH genérico se ignoran
- **WHEN** el body de `PATCH /:id` incluye `causaRaizFirmadaEn` y `causaRaizAprobadaPorId`
- **THEN** `causaRaizFirmadaEn` y `causaRaizAprobadaPorId` del QE no cambian

## ADDED Requirements

### Requirement: Análisis de causa raíz tipado en el PATCH genérico
`PATCH /api/quality-events/:id` SHALL recibir `cincoPorques` como `{ pregunta, respuesta }[]` e `ishikawa` como `{ categoria, causa }[]`, donde `categoria` ∈ {`METODO`, `MAQUINA`, `MATERIAL`, `MANO_DE_OBRA`, `MEDICION`, `MEDIO_AMBIENTE`}. El sistema SHALL guardarlos como JSON (camelCase, enums como string) en las columnas `text` existentes `cinco_porques` e `ishikawa`, sin migración. El validator SHALL exigir:
- `metodoAnalisis` ∈ {`5_PORQUES`, `ISHIKAWA`};
- `cincoPorques` o `ishikawa` solo junto con `metodoAnalisis` y solo la lista de la herramienta activa;
- con `5_PORQUES`, exactamente 5 ítems;
- con `ISHIKAWA`, exactamente 6 ítems con las 6 categorías, sin repetir;
- en ambos casos, un máximo de 2.000 caracteres por `pregunta`, `respuesta` o `causa` (se permiten respuestas vacías mientras el análisis es borrador).

Una violación SHALL responder 400. Al guardar con `metodoAnalisis = 5_PORQUES`, el sistema SHALL poner `ishikawa` en null; con `ISHIKAWA`, SHALL poner `cincoPorques` en null (PRD: una sola herramienta activa por QE). En el audit trail, `cincoPorques` e `ishikawa` SHALL registrarse con un resumen, no con el JSON completo: `5 Porqués actualizado (N de 5 respuestas completas)` o `Ishikawa actualizado (N de 6 categorías completas)`.

#### Scenario: Guardar 5 Porqués
- **WHEN** se envía `metodoAnalisis = 5_PORQUES` con 5 porqués a un QE que tenía Ishikawa
- **THEN** responde 200, el `GET` siguiente devuelve `cincoPorques` idéntico a lo enviado e `ishikawa = null`

#### Scenario: Guardar Ishikawa
- **WHEN** se envía `metodoAnalisis = ISHIKAWA` con las 6 categorías
- **THEN** responde 200, el `GET` siguiente devuelve `ishikawa` idéntico y `cincoPorques = null`

#### Scenario: Estructura inválida
- **WHEN** se envían 4 porqués, 7 categorías, una categoría repetida o `metodoAnalisis = 'OTRO'`
- **THEN** responde 400 y el QE no cambia

#### Scenario: Audit trail con resumen
- **WHEN** se guardan 5 porqués con 3 respuestas no vacías
- **THEN** el audit trail registra `CAMPO_EDITADO` en `cincoPorques` con `ValorNuevo = "5 Porqués actualizado (3 de 5 respuestas completas)"`

### Requirement: Permiso para editar el análisis de causa raíz
Cuando el body de `PATCH /api/quality-events/:id` incluye `metodoAnalisis`, `cincoPorques`, `ishikawa` o `causaRaizDefinitiva`, el sistema SHALL verificar, en este orden:
1. Si el actor no es `JEFE_CALIDAD_SYST` (rol del token) ni `qe.ResponsableInvestigacionId`, responde 403.
2. Si el estado no es `EN_INVESTIGACION` ni `ANALISIS_COMPLETADO`, responde 422 con `errorCode = ANALISIS_NO_EDITABLE`.
3. Si `causaRaizDefinitiva` viene con un valor distinto del guardado y `causaRaizFirmadaEn` ya está definido, responde 422 con `errorCode = CAUSA_RAIZ_FIRMADA`.

#### Scenario: JCA edita
- **WHEN** un JCA guarda el análisis de un QE en EN_INVESTIGACION
- **THEN** responde 200

#### Scenario: SUPERVISOR responsable asignado edita
- **WHEN** el SUPERVISOR que es `responsableInvestigacionId` guarda el análisis de un QE en EN_INVESTIGACION
- **THEN** responde 200

#### Scenario: SUPERVISOR no asignado
- **WHEN** un SUPERVISOR que no es el responsable guarda el análisis
- **THEN** responde 403

#### Scenario: QE en ABIERTO
- **WHEN** un JCA guarda el análisis de un QE en ABIERTO
- **THEN** responde 422 con `errorCode = ANALISIS_NO_EDITABLE`

#### Scenario: Causa raíz ya firmada
- **WHEN** se envía una `causaRaizDefinitiva` distinta para un QE con la causa raíz firmada
- **THEN** responde 422 con `errorCode = CAUSA_RAIZ_FIRMADA`

### Requirement: Lectura del análisis como arrays, tolerante a datos viejos
Toda respuesta que serialice la entidad `QualityEvent` (detalle, listado y endpoints de escritura) SHALL exponer `cincoPorques` e `ishikawa` como arrays (o null), nunca como texto. Las columnas crudas SHALL quedar fuera del JSON (`[JsonIgnore]`). Si el texto guardado no es JSON válido para la forma esperada, SHALL exponerse como `null`, sin 500, y `GET /api/quality-events/:id` SHALL registrar un `LogWarning` con el id del QE.

#### Scenario: Dato viejo no-JSON
- **WHEN** `cinco_porques` contiene el texto `"porque sí"` y se pide el detalle del QE
- **THEN** responde 200 con `cincoPorques: null`

### Requirement: Aprobación de la causa raíz con PIN verificado (RN-QE-002)
El sistema SHALL exponer `POST /api/quality-events/{id}/aprobar-causa-raiz`, autenticado, con body `{ pin }` (validado como 4 dígitos, 400 si no lo es). Validará, en este orden:
1. Un QE inexistente o de otra empresa responde 404.
2. Un actor que no es `JEFE_CALIDAD_SYST` responde 403.
3. Un estado distinto de `EN_INVESTIGACION` o `ANALISIS_COMPLETADO` responde 422.
4. Si la `causaRaizDefinitiva` guardada (con trim) no tiene entre 100 y 500 caracteres, responde 422 con `errorCode = CAUSA_RAIZ_INVALIDA`.
5. Si `causaRaizFirmadaEn` ya está definido, responde 422 con `errorCode = CAUSA_RAIZ_FIRMADA`.
6. Si el actor no tiene `PinHash`, responde 422 con `errorCode = PIN_NO_CONFIGURADO`. Si el PIN no coincide (`IPasswordHasher<ShacUser>`), responde 401 con `errorCode = PIN_INCORRECTO`.

En éxito, el sistema SHALL fijar `CausaRaizAprobadaPorId = actorId`, `CausaRaizFirmadaEn = DateTime.UtcNow` y `ActualizadoEn`, registrar en el audit trail `Accion = CAUSA_RAIZ_APROBADA` con `ValorNuevo` = los primeros 100 caracteres de la causa raíz, y responder 200 con el QE actualizado.

#### Scenario: JCA con PIN correcto
- **WHEN** un JCA con PIN configurado aprueba una causa raíz guardada de 150 caracteres con el PIN correcto
- **THEN** responde 200, el QE queda con `causaRaizAprobadaPorId` = el JCA y `causaRaizFirmadaEn` = la hora del servidor, y el audit trail contiene `CAUSA_RAIZ_APROBADA`

#### Scenario: PIN incorrecto
- **WHEN** el PIN no coincide
- **THEN** responde 401 con `errorCode = PIN_INCORRECTO` y el QE no cambia

#### Scenario: Sin PIN configurado
- **WHEN** el JCA no tiene `PinHash`
- **THEN** responde 422 con `errorCode = PIN_NO_CONFIGURADO`

#### Scenario: SUPERVISOR intenta aprobar
- **WHEN** un SUPERVISOR, aunque sea el responsable asignado, llama al endpoint
- **THEN** responde 403

#### Scenario: Causa raíz corta
- **WHEN** la causa raíz guardada tiene menos de 100 caracteres
- **THEN** responde 422 con `errorCode = CAUSA_RAIZ_INVALIDA`

#### Scenario: Ya firmada
- **WHEN** la causa raíz ya fue aprobada
- **THEN** responde 422 con `errorCode = CAUSA_RAIZ_FIRMADA`

#### Scenario: Otra empresa
- **WHEN** el QE pertenece a otra empresa
- **THEN** responde 404

#### Scenario: Avance a EN_EJECUCION tras aprobar
- **WHEN** la causa raíz de un QE en ANALISIS_COMPLETADO se aprueba por este endpoint y luego se pide `PATCH /:id/status { nuevoEstado: 'EN_EJECUCION' }`
- **THEN** la transición responde 200 (RN-QE-002 satisfecha)
