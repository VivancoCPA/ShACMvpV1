# Instrucciones para Claude Code — Nueva versión: 403 al enviar a revisión (autor, permisos y reasignación)

Fecha: 2026-10-07
Autor: Cowork (diagnóstico leyendo el código real)
Origen: Toño. Al crear una nueva versión de un documento y enviarla a revisión: `PATCH /api/documents/{id}/status` → **403 Forbidden**.
Change sugerido: `nueva-version-autor-permisos`

Ciclo: `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

---

## Diagnóstico (confirmado leyendo el código)

1. **`NuevaVersionDocumentoHandler` copia los tres actores del original:** `AutorId = origen.AutorId`, `RevisorId = origen.RevisorId` y `AprobadorId = origen.AprobadorId`. Quien pulsa "Crear nueva versión" no queda registrado como autor de la versión.
2. **El frontend y el backend resuelven el rol del usuario de forma distinta:**
   - Frontend (`DocumentActionPanel.tsx`): `canSendToReview = BORRADOR && (isAutor || isJefeCalidad)`, donde `isJefeCalidad` se basa en el rol **global** (JCA o JCD). Un Jefe de Calidad o de Control Documentario siempre ve el botón "Enviar a revisión".
   - Backend (`DocumentPermissionResolver.ResolveDocRole`): el orden es **AUTOR → REVISOR → APROBADOR → JEFE_CALIDAD**. Si ese mismo Jefe es el revisor o el aprobador asignado del documento, que es lo habitual porque JCD es un revisor y aprobador típico, se resuelve como `REVISOR` o `APROBADOR`. En BORRADOR esos roles son de **solo lectura** (`CanEdit = false`), así que `CambiarEstadoDocumentoHandler` responde **403**: "No tenés permiso para enviar este documento a revisión".
   - Ese es el escenario más probable del error de Toño: un Jefe que además era revisor o aprobador del original creó la nueva versión y, al no ser el autor, el backend lo trató como revisor o aprobador. **Confirma el escenario reproduciéndolo** y anótalo en `design.md`.
3. **`POST /api/documents/{id}/nueva-version` no valida permisos:** solo exige `RequireAuthorization()`. Cualquier usuario autenticado de la empresa puede crear una nueva versión. El frontend solo muestra el botón al autor y a JCA/JCD (`canCreateVersion` / `canStartNewVersion`).
4. **Hoy se puede enviar a revisión sin revisor ni aprobador.** La transición `BORRADOR → EN_REVISION` no verifica que estén asignados, y el documento queda trabado porque nadie puede aprobarlo. Con la decisión D1 este caso se vuelve frecuente en nuevas versiones.

## Decisión de Toño

**D1 — ✅ DECIDIDO (2026-10-07): el autor de la nueva versión es quien la crea.** Se descarta mantener al autor original.

Consecuencias que se derivan de D1 y de la regla D2 ya vigente de `documentos-revisor-aprobador-reales` (el autor no puede ser revisor ni aprobador de su propio documento):

- La nueva versión hereda el revisor y el aprobador del original, **salvo** cuando alguno coincide con el nuevo autor: ese campo queda **vacío** y se debe reasignar.
- Revalida también que los heredados sigan siendo candidatos válidos: activos, con asignación activa en la empresa y con un rol elegible según `DocumentoAsignacionService`. Si alguno ya no lo es, ese campo también queda vacío.
- Registra en el audit trail de la nueva versión qué campos se vaciaron y por qué.

---

## Qué implementar

### Backend
1. **`NuevaVersionDocumentoHandler`:**
   - `AutorId = actorId`.
   - `RevisorId` y `AprobadorId` se heredan solo si son distintos del nuevo autor y siguen siendo candidatos válidos. Reutiliza `DocumentoAsignacionService` (por ejemplo, `GetCandidatosAsync` o un método nuevo `EsCandidatoValidoAsync`), sin duplicar la lógica. Si no, quedan `null`.
   - Los avisos de asignación que ya se envían a revisor y aprobador solo deben enviarse a los que se heredaron.
2. **Permiso para crear una nueva versión:** solo el **autor del documento de origen** o un **JEFE_CALIDAD_SYST / JEFE_CONTROL_DOCUMENTARIO** (rol global), igual que el frontend. Cualquier otro usuario recibe 403. Si el documento es de otra empresa, 404 como siempre.
3. **Validar asignación al enviar a revisión:** en `BORRADOR → EN_REVISION`, si falta `RevisorId` o `AprobadorId`, responde con un error de validación por campo ("Asigna un revisor y un aprobador antes de enviar a revisión"). Usa el mismo formato que `FieldValidationException` y **no** devuelvas 403. Aplica la regla a todo documento, no solo a nuevas versiones, y anótala en `design.md` como regla nueva derivada de D1.
4. **Precedencia de roles (punto 2 del diagnóstico):** con D1 el caso típico queda resuelto, porque quien crea la versión pasa a ser AUTOR, que tiene la máxima precedencia. Aun así, **no** cambies el orden de `ResolveDocRole`: está replicado a propósito desde el diseño. Anota en `design.md` que un JCA/JCD que es revisor o aprobador de un BORRADOR ajeno no puede enviarlo a revisión, y que eso es el comportamiento esperado.

### Frontend
1. **Alinear `DocumentActionPanel` con el backend:** `canSendToReview`, `canDelete` y el resto de las acciones de BORRADOR deben usar la **misma precedencia** que `ResolveDocRole`. Usa el `docRole` que ya calcula `permissions.ts` / `getDocRoleForUser` (o el que se calcula en `DocumentDetailPage`), no `isJefeCalidad` suelto. Así no se muestran botones que el backend va a rechazar con 403.
2. **Si falta revisor o aprobador:**
   - En el detalle de un BORRADOR sin revisor o sin aprobador, muestra un aviso: "Asigna revisor y aprobador para poder enviar a revisión", con un enlace a **Editar**.
   - Deshabilita "Enviar a revisión" y explica el motivo con un tooltip o un texto visible.
3. **Después de crear la nueva versión:** si el backend dejó vacío algún campo, muestra un toast o un aviso que lo indique ("Debes asignar un nuevo revisor porque eras el revisor del documento original"). Lo más simple es navegar al formulario de edición de la nueva versión.
4. **MSW:** replica en los handlers la misma lógica de autor y herencia, el permiso para crear una nueva versión y la validación al enviar a revisión.

## Tests
- **Backend:**
  - nueva versión creada por un JCD que era revisor del original → `AutorId = JCD` y `RevisorId = null`;
  - creada por el autor original → hereda revisor y aprobador;
  - un heredado inactivo o sin rol elegible → queda `null`;
  - un OPERARIO u otro usuario sin permiso intenta crear una nueva versión → 403;
  - enviar a revisión sin revisor o sin aprobador → error de validación por campo, no 403;
  - un JCA que es revisor de un BORRADOR ajeno intenta enviarlo → 403, comportamiento documentado.
- **Frontend:** los botones del panel coinciden con la precedencia del backend; el aviso y el botón deshabilitado aparecen cuando falta revisor o aprobador.

## Reglas de siempre
- El código real manda sobre este doc; cualquier divergencia va en `design.md`.
- Corre la suite completa del frontend, los tests del backend y `tsc`.
- **Detén el backend y ejecuta `dotnet build` antes de la prueba manual.**
- Prueba manual con MSW apagado:
  1. Toma un documento PUBLICADO cuyo revisor sea un JCD. Entra como ese JCD y crea una nueva versión: el JCD queda como autor, el revisor queda vacío y aparece el aviso.
  2. Asigna otro revisor y envía a revisión: funciona.
  3. Repite creando la versión con el autor original: hereda todo y se puede enviar directamente.
  4. Recorre el flujo hasta publicar. La versión anterior debe pasar a OBSOLETO.
- Al terminar, Toño avisa con "listo". Cowork verifica releyendo el código real y actualiza el mapa de proceso (nueva versión → autor = quien la crea).
