## MODIFIED Requirements

### Requirement: AlertaCard es un enlace con número grande y color de nivel, neutro cuando vale 0
El sistema SHALL exportar `AlertaCard` en `src/features/dashboard/components/layout/AlertaCard.tsx`, con props `{ valor: number; titulo: string; subtitulo?: string; nivel: 'error' | 'warning' | 'info' }` más **una** de estas dos formas de destino (unión discriminada; nunca las dos a la vez):
- `to: string`: SHALL renderizar un `<Link to={to}>` de React Router. Se usa para las tarjetas que llevan a **otra pantalla**. Si `to` empieza con `#`, SHALL renderizar `<a href={to}>`.
- `onSelect: () => void` y `activa?: boolean`: SHALL renderizar un `<button type="button">` con `aria-pressed={activa ?? false}`, que llama a `onSelect` al hacer clic. Se usa para las tarjetas que filtran o seleccionan una lista de la **misma página** (`?alerta=`). Con `activa: true`, SHALL mostrar un anillo (`ring-2 ring-offset-2`) del color del nivel (`error`, `amber` o azul para `info`), con su variante `dark:`.

El número SHALL ir en `text-3xl font-bold`, con el título debajo.
- Con `valor > 0`, el fondo SHALL ser el tono suave del nivel (`error` → `bg-error/10`, `warning` → `bg-amber/15`, `info` → el token azul existente al 10–15 %), con su variante `dark:`, y el número en el color del nivel. Se muestra `subtitulo` si viene.
- Con `valor === 0`, SHALL usar el estilo neutro `bg-surface-soft text-muted` (con variante `dark:`) y el subtítulo `t('dashboard:layout.todoEnOrden')`, ignorando `subtitulo`. Sigue siendo un enlace o un botón.

El elemento SHALL tener foco visible (`focus-visible:ring-2`) y un `aria-label` con el número y el título (p.ej. "5 AC vencidas").

#### Scenario: Valor cero se ve neutro con "Todo en orden"
- **WHEN** `AlertaCard` recibe `valor: 0`, `nivel: 'error'`
- **THEN** la tarjeta usa `bg-surface-soft`, no `bg-error/10`, y muestra "Todo en orden"

#### Scenario: Valor mayor a cero usa el color del nivel
- **WHEN** `AlertaCard` recibe `valor: 5`, `nivel: 'error'`, `titulo: 'AC vencidas'`
- **THEN** la tarjeta usa `bg-error/10`, muestra `5` y su `aria-label` es "5 AC vencidas"

#### Scenario: Enlace a una lista
- **WHEN** `AlertaCard` recibe `to: '/quality-events?severidad=CRITICA'`
- **THEN** el elemento renderizado es un enlace con `href` `/quality-events?severidad=CRITICA`

#### Scenario: Enlace a un ancla de la misma página
- **WHEN** `AlertaCard` recibe `to: '#acciones-requeridas'`
- **THEN** se renderiza un `<a href="#acciones-requeridas">`

#### Scenario: Tarjeta selectora
- **WHEN** `AlertaCard` recibe `onSelect` y `activa: true`
- **THEN** se renderiza un `<button>` con `aria-pressed="true"` y la clase de anillo del nivel, y al hacer clic se llama a `onSelect`

#### Scenario: Tarjeta selectora inactiva
- **WHEN** `AlertaCard` recibe `onSelect` sin `activa`
- **THEN** el botón tiene `aria-pressed="false"` y no tiene la clase de anillo

## ADDED Requirements

### Requirement: La tarjeta de alerta seleccionada vive en la URL
El sistema SHALL exportar `useAlertaSeleccionada()` en `src/features/dashboard/hooks/useAlertaSeleccionada.ts`, que lee `?alerta=` con `useSearchParams` y devuelve `{ alerta: string | null, seleccionar(id: string): void, limpiar(): void, alternar(id: string): void }`.
- `seleccionar` y `limpiar` SHALL escribir con `replace: true` y conservar los demás parámetros de la URL (p.ej. `periodo`).
- `alternar(id)` SHALL limpiar si `alerta === id` y seleccionar `id` en caso contrario.

Cada página de dashboard con alertas SHALL declarar una tabla `ALERTAS` con, para cada tarjeta que apunta a una lista de la misma página, la función o los tipos que definen su conjunto. El `valor` de la tarjeta SHALL ser la longitud del **mismo** arreglo filtrado que muestra la lista, calculado con la misma función. Al hacer clic en una tarjeta selectora, la página SHALL llamar a `alternar(id)` y hacer scroll suave (`scrollIntoView({ behavior: 'smooth', block: 'start' })`) hasta el contenedor de la lista destino, desde el handler del clic (sin `useEffect`).

#### Scenario: Seleccionar conserva el período
- **WHEN** la URL es `/dashboard?periodo=anio` y se llama a `seleccionar('aprobaciones')`
- **THEN** la URL pasa a tener `periodo=anio` y `alerta=aprobaciones`

#### Scenario: Alternar una tarjeta activa la desactiva
- **WHEN** la URL tiene `?alerta=aprobaciones` y se llama a `alternar('aprobaciones')`
- **THEN** la URL deja de tener el parámetro `alerta`

#### Scenario: El filtro sobrevive a la recarga
- **WHEN** la página se monta con `?alerta=aprobaciones`
- **THEN** `alerta` vale `'aprobaciones'`, la tarjeta correspondiente tiene `aria-pressed="true"` y la lista destino ya está filtrada
