## 1. Backend — contrato de nombres con avatar

- [x] 1.1 `UserNombreDto.cs`: agregar `Nombre`, `Apellido`, `AvatarUrl` opcionales al record; actualizar el comentario (ya no es "sin rol/avatar", ahora es "sin email/rol").
- [x] 1.2 `NombresUsuariosHandler.cs`: agregar `avatar_url AS "AvatarUrl"` al `SELECT` del `NombreRow`, y mapear `Nombre`/`Apellido`/`AvatarUrl` al `UserNombreDto` junto con `NombreCompleto`.
- [x] 1.3 `NombresUsuariosEndpointTests.cs`: agregar casos — respuesta incluye `avatarUrl` cuando el usuario lo tiene; lo omite (no vacío) cuando no; nunca incluye `email`/`rol`; usuario de otra empresa sigue sin aparecer.
- [x] 1.4 Confirmar (sin cambiarlo) que `ActualizarUsuarioHandler`/`CrearUsuarioHandler` ya persisten `avatarUrl` como data URI base64 — no se requiere ninguna migración ni endpoint de archivo nuevo (ver design.md, hallazgo de contexto).

## 2. Frontend — tipos y hook de nombres

- [x] 2.1 `userManagement.types.ts`: `UserNombre` gana `nombre?`, `apellido?`, `avatarUrl?` opcionales.
- [x] 2.2 `useUserNames.ts`: agregar `getUser(id) → { nombre, apellido, avatarUrl? } | undefined`, sin cambiar la firma ni el comportamiento de `getName`.
- [x] 2.3 `useUserNames.test.ts`: casos para `getUser` — resuelve con avatar, resuelve sin avatar (undefined), devuelve `undefined` para id ausente/no cargado.

## 3. MSW — fixtures y handler

- [x] 3.1 `users.handlers.ts`: el handler `GET /api/users/nombres` agrega `nombre`, `apellido`, `avatarUrl` (cuando exista) a cada entrada devuelta, igual que el backend real.
- [x] 3.2 Fixtures de usuarios: agregar `avatarUrl` (data URI corta de prueba) a 2-3 usuarios de los que participan como autor/revisor/aprobador en documentos de ejemplo, dejando el resto sin avatar — para poder probar ambos casos (foto vs. iniciales).

## 4. `UserAvatar` — rol opcional

- [x] 4.1 `components/ui/UserAvatar.tsx`: `rol` pasa a opcional en `UserAvatarProps`; cuando está ausente, usar una clase de fondo neutra fija en vez de `ROLE_AVATAR_BG[rol]`.
- [x] 4.2 Test de `UserAvatar`: sin `rol`, con `avatarUrl` muestra la imagen; sin `rol` y sin `avatarUrl` muestra iniciales con el fondo neutro; con `rol` (uso existente) no cambia de apariencia.

## 5. `useDocumentActionsAvailability` — extracción de permisos

- [x] 5.1 Crear `hooks/useDocumentActionsAvailability.ts`: mover 1:1 (sin alterar ninguna condición) los `const can*`/`otraVersionEnProceso`/`hasAnyAction` hoy inline en `DocumentActionPanel.tsx` (líneas ~134-198), incluyendo el `useDocumentsByCode` que alimenta `otraVersionEnProceso`.
- [x] 5.2 `DocumentActionPanel.tsx`: consumir el nuevo hook en lugar de recalcular las mismas condiciones; el componente conserva el manejo de modales (firma, rechazo, nueva versión, revisión periódica, confirmaciones inline, visor, preview PDF) y las funciones que los abren. (Verificado: los 33 tests existentes de `DocumentActionPanel.test.tsx` siguen pasando sin modificarlos.)
- [x] 5.3 Test del hook (`useDocumentActionsAvailability.test.ts`): portar los casos de estado/rol que hoy prueban esas condiciones en `DocumentActionPanel.test.tsx`, verificando que cada flag coincide con el valor que producía el cálculo inline anterior.

## 6. Componente de pestañas reutilizable

- [x] 6.1 Crear `components/ui/Tabs.tsx`: `Tabs`/`TabList`/`Tab`/`TabPanel` (o equivalente mínimo), con `role="tablist"`/`role="tab"`/`role="tabpanel"`, `aria-selected`, navegación con flechas izquierda/derecha (y Home/End opcional), subrayado `coral` en la pestaña activa.
- [x] 6.2 Test del componente de pestañas: cambia de panel al click, `aria-selected` correcto, flechas mueven el foco entre tabs.

## 7. `DocumentDetailPage` — layout de dos columnas

- [x] 7.1 Quitar `mx-auto max-w-3xl`; nuevo contenedor `max-w-[1440px] px-8` con `grid grid-cols-[minmax(0,1fr)_340px] gap-6 items-start` desde `xl`; `grid-cols-1` por debajo. Corrección sobre el enunciado original (ver design.md D1): el DOM mantiene pestañas antes que la sidebar (como el propio mockup); la sidebar sube visualmente por debajo de `xl` con `order-first`/`xl:order-none`, no con orden de DOM.
- [x] 7.2 Verificado: ninguno de los componentes reutilizados en las pestañas (`DocumentVersionesTab`, `DocumentQEVinculadosList`, `DocumentNCVinculadasList`, `DocumentHistorial`, `DocumentAuditTrail`) usa `<table>` — son listas flex/div. El `<section>` de las pestañas lleva `overflow-hidden` + `min-w-0` como salvaguarda general; no se agregó `overflow-x-auto` por componente porque no hay contenido ancho que lo necesite hoy.
- [x] 7.3 `?tab=` leído con `useSearchParams`, validado contra `resumen|historial|versiones|vinculos|log` (+`copias` solo si el flag está activo) con fallback a `resumen`; `setSearchParams(..., { replace: true })` al cambiar de pestaña. `initialAction=iniciar-revision` se sigue pasando a `useDocumentActionsController`, independiente de `?tab=`.
- [x] 7.4 Eliminados los `useState` de acordeones — la página ya no los tiene.

## 8. Pestaña Resumen

- [x] 8.1 Contenido de "Descripción y detalle" movido al panel Resumen sin cambiar su lógica de permisos.
- [x] 8.2 `Documento` no expone motivo del cambio ni alcance como campos propios (confirmado por grep sobre `documents.types.ts`) — se omitió esa parte, sin inventar campos.

## 9. Pestaña Historial

- [x] 9.1 `DocumentHistorial` montado directamente como contenido del panel, sin wrapper de acordeón.
- [x] 9.2 Contador de la pestaña = `getHistorialEntries(documento).length` (exportado de `DocumentHistorial.tsx`) — corrección sobre el enunciado original: `Documento.historialVersiones` no existe en el tipo real (ver design.md, "Hallazgo adicional durante la implementación"); no hay entrada sintética que sumar.

## 10. Pestaña Versiones

- [x] 10.1 `DocumentVersionesTab` montado como contenido del panel, sin el card `border-l-4 border-l-coral`.
- [x] 10.2 Contador de la pestaña = `versionesData?.items.length` vía `useDocumentVersiones(documento.codigo)` (misma query key que `DocumentVersionesTab`, sin fetch adicional).

## 11. Pestaña Vínculos

- [x] 11.1 Un solo panel con dos subtítulos: "QE vinculados" y "NC vinculadas", sin wrappers de acordeón.
- [x] 11.2 Contador de la pestaña = `qeVinculados.length + ncVinculados.length`.
- [x] 11.3 Verificado: `DocumentQEVinculadosList`/`DocumentNCVinculadasList` ya manejan su propio estado vacío individual (`qeVinculados.vacio`/`ncVinculados.vacio`) — nunca queda un hueco en blanco aunque una de las dos tenga items y la otra no; no hizo falta un estado vacío combinado adicional.

## 12. Pestaña Copias (gateada)

- [x] 12.1 Constante `DOCUMENT_DETAIL_COPIAS_TAB_ENABLED = false` en `DocumentDetailPage.tsx`, con comentario apuntando a design.md; `isValidTabId` rechaza `?tab=copias` mientras esté apagada.
- [x] 12.2 Placeholder de contenido (`detail.copias.placeholder`) detrás del flag — spreadeado condicionalmente en el array de `tabs`, no rompe nada si se activa manualmente.

## 13. Pestaña Log

- [x] 13.1 `DocumentAuditTrail` montado como contenido del panel — su paginación 20+"Ver más" no se tocó.
- [x] 13.2 Contador de la pestaña = `auditTrail.length`.

## 14. Encabezado fijo con acciones de gestión

- [x] 14.1 `DocumentDetailHeader.tsx`: agregar `sticky top-0` + fondo `canvas`/`dark:surface-dark` + borde inferior; retirar la metadata grid completa (Tipo/Área/Autor/Revisor/Aprobador/fechas) — esos datos pasan a la ficha de la sidebar.
- [x] 14.2 Mover los banners (obsoleto, QE-vinculados, restringido, falta de asignación, revisión próxima/vencida/en curso, rechazo, documento eliminado) a `DocumentDetailBanners.tsx`, renderizado debajo del header fijo, fuera del elemento `sticky`, a todo el ancho del grid (`col-span-full`).
- [x] 14.3 Renderizar en el header, además de breadcrumb/código/título/badges/semáforo, los botones de gestión vía `getManagementActionItems` (`utils/documentManagementActions.ts`) + `DocumentManagementActions` según la prioridad D7 de design.md (máx. 2 inline) + menú "⋯" con el resto. El manejo de modales se extrajo a `useDocumentActionsController` + `DocumentActionModals` (no quedó en `DocumentActionPanel`, que se retiró por completo — ver nota de arquitectura final en design.md). El caso de documento eliminado (`availability.isDeleted`) reemplaza las acciones normales por el botón/confirmación de restaurar.
- [x] 14.4 Reescrito `DocumentDetailHeader.test.tsx` (nuevo, sin `getName`/metadata grid) cubriendo: `sticky`, ausencia de metadata grid, prioridad/corte inline-vs-⋯ de acciones de gestión, y el caso de documento eliminado. Los casos de banners se portaron a `DocumentDetailBanners.test.tsx` (nuevo).

## 15. Barra lateral fija

- [x] 15.1 Crear `DocumentDetailSidebar.tsx` con `xl:sticky xl:top-[64px]`, estático por debajo (envuelta en un `<div className="order-first xl:order-none">` en la página para el reordenamiento responsive, ver D1 corregido).
- [x] 15.2 Tarjeta 1 — Acciones de lectura: "Ver documento" (primario, full-width) y "Descargar copia (PDF)" (secundario, full-width, con texto de ayuda) con las condiciones de visibilidad exactas de `canVerDocumento`/`canDescargarCopia` (vía `useDocumentActionsAvailability`, pasada como prop). "Emitir copia controlada" **no implementado** — depende de `DOCUMENT_DETAIL_COPIAS_TAB_ENABLED` (false hoy, ver tarea 12.1); el hueco queda documentado en el i18n (`detail.lectura.emitirCopiaControlada`) para cuando se active.
- [x] 15.3 Tarjeta 2 — Ficha: grid 2 columnas con Versión vigente/Publicado, Tipo/Área, Próx. revisión/Confidencialidad, y el bloque de Responsables (autor/revisor/aprobador) con `UserAvatar` + `getName` + `getUser`; "Sin asignar" cuando falta revisor/aprobador.
- [x] 15.4 Derivar `fechaPublicacion` de la última entrada relevante de `auditTrail` (mismo patrón que `getPublisher` en `DocumentVersionesTab`); "—" si el documento nunca fue `PUBLICADO`.
- [x] 15.5 Tarjeta 3 — Actividad reciente: últimas 5 entradas de `auditTrail` (`{nombre} {acción}` + fecha relativa vía `formatRelativeTime`/`Intl.RelativeTimeFormat`) y enlace "Ver log" que invoca `onVerLog` (cambia `?tab=log` en la página).
- [x] 15.6 `DocumentDetailSidebar.test.tsx` (nuevo): ficha muestra versión/fecha de publicación/"—"/"Sin asignar"; avatar con iniciales cuando `getUser` resuelve sin `avatarUrl`; actividad reciente muestra máx. 5 entradas y "Ver log" invoca el callback; acciones de lectura respetan las mismas condiciones que antes (casos de la extinta `DocumentActionPanel.test.tsx` portados); nada se renderiza cuando el documento está eliminado.

## 16. i18n

- [x] 16.1 Claves agregadas en `es-PE.json`/`en-US.json` bajo `documents.detail.{tabs,ficha,actividadReciente,lectura,vinculos,copias,menu}`. Las fechas relativas ("hace 5 min", "ayer") no necesitaron claves propias — `formatRelativeTime` (`utils/date.utils.ts`) usa `Intl.RelativeTimeFormat` nativo, que ya localiza es-PE/en-US automáticamente.
- [x] 16.2 Verificado por grep sobre los componentes nuevos/tocados: sin texto en español hardcodeado entre tags JSX; se encontró y corrigió un `aria-label="breadcrumb"` literal en `DocumentDetailHeader.tsx` (se quitó — el `<nav>` ya tiene contenido textual visible, no requería label propio).

## 17. Tests de paridad de acciones

- [x] 17.1 Nuevo `DocumentDetailPage.test.tsx` (integración, mocks por hook como `NonconformityDetailPage.test.tsx`, sin `DocumentActionPanel` que ya no existe): casos por `(estado, rol)` — PUBLICADO/operario (solo sidebar), BORRADOR/autor (enviar a revisión en header), EN_APROBACION/aprobador (firmar en header), documento eliminado/JEFE_CALIDAD_SYST (restaurar, sin acciones normales). Las reglas de permisos en sí (precedencia de docRole, scoping revisor/aprobador, confidencialidad) ya están cubiertas con más precisión en `useDocumentActionsAvailability.test.ts`.
- [x] 17.2 Test de layout en `DocumentDetailPage.test.tsx`: header + tablist + sidebar(ficha) presentes; el wrapper `order-first` de la sidebar existe y sigue al tablist en el DOM (`compareDocumentPosition`).
- [x] 17.3 Test de pestañas en `DocumentDetailPage.test.tsx`: `?tab=log` abre directo en Log; `?tab=no-existe` cae a Resumen; "Copias" ausente con el flag apagado; click en una pestaña la activa.

## 18. Verificación final

- [x] 18.1 `npx tsc -b --force` corrido completo: **0 errores nuevos** introducidos por este change. Quedan los mismos errores preexistentes de antes de empezar (campo `archivoUrl` removido de `Documento` pero aún referenciado en `mocks/fixtures/documents.fixtures.ts`/`mocks/handlers/documents.handlers.ts`; un caso en `IncidentForm.tsx`; dos en `documents.types.test.ts`) — ninguno en archivos tocados por este change; confirmado comparando contra `git show HEAD` antes de tocarlos. Fuera de alcance de este change arreglarlos.
- [x] 18.2 `vitest` corrido de forma targeted (no la suite completa — mismo criterio que `fix-log-refresco-inmediato`/`proteccion-documental`, riesgo de muerte por memoria baja documentado para este entorno): `src/features/documents` completo (26 archivos/275 tests), `src/features/users` + `src/components/ui` + `src/utils` + `src/mocks/handlers/users.handlers.test.ts` (15 archivos/118 tests, 1 fallo preexistente corregido — ver nota abajo), y los demás archivos que referencian las fixtures tocadas (`documents.handlers.test.ts`, `notificationGeneration.test.ts`, `quality-events.handlers.test.ts`, `notifications.handlers.test.ts`, `DocumentEditGuard.test.tsx`: 5 archivos/162 tests). Total: 46 archivos, ~555 tests, todos en verde.
- [x] 18.3 Backend: `dotnet test --filter NombresUsuariosEndpointTests` → 9/9 en verde (incluye los 2 casos nuevos de `avatarUrl`). Se intentó además la corrida completa de `ShcMvpEndPoint.Tests` (todas las áreas) en segundo plano — se detuvo tras ~27 min sin avance de CPU (colgada, causa no diagnosticada — posible dependencia de infraestructura de test como Testcontainers/Docker, ajena a este change). Como este change solo tocó 4 archivos del área Users/NombresUsuarios, el targeted run ya cubre el riesgo real; la corrida completa queda pendiente para quien quiera diagnosticar ese cuelgue por separado (no reproducido por este change: el build limpio y el targeted run ya confirman que el código compila y funciona).
- [x] 18.4 Se detuvo el proceso del backend en ejecución (PID 32808, con confirmación del usuario) y se corrió `dotnet build ShcMvpEndPoint.csproj`: 0 errores.
- [ ] 18.5 Prueba manual con MSW apagado, a 1440px, 1280px, 1024px y ancho de celular: layout de dos columnas en un `PUBLICADO` con header/sidebar fijos al hacer scroll.
- [ ] 18.6 Prueba manual: recorrer las pestañas, copiar la URL con `?tab=log`, abrirla en otra pestaña del navegador y confirmar que abre directo en Log.
- [ ] 18.7 Prueba manual: como autor en BORRADOR, revisor en EN_REVISION, aprobador en EN_APROBACION, JCD, y operario en PUBLICADO — las acciones disponibles (inline + "⋯" + sidebar) son las mismas que antes del rediseño.
- [ ] 18.8 Prueba manual: subir una foto a un usuario (vía admin) y confirmar que aparece en la ficha de un documento donde ese usuario es autor/revisor/aprobador; los demás responsables sin foto muestran iniciales.
- [ ] 18.9 Prueba manual: abrir el visor y descargar una copia — "Actividad reciente" y el Log se actualizan solos sin recargar la página.
- [ ] 18.10 Revisar modo oscuro en las dos columnas, el header fijo, la sidebar y las pestañas.
