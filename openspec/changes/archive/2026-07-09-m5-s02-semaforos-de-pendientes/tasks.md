## 1. Utilidad de días hábiles (shared-business-days)

- [x] 1.1 Crear `src/utils/businessDays.ts` con `contarDiasHabiles(desde: Date, hasta: Date, feriados: string[] = []): number`, portando la lógica actual de `qualityEventHelpers.ts` y agregando la exclusión de fechas en `feriados` (comparadas como `'yyyy-MM-dd'` vía `date-fns#format`).
- [x] 1.2 Agregar `calcularDiasHabilesRestantes(hoy: Date, fechaVencimiento: Date, feriados: string[] = []): number` en el mismo archivo (signo positivo si `fechaVencimiento >= hoy`, negativo si ya pasó).
- [x] 1.3 Actualizar `src/features/quality-events/utils/qualityEventHelpers.ts` para que `contarDiasHabiles` re-exporte/delegue en `src/utils/businessDays.ts` en vez de mantener su propio bucle; verificar que `estaVencidaVerificacion` y `quality-events/index.ts` no requieren cambios de import.
- [x] 1.4 Crear `src/utils/businessDays.test.ts` cubriendo: conteo solo de lunes-viernes, exclusión de fin de semana, exclusión de feriado configurado, `desde === hasta` retorna `0`, signo correcto de `calcularDiasHabilesRestantes` en ambos sentidos, y que los tests existentes de `qualityEventHelpers`/`estaVencidaVerificacion` (si existen) sigan pasando sin modificación.

## 2. Cálculo de estado semáforo (shared-semaforo-pendientes — lógica)

- [x] 2.1 Crear `src/features/dashboard/types/semaforo.types.ts` con el tipo `SemaforoEstadoFila = 'VERDE' | 'AMARILLO' | 'ROJO'`.
- [x] 2.2 Crear `src/features/dashboard/utils/semaforoPendientes.ts` con `calcularEstadoSemaforoFila(diasHabilesRestantes: number): SemaforoEstadoFila` (umbrales: `>5` Verde, `1-5` Amarillo, `<=0` Rojo).
- [x] 2.3 Agregar `calcularEstadoSemaforoDesdeFecha(fechaVencimiento: string | Date, hoy?: Date, feriados?: string[]): { estado: SemaforoEstadoFila; diasHabilesRestantes: number }` en el mismo archivo, componiendo `calcularDiasHabilesRestantes` + `calcularEstadoSemaforoFila`.
- [x] 2.4 Crear `src/features/dashboard/utils/semaforoPendientes.test.ts` cubriendo los 5 escenarios de umbral (`6`→VERDE, `5`→AMARILLO, `1`→AMARILLO, `0`→ROJO, `-3`→ROJO) y `calcularEstadoSemaforoDesdeFecha` con `hoy` explícito para determinismo.

## 3. i18n

- [x] 3.1 Poblar el namespace `dashboard` (hoy `{}`) en `src/i18n/es-PE.json` con `semaforo.venceEn`, `semaforo.venceHoy`, `semaforo.vencidoHace`, `semaforo.criticoBanner.title`, `semaforo.criticoBanner.count`/`count_other`.
- [x] 3.2 Agregar las mismas claves traducidas al inglés en `src/i18n/en-US.json`.

## 4. Componente SemaforoRow (shared-semaforo-pendientes — UI)

- [x] 4.1 Crear `src/components/shared/SemaforoRow.tsx` recibiendo `estado`, `codigo`, `descripcion`, `diasHabilesRestantes`, `onClick?`; raíz `<button type="button">` si hay `onClick`, `<div>` si no.
- [x] 4.2 Aplicar clases: fondo neutro (`bg-surface-card dark:bg-surface-dark-elevated`), borde completo (`border border-hairline dark:border-hairline/20`), borde izquierdo 3px por rol (`border-l-success`/`border-l-warning`/`border-l-error`) sin redondeo en ese lado (`rounded-l-none`), sin clase de fondo coloreado por estado.
- [x] 4.3 Renderizar el texto de plazo con `t('dashboard:semaforo.venceEn'|'venceHoy'|'vencidoHace', {...})` según el signo de `diasHabilesRestantes`, con color de texto por rol (`text-success`/`text-warning`/`text-error`, cada uno con variante `dark:` explícita).
- [x] 4.4 Crear `src/components/shared/SemaforoRow.test.tsx` (Testing Library) cubriendo: clases correctas para cada `estado`, `rounded-l-none` presente, texto correcto para `diasHabilesRestantes` positivo/cero/negativo, comportamiento con y sin `onClick` (rol de botón + invocación al hacer click).

## 5. Componente SemaforoCriticoBanner (shared-semaforo-pendientes — UI)

- [x] 5.1 Crear `src/components/shared/SemaforoCriticoBanner.tsx` recibiendo `items: { id, codigo, descripcion }[]` y `onItemClick?: (id: string) => void`; retorna `null` si `items.length === 0`.
- [x] 5.2 Aplicar clases de banner independiente (`bg-error/10 dark:bg-error/15 border border-error dark:border-error rounded-lg`) con ícono `AlertTriangle` de `lucide-react` y texto `text-error dark:text-error`, usando `t('dashboard:semaforo.criticoBanner.*')`.
- [x] 5.3 Renderizar la lista de items (código + descripción) dentro del banner, con click opcional por item invocando `onItemClick(id)`.
- [x] 5.4 Crear `src/components/shared/SemaforoCriticoBanner.test.tsx` cubriendo: no renderiza con `items=[]`, renderiza con clases de banner y ambos items visibles con 2+ items, invocación de `onItemClick` con el `id` correcto.

## 6. Verificación final

- [x] 6.1 Ejecutar la suite de tests completa y confirmar cero regresiones en `quality-events` (helpers, `QEHeaderSection`) tras el refactor de `contarDiasHabiles`. (5 fallos preexistentes no relacionados con este change: `DeadlineBadge.test.tsx`/`Pagination.test.tsx` con import roto a `i18n/config` que no existe, `useNCList.test.ts` y `qualityEventCreate.schema.test.ts` — ninguno de esos archivos fue tocado por este change; confirmado con `git status` que no aparecen como modificados)
- [x] 6.2 Ejecutar type-check (`tsc --noEmit`) confirmando cero `any` y cero errores en los archivos nuevos/modificados. (Los `.ts`/`.tsx` de producción — `businessDays.ts`, `semaforoPendientes.ts`, `semaforo.types.ts`, `SemaforoRow.tsx`, `SemaforoCriticoBanner.tsx`, `qualityEventHelpers.ts` — no generan ningún error. Los `.test.tsx` nuevos sí muestran errores `toBeInTheDocument does not exist`, pero es la misma brecha preexistente de tipos jest-dom que ya afecta a *todos* los `.test.tsx` del repo — p.ej. `QEList.test.tsx`, `DocumentEditGuard.test.tsx` — confirmado corriendo `tsc -b` completo antes de tocar código; no es una regresión de este change)
- [x] 6.3 Confirmar manualmente en un harness local (Storybook no existe en el proyecto — usar una página o test visual temporal) que `SemaforoRow` y `SemaforoCriticoBanner` se ven correctamente en modo claro y oscuro para los 4 estados (Verde, Amarillo, Rojo, Crítico), y descartar el archivo temporal antes de cerrar el change. (Se creó una ruta pública temporal `/temp-semaforo-preview` + `TempSemaforoPreview.tsx`, se verificó con Playwright/screenshot en modo claro y oscuro los 4 estados de `SemaforoRow` y el banner `SemaforoCriticoBanner`, y ambos archivos temporales fueron eliminados/revertidos antes de cerrar el change)
