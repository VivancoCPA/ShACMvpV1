# Instrucciones para Claude Code — El log del documento no se refresca al ver o descargar

Fecha: 2026-10-12
Autor: Cowork (diagnóstico leyendo el código real)
Origen: Toño. Después de abrir el visor o descargar la copia, el log (audit trail) no muestra la acción nueva. Hay que salir del detalle y volver a entrar para verla.
Change sugerido: `fix-log-refresco-inmediato` (pequeño, solo frontend)

Ciclo: `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

---

## Diagnóstico (confirmado leyendo el código)

- `DocumentAuditTrail` y `DocumentHistorial` pintan el log desde el objeto `documento` de `useDocumentDetail` (query `QUERY_KEYS.documents.detail(id)`). El log solo cambia cuando esa query se vuelve a pedir.
- `lib/queryClient.ts` tiene `refetchOnWindowFocus: false`, así que la query no se actualiza sola. Solo se actualiza al volver a montar la página, que es justo lo que Toño hace a mano.
- Las mutaciones de estado, firma, reemplazo de original, confirmar revisión, restaurar, vincular y desvincular **sí** invalidan `detail(id)`. También lo hace `useGetArchivoOriginalUrl`, por eso la descarga del original sí aparece al instante.
- Las dos acciones que escriben en el log sin invalidar el detalle son:
  1. **`useExportarPdfControlado`** ("Descargar copia (PDF)"). El backend registra `DESCARGA`, pero el `onSuccess` solo dispara la descarga del blob y no invalida nada.
  2. **`DocumentViewer`** ("Ver documento"). Su `useQuery(['documents','visor', id])` llama a `GET /visor`, que registra `VISUALIZACION`, pero nada invalida el detalle cuando la carga termina.
- Además, las acciones que hace **otro usuario** (por ejemplo el revisor que aprueba mientras el autor tiene abierto el detalle) tampoco se ven hasta recargar. El hub SignalR (`lib/notificationsHub.ts`) ya existe y avisa de notificaciones nuevas.

## Qué implementar

1. **`useExportarPdfControlado`:** en `onSuccess`, después de descargar, invalida `QUERY_KEYS.documents.detail(documento.id)`. El id está en las `variables` de la mutación.
2. **`DocumentViewer`:** cuando el blob del visor llega bien, invalida `QUERY_KEYS.documents.detail(documentoId)` **una sola vez por apertura**. No uses `useEffect` para derivar estado (regla 1 de CLAUDE.md). La opción recomendada es hacer la invalidación dentro de la misma `queryFn`, después del `await getDocumentVisorBlob(...)`, usando `useQueryClient`. Revisa que no se cree un bucle: el visor no depende de `detail` y `detail` no vuelve a montar el visor. Si invalidar `detail` re-renderiza el panel y remonta el visor, eso causaría otra `VISUALIZACION`; confírmalo con un test y evítalo.
3. **Barrido:** busca cualquier otra llamada que escriba en el audit trail y no invalide `detail(id)`, por ejemplo la impresión desde el visor si registra algo, o la vista previa del PDF controlado. Lista lo que encuentres en `design.md`.
4. **Acciones de otros usuarios (SignalR):** cuando llega por el hub un evento o notificación cuya entidad es un documento (`EntidadTipo = DOCUMENTO`, `EntidadId`), invalida `detail(EntidadId)` y `documents.all`. Usa lo que el hub ya envía; **no** agregues eventos nuevos al backend en este change. Si el hub no trae el id de la entidad, anótalo en `design.md` y deja este punto fuera.
5. **No** cambies `refetchOnWindowFocus` global; afectaría a toda la app.

## Tests (frontend)
- Al descargar la copia, se invalida `detail(id)` (spy sobre `queryClient.invalidateQueries`).
- Al cargar el visor, se invalida `detail(id)` una sola vez y el visor no se vuelve a pedir por esa invalidación (`getDocumentVisorBlob` llamado una vez).
- Si el visor falla (403/404/422), no se invalida.
- Con MSW: abrir el visor y luego descargar la copia, y verificar que el log muestra `VISUALIZACION` y `DESCARGA` sin recargar la página.

## Reglas de siempre
- El código real manda sobre este doc; cualquier divergencia va en `design.md`.
- Corre la suite completa del frontend y `tsc`.
- Prueba manual con MSW apagado:
  1. Abre un documento publicado con el log desplegado.
  2. Pulsa "Ver documento" → aparece "Visualización" en el log sin salir.
  3. Pulsa "Descargar copia (PDF)" → aparece "Descarga".
  4. Con dos navegadores (autor y revisor), aprueba desde el revisor y confirma que el detalle del autor se actualiza solo (si se implementó el punto 4).
- Al terminar, Toño avisa con "listo". Cowork verifica releyendo el código real.
