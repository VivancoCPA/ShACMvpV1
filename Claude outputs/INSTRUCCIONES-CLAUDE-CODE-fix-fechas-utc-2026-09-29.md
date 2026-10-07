# Instrucciones para Claude Code — Fix: fechas sin zona horaria rompen el guardado (500)

Fecha: 2026-09-29
Autor: Cowork (diagnóstico sobre el código real y el log del backend de Toño)
Change sugerido: `fix-fechas-utc` (change **aparte**; no lo mezcles con `documentos-revisor-aprobador-reales`, que sigue abierto y bloqueado en su tarea 6.3 por este bug)

Ciclo: `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

---

## Síntoma (reproducido por Toño contra el backend real, MSW apagado)

`POST /api/documents` responde **500** al grabar un documento con Fecha de Vigencia / Próxima Revisión. Log del backend:

```
Microsoft.EntityFrameworkCore.DbUpdateException: An error occurred while saving the entity changes.
 ---> System.ArgumentException: Cannot write DateTime with Kind=Unspecified to PostgreSQL type
      'timestamp with time zone', only UTC is supported.
   at Npgsql.Internal.Converters.DateTimeConverterResolver`1.Get(...)
```

## Causa (confirmada leyendo el código)

- El formulario (`features/documents/hooks/useDocumentForm.ts`, `onSubmit`) envía `fechaVigencia` y `fechaRevisionProxima` tal como salen del `<input type="date">`, es decir `"2026-09-29"`, sin hora ni zona.
- `CrearDocumentoCommand` / `EditarDocumentoCommand` las reciben como `DateTime?`. System.Text.Json deserializa una fecha sin offset como `DateTimeKind.Unspecified`.
- Las columnas `fecha_vigencia` / `fecha_revision_proxima` son `timestamp with time zone` (ver `ShacDbContextModelSnapshot`). Npgsql 6+ solo acepta `Kind=Utc` para ese tipo.
- `ShacDbContext` no define ninguna convención ni converter para `DateTime`: no hay normalización en ningún lado.
- Los tests de integración no lo detectan porque envían fechas ISO completas con `Z`. Es el mismo patrón de bug de toda la serie: invisible con MSW y en tests, roto con el formulario real.

## Decisión de Toño

**D1 — ✅ DECIDIDO (2026-09-29): normalizar a UTC en el backend con un convertidor global de EF Core.** Descartadas: migrar a columnas `date`/`DateOnly` (más correcto semánticamente, pero implica migración, cambios en Dapper y en el contrato, y solo cubriría Documentos), y arreglarlo solo en el frontend (dejaría expuesto cualquier otro formulario con fechas). Documenta las tres opciones y la elegida en `design.md`.

---

## Qué implementar

### 1. Backend: convertidor global
- En `ShacDbContext.ConfigureConventions`, registra un `ValueConverter` para `DateTime` y otro para `DateTime?`.
  - **Al escribir:** `Unspecified` → `DateTime.SpecifyKind(v, DateTimeKind.Utc)` (sin desplazar la hora); `Utc` → sin cambios; `Local` → `v.ToUniversalTime()`.
  - **Al leer:** `DateTime.SpecifyKind(v, DateTimeKind.Utc)`.
- Aplica solo a propiedades mapeadas a `timestamp with time zone`. Verifica que no quede ninguna columna `timestamp without time zone` a la que esto le cambie el significado. Si existe alguna, exclúyela y anótalo.
- **No debe generar migración.** Si `dotnet ef migrations add` detecta cambios de esquema, algo está mal: detente y anótalo en `design.md`.
- Dapper **no** pasa por los converters de EF. Revisa las escrituras que se hagan con Dapper o SQL crudo con parámetros `DateTime` que vengan del cliente (las lecturas no importan para este bug). Si alguna recibe `Kind=Unspecified`, normalízala en ese punto y lístala en `design.md`.

### 2. Frontend: campos de fecha vacíos
- En `useDocumentForm.onSubmit`, un campo de fecha vacío (`''`) debe enviarse como `undefined` (u omitirse), **nunca** como `""`. `""` no se puede deserializar a `DateTime?`. Aplícalo a crear y a editar.
- Confirma con el backend real que responde (400 claro o aceptando `null`) y documenta el comportamiento observado.

### 3. Frontend: que la fecha no se "corra" un día (obligatorio revisar)
Con la decisión D1, `"2026-09-29"` se guarda como `2026-09-29T00:00:00Z`. Perú es UTC-5, así que cualquier pantalla que haga `new Date(valor)` y lo formatee en hora local mostrará **28/09**.
- Busca en el frontend todas las pantallas que muestran `fechaVigencia` y `fechaRevisionProxima`: lista, detalle, semáforo de revisión, dashboard, PDF controlado y cualquier otro lugar donde aparezcan.
- Los campos que son **fecha de calendario** (sin hora) se muestran sin conversión de zona: formatea la parte `YYYY-MM-DD` del ISO, o usa un helper común de "fecha sin zona" si ya existe en `utils/date.utils`. Si no existe, créalo ahí.
- Los timestamps reales (`creadoEn`, `actualizadoEn`, audit trail) **sí** se convierten a hora local. No los toques.
- Revisa también los cálculos que comparan con "hoy", como el semáforo de revisión periódica y los vencimientos, para que no se desfasen un día.

### 4. Barrido: otros formularios con fechas
El convertidor global ya los cubre en el guardado, pero confirma cada uno **contra el backend real**. Haz una lista en `design.md` de todo formulario que envíe fechas de `<input type="date">` (acciones correctivas de NC/QE/Incidentes con `fechaCompromiso`, ajustes de plazo, fechas de evento, etc.) e indica:
- si el guardado funciona;
- si el campo vacío se envía como `""`;
- si la visualización se desfasa un día.

Corrige en este change el envío de `""` y el desfase de visualización donde aparezcan: son el mismo bug.

### 5. Tests
- Backend: tests de integración que envíen fechas **date-only** (`"2026-09-29"`) y vacías en crear y editar documento. Deben dar 201/200, no 500, y la fecha guardada debe ser `2026-09-29T00:00:00Z`. Agrega al menos un caso equivalente en otro módulo del barrido.
- Frontend: un test del helper de fecha sin zona que cubra el caso UTC-5, y un test de `onSubmit` que verifique que las fechas vacías no viajan como `""`.

---

## Reglas de siempre
- El código real manda sobre este documento; cualquier divergencia va en `design.md`.
- Corre la suite completa del frontend (no solo los archivos tocados), los tests del backend y `tsc`.
- **Antes de la prueba manual, detén el backend, ejecuta `dotnet build` y vuelve a levantarlo.** En la sesión anterior el `ShcMvpEndPoint.dll` quedó sin actualizar porque se compiló con el proceso corriendo, y el endpoint nuevo daba 404.
- Prueba manual con MSW apagado:
  1. Crea un documento con fechas y verifica que se ven iguales en la lista y en el detalle, sin corrimiento de día.
  2. Edita ese documento.
  3. Crea un documento sin fechas.
  4. Guarda al menos una acción correctiva con `fechaCompromiso`.
- Al terminar, Toño avisa con "listo" y retoma la tarea 6.3 de `documentos-revisor-aprobador-reales`. Cowork verifica releyendo el código real y escribe `SHAC-Verificacion-Fix-Fechas-UTC-<fecha>.md`.
