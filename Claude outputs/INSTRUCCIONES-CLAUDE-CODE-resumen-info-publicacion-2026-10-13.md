# Instrucciones para Claude Code — Pestaña Resumen: mostrar la información de publicación

Fecha: 2026-10-13
Autor: Cowork (diagnóstico leyendo el código real)
Origen: Toño publicó un documento con el flujo completo, pero la pestaña **Resumen** no muestra la información de publicación que tenía el boceto aprobado (`Claude outputs/SHAC-Mockup-Detalle-Documento-Opcion1.html`).
Change sugerido: `resumen-info-publicacion` (frontend; pequeño). Es un complemento de `detalle-documento-dos-columnas`.

Ciclo: `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

---

## Diagnóstico (confirmado leyendo el código)

- En `DocumentDetailPage.tsx`, la pestaña `resumen` solo pinta `documento.descripcion` y la sección del **archivo original**, que se muestra cuando `showArchivoSection = perms.canViewArchivoOriginal || isObsoletoHistorico`.
- En PUBLICADO, el original no es visible por RN-DOC-013 (y así debe seguir). Por eso la pestaña queda casi vacía: no hay tarjeta de **documento publicado** (firmado por, fecha y hora, hash, "Ver") ni **motivo del cambio**.
- Los datos ya llegan en el detalle; **no hace falta cambiar el backend**:
  - quién firmó, cuándo y con qué hash: la entrada `FIRMA_REGISTRADA` del `auditTrail`, que `FirmarPublicarDocumentoHandler` registra con `ValorNuevo = hash`;
  - `motivoVersion`, `fechaVigencia` y `fechaEmision` vienen en el documento.
- `DocumentDetailSidebar` ya tiene `getFechaPublicacion()`, que busca esa entrada. Hoy esa lógica vive solo ahí.
- Causa: la instrucción de `detalle-documento-dos-columnas` decía "tarjeta del archivo (original o publicado, según el estado)", pero no detallaba qué mostrar para el publicado. Además, el boceto incluía un campo "Alcance" que **no existe** en el modelo (fue un error del boceto); **no lo crees**.

---

## Qué implementar

### 1. Helper compartido
Extrae a `features/documents/utils/publicacion.ts` una función `getDatosPublicacion(documento)` que devuelva `{ firmadoPorId, fecha, hash } | undefined`:
- toma la **última** entrada `FIRMA_REGISTRADA`; el hash es su `valorNuevo`;
- si no existe (documentos publicados antes de que se registrara la firma), el respaldo es la entrada `ESTADO_CAMBIADO → PUBLICADO` (sin hash) o, en último caso, `aprobadorId` + `fechaEmision`;
- verifica en `DocumentoAuditTrailLoader` / `AuditTrailEntry` el nombre real de los campos (`realizadoPorId`, `timestamp`, `valorNuevo`) y úsalos tal cual.

Haz que `DocumentDetailSidebar` use este helper en lugar de su `getFechaPublicacion` local, para que no haya dos versiones de la misma lógica.

### 2. Contenido de la pestaña Resumen, por estado
Orden de arriba hacia abajo:

1. **Descripción** con su etiqueta. Si no hay, muestra "Sin descripción" en `muted` en lugar de un "—" suelto.
2. **Tarjeta "Documento publicado"**, solo en **PUBLICADO, EN_REVISION_PERIODICA y OBSOLETO**:
   - ícono PDF y el nombre `{codigo} v{version}.pdf` (o el nombre real del PDF de distribución, si el backend lo expone);
   - "Firmado por {nombre} · {fecha y hora en Lima} · hash `{primeros 4}…{últimos 4}`". El hash completo va en `title` / tooltip, con un botón para copiarlo. Usa `getName` para el nombre y el formateador de fecha y hora de la app (no `toLocaleString` suelto);
   - un botón **"Ver"** que abre el visor con la misma acción y la misma condición que "Ver documento" de la barra lateral (`availability` / `controller`); sin lógica de permisos nueva;
   - en OBSOLETO, una línea más: "Versión obsoleta desde {fechaObsolescencia}", si existe.
3. **Motivo del cambio (v{version})**: `documento.motivoVersion`, si existe, en cualquier estado.
4. **Vigente desde**: `fechaVigencia`, si existe y el estado es PUBLICADO o EN_REVISION_PERIODICA, como fecha de calendario (`formatCalendarDateMedium`).
5. **Sección del archivo original**: sin cambios. Sigue saliendo solo cuando `showArchivoSection` lo permite (BORRADOR / EN_REVISION para los participantes, y CA-34 en OBSOLETO).

En BORRADOR, EN_REVISION y EN_APROBACION **no** se muestra la tarjeta de publicado. Si el documento tiene versiones anteriores publicadas, no las muestres aquí; para eso está la pestaña Versiones.

### 3. Estilo e i18n
- Reproduce la tarjeta del boceto con los tokens existentes (`surface-soft` o `canvas`, `hairline`, `coral` para el ícono, `font-mono` para el hash) y el modo oscuro.
- i18n (es-PE / en-US): "Documento publicado", "Firmado por", "Motivo del cambio", "Vigente desde", "Versión obsoleta desde", "Sin descripción", "Copiar hash" y "Hash copiado".

### 4. MSW
Las fixtures de documentos PUBLICADO y OBSOLETO deben traer una entrada `FIRMA_REGISTRADA` con un hash, y `motivoVersion`, para que la tarjeta se vea en modo mock.

---

## Tests (frontend)
- PUBLICADO con `FIRMA_REGISTRADA` → la tarjeta muestra el nombre del firmante, la fecha y el hash abreviado; el tooltip tiene el hash completo; "Ver" abre el visor.
- PUBLICADO sin `FIRMA_REGISTRADA` → usa el respaldo, sin hash y sin errores.
- OBSOLETO → la tarjeta incluye "Versión obsoleta desde".
- BORRADOR, EN_REVISION y EN_APROBACION → sin tarjeta de publicado.
- `motivoVersion` presente → se muestra; ausente → no aparece la sección.
- La barra lateral sigue mostrando la fecha de publicación correcta con el helper compartido.

## Reglas de siempre
- El código real manda sobre este doc; cualquier divergencia va en `design.md`.
- Corre la suite completa del frontend y `tsc`.
- Prueba manual con MSW apagado: abre el documento que Toño acaba de publicar. La pestaña Resumen muestra la tarjeta con su firmante, la fecha y hora y el hash; "Ver" abre el visor; el motivo del cambio aparece si se llenó. Revisa también uno en BORRADOR (sin tarjeta) y el modo oscuro.
- Al terminar, Toño avisa con "listo". Cowork verifica releyendo el código real.
