# dismissable-menus Specification

## Purpose
TBD - created by syncing change pendientes-qe-asignacion-y-menus.

## Requirements

### Requirement: Hook useDismissable cierra un panel con clic afuera y Escape
El sistema SHALL exportar `useDismissable(open: boolean, onClose: () => void, refs: React.RefObject<HTMLElement | null>[]): void` en `src/hooks/useDismissable.ts`. Mientras `open` sea `true`, el hook SHALL escuchar `mousedown` y `touchstart` en `document` y llamar a `onClose()` cuando el target no esté contenido en ninguno de los elementos de `refs`; y SHALL escuchar `keydown` en `document` y, ante `Escape`, llamar a `onClose()` y devolver el foco al botón disparador (`refs[1]`, por convención `[panelRef, triggerRef]`; si no existe, `refs[0]`). Mientras `open` sea `false` no SHALL haber listeners registrados, y los listeners SHALL removerse al cerrar o desmontar. El botón disparador SHALL formar parte de `refs`, para que un `mousedown` sobre él no cierre el panel antes de que su `onClick` lo alterne.

#### Scenario: Clic afuera cierra
- **WHEN** el panel está abierto y se produce un `mousedown` sobre un elemento fuera del panel y del botón
- **THEN** se llama a `onClose()`

#### Scenario: Clic adentro o en el botón no cierra por el hook
- **WHEN** el panel está abierto y se produce un `mousedown` dentro del panel o sobre el botón disparador
- **THEN** el hook no llama a `onClose()`

#### Scenario: Escape cierra y devuelve el foco
- **WHEN** el panel está abierto y se presiona `Escape`
- **THEN** se llama a `onClose()` y el foco queda en el botón disparador

#### Scenario: Cerrado no escucha
- **WHEN** `open` es `false` y se produce un `mousedown` o `Escape` en el documento
- **THEN** `onClose()` no se llama

### Requirement: Los menús desplegables no modales se cierran al navegar
Los paneles desplegables cubiertos por esta capacidad SHALL cerrarse automáticamente cuando cambia `location.pathname`. El estado abierto SHALL derivarse de la ruta en la que se abrió (p.ej. `openAt === location.pathname`), sin `useEffect` que llame a `setState`.

#### Scenario: Cambio de ruta cierra el panel
- **WHEN** un panel está abierto y la ruta cambia a otro `pathname`
- **THEN** el panel deja de renderizarse

### Requirement: Menús del header y paneles desplegables usan useDismissable
`useDismissable` y el cierre al navegar SHALL aplicarse a: el menú de usuario y el selector de empresa de `TopNav`, el panel de `NotificationBell`, el menú "⋯" de `DocumentManagementActions` y el panel de `SyncQueueBadge`. En `TopNav`, abrir el menú de usuario SHALL cerrar el selector de empresa y viceversa (a lo sumo uno abierto). Los botones disparadores SHALL exponer `aria-expanded`, `aria-haspopup` (`"menu"` para menús, `"dialog"` para paneles de contenido) y `aria-controls` apuntando al `id` del panel. Los combobox (`SearchableSelect`, `DocumentoQECombobox`, `DocumentoNCCombobox`, `NormativaVinculadaCombobox`) y los modales quedan fuera de alcance.

#### Scenario: Solo un menú del header abierto a la vez
- **WHEN** el menú de usuario está abierto y el usuario abre el selector de empresa
- **THEN** el selector de empresa queda abierto y el menú de usuario cerrado

#### Scenario: Atributos ARIA del disparador
- **WHEN** el menú de usuario está abierto
- **THEN** su botón tiene `aria-expanded="true"`, `aria-haspopup="menu"` y `aria-controls` igual al `id` del panel renderizado
