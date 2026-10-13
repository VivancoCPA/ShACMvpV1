## 1. Helper compartido

- [x] 1.1 Crear `features/documents/utils/publicacion.ts` con `getDatosPublicacion(documento: Documento): { firmadoPorId: string; fecha: string; hash?: string } | undefined`, implementando los 3 niveles de respaldo del design.md (FIRMA_REGISTRADA más reciente → ESTADO_CAMBIADO→PUBLICADO más reciente → aprobadorId+fechaEmision → undefined).
- [x] 1.2 Tests unitarios de `getDatosPublicacion` cubriendo los 4 escenarios de la spec (con hash, sin hash vía fallback 2, sin hash vía fallback 3, undefined).
- [x] 1.3 `DocumentDetailSidebar.tsx`: eliminar la función local `getFechaPublicacion` y usar `getDatosPublicacion(documento)?.fecha` en su lugar. Actualizar `DocumentDetailSidebar.test.tsx` si algún caso dependía del comportamiento anterior (sin el fallback 3).

## 2. Contenido de la pestaña Resumen

- [x] 2.1 `DocumentDetailPage.tsx`: cambiar el placeholder de descripción vacía de `"—"` a `t('documents:detail.sinDescripcion')` en `muted`.
- [x] 2.2 Nuevo componente `DocumentPublicadoCard.tsx` (o sección inline en `DocumentDetailPage.tsx`, según se acomode mejor al resto del panel) que reciba `documento`, `availability`, `controller`, `getName` y renderice la tarjeta "Documento publicado" solo cuando `estado` sea `PUBLICADO`, `EN_REVISION_PERIODICA` u `OBSOLETO` y `getDatosPublicacion` resuelva: ícono PDF, nombre `{codigo} v{version}.pdf`, línea "Firmado por {nombre} · {fecha y hora} · hash abreviado" (usando `formatDateTime` de `utils/date.utils.ts`), botón "Ver" condicionado a `availability.canVerDocumento` que llama `controller.setShowVisor(true)`, y línea "Versión obsoleta desde {fechaObsolescencia}" solo en `OBSOLETO` cuando el campo existe.
- [x] 2.3 Hash abreviado (`slice(0,4) + '…' + slice(-4)`) en `font-mono` con `title={hash}` (tooltip) y botón "Copiar hash" que usa `navigator.clipboard.writeText` envuelto en `try/catch`, mostrando `toast.success(t('documents:detail.publicado.hashCopiado'))` (Sonner) al copiar. La línea de hash y el botón no se renderizan cuando `getDatosPublicacion` no devuelve `hash`.
- [x] 2.4 Sección "Motivo del cambio (v{version})" con `documento.motivoVersion`, visible en cualquier estado cuando el campo existe; ausente en caso contrario.
- [x] 2.5 Sección "Vigente desde" con `documento.fechaVigencia` vía `formatCalendarDateMedium`, solo cuando `estado` es `PUBLICADO` o `EN_REVISION_PERIODICA` y el campo existe.
- [x] 2.6 Verificar que en `BORRADOR`/`EN_REVISION`/`EN_APROBACION` no se rendericen ninguno de los tres bloques nuevos, y que la sección del archivo original (`showArchivoSection`) conserve su posición y condición actuales sin cambios.

## 3. i18n

- [x] 3.1 Agregar en `es-PE.json`/`en-US.json` (namespace `documents`), bajo `detail`: `sinDescripcion`, y un nuevo bloque `publicado` con `titulo` ("Documento publicado"), `firmadoPor` (plantilla "Firmado por {{nombre}} · {{fecha}}"), `copiarHash`, `hashCopiado`, `verBoton` (reusar `visor.verDocumento` si aplica en vez de duplicar), `obsoletoDesde` ("Versión obsoleta desde {{fecha}}"), `motivoCambio` ("Motivo del cambio (v{{version}})"), `vigenteDesde` ("Vigente desde").
- [x] 3.2 Grep sobre los componentes nuevos/tocados para confirmar que no quede texto en español hardcodeado entre tags JSX (regla CLAUDE.md #4).

## 4. MSW

- [x] 4.1 En `mocks/fixtures/documents.fixtures.ts`, agregar una entrada `FIRMA_REGISTRADA` (con `valorNuevo` = hash de ejemplo realista, p.ej. 64 caracteres hex) y un `motivoVersion` a al menos un documento fixture `PUBLICADO` y uno `OBSOLETO` que ya existan — sin crear documentos nuevos.
- [x] 4.2 Confirmar que el documento `EN_REVISION_PERIODICA` fixture (si existe) también tenga datos suficientes para que la tarjeta se vea en ese estado; si no hay uno, usar el mismo fixture `PUBLICADO` reutilizado por ese estado en otras pruebas.

## 5. Tests

- [x] 5.1 Test de integración en `DocumentDetailPage.test.tsx` (o nuevo archivo dedicado): `PUBLICADO` con `FIRMA_REGISTRADA` → la tarjeta muestra nombre del firmante, fecha/hora, hash abreviado, tooltip con hash completo, y "Ver" abre el visor (mock del controller/availability).
- [x] 5.2 Test: `PUBLICADO` sin `FIRMA_REGISTRADA` → usa el fallback (2 o 3), sin hash, sin errores.
- [x] 5.3 Test: `OBSOLETO` → la tarjeta incluye "Versión obsoleta desde {fecha}".
- [x] 5.4 Test: `motivoVersion` presente → se muestra "Motivo del cambio (v{version})"; ausente → la sección no aparece.
- [x] 5.5 Test: `BORRADOR`, `EN_REVISION`, `EN_APROBACION` → sin tarjeta de publicado, sin "Vigente desde".
- [x] 5.6 Test: la sidebar (`DocumentDetailSidebar.test.tsx`) sigue mostrando la fecha de publicación correcta ahora vía el helper compartido, incluyendo el caso del fallback 3 (aprobadorId+fechaEmision) que antes no cubría.
- [x] 5.7 Test de `getDatosPublicacion` (ver 1.2) corrido como parte de la suite.

## 6. Verificación final

- [x] 6.1 `npx tsc -b --force` — 0 errores nuevos introducidos por este change. Quedan exactamente los mismos errores preexistentes de antes de empezar (11 en `mocks/fixtures/documents.fixtures.ts` por `archivoUrl`, 4 en `mocks/handlers/documents.handlers.ts`, 2 en `types/documents.types.test.ts`, 1 en `IncidentForm.tsx` — ninguno en archivos tocados por este change).
- [x] 6.2 `vitest` targeted sobre `src/features/documents` completo (y `mocks/handlers/documents.handlers.test.ts`): 30 archivos / 376 tests, todos en verde (incluye los 2 archivos nuevos: `publicacion.test.ts` y `DocumentDetailPage.resumen.test.tsx`, y los casos agregados a `DocumentDetailSidebar.test.tsx`).
- [ ] 6.3 Prueba manual con MSW apagado: abrir el documento que Toño publicó — la pestaña Resumen muestra la tarjeta con firmante, fecha/hora y hash; "Ver" abre el visor; el motivo del cambio aparece si se llenó. Revisar también un documento en `BORRADOR` (sin tarjeta) y el modo oscuro.
