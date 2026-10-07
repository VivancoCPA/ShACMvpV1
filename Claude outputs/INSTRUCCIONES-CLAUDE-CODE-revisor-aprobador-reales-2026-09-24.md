# Instrucciones para Claude Code — Revisor y Aprobador desde la base de datos real

Fecha: 2026-09-24
Autor: Cowork (investigación sobre el código real vía device bridge)
Origen: Toño, al crear documentos contra el backend real, notó que las listas de Revisor y Aprobador no vienen de la base de datos.
Change sugerido: `documentos-revisor-aprobador-reales`

Ciclo: `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`. Las decisiones `D#` van en `design.md` como decisiones explícitas de Toño.

---

## Hallazgo (confirmado leyendo el código)

**Frontend.** `features/documents/pages/DocumentFormPage.tsx` importa `mockUsers` desde `src/mocks/fixtures/documents.fixtures` y se lo pasa a `DocumentForm` como prop `mockUsers`. Los dos `<select>` (`revisorId`, `aprobadorId`) iteran esa fixture. Con MSW apagado, los IDs que se envían en `POST/PUT /api/documents` son IDs **ficticios** que no existen en `asp_net_users`.

Este hueco se le pasó al cutover de Documentos (verificación de Cowork del 2026-09-15). Es el mismo patrón de bug que esta serie busca atrapar: invisible bajo MSW, roto contra el backend real.

**Backend.** `CrearDocumentoHandler` y `EditarDocumentoHandler` guardan `RevisorId` / `AprobadorId` tal como llegan. `CrearDocumentoValidator` solo verifica RN-DOC-019 (revisor ≠ aprobador). **No hay ninguna validación** de que el ID:
- exista como usuario;
- esté activo;
- pertenezca a la **empresa activa**. Esto viola la regla fija de multi-tenancy: hoy se puede asignar como revisor a un usuario de otra empresa, o un GUID inventado;
- tenga un rol apto para revisar o aprobar.

Consecuencia práctica: el documento se crea "bien", pero nadie real puede actuar como revisor o aprobador. `ResolveDocRole` nunca va a coincidir con un usuario real, `FirmarPublicarDocumentoHandler` exige `AprobadorId == actorId`, y la notificación de asignación sale hacia un ID que no existe.

Además, `GET /api/users` **no sirve** como fuente para estas listas: está restringido a `ADMINISTRADOR_EMPRESA`/`SUPERADMIN`, y quien crea documentos (JCA, JCD, DIR) no tiene esos roles.

---

## Qué dice la documentación sobre quién califica (insumo para D1)

- **PRD §4.2:** define los permisos del *docRole* Revisor/Aprobador por estado, pero **no** restringe qué roles globales pueden ser asignados.
- **Matriz de Responsabilidades M1 (SHAC-M1-RACI-v1.0):**
  - EN_REVISION, "Aprobar / Rechazar revisión": ✓ solo **JCD** y **DIR**, con la nota "Revisor = JCD típicamente".
  - EN_APROBACION, "Firmar / aprobar (con PIN)": ✓ solo **DIR**, con la nota "Aprobador (DIR típicamente)".
  - Diagrama 5.1: "EN_REVISION — Revisor (JCD)", "EN_APROBACION — Aprobador (DIR)".
- **Backend actual:** no restringe nada; cualquier usuario puede quedar asignado.
- **Implicaciones:**
  - La confidencialidad `CONFIDENCIAL` solo es visible para JCA/JCD/AUD/DIR. Si se asigna un revisor con otro rol (por ejemplo SUPERVISOR) a un documento CONFIDENCIAL, podría no verlo en su listado.
  - La firma exige PIN (RN-DOC-004), así que el aprobador debe tener PIN configurado.

**D1 — Roles elegibles. ✅ DECIDIDO por Toño (2026-09-24): opción (b) Flexible.** Opciones evaluadas (documentar en `design.md` las tres y la elegida):
- (a) **Estricto según la matriz:** Revisor ∈ {JEFE_CONTROL_DOCUMENTARIO, ALTA_DIRECCION}; Aprobador ∈ {ALTA_DIRECCION}.
- (b) **Flexible, recomendado por Cowork:** Revisor ∈ {JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, AUDITOR_INTERNO, ALTA_DIRECCION}; Aprobador ∈ {JEFE_CONTROL_DOCUMENTARIO, ALTA_DIRECCION}. Respeta el "típicamente" de la matriz sin dejar a una empresa pequeña sin candidatos, y coincide con los roles que pueden ver documentos CONFIDENCIAL.
- (c) **Sin restricción de rol:** cualquier usuario activo de la empresa, excepto OPERARIO.

La lista elegida debe vivir en **un solo lugar por lado**: una constante en backend y la constante equivalente en `features/documents/constants.ts`, igual que `DOCUMENT_AUTHORIZED_ROLES`. No se duplica en varios archivos.

**D2 — ¿Excluir al autor? ✅ DECIDIDO por Toño (2026-09-24): SÍ, excluir al autor** (no puede ser Revisor ni Aprobador de su propio documento; tampoco debe aparecer en la lista de candidatos del formulario). ¿Puede el autor asignarse a sí mismo como revisor o aprobador? El handler ya evita notificarse a sí mismo (`!= actorId`), lo que sugiere que se consideró posible. Motivo: segregación de funciones (ISO 9001 §7.5).

---

## Qué implementar

### Backend
1. **Nuevo endpoint de lectura (Dapper)** para candidatos. Nombre sugerido: `GET /api/documents/candidatos-asignacion?tipo=REVISOR|APROBADOR`.
   - Protegido con `RequireAuthorization()` y `RequireEmpresaActivaFilter`. Accesible a cualquier usuario que pueda crear o editar documentos; no lo restrinjas a ADMINISTRADOR_EMPRESA.
   - Devuelve solo usuarios **activos** (`asp_net_users.activo`) con asignación **ACTIVA** en `usuarios_empresa` para la **empresa activa de la sesión**, cuyo `ue.rol` esté en la lista elegible de D1 para el `tipo` pedido.
   - Respuesta mínima: `id`, `nombreCompleto` (o `nombre` + `apellido`) y `rol`. **Ni email ni avatar**: no hacen falta, y no se debe exponer más de lo necesario.
   - Orden por nombre.
   - Por D2, excluye al autor: en la creación, el usuario de la sesión. En la edición, el `AutorId` del documento; para eso, el endpoint puede aceptar un `documentoId` opcional, validado contra la empresa activa (404 si es de otra empresa o no existe).
2. **Validación server-side en crear, editar y nueva versión** (revisa `NuevaVersionDocumento` por si también acepta revisor/aprobador). Si `RevisorId` o `AprobadorId` vienen informados, deben pertenecer a un usuario activo, con asignación activa en la empresa activa y rol elegible según D1.
   - Si no, **no** devuelvas 404 (el recurso principal es el documento): devuelve error de validación (400/422, el mismo formato que usa `ValidationFilter`) con un mensaje claro por campo (`revisorId` / `aprobadorId`).
   - Por D2, valida también que no coincida con el actor en la creación ni con `AutorId` en la edición.
   - Pon la lógica en un helper compartido en `Features/Documentos/Shared/`, no copiada en cada handler.
3. Tests de integración:
   - candidato de otra empresa → rechazado;
   - usuario inactivo → rechazado;
   - rol no elegible → rechazado;
   - candidato válido → aceptado;
   - el endpoint de candidatos nunca devuelve usuarios de otra empresa.

### Frontend
1. Nuevo hook (por ejemplo `useCandidatosAsignacion(tipo)`) con TanStack Query contra el endpoint nuevo.
2. `DocumentFormPage` / `DocumentForm`: **eliminar** la prop `mockUsers` y el import de fixtures. Cada `<select>` usa su propia lista: la de revisores y la de aprobadores son distintas si D1 las diferencia.
3. **Edición de un documento existente:** si el revisor o aprobador guardado ya no aparece entre los candidatos (se desactivó o cambió de rol), el select no debe quedar en blanco en silencio. Muéstralo como opción marcada "(no disponible)" o con un aviso, y deja que el usuario lo cambie. Documenta el enfoque en `design.md`.
4. El superRefine de RN-DOC-019 se mantiene.
5. **MSW:** agrega el handler del endpoint nuevo en `documents.handlers.ts`, filtrando los usuarios de las fixtures con **la misma regla de D1**, para que el modo mock siga funcionando y los tests cubran el filtro.
6. Tipos TS del candidato en `types/documents.types.ts` (o donde viva el resto del contrato de documentos).

### Barrido obligatorio: otros imports de fixtures en código de producción
Este hallazgo sugiere que puede haber **otros** componentes que importan de `src/mocks/` fuera de `src/mocks/` y de los tests. Antes de cerrar el change:
- Busca en todo `src/` los imports desde `mocks/` en archivos que **no** sean `*.test.*`, `test-setup.ts` ni estén dentro de `src/mocks/`. El `import('./mocks/browser')` condicional de `main.tsx` es legítimo.
- Lista en `design.md` **cada** ocurrencia encontrada, con archivo y qué importa.
- Corrige en este change solo las de Documentos. Las de otros módulos quedan listadas como hallazgos para que Toño decida si se abre otro change. Un import de **solo tipos** (`import type`) desde fixtures no rompe en runtime, pero también debe listarse: el tipo debería vivir en `types/`.

---

## Reglas de siempre
- El código real manda sobre este doc; cualquier divergencia se anota en `design.md`.
- Contrato nuevo = backend + handler MSW + tipos TS + tests, todo en el mismo change.
- Suite completa de tests del frontend (no solo los archivos tocados), tests del backend y `tsc`.
- Prueba manual contra el backend real con MSW apagado: crear un documento, asignar revisor y aprobador reales, y recorrer el flujo BORRADOR → EN_REVISION → EN_APROBACION → firma con PIN → PUBLICADO con esos usuarios.
- Al terminar, Toño relaya "listo". Cowork verifica releyendo el código real y escribe `SHAC-Verificacion-Revisor-Aprobador-Reales-<fecha>.md`.
