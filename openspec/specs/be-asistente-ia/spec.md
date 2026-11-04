# be-asistente-ia Specification

## Purpose
Backend del asistente de IA para el análisis de causa raíz de un Quality Event (PRD §1.7, QE-AC-005): configuración `Anthropic` sin clave en el repositorio, cliente de Claude con salida estructurada, proveedor simulado sin costo, endpoint de consulta con permisos, minimización de datos, límite diario y audit trail, y endpoint de funcionalidades.
## Requirements
### Requirement: Configuración `Anthropic` sin clave en el repositorio
El backend SHALL leer la sección `Anthropic` (`Proveedor`, `ApiKey`, `Model`, `MaxTokens`, `TimeoutSeconds`, `MaxLlamadasPorQEPorDia`) en `AnthropicOptions` vía `IOptions<>`. `appsettings.json` SHALL declarar la sección con `Proveedor = "Anthropic"`, `ApiKey` vacía, `Model = "claude-sonnet-5-5"`, `MaxTokens = 2000`, `TimeoutSeconds = 15` y `MaxLlamadasPorQEPorDia = 10`. La clave SHALL provenir solo de `user-secrets` (desarrollo) o de la variable `Anthropic__ApiKey`. Con `Proveedor = "Anthropic"` y `ApiKey` vacía, la app SHALL arrancar sin error y la funcionalidad SHALL quedar desactivada. `appsettings.Development.json.example` SHALL sugerir `Proveedor = "Simulado"` para desarrollo. Ningún `appsettings*.json` versionado SHALL contener una clave.

#### Scenario: Arranque sin clave
- **WHEN** la app arranca con `Proveedor = "Anthropic"` y `Anthropic:ApiKey` vacía
- **THEN** arranca normalmente y `GET /api/config/funcionalidades` devuelve `asistenteIA: false`

#### Scenario: Repositorio sin clave
- **WHEN** se buscan claves (`sk-ant`) en los `appsettings*.json` versionados
- **THEN** no hay coincidencias

### Requirement: Endpoint de funcionalidades
El sistema SHALL exponer `GET /api/config/funcionalidades`, autenticado, que responde 200 con `{ asistenteIA: boolean, asistenteIASimulado: boolean }`. `asistenteIA` SHALL ser `true` si `Anthropic:ApiKey` no está vacía **o** si `Proveedor = "Simulado"`; `asistenteIASimulado` SHALL ser `true` solo con `Proveedor = "Simulado"`.

#### Scenario: Con clave configurada
- **WHEN** `Anthropic:ApiKey` tiene valor y un usuario autenticado consulta el endpoint
- **THEN** responde 200 con `asistenteIA: true` y `asistenteIASimulado: false`

#### Scenario: Modo simulado sin clave
- **WHEN** `Proveedor = "Simulado"`, `ApiKey` está vacía y un usuario autenticado consulta el endpoint
- **THEN** responde 200 con `asistenteIA: true` y `asistenteIASimulado: true`

#### Scenario: Sin autenticación
- **WHEN** se llama sin token
- **THEN** responde 401

### Requirement: Cliente de IA con salida estructurada
`IAsistenteCausaRaizClient.SugerirAsync(ContextoQE ctx, CancellationToken ct)` SHALL llamar a la API de Messages de Claude con:
- el modelo configurado;
- un system prompt fijo en español: asistente de análisis de causa raíz para un operador logístico de minerales bajo ISO 9001 e ISO 45001; responde siempre en español; las acciones describen la acción, no el problema; no inventa datos personales ni nombres;
- una salida estructurada JSON con `causaRaizProbable`, `cincoPorques[{pregunta, respuesta}]` y `accionesSugeridas[{descripcion, tipo ∈ CORRECTIVA|PREVENTIVA|MEJORA, rolResponsableSugerido, plazoDiasHabiles}]`.

El cliente SHALL validar en el servidor que `causaRaizProbable` tenga de 100 a 500 caracteres, que haya exactamente 5 porqués, de 2 a 3 acciones, y descripciones de 50 a 500 caracteres. La llamada SHALL cortarse a los `TimeoutSeconds` y no SHALL reintentarse. SHALL lanzar `AsistenteIANoDisponibleException` ante:
- un timeout;
- un 5xx o un 429;
- un `stop_reason` que no sea un fin normal (`refusal`, `max_tokens`);
- una respuesta que no cumple el esquema.

El log SHALL incluir el tipo de falla y el status HTTP, nunca la clave ni el contenido del prompt.

#### Scenario: Respuesta válida
- **WHEN** la API devuelve un JSON que cumple el esquema
- **THEN** el cliente devuelve una `SugerenciaCausaRaiz` con los tres bloques

#### Scenario: Esquema inválido
- **WHEN** la API devuelve 4 porqués o una causa de 50 caracteres
- **THEN** el cliente lanza `AsistenteIANoDisponibleException`

#### Scenario: Error HTTP o timeout
- **WHEN** la API responde 500, 429 o no responde dentro de `TimeoutSeconds`
- **THEN** el cliente lanza `AsistenteIANoDisponibleException` y el log no contiene la clave

### Requirement: Consulta al asistente IA de un QE
El sistema SHALL exponer `POST /api/quality-events/{id}/asistente-ia`, autenticado, que valida en este orden:
1. Un QE inexistente o de otra empresa responde 404.
2. Un actor que no es `JEFE_CALIDAD_SYST` ni `qe.ResponsableInvestigacionId` responde 403.
3. Un estado distinto de `EN_INVESTIGACION`/`ANALISIS_COMPLETADO` responde 422 `ANALISIS_NO_EDITABLE`; con `causaRaizFirmadaEn` definido responde 422 `CAUSA_RAIZ_FIRMADA`.
4. Con `Proveedor = "Anthropic"` y sin `ApiKey`, responde 503 `IA_NO_CONFIGURADA` (con `Proveedor = "Simulado"` la clave no hace falta).
5. Si el QE ya tiene `MaxLlamadasPorQEPorDia` entradas `ASISTENTE_IA_CONSULTADO` en el día calendario actual de `America/Lima`, responde 429 `IA_LIMITE_DIARIO`.
6. Si el cliente lanza `AsistenteIANoDisponibleException`, responde 503 `IA_NO_DISPONIBLE` con el mensaje "El asistente no está disponible en este momento. Puedes completar el análisis manualmente."

En éxito:
- SHALL responder 200 con `{ causaRaizProbable, cincoPorques, accionesSugeridas, modelo, generadoEn }`;
- SHALL NOT modificar ningún campo del QE;
- SHALL agregar al audit trail una entrada `ASISTENTE_IA_CONSULTADO` con `GeneradoPorIA = true`, el actor y `ValorNuevo` = el modelo usado.

Las consultas fallidas no se registran ni cuentan para el límite.

#### Scenario: Sugerencia exitosa
- **WHEN** el JCA consulta un QE en EN_INVESTIGACION y la API devuelve una respuesta válida
- **THEN** responde 200 con los tres bloques, el QE no cambia y el audit trail tiene `ASISTENTE_IA_CONSULTADO` con `generadoPorIA: true`

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

### Requirement: Minimización de datos enviados a la IA (PRD §1.7)
El contexto enviado SHALL contener solo:
- **del QE:** `tipo`, `severidad`, `origen`, el nombre del área (nunca su id), `mineralInvolucrado`, `descripcion` y `descripcionAmpliada`;
- **del incidente de origen**, si existe y es de la misma empresa: `tipo`, `huboLesionados`, `numPersonasAfectadas`, `condicionesEntorno` y `equiposInvolucrados`;
- **QEs similares:** hasta 5, de la **misma empresa** y la **misma área**, de los últimos 12 meses, no eliminados, distintos del actual y con causa raíz aprobada. De cada uno, solo `tipo`, `descripcion` (recortada a 300 caracteres) y `causaRaizDefinitiva`.

El request SHALL NOT contener `personalInvolucrado`, `testigos`, nombres, emails ni ids de usuarios.

#### Scenario: Sin datos personales
- **WHEN** el QE viene de un incidente con `personalInvolucrado` y `testigos` cargados
- **THEN** el body enviado a la API no contiene esos valores, ni el nombre, email o id de ningún usuario

#### Scenario: QEs similares acotados a la empresa y el área
- **WHEN** existen 7 QEs aprobados en la misma área y empresa, y otros en otra empresa
- **THEN** el contexto incluye como máximo 5, todos de la misma empresa y área, y contiene el nombre del área

### Requirement: Proveedor simulado para pruebas sin costo
Con `Anthropic:Proveedor = "Simulado"` el backend SHALL resolver `IAsistenteCausaRaizClient` como `AsistenteCausaRaizSimulado` en lugar del cliente real. El simulado:
- SHALL NOT hacer ninguna llamada de red ni requerir `ApiKey`;
- SHALL esperar unos 800 ms y devolver una `SugerenciaCausaRaiz` fija en español que cumple el mismo esquema que la real: `causaRaizProbable` de 100 a 500 caracteres que menciona el `tipo` y el nombre del área del contexto, 5 porqués completos y 3 acciones, una de cada tipo (CORRECTIVA, PREVENTIVA, MEJORA), con descripciones de 50 a 500 caracteres;
- SHALL devolver `modelo = "simulado"`, que el endpoint guarda como `ValorNuevo` de `ASISTENTE_IA_CONSULTADO`;
- SHALL lanzar `AsistenteIANoDisponibleException` si `descripcion` o `descripcionAmpliada` contiene `[simular-error-ia]`, de modo que el endpoint responda 503 `IA_NO_DISPONIBLE`.

Si la app arranca con `ASPNETCORE_ENVIRONMENT = Production` y `Proveedor = "Simulado"`, SHALL registrar un warning y SHALL NOT bloquear el arranque.

#### Scenario: Sugerencia simulada sin clave
- **WHEN** `Proveedor = "Simulado"`, `ApiKey` está vacía y el JCA consulta un QE en EN_INVESTIGACION
- **THEN** responde 200 con una sugerencia que cumple el esquema, `modelo = "simulado"`, ninguna llamada HTTP saliente y `ASISTENTE_IA_CONSULTADO` con `ValorNuevo = "simulado"`

#### Scenario: Error simulado
- **WHEN** `Proveedor = "Simulado"` y la descripción del QE contiene `[simular-error-ia]`
- **THEN** responde 503 con `errorCode = IA_NO_DISPONIBLE` y no registra audit

