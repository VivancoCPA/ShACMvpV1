## Context

- **Frontend:** `QEInvestigationSection.tsx` ya modela el análisis como listas tipadas (`CincoPorques[]`, `Ishikawa[]` en `qualityEvent.types.ts`), los fixtures MSW ya son arrays y `buildQualityEventPdf.ts` ya imprime una fila por porqué o por categoría.
- **Backend:**
  - `ActualizarQualityEventCommand` declara `string? CincoPorques` / `string? Ishikawa`, así que el binding de System.Text.Json responde 400 con cualquier array, y con eso se pierde toda la petición, incluida la causa raíz.
  - La lectura (`ObtenerQualityEventHandler`, `ListarQualityEventsHandler`, vía Dapper) devuelve el texto crudo de las columnas.
  - El handler del PATCH no valida ni rol ni estado para nada, salvo RN-QE-006.
  - Acepta `CausaRaizAprobadaPorId`/`CausaRaizFirmadaEn` del body, que es el único "mecanismo" de firma de RN-QE-002 hoy.
- **Patrones existentes:** el patrón correcto de PIN ya existe en `FirmarCierreQEHandler` (`IPasswordHasher<ShacUser>` contra `PinHash`, `PIN_NO_CONFIGURADO` 422 / `PIN_INCORRECTO` 401 como `UnauthorizedBusinessException`, que el interceptor de axios no trata como sesión expirada). El patrón de la UI está en `QECierreSection` (aviso inline con enlace a `/perfil#pin-firma` y "¿Olvidaste tu PIN?").

## Goals / Non-Goals

**Goals:**
- Que el análisis (5 Porqués / Ishikawa) y la causa raíz se guarden y se relean tal cual.
- Que la firma de la causa raíz sea verificable: PIN validado en el servidor, firmante y hora fijados por el servidor, y registro en el audit trail.
- Que el responsable asignado pueda editar el análisis (PRD §1.3, estado 3), pero no aprobarlo.

**Non-Goals:**
- No hay "retirar aprobación" ni "desfirmar". Si hace falta cambiar una causa raíz aprobada, se reabre el QE (ver Open Questions).
- No hay migración ni cambio de tipo de columna: siguen siendo `text`, no pasan a `jsonb`.
- El asistente de IA queda para `qe-asistente-ia`.

## Decisions

### D1 — Listas tipadas sobre columnas `text` existentes

- **Escritura:** el command recibe `List<CincoPorqueItem>?` / `List<IshikawaItem>?`, y el handler serializa con un `JsonSerializerOptions` estático compartido (camelCase + `JsonStringEnumConverter`).
- **Lectura:**
  - la entidad conserva `CincoPorques`/`Ishikawa` como `string?` mapeados (EF y Dapper siguen igual), ahora con `[JsonIgnore]`;
  - expone `[NotMapped]` de solo lectura `CincoPorquesItems` / `IshikawaItems` con `[JsonPropertyName("cincoPorques")]` / `("ishikawa")`, que deserializan con try/catch y devuelven null ante JSON inválido;
  - es el mismo patrón que `Incidente.Ubicacion`, y cubre de una vez detalle, listado, dashboard y los endpoints de escritura que devuelven la entidad.
- **Alternativa descartada:** DTO de respuesta propio por endpoint. Obligaría a tocar unas 15 respuestas que hoy devuelven la entidad.
- **Alternativa descartada:** columna `jsonb`. Requiere migración y la decisión de Toño fue no migrar.

**Divergencia con la instrucción:**
- Los DTOs (`CincoPorqueItem`, `IshikawaItem`, `IshikawaCategoria`) y el helper de serialización van en `ShcMvpEndPoint.Domain` (`Domain/Entities/AnalisisCausaRaiz.cs`), no en `Features/QualityEvents/Shared/AnalisisCausaRaizDtos.cs`. Motivo: la entidad `QualityEvent` vive en Domain y necesita el tipo para la propiedad de lectura, y Domain no puede referenciar el proyecto web.
- La entidad no tiene logger, así que el getter es silencioso. El `LogWarning` de datos viejos lo emite `ObtenerQualityEventHandler`, que compara "columna con texto, items en null". El listado no lo emite, para no llenar el log en cada página.

Los literales de `IshikawaCategoria` se copian de `qualityEvent.types.ts` (`METODO`, `MAQUINA`, `MATERIAL`, `MANO_DE_OBRA`, `MEDICION`, `MEDIO_AMBIENTE`). `MetodoAnalisis` queda como `string` validado, porque `5_PORQUES` no es un identificador válido de C#.

### D2 — Validación estructural en un validator nuevo y validación de contexto en el handler

- **`ActualizarQualityEventValidator` (FluentValidation + `ValidationFilter`, 400):** valida el método, la cantidad de ítems, las categorías únicas y completas, el máximo de 2.000 caracteres, que la lista enviada sea la del método activo y que no venga ninguna lista sin `metodoAnalisis`.
  - El endpoint no tenía validator. Al agregarlo se aplica a todo el command, pero solo con reglas sobre el análisis, sin tocar el resto del contrato.
- **Handler:** valida el actor (403), el estado (422 `ANALISIS_NO_EDITABLE`) y `CAUSA_RAIZ_FIRMADA` (422).
- **Decisión documentada (pedida por el test "QE en ABIERTO devuelve 403 o 422"):** un estado no permitido responde **422** con `errorCode = ANALISIS_NO_EDITABLE`, no 403. Es coherente con el resto del módulo, donde las reglas por estado (RN-QE-006, `QE_CERRADO`) son 422 y el 403 se reserva para "este actor no puede". El actor se evalúa primero: un SUPERVISOR no asignado recibe 403 aunque el estado tampoco sea válido.
- **`CAUSA_RAIZ_FIRMADA`:** solo dispara si el valor enviado **difiere** del guardado, para no romper a un cliente que reenvía el formulario completo. El frontend igual deja de enviarla una vez firmada.
- **Después de la firma:** el resto del análisis (5 Porqués / Ishikawa) sigue siendo editable mientras el estado lo permita, porque así lo pide la instrucción (§3.1c bloquea solo la causa raíz). Hoy la UI ocultaba "Guardar" al firmar. Pasa a mostrarlo y a mandar solo el análisis.
- **"JCA (rol global)":** se usa `user.GetRolEfectivo()`, el claim `ClaimTypes.Role` del JWT. Es el mismo claim que evalúa `RequireRole(JEFE_CALIDAD_SYST)` en `AsignarResponsableQEEndpoint`, así que "rol global" en la instrucción equivale al rol del token, igual que en el change anterior.

### D3 — Endpoint propio de aprobación, copia del patrón de FirmarCierreQE

- **Slice:** `Features/QualityEvents/AprobarCausaRaizQE/`, con command `{ Pin }`, validator de 4 dígitos, handler con `IPasswordHasher<ShacUser>` y endpoint `POST /api/quality-events/{id:guid}/aprobar-causa-raiz`.
- **Rol:** se valida en el handler (403 con `ForbiddenBusinessException`), no con `RequireRole`. Así el orden de la instrucción (404 de otra empresa **antes** que 403) se cumple. Con `RequireRole`, un SUPERVISOR recibiría 403 incluso para un QE de otra empresa, lo que revela su existencia de forma indirecta.
- **Orden:** 404 → 403 → estado → longitud → ya firmada → PIN. El PIN va al final para no gastar un intento de PIN en algo que igual va a fallar por regla de negocio.
- **Respuesta:** la entidad, con el mismo patrón que `FirmarCierreQE`. `ResponsableInvestigacionNombre` va en null en escritura (comportamiento ya documentado en la entidad). El frontend invalida el detalle.

### D4 — Frontend

- **`isEditable`:** `(rol === JCA || qe.responsableInvestigacionId === user.id) && estado ∈ {EN_INVESTIGACION, ANALISIS_COMPLETADO} && !deletedAt`. Se reutiliza el helper `esResponsableInvestigacion(qe, user)` de `qualityEventPermissions.ts` (`qe-precarga-incidente-responsable`).
- **`puedeAprobar`:** `rol === JCA`.
- **Guardado previo al PIN:** si `formState.isDirty`, "Aprobar" primero hace `mutateAsync` del PATCH y abre el modal solo si el guardado tuvo éxito. Se descartó bloquear el botón y pedir que guarden primero: es un paso extra sin valor.
- **PinModal:** pasa a recibir `errorCode` y a renderizar el error y los enlaces inline, como `QECierreSection`.
- **Formulario:** el `useForm` del componente se mantiene sin `zodResolver`, como hasta ahora (la validación de longitud se hace con `safeParse` al aprobar). No se reescribe el formulario en este change.

### D5 — MSW

El `PATCH` deja de hacer un spread ciego de los campos de firma: se los quita del body antes del merge y limpia la lista de la otra herramienta. El handler nuevo copia la verificación de PIN de `firmar-cierre` (`getUsersStore()`).

### D6 — Divergencias encontradas durante el apply

- **Claves de i18n:**
  - Se agregaron `errors.ANALISIS_NO_EDITABLE` (el código nuevo de D2 necesitaba texto) y `detail.investigation.errors.generico` (fallback cuando el servidor no manda ni `errorCode` ni `message`; `common` no tiene una clave de error genérica).
  - `detail.investigation.pinModal.error` decía "PIN incorrecto." pero se usaba para el error de **formato**. Pasa a "El PIN debe tener 4 dígitos.", y "PIN incorrecto." queda en `detail.investigation.errors.PIN_INCORRECTO`, para el rechazo real del servidor.
  - La etiqueta de audit trail `CAUSA_RAIZ_APROBADA` y su ícono ya existían (`QEAuditTrail.tsx`, `detail.auditTrail.acciones`), así que no se agregaron.
- **PATCH en MSW:** el mock solo descarta los campos de firma y limpia la otra lista. No replica el 403/422 de permisos ni la validación estructural del PATCH (la instrucción §3.3 no lo pide), así que esas reglas solo se verifican contra el backend real.
- **PDF:** no hubo que tocarlo. `buildQualityEventPdf.ts` ya iteraba las listas y `ExportarPdfQE` (backend) no lee el análisis.
- **Tests del backend:** se corren con `-c Release` mientras el backend de desarrollo está levantado, porque bloquea `bin/Debug`. El código es el mismo.
- **Test existente migrado:** `TransicionarEstado_AEnEjecucion_ConCausaRaizYFirmada_Exito` firmaba como OPERARIO vía PATCH. Ahora lo hace un JCA con `POST /aprobar-causa-raiz` y PIN.

## Risks / Trade-offs

- **[Riesgo] Datos viejos en `cinco_porques` / `ishikawa` con texto libre se pierden en pantalla (se ven null).** → Mitigación: el contrato de 400 hacía imposible guardar listas desde la UI, así que solo podría haber texto escrito a mano o desde Swagger. Queda el warning en el log con el id del QE para recuperarlo.
- **[Riesgo] Los tests de integración existentes que firman con `PATCH { causaRaizFirmadaEn }` (p. ej. `QualityEventsStateMachineEndpointTests.TransicionarEstado_AEnEjecucion_ConCausaRaizYFirmada_Exito`) dejan de firmar.** → Mitigación: se migran a sembrar la firma en la base de datos o a usar el endpoint nuevo con un usuario de test con PIN.
- **[Trade-off] El análisis sigue editable después de firmar la causa raíz.** → Se sigue la instrucción. Si en la práctica eso confunde, se puede bloquear todo el análisis tras la firma en un change posterior.
- **[Riesgo] Al agregar un validator al PATCH genérico, un cliente que mande listas sin `metodoAnalisis` pasa a recibir 400.** → El único cliente es `QEInvestigationSection`, que siempre envía el método.

## Migration Plan

Sin migración de base de datos. Despliegue: detener el backend → `dotnet build` → `dotnet run` → Ctrl+F5 en el frontend. Rollback: revertir el commit; los datos guardados como JSON siguen siendo texto válido para la versión anterior (que igual no podía leerlos como listas).

## Open Questions

- ¿Hace falta un "retirar aprobación" de la causa raíz sin reabrir el QE? Por ahora no. Anotarlo si aparece en el uso real.
- ¿Debe bloquearse todo el análisis (no solo la causa raíz) una vez aprobado? Ver el trade-off de arriba.
