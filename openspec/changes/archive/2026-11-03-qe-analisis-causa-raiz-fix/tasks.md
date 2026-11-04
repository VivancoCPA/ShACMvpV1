## 1. Backend — tipos y persistencia del análisis

- [x] 1.1 Crear `ShcMvpEndPoint.Domain/Entities/AnalisisCausaRaiz.cs` con `CincoPorqueItem`, `IshikawaItem`, `IshikawaCategoria` (literales copiados de `qualityEvent.types.ts`) y el helper de serialización (camelCase + `JsonStringEnumConverter`, `TryDeserialize` que devuelve null ante JSON inválido)
- [x] 1.2 En `QualityEvent`: `[JsonIgnore]` sobre `CincoPorques`/`Ishikawa` crudos y propiedades `[NotMapped]` de solo lectura `CincoPorquesItems`/`IshikawaItems` con `[JsonPropertyName("cincoPorques")]`/`("ishikawa")`
- [x] 1.3 `ObtenerQualityEventHandler`: `LogWarning` cuando la columna tiene texto pero no deserializa (dato viejo)
- [x] 1.4 Verificar con grep que ningún otro lugar (Dashboard, ExportarPdfQE, Listar) lea esas columnas como texto para mostrarlas

## 2. Backend — PATCH genérico

- [x] 2.1 `ActualizarQualityEventCommand`: `List<CincoPorqueItem>? CincoPorques`, `List<IshikawaItem>? Ishikawa`; quitar `CausaRaizAprobadaPorId` y `CausaRaizFirmadaEn`
- [x] 2.2 Crear `ActualizarQualityEventValidator` (método válido, 5 porqués, 6 categorías únicas, ≤ 2.000 caracteres, lista solo con su método) y registrar `ValidationFilter` en el endpoint
- [x] 2.3 Handler: validación de actor (JCA o responsable → si no, 403), estado (422 `ANALISIS_NO_EDITABLE`) y `CAUSA_RAIZ_FIRMADA` (422, solo si el valor cambia); el endpoint pasa el rol del token
- [x] 2.4 Handler: serializar la lista activa, limpiar la otra y registrar en el audit trail el resumen ("N de 5 respuestas completas" / "N de 6 categorías completas"); quitar los bloques de firma

## 3. Backend — aprobar causa raíz

- [x] 3.1 Slice `Features/QualityEvents/AprobarCausaRaizQE/` (Command `{ Pin }`, Validator de 4 dígitos, Handler, Endpoint `POST /api/quality-events/{id:guid}/aprobar-causa-raiz`) con el orden 404 → 403 → estado → `CAUSA_RAIZ_INVALIDA` → `CAUSA_RAIZ_FIRMADA` → PIN
- [x] 3.2 Efecto: firmante, `DateTime.UtcNow`, `ActualizadoEn` y audit `CAUSA_RAIZ_APROBADA` con un extracto de 100 caracteres
- [x] 3.3 Registrar el handler en DI y el endpoint en `EndpointExtensions.cs`

## 4. Backend — tests

- [x] 4.1 PATCH con 5 Porqués / Ishikawa: el round-trip por GET es idéntico y la otra lista queda null
- [x] 4.2 Validación: 4 porqués, 7 categorías, categoría repetida y método inválido devuelven 400
- [x] 4.3 Permisos: JCA 200, SUPERVISOR responsable 200, SUPERVISOR no asignado 403, QE en ABIERTO 422 `ANALISIS_NO_EDITABLE`, causa raíz firmada distinta 422 `CAUSA_RAIZ_FIRMADA`
- [x] 4.4 El PATCH con `causaRaizFirmadaEn`/`causaRaizAprobadaPorId` no los cambia
- [x] 4.5 `aprobar-causa-raiz`: éxito con audit, `PIN_INCORRECTO` 401, `PIN_NO_CONFIGURADO`, SUPERVISOR 403, causa corta 422, ya firmada 422, otra empresa 404
- [x] 4.6 Aprobar y luego transicionar a EN_EJECUCION devuelve 200; migrar los tests existentes que firmaban vía PATCH
- [x] 4.7 Un dato viejo no-JSON en `cinco_porques` hace que el GET responda 200 con `cincoPorques: null`

## 5. Frontend — API, tipos y hook

- [x] 5.1 Quitar `causaRaizAprobadaPorId`/`causaRaizFirmadaEn` de `QualityEventUpdateInput`
- [x] 5.2 `aprobarCausaRaiz(id, pin)` en `quality-events.api.ts`
- [x] 5.3 Hook `useAprobarCausaRaiz` (invalida la lista, el detalle y el audit trail; sin toast propio)

## 6. Frontend — QEInvestigationSection

- [x] 6.1 `isEditable` con JCA o responsable asignado; causa raíz editable solo si no está firmada; Guardar visible aunque esté firmada (sin enviar la causa raíz)
- [x] 6.2 `onGuardar`: toast de éxito "Análisis guardado." y toast de error con el `errorCode` traducido o el mensaje
- [x] 6.3 "Aprobar" solo para JCA; "Pendiente de aprobación del Jefe de Calidad." para quien edita sin ser JCA; guardar los cambios pendientes antes de abrir el modal
- [x] 6.4 PinModal: llamar a `useAprobarCausaRaiz` con `{ pin }`; `PIN_INCORRECTO` inline, `PIN_NO_CONFIGURADO` con enlace a `/perfil#pin-firma` y enlace "¿Olvidaste tu PIN?"
- [x] 6.5 i18n es-PE/en-US: `detail.investigation.guardado`, `pendienteAprobacion`, `errors.PIN_INCORRECTO`, `errors.CAUSA_RAIZ_FIRMADA`, `errors.CAUSA_RAIZ_INVALIDA`, `errors.ANALISIS_NO_EDITABLE`, claves de PIN no configurado / olvidado, y la etiqueta de audit `CAUSA_RAIZ_APROBADA`

## 7. MSW

- [x] 7.1 `PATCH /api/quality-events/:id`: descartar los campos de firma y limpiar la lista de la otra herramienta
- [x] 7.2 `POST /api/quality-events/:id/aprobar-causa-raiz` con 404/403/422/401 y audit `CAUSA_RAIZ_APROBADA`
- [x] 7.3 Confirmar que los fixtures tienen `cincoPorques`/`ishikawa` como arrays

## 8. Frontend — tests

- [x] 8.1 Guardar los 5 Porqués / Ishikawa y refetch: las respuestas siguen ahí
- [x] 8.2 El modal de PIN envía solo `{ pin }`; `PIN_INCORRECTO` inline; `PIN_NO_CONFIGURADO` con enlace a Mi Perfil
- [x] 8.3 El SUPERVISOR responsable edita pero no ve "Aprobar"; el SUPERVISOR no asignado ve todo en solo lectura
- [x] 8.4 Actualizar los tests existentes de `QEInvestigationSection` que esperaban el PATCH con la firma

## 9. Verificación

- [ ] 9.1 Suite completa backend (`dotnet test`) y frontend (`npm test`)
- [ ] 9.2 `tsc --noEmit` y `npm run lint` con cero errores
- [x] 9.3 Registrar en `design.md` cualquier divergencia nueva encontrada durante el apply
