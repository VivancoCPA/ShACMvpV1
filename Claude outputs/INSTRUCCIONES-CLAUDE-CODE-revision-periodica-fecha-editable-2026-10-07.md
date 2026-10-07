# Instrucciones para Claude Code — Revisión periódica: permitir elegir la próxima fecha de revisión

Fecha: 2026-10-07
Autor: Cowork (investigación sobre el código real)
Origen: Toño: desde el listado se puede hacer la revisión periódica, pero no deja poner una fecha y la asigna automáticamente.
Change sugerido: `revision-periodica-fecha-editable`

Ciclo: `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

---

## Estado actual (confirmado leyendo el código)

- En el listado, `DocumentListRow` navega a `/documentos/{id}?action=iniciar-revision`. El detalle abre `DocumentRevisionPeriodicaModal` con dos opciones: **A) "Confirmar vigencia sin cambios"** y **B) "Crear nueva versión"**.
- La opción A llama a `useConfirmarRevisionPeriodica`, que hace `PATCH /:id/confirmar-revision` **sin body**. El modal **no tiene ningún campo de fecha**: solo muestra la fecha de próxima revisión actual, antes de confirmar.
- `ConfirmarRevisionPeriodicaHandler` hace `FechaRevisionProxima = DateTime.UtcNow.AddMonths(meses)`, con `meses` según `PeriodicidadMeses`: POL/PRC/PLAN 12, INS 24, MAT 6, REG/INF `null`.
  - El usuario no puede elegirla, y el cálculo parte de **hoy** (fecha de confirmación), no de la fecha anterior.
  - Guarda la fecha **con hora**, lo que no respeta la semántica de "fecha de calendario" de `fix-fechas-utc`. El resto de las fechas de revisión se guardan como `YYYY-MM-DDT00:00:00Z`.
  - Para REG/INF deja la fecha en `null`.
- **Antes de implementar**, reproduce lo que Toño ve como "fecha de hoy": confirma con un PRC y con un REG/INF qué fecha muestran después el listado (semáforo) y el detalle, y anótalo en `design.md`. Si en algún caso realmente queda la fecha de hoy, ese bug también se corrige en este change.

## Decisión de Toño

**D1 — ✅ DECIDIDO (2026-10-07): fecha sugerida y editable.** El modal propone una fecha según el tipo de documento y el usuario puede cambiarla. La fecha debe ser **al menos 30 días después de hoy**, el mismo margen de RN-DOC-020 (`DOC_REVISION_MIN_GAP_DAYS`). Para REG/INF es opcional (puede quedar vacía). Se descartaron "libre sin mínimo" y "solo automática".

---

## Qué implementar

### Backend
1. `PATCH /api/documents/{id}/confirmar-revision` acepta un body opcional `{ fechaRevisionProxima?: "YYYY-MM-DD" | null }`, con un `ConfirmarRevisionPeriodicaCommand` y su validator.
   - **Si viene una fecha:** debe ser ≥ hoy + 30 días. Calcula "hoy" como fecha de calendario en `America/Lima` para que el corte de día no dependa de UTC. Si no se cumple, responde un error de validación por campo, con el mismo formato que `ValidationFilter`.
   - **Si no viene (o es `null`):**
     - POL/PRC/PLAN/INS/MAT: usa la fecha sugerida (punto 2), para mantener la compatibilidad con clientes que no envían body.
     - REG/INF: queda `null`, como hoy.
   - Para REG/INF se acepta una fecha opcional, con la misma regla de ≥ hoy + 30.
2. **Fecha sugerida:** un helper compartido (por ejemplo `CalcularFechaRevisionSugerida(tipo, hoyLima)`) que devuelva hoy + periodicidad del tipo como **fecha de calendario** a medianoche UTC (`YYYY-MM-DDT00:00:00Z`, criterio de `fix-fechas-utc`). Unifica `PeriodicidadMeses` con `DOC_PERIODICIDAD_POR_TIPO` del frontend: debe haber una sola fuente por lado y con los mismos valores.
3. Guarda `FechaRevisionProxima` siempre como fecha de calendario, sin hora.
4. Audit trail `REVISION_PERIODICA_CONFIRMADA`: registra la fecha anterior y la nueva (`ValorAnterior` / `ValorNuevo` en formato `YYYY-MM-DD`). Si existe una columna más adecuada, úsala y anótalo.
5. Opcional, pero recomendado: un `GET` liviano o un campo en el detalle que exponga la fecha sugerida, para no duplicar el cálculo en el frontend. Si prefieres calcularla en el frontend con `DOC_PERIODICIDAD_POR_TIPO`, deja documentado que ambos lados usan la misma tabla.

### Frontend (`DocumentRevisionPeriodicaModal`)
1. Opción A: agrega un campo de fecha "Próxima revisión":
   - viene **precargado con la fecha sugerida** según el tipo;
   - es editable;
   - tiene `min` = hoy + 30 días;
   - en REG/INF es opcional y empieza vacío.

   Usa los helpers de fecha de calendario de `utils/date.utils` (`fix-fechas-utc`) y nunca `new Date(...)` con zona local.
2. Muestra un texto de ayuda: "Sugerida según el tipo de documento ({periodicidad}). Puedes ajustarla; mínimo 30 días." Valida con Zod y muestra el error del backend en el campo si lo devuelve.
3. `useConfirmarRevisionPeriodica` debe enviar `{ fechaRevisionProxima }`. El toast de éxito muestra la fecha que quedó guardada, formateada como fecha de calendario.
4. La opción B (crear nueva versión) no cambia.
5. **MSW:** el handler de `confirmar-revision` acepta el body con las mismas reglas y devuelve el mismo error de validación.

## Tests
- **Backend:**
  - sin body en PRC → hoy + 12 meses, como fecha de calendario;
  - con una fecha válida → se guarda esa fecha;
  - con una fecha < hoy + 30 → error de validación;
  - REG sin fecha → `null`;
  - REG con fecha → se guarda;
  - el audit trail registra la fecha anterior y la nueva.
- **Frontend:**
  - el modal precarga la fecha sugerida según el tipo;
  - no permite enviar una fecha menor al mínimo;
  - en REG/INF el campo es opcional;
  - el toast muestra la fecha correcta sin desfase en UTC-5.

## Reglas de siempre
- El código real manda sobre este documento; cualquier divergencia va en `design.md`.
- Un cambio de contrato (body nuevo) se refleja en el backend, el MSW, los tipos TS y los tests.
- Corre la suite completa del frontend, los tests del backend y `tsc`.
- **Detén el backend y ejecuta `dotnet build` antes de la prueba manual.**
- Prueba manual con MSW apagado:
  1. Desde el listado, en un PRC PUBLICADO, abre "Iniciar revisión" → opción A. Verifica la fecha sugerida, cámbiala y confirma. El listado y el detalle deben mostrar exactamente esa fecha.
  2. Intenta con una fecha a 10 días → debe dar error.
  3. Repite con un REG, sin fecha y con fecha.
- Al terminar, Toño avisa con "listo". Cowork verifica releyendo el código real y actualiza el mapa de proceso.
