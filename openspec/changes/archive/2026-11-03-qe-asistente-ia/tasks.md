## 1. Configuración y dependencias (backend)

- [x] 1.1 Agregar el paquete NuGet `Anthropic` (versión estable más reciente) a `ShcMvpEndPoint.csproj` y `UserSecretsId` (`dotnet user-secrets init`).
- [x] 1.2 Agregar la sección `Anthropic` (sin la clave) a `appsettings.json` y a `appsettings.Development.json.example`.
- [x] 1.3 Crear `AnthropicOptions` (con `SectionName` y `EstaConfigurado`) y registrarlo con `Configure<>` en `Program.cs`.
- [x] 1.4 Crear `ShcMvpEndPoint/README.md` con la sección "Asistente IA" (user-secrets, `Anthropic__ApiKey`, comportamiento sin clave y costo).

## 2. Excepciones y mapeo HTTP

- [x] 2.1 Crear `ServiceUnavailableBusinessException` (503) y `TooManyRequestsBusinessException` (429) en `Domain/Exceptions`, cada una con `ErrorCode`.
- [x] 2.2 Mapearlas en `ApiExceptionHandler` con `ApiResponse.Fail(message, errorCode)`.

## 3. Cliente de IA

- [x] 3.1 Definir los records `ContextoQE` (con QE, incidente y similares, sin campos de personas), `SugerenciaCausaRaiz`, `PorqueSugerido` y `AccionSugerida`, además de `AsistenteIANoDisponibleException`.
- [x] 3.2 Implementar `IAsistenteCausaRaizClient`/`AnthropicAsistenteCausaRaizClient` con el SDK oficial:
  - `HttpClient` con nombre `Anthropic` desde `IHttpClientFactory`, `MaxRetries = 0` y timeout;
  - system prompt en español;
  - `output_config.format` con el JSON schema y `effort: low`.
  
  Si el SDK no permite inyectar el `HttpClient`, caer a `HttpClient` tipado y documentarlo en design.md.
- [x] 3.3 Validar la respuesta: `stop_reason`, parseo del JSON y restricciones (100–500, 5 porqués, 2–3 acciones, 50–500, tipos válidos). Cualquier falla lanza `AsistenteIANoDisponibleException`, con un log sin la clave ni el prompt.
- [x] 3.4 Registrar el cliente y el `HttpClient` en DI.

## 4. Endpoints

- [x] 4.1 Crear el slice `Features/QualityEvents/AsistirCausaRaizIA/` (endpoint + handler). El handler:
  - valida en el orden 404 → 403 → 422 → 503 `IA_NO_CONFIGURADA` → 429 `IA_LIMITE_DIARIO` (día de Lima);
  - arma el contexto minimizado (nombre del área, incidente sin personas, hasta 5 similares de la misma empresa y área en 12 meses);
  - llama al cliente, traduce la excepción a 503 `IA_NO_DISPONIBLE` y registra `ASISTENTE_IA_CONSULTADO`.
- [x] 4.2 Crear el slice `Features/Config/Funcionalidades/` con `GET /api/config/funcionalidades`.
- [x] 4.3 Registrar los handlers y endpoints (`EndpointExtensions`, `AddFeatureHandlers` o lo que corresponda).

## 5. origenIA en el PATCH genérico

- [x] 5.1 Agregar `OrigenIA` al `ActualizarQualityEventCommand` y validar sus valores (`IA` / `IA_EDITADO`) en el validator.
- [x] 5.2 En el handler, marcar `GeneradoPorIA` o agregar el sufijo " (sugerencia IA editada)" en `causaRaizDefinitiva`/`cincoPorques`.

## 6. Tests backend (HttpMessageHandler falso, nunca la API real)

- [x] 6.1 Respuesta válida: 200 con los 3 bloques, el QE no cambia y el audit trail tiene `ASISTENTE_IA_CONSULTADO` con `GeneradoPorIA = true`.
- [x] 6.2 El request capturado no contiene `personalInvolucrado`, `testigos`, nombres, emails ni ids de usuarios; contiene el nombre del área y hasta 5 similares de la misma empresa.
- [x] 6.3 Timeout, 500, 429 o esquema inválido devuelven 503 `IA_NO_DISPONIBLE`, sin audit y con un log sin la clave.
- [x] 6.4 Sin `ApiKey`: 503 `IA_NO_CONFIGURADA` y `funcionalidades.asistenteIA = false`; con clave, `true`.
- [x] 6.5 Permisos: el JCA y el responsable pueden; otro SUPERVISOR recibe 403; con la causa raíz firmada, 422; otra empresa, 404.
- [x] 6.6 Límite diario: la llamada N+1 recibe 429 `IA_LIMITE_DIARIO`.
- [x] 6.7 PATCH con `origenIA.causaRaiz = IA` deja `GeneradoPorIA = true`; con `IA_EDITADO`, deja el sufijo; un valor inválido da 400.

## 7. Frontend: tipos, API y hooks

- [x] 7.1 Tipos `Funcionalidades`, `SugerenciaCausaRaizIA`, `AccionSugeridaIA`, `OrigenIAValor` y `origenIA` en `QualityEventUpdateInput`.
- [x] 7.2 `getFuncionalidades()` y `asistirCausaRaizIA(id)` en `quality-events.api.ts`.
- [x] 7.3 Hooks `useFuncionalidades` y `useAsistenteIA` (este último invalida el audit trail).

## 8. Frontend: UI

- [x] 8.1 Exportar `AgregarQEACModal` desde `QEACSection.tsx`, con `defaultValues` y un slot de ayuda opcional.
- [x] 8.2 En `QEInvestigationSection`, mostrar el botón según `asistenteIA` y la editabilidad, con el spinner "Analizando…" y el manejo de errores por toast. Eliminar el tooltip "Próximamente disponible".
- [x] 8.3 Panel de sugerencia: etiqueta, `Sparkles`, fondo diferenciado y los bloques Usar/Descartar (causa raíz, y 5 Porqués con confirmación) y Crear AC (solo el JCA, en los estados de alta de AC).
- [x] 8.4 Marcas IA / IA (editado) derivadas en render, y `origenIA` al guardar.
- [x] 8.5 `QEAuditTrail`: la acción `ASISTENTE_IA_CONSULTADO`, con su etiqueta y el ícono `Sparkles`.
- [x] 8.6 i18n es-PE/en-US: claves `detail.investigation.ia.*`, `errors.IA_LIMITE_DIARIO`/`IA_NO_DISPONIBLE`/`IA_NO_CONFIGURADA` y la etiqueta de audit; eliminar `asistirIATooltip`.

## 9. MSW

- [x] 9.1 Handler `GET /api/config/funcionalidades` → `{ asistenteIA: true }`.
- [x] 9.2 Handler `POST /api/quality-events/:id/asistente-ia` con una sugerencia fija y `delay(800)`, que agrega la entrada de audit. Toggle `setAsistenteIAMockFalla` en los fixtures para el 503.
- [x] 9.3 El PATCH mock respeta `origenIA` en el audit trail.

## 10. Tests frontend

- [x] 10.1 Con `asistenteIA = false`, el botón no aparece.
- [x] 10.2 Clic → spinner → panel con la etiqueta; "Usar" en la causa raíz → marca "IA"; al editar → "IA (editado)"; al guardar se envía `origenIA`.
- [x] 10.3 "Usar" en los 5 Porqués con datos previos pide confirmación.
- [x] 10.4 "Crear AC" abre el formulario precargado.
- [x] 10.5 Un 503 muestra el toast y el formulario queda intacto.

## 11. Verificación

- [ ] 11.1 Suite completa del backend (`dotnet test`) y del frontend (`npm test`).
- [ ] 11.2 `tsc --noEmit` y `npm run lint` con cero errores.
- [x] 11.3 Verificar que ningún `appsettings*.json` contenga una clave (`sk-ant`).
- [x] 11.4 Completar "Resolución al aplicar" en design.md.

## 12. Modo simulado (actualización del 2026-10-30)

- [x] 12.1 `AnthropicOptions.Proveedor` (`Anthropic` default / `Simulado`), `EsSimulado` y `EstaConfigurado = EsSimulado || ApiKey`; `Proveedor` en `appsettings.json` (`Anthropic`) y `appsettings.Development.json.example` (`Simulado`).
- [x] 12.2 `AsistenteCausaRaizSimulado` (800 ms, sugerencia fija con el esquema, `modelo = "simulado"`, `[simular-error-ia]` → `AsistenteIANoDisponibleException`) y selección en DI por `IOptions`.
- [x] 12.3 Warning al arrancar en `Production` con `Proveedor = "Simulado"`.
- [x] 12.4 `funcionalidades` devuelve `asistenteIASimulado`; README del backend (modo simulado, `[simular-error-ia]`, `claude-haiku-5-5` para pruebas reales).
- [x] 12.5 Frontend: `Funcionalidades.asistenteIASimulado`, sufijo `detail.investigation.ia.simulado` en la etiqueta del panel (es-PE/en-US); MSW devuelve `asistenteIASimulado: false`.
- [x] 12.6 Tests backend: simulado sin clave → 200 con esquema válido, `modelo`/audit `simulado` y sin llamadas HTTP; `funcionalidades` → `true`/`true`; `[simular-error-ia]` → 503 `IA_NO_DISPONIBLE`; con clave real → `asistenteIASimulado = false`.
- [x] 12.7 Test frontend: en modo simulado la etiqueta muestra el sufijo.

