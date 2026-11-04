## MODIFIED Requirements

### Requirement: Cliente de IA con salida estructurada
`IAsistenteCausaRaizClient.SugerirAsync(ContextoQE ctx, string metodo, CancellationToken ct)` SHALL llamar a la API de Messages de Claude con:
- el modelo configurado;
- un system prompt fijo en español: asistente de análisis de causa raíz para un operador logístico de minerales bajo ISO 9001 e ISO 45001; responde siempre en español; las acciones describen la acción, no el problema; no inventa datos personales ni nombres. El prompt SHALL agregar el bloque del método: con `5_PORQUES`, 5 porqués encadenados; con `ISHIKAWA`, completar las 6 categorías del diagrama de Ishikawa (Método, Máquina, Material, Mano de obra, Medición, Medio ambiente) una vez cada una y, si una categoría no aplica, indicarlo explícitamente con una frase breve en lugar de inventar una causa;
- una salida estructurada JSON (`output_config.format`) cuyo esquema depende del método:
  - `5_PORQUES`: `causaRaizProbable`, `cincoPorques[{pregunta, respuesta}]` y `accionesSugeridas`;
  - `ISHIKAWA`: `causaRaizProbable`, `ishikawa[{categoria, causa}]` y `accionesSugeridas`, con `categoria` como `enum` de los 6 literales de `IshikawaCategoria`;
  - en ambos, `accionesSugeridas[{descripcion, tipo ∈ CORRECTIVA|PREVENTIVA|MEJORA, rolResponsableSugerido, plazoDiasHabiles}]`.

El cliente SHALL validar en el servidor que `causaRaizProbable` tenga de 100 a 500 caracteres, de 2 a 3 acciones y descripciones de 50 a 500 caracteres, y según el método:
- `5_PORQUES`: exactamente 5 porqués completos;
- `ISHIKAWA`: exactamente 6 ítems, con las 6 categorías sin repetir, ninguna categoría desconocida y ninguna `causa` vacía. La categoría se parsea sin distinguir mayúsculas y la causa se recorta.

La `SugerenciaCausaRaiz` devuelta SHALL traer exactamente uno de `CincoPorques` o `Ishikawa` (el otro `null`). La llamada SHALL cortarse a los `TimeoutSeconds` y no SHALL reintentarse. SHALL lanzar `AsistenteIANoDisponibleException` ante:
- un timeout;
- un 5xx o un 429;
- un `stop_reason` que no sea un fin normal (`refusal`, `max_tokens`);
- una respuesta que no cumple el esquema.

El log SHALL incluir el tipo de falla y el status HTTP, nunca la clave ni el contenido del prompt.

#### Scenario: Respuesta válida
- **WHEN** la API devuelve un JSON que cumple el esquema de 5 Porqués
- **THEN** el cliente devuelve una `SugerenciaCausaRaiz` con causa, 5 porqués y acciones, e `Ishikawa = null`

#### Scenario: Esquema de Ishikawa en el pedido
- **WHEN** se consulta con `metodo = ISHIKAWA`
- **THEN** el request enviado a la API lleva un esquema con `required` = `causaRaizProbable`, `ishikawa`, `accionesSugeridas` y el `enum` de las 6 categorías

#### Scenario: Ishikawa válido
- **WHEN** la API devuelve 6 categorías distintas con causa
- **THEN** el cliente devuelve `Ishikawa` con 6 ítems y `CincoPorques = null`

#### Scenario: Ishikawa inválido
- **WHEN** la API devuelve 5 categorías, una categoría repetida, una causa vacía o una categoría desconocida
- **THEN** el cliente lanza `AsistenteIANoDisponibleException`

#### Scenario: Esquema inválido
- **WHEN** la API devuelve 4 porqués o una causa de 50 caracteres
- **THEN** el cliente lanza `AsistenteIANoDisponibleException`

#### Scenario: Error HTTP o timeout
- **WHEN** la API responde 500, 429 o no responde dentro de `TimeoutSeconds`
- **THEN** el cliente lanza `AsistenteIANoDisponibleException` y el log no contiene la clave

### Requirement: Consulta al asistente IA de un QE
El sistema SHALL exponer `POST /api/quality-events/{id}/asistente-ia`, autenticado, con un body opcional `{ metodo?: "5_PORQUES" | "ISHIKAWA" }`. El método efectivo SHALL ser `metodo` si viene; si no, `qe.MetodoAnalisis`; si ese también es null, `5_PORQUES`. Un `metodo` con otro valor SHALL responder 400 antes de cualquier otra validación. Luego valida en este orden:
1. Un QE inexistente o de otra empresa responde 404.
2. Un actor que no es `JEFE_CALIDAD_SYST` ni `qe.ResponsableInvestigacionId` responde 403.
3. Un estado distinto de `EN_INVESTIGACION`/`ANALISIS_COMPLETADO` responde 422 `ANALISIS_NO_EDITABLE`; con `causaRaizFirmadaEn` definido responde 422 `CAUSA_RAIZ_FIRMADA`.
4. Con `Proveedor = "Anthropic"` y sin `ApiKey`, responde 503 `IA_NO_CONFIGURADA` (con `Proveedor = "Simulado"` la clave no hace falta).
5. Si el QE ya tiene `MaxLlamadasPorQEPorDia` entradas `ASISTENTE_IA_CONSULTADO` en el día calendario actual de `America/Lima`, responde 429 `IA_LIMITE_DIARIO`. El límite cuenta todas las consultas, sin distinguir el método.
6. Si el cliente lanza `AsistenteIANoDisponibleException`, responde 503 `IA_NO_DISPONIBLE` con el mensaje "El asistente no está disponible en este momento. Puedes completar el análisis manualmente."

En éxito:
- SHALL responder 200 con `{ causaRaizProbable, cincoPorques, ishikawa, accionesSugeridas, modelo, generadoEn }`, donde solo uno de `cincoPorques`/`ishikawa` tiene valor, según el método efectivo;
- SHALL NOT modificar ningún campo del QE;
- SHALL agregar al audit trail una entrada `ASISTENTE_IA_CONSULTADO` con `GeneradoPorIA = true`, el actor y `ValorNuevo = "<modelo> · <metodo>"`.

Las consultas fallidas no se registran ni cuentan para el límite.

#### Scenario: Sugerencia exitosa
- **WHEN** el JCA consulta un QE en EN_INVESTIGACION sin body y la API devuelve una respuesta válida
- **THEN** responde 200 con causa, 5 porqués y acciones, `ishikawa = null`, el QE no cambia y el audit trail tiene `ASISTENTE_IA_CONSULTADO` con `generadoPorIA: true` y `valorNuevo = "claude-sonnet-5-5 · 5_PORQUES"`

#### Scenario: Sugerencia de Ishikawa
- **WHEN** el JCA consulta con `{ metodo: "ISHIKAWA" }` y la API devuelve un Ishikawa válido
- **THEN** responde 200 con `ishikawa` (6) y `cincoPorques = null`

#### Scenario: Método por defecto desde el QE
- **WHEN** el QE tiene `metodoAnalisis = ISHIKAWA` y se consulta sin body
- **THEN** el pedido a la API usa el esquema de Ishikawa

#### Scenario: Método inválido
- **WHEN** se consulta con `{ metodo: "PARETO" }`
- **THEN** responde 400 y no llama a la API

#### Scenario: Responsable asignado
- **WHEN** el SUPERVISOR responsable del QE consulta
- **THEN** responde 200

#### Scenario: Otro SUPERVISOR
- **WHEN** un SUPERVISOR que no es el responsable consulta
- **THEN** responde 403

#### Scenario: Causa raíz firmada
- **WHEN** el QE tiene la causa raíz aprobada
- **THEN** responde 422 con `errorCode = CAUSA_RAIZ_FIRMADA`

#### Scenario: Otra empresa
- **WHEN** el QE es de otra empresa
- **THEN** responde 404

#### Scenario: IA caída
- **WHEN** la API responde 500
- **THEN** el endpoint responde 503 con `errorCode = IA_NO_DISPONIBLE` y no registra audit

#### Scenario: Sin clave
- **WHEN** `Proveedor = "Anthropic"` y `ApiKey` está vacía
- **THEN** responde 503 con `errorCode = IA_NO_CONFIGURADA`

#### Scenario: Límite diario
- **WHEN** el QE ya tiene `MaxLlamadasPorQEPorDia` consultas exitosas hoy (hora de Lima)
- **THEN** la siguiente responde 429 con `errorCode = IA_LIMITE_DIARIO` sin llamar a la API

### Requirement: Proveedor simulado para pruebas sin costo
Con `Anthropic:Proveedor = "Simulado"` el backend SHALL resolver `IAsistenteCausaRaizClient` como `AsistenteCausaRaizSimulado` en lugar del cliente real. El simulado:
- SHALL NOT hacer ninguna llamada de red ni requerir `ApiKey`;
- SHALL esperar unos 800 ms y devolver una `SugerenciaCausaRaiz` fija en español que cumple el mismo esquema que la real: `causaRaizProbable` de 100 a 500 caracteres que menciona el `tipo` y el nombre del área del contexto, y 3 acciones, una de cada tipo (CORRECTIVA, PREVENTIVA, MEJORA), con descripciones de 50 a 500 caracteres;
- con `5_PORQUES`, SHALL devolver 5 porqués completos e `Ishikawa = null`;
- con `ISHIKAWA`, SHALL devolver 6 causas fijas, una por categoría, coherentes con el tipo y el área, con al menos una que use la frase de "no aplica" ("No se identifican causas en esta categoría para este evento"), y `CincoPorques = null`;
- SHALL devolver `modelo = "simulado"`, que el endpoint guarda en `ValorNuevo` de `ASISTENTE_IA_CONSULTADO` junto con el método (`"simulado · <metodo>"`);
- SHALL lanzar `AsistenteIANoDisponibleException` si `descripcion` o `descripcionAmpliada` contiene `[simular-error-ia]`, con cualquiera de los dos métodos, de modo que el endpoint responda 503 `IA_NO_DISPONIBLE`.

Si la app arranca con `ASPNETCORE_ENVIRONMENT = Production` y `Proveedor = "Simulado"`, SHALL registrar un warning y SHALL NOT bloquear el arranque.

#### Scenario: Sugerencia simulada sin clave
- **WHEN** `Proveedor = "Simulado"`, `ApiKey` está vacía y el JCA consulta un QE en EN_INVESTIGACION
- **THEN** responde 200 con una sugerencia que cumple el esquema, `modelo = "simulado"`, ninguna llamada HTTP saliente y `ASISTENTE_IA_CONSULTADO` con `ValorNuevo = "simulado · 5_PORQUES"`

#### Scenario: Ishikawa simulado
- **WHEN** `Proveedor = "Simulado"` y se consulta con `{ metodo: "ISHIKAWA" }`
- **THEN** responde 200 con 6 categorías distintas, al menos una con la frase de "no aplica", sin llamadas HTTP, y el audit registra `"simulado · ISHIKAWA"`

#### Scenario: Error simulado
- **WHEN** `Proveedor = "Simulado"` y la descripción del QE contiene `[simular-error-ia]`
- **THEN** responde 503 con `errorCode = IA_NO_DISPONIBLE` y no registra audit
