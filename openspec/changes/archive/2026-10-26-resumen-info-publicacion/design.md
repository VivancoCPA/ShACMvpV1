## Context

`DocumentDetailPage.tsx` (de `detalle-documento-dos-columnas`, implementado) renderiza la pestaña Resumen con solo `documento.descripcion` y, condicionalmente, la sección del archivo original. Los datos de publicación (firmante, fecha, hash, motivo de versión) ya existen en el `documento` que la página recibe — no hace falta ningún fetch ni cambio de backend. Hoy esa lógica de "fecha de publicación" vive duplicada de forma incompleta en `DocumentDetailSidebar.tsx` (`getFechaPublicacion`, sin el respaldo de `aprobadorId`+`fechaEmision` que pide el mockup).

## Goals / Non-Goals

**Goals:**
- Un único helper (`getDatosPublicacion`) que resuelva firmante/fecha/hash con sus tres niveles de respaldo, consumido tanto por la tarjeta nueva de Resumen como por la Ficha de la sidebar.
- Tarjeta "Documento publicado" visualmente consistente con el mockup aprobado, usando tokens existentes y con dark mode.
- Reutilizar la acción "Ver documento" ya existente (`availability.canVerDocumento` + `controller.setShowVisor(true)`) para el botón "Ver" de la tarjeta — cero lógica de permisos nueva.

**Non-Goals:**
- No se agrega el campo "Alcance" del mockup (no existe en el modelo `Documento`).
- No se cambia el backend, el modelo de datos, ni los handlers MSW de endpoints (solo fixtures).
- No se toca el layout de pestañas/sidebar de `detalle-documento-dos-columnas` — este change es estrictamente contenido de un panel existente.

## Decisions

**1. `getDatosPublicacion` vive en `features/documents/utils/publicacion.ts`, no en un hook.**
Es una función pura sobre `Documento` (sin estado, sin React) — igual que otros helpers de la feature (`getHistorialEntries`). Firma: `getDatosPublicacion(documento: Documento): { firmadoPorId: string; fecha: string; hash?: string } | undefined`.

Orden de resolución (ninguno excluye mostrar la tarjeta si el estado es `PUBLICADO`/`EN_REVISION_PERIODICA`/`OBSOLETO` — solo cambia si hay hash):
1. Última entrada `FIRMA_REGISTRADA` del `auditTrail` (orden descendente por `timestamp`) → `{ firmadoPorId: realizadoPorId, fecha: timestamp, hash: valorNuevo }`.
2. Si no hay ninguna: última entrada `ESTADO_CAMBIADO` con `estadoNuevo === 'PUBLICADO'` → `{ firmadoPorId: realizadoPorId, fecha: timestamp, hash: undefined }`.
3. Si tampoco hay esa entrada (documento publicado antes de que existiera el audit trail de estados, o datos legacy): `aprobadorId` + `fechaEmision`, solo si ambos están presentes → `{ firmadoPorId: aprobadorId, fecha: fechaEmision, hash: undefined }`.
4. Si ninguno de los tres aplica, retorna `undefined` (la tarjeta no debería llegar a este caso en `PUBLICADO`/`EN_REVISION_PERIODICA`/`OBSOLETO` reales, pero el caller debe tolerarlo sin romper).

**2. `DocumentDetailSidebar` reemplaza su `getFechaPublicacion` local por `getDatosPublicacion(...)?.fecha`.**
Mismo criterio que ya pedía la instrucción original: una sola fuente de verdad. La Ficha de la sidebar solo necesita la fecha, no el hash ni el firmante — sigue mostrando "—" cuando `getDatosPublicacion` devuelve `undefined`.

**3. Nombre de archivo mostrado en la tarjeta.**
El modelo no expone un nombre real de PDF de distribución separado del código/versión (`documento.archivoDistribucionUrl` es solo una URL mock). Se muestra `{codigo} v{version}.pdf` de forma determinística, sin depender de un campo que no existe.

**4. Hash abreviado + copiar.**
`hash.slice(0, 4) + '…' + hash.slice(-4)` en `font-mono`, con `title={hash}` (tooltip nativo) y un botón de copiar que usa `navigator.clipboard.writeText(hash)` envuelto en `try/catch` (algunos entornos de test/CI no lo exponen) y dispara `toast.success(t('detail.publicado.hashCopiado'))` vía Sonner — nunca `alert()`, conforme a CLAUDE.md. Si no hay `hash` (fallback 2 o 3 de la resolución), no se renderiza la línea de hash ni el botón de copiar — solo "Firmado por {nombre} · {fecha y hora}".

**5. Botón "Ver" de la tarjeta.**
No es una acción nueva: renderiza condicionado a `availability.canVerDocumento` (mismo flag que ya gatea "Ver documento" en la sidebar) y, al click, llama `controller.setShowVisor(true)` — el mismo modal `DocumentActionModals` ya montado por la página. Si `canVerDocumento` es `false` (caso raro dado que la tarjeta solo aparece en estados con `canRead` casi siempre verdadero, pero posible por confidencialidad), el botón simplemente no se renderiza.

**6. Fecha/hora con el formateador existente.**
Se usa el formateador de fecha+hora ya presente en `utils/date.utils.ts` (el mismo patrón que usa `DocumentAuditTrail`/`DocumentHistorial` para timestamps, `Intl.DateTimeFormat` con locale) — no `toLocaleString()` suelto, conforme a CLAUDE.md regla 5.

**7. Fixtures MSW.**
Se agrega una entrada `FIRMA_REGISTRADA` (con `valorNuevo` = hash de ejemplo) y un `motivoVersion` a los documentos fixture que ya están en `PUBLICADO`/`OBSOLETO` en `documents.fixtures.ts` — sin crear documentos nuevos, solo completando los existentes para que la tarjeta tenga datos reales en mock.

## Risks / Trade-offs

- **[Riesgo] El respaldo 3 (`aprobadorId`+`fechaEmision`) puede no coincidir exactamente con quién firmó si el documento fue migrado o editado manualmente fuera del flujo normal.** → Mitigación: es el mismo comportamiento que ya pedía la instrucción original como último recurso; se documenta en el propio helper con un comentario, y los tests cubren explícitamente el caso "sin FIRMA_REGISTRADA" para que cualquier regresión futura se note.
- **[Riesgo] `navigator.clipboard` puede no existir en el entorno de test (jsdom) o en navegadores sin permisos.** → Mitigación: `try/catch` alrededor de la llamada; el botón no rompe la tarjeta si falla, solo no muestra el toast de éxito.
- **[Trade-off] El nombre de archivo mostrado (`{codigo} v{version}.pdf`) es sintético, no viene del backend.** → Aceptado explícitamente por la instrucción original ("o el nombre real del PDF de distribución, si el backend lo expone" — hoy no lo expone).
