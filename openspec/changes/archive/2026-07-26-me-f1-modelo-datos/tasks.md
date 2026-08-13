## 1. Tipos nuevos — Empresa y UsuarioEmpresa

- [x] 1.1 Crear `src/features/empresas/types/empresa.types.ts` con `EmpresaEstado`, `Empresa`, `UsuarioEmpresaEstado`, `UsuarioEmpresa` (ver `empresa-types`, `empresa-usuario-types`)

## 2. `empresaId` en tipos transaccionales existentes

- [x] 2.1 Agregar `empresaId: string` a `Documento` (`src/types/documents.types.ts`)
- [x] 2.2 Agregar `empresaId: string` a `Incidente`, `Local` y `Zona` (`src/features/incidents/types/incident.types.ts`)
- [x] 2.3 Agregar `empresaId: string` a `NoConformidad` (`src/features/nonconformities/types/nonconformity.types.ts`)
- [x] 2.4 Agregar `empresaId: string` a `QualityEvent` (`src/features/quality-events/types/qualityEvent.types.ts`)
- [x] 2.5 Correr `tsc --noEmit` y confirmar que los únicos errores nuevos son "falta `empresaId`" en fixtures — no en `update*Schema`/tipos de payload de edición (confirma la inmutabilidad por omisión, D3 de `design.md`)

## 3. Mock data — Empresa, UsuarioEmpresa y usuarios de empresa-002

- [x] 3.1 Crear `src/mocks/fixtures/empresas.fixtures.ts` con `empresaFixtures` (`empresa-001` Minera Andina del Sur S.A.C., `empresa-002` Terminal Portuario Ilo S.A.C.)
- [x] 3.2 Agregar a `src/mocks/fixtures/auth.fixtures.ts` los 4 usuarios nuevos de `empresa-002` (`user-operario-101`, `user-supervisor-101`, `user-jefecalidad-101`, `user-jefedocs-101`) con credenciales de login mock
- [x] 3.3 En `empresas.fixtures.ts`, agregar `usuarioEmpresaFixtures`: una entrada por cada usuario existente de `empresa-001`, una por cada usuario nuevo de `empresa-002`, y una segunda entrada para `user-supervisor-001` en `empresa-002` con rol `JEFE_CALIDAD_SYST`
- [x] 3.4 Verificar manualmente que todo `usuarioId` en `usuarioEmpresaFixtures` tiene contraparte real en `authFixtures` (patrón de fixtures desincronizados, ver CLAUDE.md)

## 4. Etiquetar mock data existente con `empresaId: 'empresa-001'`

- [x] 4.1 Agregar `empresaId: 'empresa-001'` a los 22 fixtures existentes de `src/mocks/fixtures/documents.fixtures.ts`
- [x] 4.2 Agregar `empresaId: 'empresa-001'` a los 20 fixtures existentes de `src/mocks/fixtures/incidents.fixtures.ts`
- [x] 4.3 Agregar `empresaId: 'empresa-001'` a los 3 locales y 5 zonas existentes de `src/mocks/fixtures/locales.fixtures.ts`
- [x] 4.4 Agregar `empresaId: 'empresa-001'` a los 22 fixtures existentes de `src/mocks/fixtures/nonconformities.fixtures.ts`
- [x] 4.5 Agregar `empresaId: 'empresa-001'` a los 21 fixtures existentes de `src/mocks/fixtures/quality-events.fixtures.ts`

## 5. Mock data nueva de `empresa-002`

- [x] 5.1 Agregar 1 local (`loc-e2-001`) y 2 zonas nuevas a `locales.fixtures.ts` con `empresaId: 'empresa-002'`
- [x] 5.2 Agregar al menos 4 documentos nuevos (`doc-e2-NNN`) a `documents.fixtures.ts` con `empresaId: 'empresa-002'`, referenciando solo usuarios de `empresa-002`
- [x] 5.3 Agregar al menos 4 incidentes nuevos (`inc-e2-NNN`) a `incidents.fixtures.ts` con `empresaId: 'empresa-002'`, referenciando solo usuarios de `empresa-002`
- [x] 5.4 Agregar al menos 4 no conformidades nuevas (`nc-e2-NNN`) a `nonconformities.fixtures.ts` con `empresaId: 'empresa-002'`, referenciando solo usuarios de `empresa-002`
- [x] 5.5 Agregar al menos 4 quality events nuevos (`qe-e2-2026-NNN`) a `quality-events.fixtures.ts` con `empresaId: 'empresa-002'`, referenciando solo usuarios de `empresa-002`

## 6. Handlers MSW de creación — asignación temporal de `empresaId`

- [x] 6.1 En el handler `POST` de creación de cada dominio (`documents.handlers.ts`, `incidents.handlers.ts`, `nonconformities.handlers.ts`, `quality-events.handlers.ts`), asignar `empresaId: 'empresa-001'` al registro nuevo, con comentario `// TODO(Fase 2)` explicando que es temporal hasta que exista selector de empresa activa
- [x] 6.2 Actualizar `src/mocks/handlers/locales.handlers.ts` para que el store mutable en memoria siga inicializándose desde `localFixtures`/`zonaFixtures` (ahora con 4 locales / 7 zonas) sin cambiar su lógica de filtrado por `activo`/`localId`

## 7. Fixtures/factories de tests

- [x] 7.1 Grep por construcciones inline de `Documento`/`Incidente`/`NoConformidad`/`QualityEvent`/`Local`/`Zona` en archivos `*.test.ts*` fuera de `src/mocks/fixtures` y agregar `empresaId` donde haga falta
- [x] 7.2 Correr la suite completa de tests (`npm test` o equivalente) y confirmar que pasa sin regresiones

## 8. Verificación en navegador

- [ ] 8.1 Levantar la app en dev (`VITE_ENABLE_MSW=true`) y confirmar que `/documentos`, `/incidentes`, `/no-conformidades`, `/quality-events` renderizan sin errores, mostrando mezclados los registros de `empresa-001` y `empresa-002` (comportamiento esperado en esta fase, ver Open Question de `design.md`) — **PENDIENTE**: no hay herramienta de automatización de navegador disponible en esta sesión; solo se verificó que `npm run dev` sirve la SPA y transforma `main.tsx` sin errores (sanity check, no verificación visual real). Requiere verificación manual humana.
- [ ] 8.2 Loguearse como `user-supervisor-001` y confirmar que el login sigue funcionando igual que antes (sin selector de empresa, ya que es Fase 2) — **PENDIENTE**, mismo motivo que 8.1
- [ ] 8.3 Loguearse como uno de los 4 usuarios nuevos de `empresa-002` (p. ej. `user-jefecalidad-101`) y confirmar que el login funciona — **PENDIENTE**, mismo motivo que 8.1
- [x] 8.4 Dejar un resumen corto de archivos tocados, ids/nombres de las 2 empresas, y qué usuario quedó asignado a ambas (para verificación humana) — ver resumen final entregado al usuario
