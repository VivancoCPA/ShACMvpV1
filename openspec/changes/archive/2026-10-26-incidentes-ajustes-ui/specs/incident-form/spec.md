## ADDED Requirements

### Requirement: Barra de acciones fija al pie del formulario
`IncidentForm` SHALL renderizar las acciones Cancelar y Guardar en una barra `sticky bottom-0`, dentro del `<form>`, con borde superior, fondo semitransparente (`bg-canvas/95`, `dark:bg-surface-dark/95`) y `backdrop-blur`, de modo que las dos acciones queden visibles sin hacer scroll hasta el final, tanto en alta como en edición. El botón Guardar SHALL conservar `type="submit"`, el estado `disabled` mientras se guarda y el texto "Guardando…". La barra SHALL NOT tapar el último campo del formulario cuando se hace scroll hasta el final. `IncidentQuickReportForm` queda fuera de este requisito.

#### Scenario: Acciones sticky en alta
- **WHEN** se renderiza `IncidentForm` en modo creación
- **THEN** el contenedor de las acciones tiene la clase `sticky` y el botón submit es descendiente del `<form>`

#### Scenario: Acciones sticky en edición
- **WHEN** se renderiza `IncidentForm` en modo edición
- **THEN** el contenedor de las acciones tiene la clase `sticky` y el botón submit es descendiente del `<form>`
