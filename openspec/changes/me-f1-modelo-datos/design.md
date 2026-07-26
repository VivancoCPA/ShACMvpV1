## Context

SHAC hoy corre enteramente sobre MSW (no existe backend .NET real). Verificado en código (`shc-controldoc/src/`):

- `Documento` (`src/types/documents.types.ts`), `Incidente`/`Local`/`Zona` (`src/features/incidents/types/incident.types.ts`), `NoConformidad` (`src/features/nonconformities/types/nonconformity.types.ts`) y `QualityEvent` (`src/features/quality-events/types/qualityEvent.types.ts`) son interfaces planas sin ningún concepto de empresa/tenant.
- `Area` (departamento organizacional, `src/features/areas/types/area.types.ts`) es un concepto **distinto** de `Local`/`Zona` (sitio físico) — ambos deben recibir `empresaId`, pero no deben confundirse entre sí.
- `User` (`src/types/auth.types.ts`) usa `areaId`/`areaIds` (no `area`/`areasAsignadas` como sugiere una versión desactualizada de la prosa de CLAUDE.md) y tiene un único `rol` global — no hay noción de rol por empresa.
- Cada dominio (`documents.fixtures.ts`, `incidents.fixtures.ts`, `nonconformities.fixtures.ts`, `quality-events.fixtures.ts`, `locales.fixtures.ts`, `areas.fixtures.ts`, `auth.fixtures.ts`) es un array literal hardcodeado — no existe un patrón `createMockX()` en ningún dominio. No hay una capa de test-factories separada: los tests importan directamente estos mismos fixtures.
- Los handlers MSW de Documentos/Incidentes/NC/Dashboard/Notificaciones resuelven el usuario actual con una función `getUserFromRequest(request)` casi idéntica y duplicada en cada archivo (parseo de `Authorization: Bearer mock-access-token-<userId>-<timestamp>`). El handler de Quality Events en cambio lee `useAuthStore.getState().user` directamente. Ninguno filtra hoy por empresa — este es exactamente el punto de inserción que usará la Fase 3.
- IDs son slugs de texto plano por dominio (`doc-001`, `inc-001`, `nc-001`, `qe-2026-001`, `loc-001`, `zon-001`, `area-001`, `user-operario-001`), no UUIDs.

## Goals / Non-Goals

**Goals:**
- Definir `Empresa` y `UsuarioEmpresa` como tipos TypeScript + fixtures MSW, con datos de 2 empresas de prueba completas.
- Agregar `empresaId: string` (obligatorio) a `Documento`, `Incidente`, `NoConformidad`, `QualityEvent`, `Local`, `Zona`, etiquetando toda la mock data existente y la nueva.
- Mantener la suite de tests y el comportamiento visible de la app sin romperse — todo lo demás (RBAC, filtrado de listas, UI) sigue exactamente igual que hoy.

**Non-Goals (explícitamente diferido a Fases 2-4):**
- Filtrar listas/handlers por `empresaId`.
- Selector de empresa activa / contexto de sesión multiempresa.
- Resolver el rol efectivo del usuario vía `UsuarioEmpresa` en el RBAC (`RoleGuard`, `*Permissions.ts`) — `User.rol` sigue siendo la única fuente de verdad para permisos en esta fase.
- CRUD de administración de `Empresa`/`UsuarioEmpresa` (páginas, hooks, endpoints de escritura más allá del modelo).
- Definir RN-EMP-003 a RN-EMP-007 (pertenecen a fases futuras y no se fabrican aquí sin el documento fuente; solo se formalizan RN-EMP-001 y RN-EMP-002, que son las que esta fase implementa).

## Decisions

### D1 — Ubicación de los tipos nuevos
`Empresa` y `UsuarioEmpresa` viven en `src/features/empresas/types/empresa.types.ts`, siguiendo el mismo patrón que `Area` (`features/areas/types/area.types.ts`): una entidad catálogo simple con su propia carpeta de feature, aunque su UI de administración (Fase 4) todavía no exista. Alternativa descartada: ponerlos en `src/types/` junto a `auth.types.ts` — se descarta porque `Empresa` no es un tipo de auth y este patrón (feature propio para catálogos afines a permisos) ya es el precedente establecido por `Area`.

### D2 — `empresaId` obligatorio, no opcional
Se agrega como `empresaId: string` (no `empresaId?: string`) en las 6 interfaces transaccionales, cumpliendo RN-EMP-001 al nivel de tipos: TypeScript obliga a que todo fixture nuevo lo incluya, hace explícitos los sitios de código que aún no lo asignan (vía errores de compilación), y evita el patrón "opcional que en la práctica siempre está presente" que ya generó ambigüedad en otros campos del proyecto.

### D3 — Inmutabilidad de `empresaId` tras creación (RN-EMP-001)
No se añade ningún guard runtime nuevo en esta fase. La inmutabilidad se logra por **omisión deliberada**: `empresaId` nunca se incluye en los Zod schemas de edición/actualización (`update*Schema`) ni en los tipos de payload de los formularios existentes — solo se asigna en el momento de creación del registro (vía handler MSW). Como ningún formulario de producción edita ni siquiera expone `empresaId` todavía (Non-Goal de UI), no hay superficie desde la que un usuario podría intentar cambiarlo. Se deja una nota técnica en el handler de creación de cada dominio para que Fase 3 (cuando se construya edición real con contexto de empresa) no lo agregue por error a un `update*Schema`.

### D4 — Asignación de `empresaId` en creación de registros nuevos (hoy, sin selector de empresa activa)
Los handlers MSW `POST` de cada dominio (documentos, incidentes, NC, QE) asignan `empresaId: 'empresa-001'` de forma hardcodeada al crear un registro nuevo desde la UI actual. Es un valor temporal y se documenta como tal con un comentario `// TODO(Fase 2)` en cada handler — cuando exista selector de empresa activa (Fase 2), este hardcode se reemplaza por el `empresaId` de la sesión activa. Alternativa descartada: derivar `empresaId` del primer `UsuarioEmpresa` del usuario logueado — se descarta por agregar acoplamiento cross-dominio (handler de creación tendría que leer el store de `UsuarioEmpresa`) para resolver un problema que Fase 2 va a resolver correctamente de todas formas; no vale la pena construirlo dos veces.

### D5 — Estrategia de mock data: no reparticionar, sumar
La mock data **existente** de cada dominio (22 documentos, 20 incidentes, 22 NC, 21 QE, 19 áreas, 3 locales, 5 zonas) se etiqueta completa como perteneciente a `empresa-001` ("Minera Andina del Sur S.A.C.") — cero riesgo de romper tests o comportamiento actual, porque ningún registro existente cambia de identidad, solo gana un campo. Para `empresa-002` ("Terminal Portuario Ilo S.A.C.") se agrega un set **nuevo y más pequeño** (3-5 registros por dominio, suficiente para verificación visual) con IDs en un rango claramente distinto (`doc-e2-001`, `inc-e2-001`, `nc-e2-001`, `qe-e2-2026-001`, `area-e2-001`, `loc-e2-001`, `zon-e2-001`) para evitar cualquier colisión con la numeración existente. Alternativa descartada: dividir los fixtures existentes 50/50 entre las 2 empresas — se descarta porque reasignar `empresaId` a registros que ya usan otros tests/specs como referencia (por id) introduce riesgo de romper la suite actual sin necesidad.

### D6 — Usuarios de `empresa-002` y el usuario con doble asignación
Se agregan 4 usuarios nuevos a `auth.fixtures.ts` para `empresa-002` (`user-operario-101`, `user-supervisor-101`, `user-jefecalidad-101`, `user-jefedocs-101`), cada uno con su fila `UsuarioEmpresa` correspondiente. El usuario existente `user-supervisor-001` (hoy `SUPERVISOR` en `areaIds` de `empresa-001`) se asigna también a `empresa-002` con rol `JEFE_CALIDAD_SYST` vía una segunda fila `UsuarioEmpresa` — cumple el requisito de "mismo usuario, rol distinto por empresa" sin crear un usuario nuevo desde cero. Se documenta explícitamente que `User.rol` (el campo plano) sigue reflejando únicamente su rol en `empresa-001` (`SUPERVISOR`) en esta fase, porque el RBAC actual no sabe leer `UsuarioEmpresa` — la fila de `UsuarioEmpresa` para `empresa-002` con rol distinto existe en los datos pero no cambia nada observable en la UI hasta Fase 2. Todos los `autorId`/`revisorId`/`aprobadorId`/`reportadoPorId`/etc. de los fixtures nuevos de `empresa-002` referencian exclusivamente a estos usuarios nuevos (o a `user-supervisor-001`), nunca a IDs inventados sin contraparte en `auth.fixtures.ts`.

### D7 — Convenciones de tipos nuevos
```typescript
type EmpresaEstado = 'ACTIVA' | 'INACTIVA'
interface Empresa {
  id: string
  razonSocial: string
  ruc: string
  estado: EmpresaEstado
  logoUrl: string
  fechaAlta: string // ISO 8601
}

type UsuarioEmpresaEstado = 'ACTIVO' | 'INACTIVO'
interface UsuarioEmpresa {
  usuarioId: string  // FK a User.id
  empresaId: string  // FK a Empresa.id
  rol: UserRole       // reutiliza el enum UserRole existente de auth.types.ts
  estado: UsuarioEmpresaEstado
  fechaAsignacion: string // ISO 8601
}
```
IDs siguen la convención de slugs existente: `empresa-001`, `empresa-002`; `UsuarioEmpresa` no necesita `id` propio (clave compuesta `usuarioId`+`empresaId`, no hay UI que la liste todavía).

## Risks / Trade-offs

- **[Riesgo]** Al no filtrar por empresa (Non-Goal de esta fase), las listas actuales (documentos, incidentes, NC, QE) mostrarán mezclados los registros de `empresa-001` y `empresa-002` en el navegador durante esta fase, lo cual puede leerse como un bug visual en una demo. → **Mitigación:** es un trade-off aceptado explícitamente por el alcance de la Fase 1 (el proposal ya lo reconoce: "el comportamiento actual de la app puede seguir ignorándolo"); se deja constancia en el resumen final de verificación para que quien reciba el cambio no lo confunda con una regresión.
- **[Riesgo]** Agregar `empresaId` como campo obligatorio puede romper la compilación de cualquier test que construya un objeto `Documento`/`Incidente`/`NoConformidad`/`QualityEvent`/`Local`/`Zona` inline (fuera de los fixtures compartidos) sin ese campo. → **Mitigación:** se hizo grep dirigido durante la investigación — no se encontró una capa de test-factories separada; los tests existentes importan los fixtures compartidos directamente. Aun así, `tasks.md` incluye un paso explícito de correr `tsc`/la suite completa después de tipar el campo como obligatorio, para atrapar cualquier caso residual.
- **[Riesgo]** El hardcode `empresaId: 'empresa-001'` en los handlers de creación (D4) podría quedar olvidado y llegar a Fase 3 sin reemplazarse. → **Mitigación:** comentario `// TODO(Fase 2)` explícito en cada handler tocado, mencionado también en el resumen final de la implementación.

## Migration Plan

No hay base de datos real ni despliegue — "migrar" significa: (1) agregar los tipos nuevos y el campo `empresaId` a los tipos existentes, (2) actualizar fixtures y handlers de creación, (3) correr `tsc --noEmit` y la suite de tests completa para confirmar que compila y pasa, (4) levantar la app en dev y verificar visualmente que Dashboard, listas de Documentos/Incidentes/NC/QE y el módulo de Usuarios siguen funcionando sin errores con los nuevos registros de `empresa-002` mezclados. No hay rollback especial más allá de revertir el commit — el cambio es aditivo y no toca ninguna tabla/colección real.

## Open Questions

- ¿Es aceptable que, durante esta fase, un usuario que navegue `/documentos`, `/incidentes`, etc. vea mezclados registros de ambas empresas de prueba (sin ningún indicador visual de a cuál pertenecen)? Se asume que sí, dado que el proposal lo acepta explícitamente y el filtrado es Fase 3 — se deja constancia aquí por si el usuario prefiere, alternativamente, que la Fase 1 no agregue absolutamente ningún dato transaccional de `empresa-002` todavía (solo `Empresa`/`UsuarioEmpresa` + usuarios) para evitar ese ruido visual antes de Fase 3.
