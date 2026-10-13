# Instrucciones para Claude Code — Rediseño del detalle del documento: dos columnas, pestañas y barra lateral fija

Fecha: 2026-10-13
Autor: Cowork
Origen: Toño. El detalle apila todos los paneles en vertical, la página se alarga y se desperdician los espacios laterales.
Change sugerido: `detalle-documento-dos-columnas` (frontend, con un ajuste chico de backend para las fotos)

Ciclo: `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

**Referencia visual aprobada por Toño:** `Claude outputs/SHAC-Mockup-Detalle-Documento-Opcion1.html`. Ábrelo antes de empezar. Es un boceto en HTML plano con datos ficticios: reprodúcelo con los componentes, los tokens de Tailwind y el i18n reales. **No copies su CSS.**

Dependencias: hazlo después de `fix-log-refresco-inmediato` y `copias-controladas`, porque la pestaña "Copias" y el log paginado dependen de ellos. Si `copias-controladas` todavía no está archivado, deja la pestaña detrás de una condición y anótalo en `design.md`.

---

## Situación actual (leída en el código)

- `DocumentDetailPage.tsx` envuelve todo en `mx-auto max-w-3xl` (unos 768 px). Dentro apila, en este orden: `DocumentDetailHeader`, `DocumentActionPanel`, y acordeones de descripción y archivo, historial, versiones, QE vinculados, NC vinculadas y audit trail.
- `useUserNames([...])` se llama una sola vez en la página y `getName` se pasa a los hijos (decisión D4 de `nombres-usuarios-reales`). Esto se mantiene.
- `User.avatarUrl` ya existe en los tipos y en `components/ui/UserAvatar`, que se usa en la lista de usuarios y en la de empresas. Pero el endpoint de nombres que alimenta `useUserNames` devuelve solo el nombre (`documents.types.ts`: "el backend no expone email ni avatar").

## Decisiones de Toño (2026-10-13)

- **D1 — ✅ Opción 1: dos columnas.** A la izquierda, contenido con pestañas; a la derecha, una barra lateral que se queda fija al hacer scroll. Encima, un encabezado que también se queda fijo.
- **D2 — ✅ La ficha muestra la versión vigente y, como campo propio, la fecha de publicación.**
- **D3 — ✅ Los responsables muestran su foto si existe, y sus iniciales si no.**

---

## Qué implementar

### 1. Layout de la página
- Quita el `max-w-3xl`. Usa un contenedor ancho (por ejemplo `max-w-[1440px]`, con `px-8`) y un grid `grid-cols-[minmax(0,1fr)_340px] gap-6 items-start` a partir de `xl` (≥ 1280 px).
- Por debajo de `xl` hay una sola columna, y la barra lateral va **encima** de las pestañas, como en el boceto.
- No debe haber scroll horizontal en ningún ancho. Las tablas de las pestañas hacen scroll dentro de su propio contenedor.

### 2. Encabezado fijo (`DocumentDetailHeader`)
- `sticky top-0` con fondo `canvas` y un borde inferior `hairline`. Contiene: miga de pan (Documentos / código), código en mono, título, píldoras de estado, versión y confidencialidad, el semáforo de revisión (reutiliza `RevisionSemaforo`) y, a la derecha, las **acciones de gestión**.
- Acciones de gestión según los permisos de siempre (`DocumentActionPanel`): nueva versión, enviar a revisión, aprobar o rechazar, firmar, iniciar o cancelar la revisión periódica, editar. Muestra **como máximo dos botones visibles**, elegidos por estado y permiso (los más probables para ese estado). El resto va en un menú **"⋯"** (eliminar, restaurar, reemplazar original, etc.).
- **No cambies ninguna regla de permisos.** Solo cambia dónde se pintan los botones. Si `DocumentActionPanel` mezcla la lógica de permisos con el markup, separa la lógica (por ejemplo un hook `useDocumentActionsAvailability`) y deja que el encabezado y la barra lateral la consuman. Documenta la separación.
- Los avisos (`detail.banners.*`: obsoleto, restringido, falta de asignación, revisión próxima, vencida o en curso, copias por recoger) pasan a una franja **debajo** del encabezado fijo, a todo el ancho y **fuera** de la parte fija, para que no ocupen pantalla al hacer scroll.

### 3. Columna izquierda: pestañas
Pestañas en este orden, cada una con un contador cuando aplique:

| Pestaña | Contenido actual que la llena |
|---|---|
| Resumen | Descripción, motivo del cambio y alcance (si existen en el tipo), y tarjeta del archivo (original o publicado, según el estado y las reglas de siempre, con sus botones actuales) |
| Historial (n) | `DocumentHistorial` |
| Versiones (n) | `DocumentVersionesTab` |
| Vínculos (n) | `DocumentQEVinculadosList` + `DocumentNCVinculadasList`, en una sola pestaña con dos subtítulos |
| Copias (n) | La sección de `copias-controladas`, visible solo para los roles que pueden ver ese listado |
| Log (n) | `DocumentAuditTrail` |

- Reutiliza los componentes existentes sin cambiar su lógica. Solo se quitan los acordeones.
- **Pestaña activa en la URL** (`?tab=historial`), para que un enlace o una notificación pueda abrir una pestaña concreta. Mantén la compatibilidad con el `initialAction` que hoy usa la página.
- Accesibilidad: `role="tablist"`, `tab` y `tabpanel`, `aria-selected`, y navegación con flechas. Si el proyecto ya tiene un componente de pestañas, úsalo; si no, crea uno pequeño en `components/ui`.
- **Log paginado:** muestra 20 entradas y un botón "Ver más" (paginación en el cliente sobre lo que ya llega en el detalle). Si el audit trail ya viene paginado del backend, respeta eso y anótalo.
- Una pestaña vacía muestra un estado vacío con texto, nunca un hueco en blanco.

### 4. Columna derecha: barra lateral fija
Con `sticky top-[altura del encabezado]` a partir de `xl`. Tiene tres tarjetas:
1. **Acciones de lectura:** "Ver documento" como botón principal y "Descargar copia (PDF)" como secundario, con su texto de ayuda. Para JCD, también "Emitir copia controlada". Las condiciones de visibilidad son exactamente las actuales: `canVerDocumento`, `canExportarPdf` y la regla de copias controladas.
2. **Ficha** (D2), en una cuadrícula de dos columnas:
   - Versión vigente · Publicado (fecha de publicación; "—" si no está publicado);
   - Tipo · Área;
   - Próx. revisión · Confidencialidad;
   - **Responsables:** autor, revisor y aprobador, cada uno con avatar (D3), nombre (`getName`) y rol en el documento. Si el revisor o el aprobador no están asignados, muestra "Sin asignar" en tono `muted`.
3. **Actividad reciente:** las últimas 5 entradas del audit trail en una línea cada una ("{nombre} {acción}" y una fecha relativa: "hace 5 min", "ayer", o la fecha si es más vieja). Incluye un enlace "Ver log" que abre la pestaña Log. Los datos vienen del mismo `documento`, sin una llamada nueva, y se actualizan solos con el fix de refresco.

### 5. Fotos de los responsables (D3)
- **Backend:** el endpoint de nombres que consume `useUserNames` debe devolver también `avatarUrl` (opcional), con la misma validación de tenant de siempre. No expongas el email ni otros datos.
- **Antes, verifica dónde y cómo se guardan los avatares.** Si siguen en `wwwroot` como URL pública, confirma si `proteccion-documental` ya los movió. Si no los movió, la foto se carga por blob autenticado, igual que los planos; no vuelvas a abrir una ruta estática. Documenta lo que encuentres en `design.md`.
- **Frontend:** amplía `useUserNames` para exponer algo como `getUser(id) → { nombre, avatarUrl? }` sin romper `getName`. Usa `UserAvatar` en la ficha, con iniciales como respaldo si no hay foto o si la imagen falla al cargar.
- MSW: agrega `avatarUrl` a algunas fixtures, no a todas, para probar ambos casos.

### 6. Estilo
- Usa solo los tokens existentes (`canvas`, `surface-card`, `hairline`, `ink`, `body`, `muted`, `coral`, etc.) y el modo oscuro (`dark:`) como en el resto de la app.
- Pestaña activa: subrayado `coral`. Botón principal: `ink` sobre `canvas`, como el boceto. Etiquetas: `text-xs uppercase tracking-wide text-muted`, el patrón actual del encabezado.
- i18n en es-PE y en-US para las etiquetas nuevas: pestañas, "Versión vigente", "Actividad reciente", "Ver log", "Sin asignar", "Ver más", estados vacíos y fechas relativas.

---

## Tests (frontend)
- Layout: en `xl` se renderizan las dos columnas; en un ancho menor, la barra lateral queda antes de las pestañas.
- Pestañas: la activa se sincroniza con `?tab=`; las flechas cambian de pestaña; los contadores son correctos; la pestaña Copias aparece solo para los roles permitidos.
- Acciones: para cada estado y rol de los tests actuales de `DocumentActionPanel`, el **conjunto** de acciones disponibles (botones visibles más menú "⋯" más barra lateral) es idéntico al de antes del rediseño. Adapta esos tests; no los borres.
- Ficha: muestra la versión y la fecha de publicación; "—" sin publicación; "Sin asignar" sin revisor.
- Avatar: con `avatarUrl` muestra la imagen; sin ella, o si la imagen falla, muestra las iniciales.
- Actividad reciente: muestra 5 entradas y "Ver log" abre la pestaña Log.
- Log: muestra 20 entradas y "Ver más" carga las siguientes.
- **Backend:** el endpoint de nombres devuelve `avatarUrl` cuando existe y no expone datos de otra empresa.

## Reglas de siempre
- El código real manda sobre este doc; cualquier divergencia va en `design.md`.
- Un cambio de contrato (el `avatarUrl` en nombres) se refleja a la vez en backend, MSW, tipos TS y tests.
- Corre la suite completa del frontend, los tests del backend y `tsc`.
- **Detén el backend y ejecuta `dotnet build` antes de la prueba manual.**
- Prueba manual con MSW apagado, a 1440 px, 1280 px, 1024 px y en el ancho de un celular:
  1. El detalle de un PUBLICADO se ve como el boceto: el encabezado y la barra lateral se quedan fijos al hacer scroll.
  2. Recorre las pestañas, copia la URL con `?tab=log` y ábrela en otra pestaña del navegador.
  3. Como autor en BORRADOR, como revisor en EN_REVISION, como aprobador en EN_APROBACION, como JCD y como operario en PUBLICADO: las acciones disponibles son las mismas de antes.
  4. Sube una foto a un usuario y confirma que aparece en la ficha; los demás muestran sus iniciales.
  5. Abre el visor y descarga una copia: la actividad reciente y el log se actualizan sin recargar.
  6. Revisa el modo oscuro.
- Al terminar, Toño avisa con "listo". Cowork verifica releyendo el código real.
