## Why

M5-S01 dejó los tipos, RBAC, fixtures y hooks de datos del Dashboard listos, pero ningún dashboard por rol (S03-S07) tiene todavía una forma visual estándar de mostrar urgencia de plazos. Sin un componente compartido, cada pantalla de dashboard reimplementaría su propio cálculo de días hábiles y su propio criterio de color, generando inconsistencia visual y duplicación entre 5+ pantallas. Este spec construye esa pieza reutilizable una sola vez, antes de que arranque el primer dashboard consumidor (S03).

## What Changes

- Nueva utilidad de días hábiles configurable (`contarDiasHabiles` con feriados opcionales) y una función que calcula días hábiles restantes (con signo) entre hoy y una fecha de vencimiento — vive en `src/utils/businessDays.ts`, no acoplada a ningún dominio.
- El helper existente `contarDiasHabiles` de `features/quality-events/utils/qualityEventHelpers.ts` (usado por `estaVencidaVerificacion` y `QEHeaderSection`) pasa a delegar en la nueva utilidad compartida en vez de mantener su propia implementación duplicada; su firma pública y comportamiento actual no cambian (feriados por defecto `[]`).
- Nueva función `calcularEstadoSemaforoFila` (mapea días hábiles restantes → `VERDE`/`AMARILLO`/`ROJO` según los umbrales del PRD §5.3: Verde > 5 días, Amarillo 1-5 días, Rojo ≤ 0 días) y su envoltorio de conveniencia a partir de una fecha de vencimiento.
- Nuevo componente `SemaforoRow` (`src/components/shared/SemaforoRow.tsx`): fila reutilizable con borde izquierdo de 3px del color de rol semántico, fondo neutro, sin fondo de fila coloreado, y texto de plazo ("Vence en Nd" / "Vence hoy" / "Vencido hace Nd") en el color del rol — según el mockup ya aprobado.
- Nuevo componente `SemaforoCriticoBanner` (`src/components/shared/SemaforoCriticoBanner.tsx`): banner independiente (no una fila más) para QEs con severidad `CRITICA` sin cerrar, con fondo/borde/texto de rol `danger` e ícono de alerta; no se renderiza si no hay items críticos.
- Ambos componentes soportan modo claro/oscuro con clases Tailwind `dark:` (tokens ya existentes: `success`, `warning`, `error`, `surface-card`, `hairline`) y usan `t('dashboard:semaforo.*')` para todo texto visible.
- Tests unitarios de la utilidad de cálculo (incluyendo feriados) y tests de componente (Testing Library) para `SemaforoRow` y `SemaforoCriticoBanner` en sus 4 estados.
- Fuera de alcance: ningún dashboard por rol consume estos componentes todavía (eso es S03-S07); no se agrega un store/endpoint de "feriados" — la lista de feriados es un parámetro opcional que hoy se pasa vacío.

## Capabilities

### New Capabilities
- `shared-business-days`: Utilidad pura de cálculo de días hábiles (lunes-viernes, feriados configurables opcionales) y de días hábiles restantes con signo entre dos fechas, en `src/utils/businessDays.ts`.
- `shared-semaforo-pendientes`: Componentes `SemaforoRow` y `SemaforoCriticoBanner`, más la función `calcularEstadoSemaforoFila`/`calcularEstadoSemaforoDesdeFecha` que traduce días hábiles restantes al estado semáforo de fila (`VERDE`/`AMARILLO`/`ROJO`), independiente del banner de Crítico.

### Modified Capabilities
(ninguna — el ajuste a `qualityEventHelpers.ts` es un refactor interno que preserva la firma y el comportamiento público de `contarDiasHabiles`, sin cambio de requisito a nivel de spec)

## Impact

- **Nuevos archivos**: `src/utils/businessDays.ts`, `src/utils/businessDays.test.ts`, `src/features/dashboard/types/semaforo.types.ts`, `src/features/dashboard/utils/semaforoPendientes.ts`, `src/features/dashboard/utils/semaforoPendientes.test.ts`, `src/components/shared/SemaforoRow.tsx`, `src/components/shared/SemaforoRow.test.tsx`, `src/components/shared/SemaforoCriticoBanner.tsx`, `src/components/shared/SemaforoCriticoBanner.test.tsx`.
- **Archivos modificados**: `src/features/quality-events/utils/qualityEventHelpers.ts` (delega `contarDiasHabiles` en la utilidad compartida), `src/i18n/es-PE.json` y `src/i18n/en-US.json` (namespace `dashboard` → claves `semaforo.*`).
- **Sin impacto en dashboards existentes**: `DashboardPage` sigue siendo el placeholder de M5-S01; ningún dashboard por rol importa estos componentes en este change.
- **Sin nuevos endpoints ni fixtures MSW**: es UI pura + utilidades; no hay datos nuevos que mockear.
