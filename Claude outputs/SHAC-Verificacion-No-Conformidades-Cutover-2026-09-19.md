# Verificación — Cutover: No Conformidades

Fecha: 2026-09-19
Autor: Cowork, verificación independiente vía device bridge (fallback `device_list_dir` +
`device_stage_files`/`Read` — `device_bash` sigue caído, mismo problema del 8 de septiembre).

Conclusión: **aprobado**. Este fue el primer cutover de la serie donde la investigación previa no
encontró ningún mismatch de contrato, y confirmé que el resultado real coincide: no se tocó código
de negocio (ni frontend ni backend), solo se verificó contra el backend real y se documentó un
hallazgo informativo nuevo.

## 1. Repetición de la investigación con más rigor — confirmada

`design.md` deja constancia de que repitieron los hallazgos de mi investigación (hecha sin
`device_bash`, por lectura puntual) esta vez con `grep`/lectura completa de archivo — buena
práctica dado que mi investigación original tenía esa limitación reconocida. Confirmé por mi cuenta
los puntos clave que citan:

- `cambiarEstadoNC.schema.ts`: sigue existiendo, sin tocar (mtime original) — coincide con la
  decisión D3 (código muerto, documentado, no es requisito eliminarlo).
- `.env.development`: `VITE_ENABLE_MSW=true`, `VITE_API_BASE_URL` vacío — reverted a baseline,
  confirmado.

No verifiqué de nuevo cada archivo individual citado en el `design.md` (`ncPermissions.ts`,
`ActualizarNoConformidadCommand.cs`, `EndpointExtensions.cs`, etc.) porque ya los había leído
completos yo mismo en la investigación previa de este mismo módulo y coinciden con lo que
describen — no encontré motivo para dudar de esta parte.

## 2. Hallazgo nuevo real — el backend no valida el orden de la secuencia de estados

Documentado en `design.md`: `PATCH /:id { estado }` contra el backend real aceptó una transición
`ABIERTA -> PENDIENTE_CIERRE` directa (200), saltando los estados intermedios. Confirma que el
único control server-side real es el bloqueo 409 en estados terminales (`CERRADA`/`ANULADA`) — no
hay una máquina de estados estricta como la de Quality Event. Correctamente calificado como
hallazgo informativo, no bloqueante: ni la spec original (`be-no-conformidades-api`) ni ningún
código UI (que no existe, ver Sección 1 de mis instrucciones) exigen ese orden hoy. Coherente con
no inventar una regla de negocio nueva sin que Toño la pida — quedó bien dejado como decisión de
producto futura, no resuelta unilateralmente.

## 3. Alcance del change — mínimo, como se anticipó

A diferencia de los cuatro cutovers anteriores, este no requirió ningún cambio de contrato: cero
archivos de negocio tocados (ni commands, ni schemas, ni componentes) — solo verificación contra
el backend real y documentación. Es exactamente lo que anticipaban mis instrucciones ("no encontré
ningún mismatch bloqueante") y lo que el propio `design.md` (D1) declara explícitamente como
estrategia. Buena señal de que el módulo venía más prolijo que los anteriores, no que se haya
verificado con menos rigor — el `design.md` es, si acaso, más extenso en trazabilidad que el de
los cutovers con cambios reales.

## 4. Estado real de archivo y entorno

- **`openspec/changes/cutover-no-conformidades/` sigue activo, no archivado** — confirmado
  listando `openspec/changes/` (solo `archive/` y `cutover-no-conformidades/`). Los dos archives
  que dijiste que ibas a hacer manualmente (`cutover-documentos`, `cutover-incidentes`) sí están
  confirmados dentro de `archive/` — gracias por eso, ya no quedan pendientes de esa lista.
- **`.env.production` no tocado** (coherente con el Non-Goal explícito).

No encontré nada pendiente de corregir. El único punto abierto es tuyo: decidir cuándo archivar
este change, y si en algún momento querés que se construya la UI de transición de estados de la NC
(hoy no existe, solo el contrato backend).

## 5. Qué sigue

Con Auth, Catálogos, Incidentes, Documentos y No Conformidades cutover-eados y verificados, quedan:
Quality Events, Notificaciones, Dashboard y Usuarios. Avisame por dónde seguís.
