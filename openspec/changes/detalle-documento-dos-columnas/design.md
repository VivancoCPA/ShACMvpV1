## Context

`DocumentDetailPage.tsx` hoy envuelve todo en `mx-auto max-w-3xl space-y-6` y apila, en orden fijo: `DocumentDetailHeader` (card con título/badges/metadata grid; los banners viven *dentro* de este componente, antes de la card), `DocumentActionPanel` (fila de botones + toda la lógica de permisos inline), y cinco bloques colapsables con `useState` local (descripción+archivo, historial, versiones —no colapsable—, QE vinculados, NC vinculadas, audit trail).

`useUserNames([...])` se llama una sola vez en la página (decisión D4 de `nombres-usuarios-reales`) y `getName` se pasa a los hijos — esto se mantiene sin cambios.

Referencia visual aprobada por Toño: `Claude outputs/SHAC-Mockup-Detalle-Documento-Opcion1.html` (boceto HTML plano, CSS propio que no se copia — solo la estructura/retícula).

### Hallazgos de la lectura de código (antes de proponer)

- **`copias-controladas` no existe en el repo**: no aparece en `openspec list` (changes activos), no está en `openspec/changes/archive/`, y no hay spec `copias-*` en `openspec/specs/`. No hay ningún componente de "copias controladas" implementado. La pestaña "Copias" del mockup no tiene con qué llenarse todavía → **queda detrás de una constante de feature flag `ENABLE_COPIAS_TAB = false`** en el propio archivo de la pestaña, documentada con un comentario que apunta a este design.md. Cuando `copias-controladas` se proponga y archive, ese flag se retira en ese change, no en este.
- **`fix-log-refresco-inmediato` está funcionalmente completo**: las tareas de código (invalidación de queries en `useExportarPdfControlado`, `DocumentViewer`, `useNotificationsHub`) ya están hechas y testeadas (9/12 tareas; las 3 pendientes son solo verificación manual en navegador). La dependencia que este change necesita (que "Ver documento"/"Descargar copia" refresquen el detalle sin recargar, para que Actividad reciente y Log se actualicen solos) ya está satisfecha en el código — no bloquea el inicio de este change.
- **`DocumentAuditTrail` ya pagina del lado del cliente con `PAGE_SIZE = 20` y botón "Ver más"** — el requisito de "log paginado" del encargo ya está resuelto por el componente existente; la pestaña Log solo lo reutiliza tal cual, sin reimplementar paginación.
- **Avatares de usuario no son archivos**: `ShacUser.AvatarUrl` (columna `avatar_url`, `text`, nullable) se escribe en `ActualizarUsuarioHandler`/`CrearUsuarioHandler` directamente desde `command.AvatarBase64` — es decir, hoy ya es una **data URI base64 inline**, nunca una ruta a `wwwroot` ni un archivo servido aparte. `UserAvatar.tsx` ya lo consume como `<img src={user.avatarUrl}>` sin ninguna llamada adicional. **No aplica ninguna limitación de blob/MSW/descarga aquí** (a diferencia de `archivoOriginalUrl`/`archivoDistribucionUrl`) — es un string más que viaja en el JSON de la respuesta. `proteccion-documental` no necesitaba tocar esto y no lo tocó.
- **`UserNombreDto` es deliberadamente mínimo** (`Id`, `NombreCompleto`) — el comentario en el código dice explícitamente "sin email/rol/avatar". Extenderlo a `avatarUrl` (y `nombre`/`apellido` separados, necesarios para las iniciales de `UserAvatar`) es un cambio de contrato consciente, no un descuido.
- **`UserAvatar` exige `rol: UserRole`** para elegir el color de fondo de fallback (`ROLE_AVATAR_BG`). El endpoint de nombres no expone rol (y no debe empezar a hacerlo — rompería el principio de superficie mínima de `shared-user-identity`). Se resuelve haciendo `rol` opcional en `UserAvatar`, con un color de fondo neutro (`surface-cream`/`bg-cream`) cuando no se provee.

## Goals / Non-Goals

**Goals:**
- Layout de dos columnas (contenido con pestañas + barra lateral fija) en `≥xl` (1280px), una columna con la barra lateral primero por debajo de ese punto de quiebre.
- Encabezado fijo con banners reubicados fuera de la zona sticky.
- Pestañas con estado sincronizado a `?tab=`, reutilizando componentes existentes sin tocar su lógica interna.
- Separar la lógica de disponibilidad de acciones de `DocumentActionPanel` de su markup, para que header (máx. 2 botones + menú "⋯") y sidebar (acciones de lectura) consuman la misma fuente de verdad sin duplicar reglas.
- Ficha de metadatos con avatar+iniciales de responsables (requiere el cambio mínimo de backend descrito arriba).
- Ningún cambio de reglas de negocio ni de permisos — paridad exacta del conjunto de acciones disponibles por estado/rol, solo reubicadas.

**Non-Goals:**
- No se implementa la pestaña "Copias" en sí (depende de `copias-controladas`, change inexistente) — solo se deja el hueco gateado.
- No se cambia el almacenamiento de avatares (sigue siendo base64 inline) ni se introduce subida de archivos nueva.
- No se tocan las reglas RN-DOC-*/RN-QE-* ni el motor de permisos (`permissions.ts`, `DocumentPermissionResolver` en backend).
- No se pagina el audit trail en el backend (se mantiene paginación cliente existente).

## Decisions

**D1 — Grid de dos columnas desde `xl`, una columna con sidebar primero por debajo.**
`max-w-[1440px] px-8` en el contenedor de la página; `grid grid-cols-[minmax(0,1fr)_340px] gap-6 items-start` a partir de `xl`. Por debajo, `grid-cols-1`. Sin scroll horizontal de página en ningún ancho — las tablas de cada pestaña llevan su propio `overflow-x-auto`.

*Corrección post-implementación:* la primera versión de esta decisión decía "sin `order-*` de CSS, orden natural del DOM" — al implementar se confirmó que el propio mockup de referencia SÍ usa `order` (`.side{order:-1}` en su media query `max-width:1100px`), precisamente porque el DOM real tiene el contenido (pestañas) antes que la sidebar (para que el lector de pantalla llegue primero al contenido principal, patrón convencional), y es el CSS el que la sube visualmente en pantallas angostas. La implementación sigue ese mismo mecanismo: DOM = banners → pestañas → sidebar; la sidebar lleva `order-first` (y `xl:order-none` para volver a la posición natural de segunda columna desde `xl`). El código real es la fuente de verdad; este documento queda corregido para no contradecirlo.

**D2 — La ficha de la barra lateral muestra versión vigente + fecha de publicación como campo propio.**
`fechaPublicacion` se deriva de la última entrada `FIRMA_REGISTRADA`/transición a `PUBLICADO` en `documento.auditTrail` (mismo patrón que `getPublisher` en `DocumentVersionesTab`) — no es un campo nuevo de `Documento`, se calcula en el cliente. Si el documento nunca fue `PUBLICADO`, muestra "—".

**D3 — Avatares de responsables con iniciales de respaldo.**
`useUserNames` gana `getUser(id) → { nombre, apellido, avatarUrl? } | undefined` además de `getName` (que no cambia). La ficha usa `<UserAvatar user={{ nombre, apellido, avatarUrl }} size="sm" />` sin pasar `rol` (ver cambio de `UserAvatar` abajo). Si `getUser` no resuelve (nombre no cargado aún, o id ausente como revisor/aprobador sin asignar) se muestra el texto "Sin asignar"/estado de carga, nunca el componente de avatar vacío.

**D4 — `UserAvatar.rol` pasa a opcional.**
`interface UserAvatarProps { user: { nombre: string; apellido: string; avatarUrl?: string; rol?: UserRole } }`. Cuando `rol` está ausente, el fondo de fallback usa una clase fija neutra (`bg-surface-cream text-ink dark:bg-surface-dark-elevated dark:text-on-dark`) en vez de `ROLE_AVATAR_BG[rol]`. Los consumidores actuales (lista de usuarios, lista de empresas) siguen pasando `rol` y no cambian de apariencia.

**D5 — Contrato de `GET /api/users/nombres` se extiende, no se reemplaza.**
`UserNombreDto` pasa a `(Guid Id, string NombreCompleto, string? Nombre, string? Apellido, string? AvatarUrl)`. `NombresUsuariosHandler` ya selecciona `Nombre`/`Apellido` por separado en el SQL (`NombreRow`) — solo agrega `u.avatar_url` al `SELECT` y a la proyección. Frontend: `UserNombre` (`userManagement.types.ts`) gana los mismos tres campos opcionales; `getUserNames` no cambia de firma. Se eligen opcionales (no se retira `nombreCompleto`) para no romper ningún consumidor existente de `getName`/`useUserNames` fuera de este change.

**D6 — Separación de permisos y markup de `DocumentActionPanel` vía hook.**
Nuevo `useDocumentActionsAvailability(documento, user): { canVerDocumento, canDescargarCopia, canSendToReview, canSendToReviewBloqueadoPorAsignacion, canApproveReview, canRejectReview, canCancelReview, canSign, canRejectAprobacion, canStartPeriodic, canCreateVersion, canStartNewVersion, canDelete, otraVersionEnProceso, hasAnyAction }` — es una extracción 1:1 de los `const can*` que hoy viven inline en `DocumentActionPanel.tsx` (línea ~134-198), **sin cambiar ninguna condición**. `DocumentActionPanel` pasa a ser un componente más pequeño que solo orquesta modales (`DocumentSignatureModal`, `DocumentRejectModal`, `DocumentNuevaVersionModal`, `DocumentRevisionPeriodicaModal`, confirmaciones inline, visor, preview de PDF) y expone funciones `abrir*`/handlers; el *rendering* de los botones se separa en:
- Botones de **gestión** (enviar a revisión, aprobar/rechazar, firmar, iniciar/cancelar revisión periódica, nueva versión, eliminar) → los pinta el encabezado, eligiendo como máximo 2 según prioridad por estado (ver D7) y el resto va al menú "⋯".
- Botones de **lectura** (Ver documento, Descargar copia, Emitir copia controlada — este último condicional/gateado igual que la pestaña Copias) → los pinta la tarjeta 1 de la barra lateral.

El estado de los modales permanece en un único lugar (se sube de `DocumentActionPanel` a un hook/contexto pequeño o al propio `DocumentActionPanel`, que ahora se monta una sola vez en la página y es consumido por header+sidebar vía callbacks) — a decidir en tasks.md el mecanismo concreto (prop drilling simple vs. contexto), priorizando el que toque menos archivos.

**D7 — Prioridad de botones visibles en el encabezado (máximo 2).**
Orden de prioridad por acción disponible (de mayor a menor, se muestran las primeras 2 que aplican, el resto a "⋯"): `canSign` > `canApproveReview` > `(canRejectReview || canRejectAprobacion)` > `canSendToReview`/`canSendToReviewBloqueadoPorAsignacion` > `canStartNewVersion` > `canCreateVersion` > `canStartPeriodic` > `canCancelReview` > `canDelete`. Esta prioridad refleja la acción más "siguiente paso del flujo" primero; es una decisión de UX nueva (el mockup solo ilustra con "Nueva versión" + "Iniciar revisión periódica" para un `PUBLICADO`, que coincide con esta prioridad) y no una regla de negocio — se documenta aquí para que los tests de paridad puedan fijarla.

**D8 — Pestañas: componente propio en `components/ui/Tabs.tsx`.**
No existe ya un componente de pestañas reutilizable en el design system (se confirmó buscando en `components/ui/`). Se crea uno mínimo y accesible (`role="tablist"`, `Tab`/`TabPanel`, navegación con flechas, `aria-selected`) en vez de una librería externa — consistente con "no negociable: sin dependencias nuevas" implícito en CLAUDE.md (no se menciona ninguna librería de tabs en el stack).

**D9 — `?tab=` como única fuente de la pestaña activa.**
Se lee con `useSearchParams` (ya importado en la página); cambiar de pestaña hace `setSearchParams` sin crear una entrada nueva de historial (`replace`) salvo que se prefiera lo contrario — se deja como `replace: true` para no ensuciar el botón "atrás" del navegador con cada click de pestaña. Valores válidos: `resumen` (default) | `historial` | `versiones` | `vinculos` | `log` (y `copias` solo si el flag D-anterior está activo). Un valor inválido o ausente cae a `resumen`. El `initialAction=iniciar-revision` existente (abre el modal de revisión periódica) es independiente de `?tab=` y se mantiene intacto.

**D10 — "Copias" detrás de feature flag, no borrado del diseño.**
Ver hallazgo de contexto. El flag vive como constante exportada (`DOCUMENT_DETAIL_COPIAS_TAB_ENABLED = false`) cerca de la definición de pestañas, con comentario explícito. El contador de la pestaña y su contenido ya no se renderizan mientras el flag esté apagado — no se oculta con CSS, se omite del array de pestañas.

## Risks / Trade-offs

- **[Riesgo] Romper paridad de acciones al mover el rendering fuera de `DocumentActionPanel`** → Mitigación: extracción 1:1 de condiciones a `useDocumentActionsAvailability` sin reescribir ninguna; los tests existentes de `DocumentActionPanel.test.tsx` se adaptan (no se borran) para verificar el *conjunto* de acciones disponibles (botones visibles + menú + sidebar) por estado/rol, igual al de antes.
- **[Riesgo] `UserAvatar.rol` opcional cambia el tipo de un componente compartido** → Mitigación: es un ensanchamiento (antes requerido, ahora opcional), no hay consumidor existente que deje de compilar; se corre `tsc --noEmit` completo.
- **[Riesgo] Extender `UserNombreDto` expone más superficie de la que el comentario original documentaba como intencional** → Mitigación: se mantiene la exclusión explícita de `email`/`rol`; se actualiza el comentario del DTO para reflejar el nuevo alcance (nombre/apellido/avatar sí, email/rol no) en vez of dejar el comentario viejo contradiciendo el código.
- **[Riesgo] Sticky header + sticky sidebar con alturas dinámicas (banners aparecen/desaparecen) pueden desincronizar el `top` del sidebar** → Mitigación: el sidebar usa `sticky top-[var(--header-h)]` o un valor fijo conservador medido en el header actual (sin banners, que viven fuera del área sticky tras este cambio) — los banners ya no afectan la altura de la zona fija porque se reubican fuera de ella (ver proposal).
- **[Riesgo] `copias-controladas` se vuelve "fantasma" si nadie recuerda retirar el flag** → Mitigación: el flag y su comentario apuntan a este design.md; se añade una nota en tasks.md para no marcar la tarea del flag como "hecha para siempre" sino como "pendiente de retirar cuando `copias-controladas` archive".

## Migration Plan

Sin migración de datos (la columna `avatar_url` ya existe). Despliegue en un solo paso: backend (DTO/handler) y frontend (tipos/hook/componentes) se despliegan juntos porque el contrato se extiende de forma aditiva (campos opcionales) — el frontend puede desplegarse antes o después del backend sin romper nada (si llega antes, `avatarUrl`/`nombre`/`apellido` vienen `undefined` y la UI cae a "Sin asignar"/iniciales; si el backend llega antes, el frontend viejo simplemente ignora los campos nuevos). Rollback: revertir el commit del frontend no requiere rollback de backend ni viceversa.

## Hallazgo adicional durante la implementación

El requirement "DocumentHistorial section" en `openspec/specs/document-detail/spec.md` (main spec, no esta delta) describe una entrada sintética "Creado en Borrador" y badges de versión/`StatusBadge` que **no existen en el código real** de `DocumentHistorial.tsx` — el componente real solo lista entradas de `documento.auditTrail` filtradas por un `Set` de `accion` relevantes, sin ninguna entrada sintética ni badge de versión (el propio comentario del archivo ya lo aclara: "derivado de documento.auditTrail — nunca historialVersiones (no existe en el backend real...)"). Es decir, el main spec ya estaba desactualizado respecto al código *antes* de este change (no es una regresión introducida aquí). La delta spec de este change para ese requirement se escribió inicialmente copiando el texto del main spec (como indica el flujo de MODIFIED Requirements) y heredó la misma inexactitud — se corrigió en esta delta para reflejar el componente real (ver `specs/document-detail/spec.md` de este change), y se exportó `getHistorialEntries` desde `DocumentHistorial.tsx` para que el contador de la pestaña use la misma fuente de verdad que el propio componente, en vez de inventar un campo `historialVersiones` que no existe en `Documento`. **No se corrigió el main spec** (fuera de alcance de este change) — queda pendiente para quien sincronice specs o audite `document-detail` por separado.

## Open Questions

- ~~Mecanismo exacto para compartir el estado de modales de `DocumentActionPanel` entre header y sidebar~~ — resuelto durante la implementación, ver "Arquitectura final de acciones" abajo.
- Si se prefiere `setSearchParams(..., { replace: true })` o permitir historial por click de pestaña — D9 fija `replace: true` como default razonable; reversible sin impacto en specs.

## Arquitectura final de acciones (post-implementación)

`DocumentActionPanel.tsx` se retiró por completo (no quedó ningún componente con ese nombre ni ese archivo) — no era solo una extracción de la disponibilidad (D6), sino una redistribución real de responsabilidades, ya que sus botones ahora viven en dos lugares físicamente distintos (header + sidebar) en vez de una sola fila. División final:

- **`useDocumentActionsAvailability(documento)`** (ya documentado en D6): banderas puras, sin JSX, consumida por header y sidebar. Se le agregaron `isDeleted`/`canRestore` para replicar el `return` anticipado que existía inline cuando `documento.deletedAt` — sin esto, un documento eliminado habría mostrado banderas de acciones "normales" calculadas sobre su `estado` subyacente, que es exactamente el bug que el `return` anticipado original evitaba (encontrado y corregido durante la implementación, con test de regresión en `useDocumentActionsAvailability.test.ts`).
- **`useDocumentActionsController(documento, initialAction)`**: solo estado (`modal`, `showVisor`, `showPdfPreview`, `showRestoreConfirm`) y mutations (`changeStatus`, `deleteDocument`, `restaurar`, `exportar`), sin JSX — reemplaza los `useState`/mutations que vivían inline en `DocumentActionPanel`.
- **`utils/documentManagementActions.ts` (`getManagementActionItems`) + `DocumentManagementActions.tsx`**: resuelve la lista priorizada (D7) de acciones de gestión y la pinta en el header (máx. 2 inline + menú "⋯").
- **`DocumentDetailSidebar.tsx`**: pinta las acciones de lectura (Ver documento / Descargar copia) directamente desde `availability`+`controller`, sin un componente intermedio — son solo 2 botones, no justifican su propio archivo de "acciones".
- **`DocumentActionModals.tsx`**: todos los diálogos/overlays (confirmaciones inline, firma, rechazo, nueva versión, revisión periódica, preview PDF, visor) montados una sola vez en `DocumentDetailPage`, consumiendo `controller` — ningún botón vive aquí, solo los modales que esos botones disparan.
- **`DocumentDetailBanners.tsx`**: los banners contextuales (antes dentro de `DocumentDetailHeader`), incluyendo el aviso de documento eliminado (antes parte del bloque "deleted" de `DocumentActionPanel"`, ahora separado de su botón de restaurar).

Cobertura de tests reemplazada 1:1 (no se perdió ningún caso, se redistribuyó): los 33 tests de `DocumentActionPanel.test.tsx` (retirado) se cubren ahora entre `useDocumentActionsAvailability.test.ts` (reglas de negocio/permisos — más preciso, al nivel del hook en vez de inferir del DOM), `DocumentDetailHeader.test.tsx` + `DocumentDetailBanners.test.tsx` (rendering), `DocumentDetailSidebar.test.tsx` y `DocumentActionModals.test.tsx` (rendering de lectura/modales), y el test de paridad de la tarea 17.1.
