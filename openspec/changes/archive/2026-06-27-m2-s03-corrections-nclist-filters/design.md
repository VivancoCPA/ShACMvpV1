## Context

M2-S03 entregó la capa UI de No Conformidades: NCList, NCListFilters, NonconformityListPage y los badges compartidos. En la revisión post-implementación se identificaron inconsistencias con la UX de M1 (DocumentList) y decisiones de diseño a corregir antes de avanzar a M2-S04:

- El filtro y columna **Dominio** no aportan valor en la tabla; el campo clave para orientar al usuario es el **Título** (descripción truncada).
- El filtro de **Área Afectada** usa `<input type="text">` cuando la aplicación ya tiene `AREAS_SHAC` como select estándar (usado en DocumentListFilters).
- Los inputs de **fecha** del browser no muestran `dd/mm/yyyy` en Windows; necesitan formato explícito vía `<input type="date">` con locale hint o campo de texto con máscara.
- Falta visibilidad de la **Fecha de Cierre** esperada con semáforo de urgencia.
- Los componentes de **paginación** y **barra de filtros** están duplicados en M1 y M2.
- `AREAS_SHAC` vive en `features/documents/constants.ts`, creando dependencia de M2 hacia M1.

Este change no toca lógica de negocio ni APIs. Es puramente UX, estandarización de componentes y limpieza de dependencias.

## Goals / Non-Goals

**Goals:**
- Eliminar columna y filtro de Dominio; agregar columna Título con truncado + tooltip.
- Agregar columna Fecha de Cierre con DeadlineBadge semáforo.
- Agregar `NC-PRV` (Proveedor/Contratista) como quinto valor de `NCDominio`.
- Reemplazar text input de Área Afectada por select usando `AREAS_SHAC`.
- Agregar etiqueta "Fecha detección" al grupo de filtros de fecha.
- Mover `AREAS_SHAC` a `src/constants/shared.constants.ts` (reutilizable por todos los módulos).
- Crear `DeadlineBadge`, `Pagination` y `FilterBar` como componentes shared.
- Centralizar `TABLE_ROW_CLASS` en `src/constants/ui.constants.ts`.
- Refactorizar DocumentList y DocumentListFilters para usar los nuevos shared components.

**Non-Goals:**
- No se modifica la lógica de query ni los endpoints del API.
- No se implementa date picker custom; se mantiene `<input type="date">` del browser con atributo `lang="es-PE"` para hint de formato.
- No se altera el flujo de estados NC ni las reglas de negocio.
- No se implementa virtualización de lista (fuera de scope de este change).
- No se toca M3, M4, M5 o M6.

## Decisions

### 1. `fechaCierre` en `NoConformidad`, no en `AccionCorrectiva`

`fechaCierre` en este contexto es la **fecha límite esperada de cierre de la NC**, no la fecha de cierre de una AC específica. Las ACs ya tienen `plazoFecha`. Agregar `fechaCierre?: string` a `NoConformidad` es más directo y permite mostrar el semáforo a nivel de fila sin necesidad de calcular el peor caso entre ACs.

**Alternativa descartada**: Calcular `fechaCierre` como el `plazoFecha` más tardío de todas las ACs. Descartada porque una NC puede no tener ACs (recién abierta), y el plazo de cierre puede ser definido explícitamente por el supervisor independientemente de las ACs.

### 2. `NCDominio` agrega `'PROVEEDOR'` con prefijo `NC-PRV`

El valor lógico en TypeScript es `'PROVEEDOR'` (consistente con los otros valores en español: CALIDAD, SST, ADUANERO, OPERACIONAL). El prefijo en el número NC es `PRV`. Los valores de filtro URL y MSW usan el valor lógico completo.

**Alternativa descartada**: Usar `'PRV'` como valor del tipo (para que coincida con el prefijo). Descartada porque los otros dominios usan nombres completos, y abreviatures solo están en el `numero` de la NC, no en el tipo.

### 3. `AREAS_SHAC` se mueve a `src/constants/shared.constants.ts`

`features/documents/constants.ts` expone una constante de aplicación que M2 (y eventualmente M3, M4) necesita. La convención del proyecto es que los `features/` no deben importar de otros `features/`. Mover `AREAS_SHAC` a `src/constants/` rompe la dependencia y hace la constante accesible a todos.

`features/documents/constants.ts` pasa a re-exportar `AREAS_SHAC` desde `src/constants/shared.constants.ts` para no romper imports existentes en M1 durante la transición.

### 4. `Pagination` recibe estado via props; el padre maneja la navegación

El componente `Pagination` es **stateless**: recibe `currentPage`, `totalPages`, `totalItems`, `pageSize`, `onPageChange`. El módulo padre (NCList, DocumentList) sigue siendo dueño del estado de paginación URL. Esto evita que `Pagination` acceda a `useSearchParams` directamente, manteniéndolo reutilizable fuera de contextos de router (tests, M3).

### 5. `FilterBar` es un contenedor puro de estilos, no gestiona estado de filtros

`FilterBar` provee el `div` contenedor con `className` estandarizado (`flex flex-wrap items-end gap-3 mb-4`). Cada módulo compone sus propios inputs dentro del slot `children`. Esto elimina duplicación de layout sin forzar un API de filtros genérico complejo.

### 6. `TABLE_ROW_CLASS` como constante string en `ui.constants.ts`

Las clases de fila de tabla son idénticas entre DocumentList y NCList. Centralizar en una constante string exportable desde `src/constants/ui.constants.ts` es la opción más liviana (sin abstracción de componente `<TableRow>`), permite override per-módulo via concatenación, y es auditable en un solo lugar.

## Risks / Trade-offs

- **Re-export en `features/documents/constants.ts`**: Si en el futuro alguien borra el re-export olvidando que hay consumers en M1, se rompen imports. Mitigación: el re-export incluye un comentario señalando que la fuente es `src/constants/shared.constants.ts`.
- **`fechaCierre` en fixtures**: Algunos fixtures existentes no tendrán `fechaCierre` (campo opcional). Los nuevos fixtures para NC-PRV sí lo incluirán con fechas representativas de los tres estados del semáforo. No hay riesgo de TypeScript ya que el campo es `?`.
- **Formato de fecha en browser**: `<input type="date">` en Windows muestra `dd/mm/yyyy` o `mm/dd/yyyy` según la configuración regional del OS, no del atributo `lang`. No hay solución perfecta sin date picker custom. La decisión es aceptar el comportamiento del browser y agregar el atributo `lang="es-PE"` como hint para cuando el browser lo soporte.
- **Refactor DocumentList/DocumentListFilters**: Cambios en componentes M1 en producción. Riesgo bajo porque los cambios son puramente de UI (mismo comportamiento, diferente componente de presentación). Mitigación: tests unitarios existentes de M1 siguen pasando.
