## ADDED Requirements

### Requirement: El panel de notificaciones se cierra con clic afuera, Escape y al navegar
El panel desplegable de `NotificationBell` SHALL cerrarse al hacer clic/touch fuera del panel y del botón de la campana, al presionar `Escape` (devolviendo el foco a la campana) y al cambiar `location.pathname` — en particular, hacer clic en una notificación navega a su `link` y con eso el panel se cierra. Usa `useDismissable` (`dismissable-menus`). El botón SHALL exponer `aria-expanded`, `aria-haspopup="dialog"` y `aria-controls` con el `id` del panel.

#### Scenario: Clic en el body cierra el panel
- **WHEN** el panel está abierto y el usuario hace clic en `document.body`
- **THEN** el panel deja de renderizarse

#### Scenario: Escape cierra el panel
- **WHEN** el panel está abierto y el usuario presiona `Escape`
- **THEN** el panel deja de renderizarse y el foco vuelve al botón de la campana

#### Scenario: Navegar desde una notificación cierra el panel
- **WHEN** el usuario hace clic en una notificación y la ruta cambia a su `link`
- **THEN** el panel deja de renderizarse
