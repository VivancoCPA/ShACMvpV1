## MODIFIED Requirements

### Requirement: Bloque "Ubicación" en formulario de incidente (ADD-03)
El formulario SHALL incluir un bloque "Ubicación" opcional, posicionado después de los campos de descripción del bloque "Reporte inicial" y antes de la zona de carga de evidencias. El bloque contiene tres campos opcionales: `localId` (select), `zonaId` (select), y `ubicacion` (componente interactivo). La ausencia de los tres campos NO bloquea el guardado ni rompe ninguna validación Zod existente (RN-LOC-003).

El campo `localId` SHALL renderizarse como un select con las opciones cargadas desde `useLocales()`. Al cambiar `localId`, el sistema SHALL resetear automáticamente `zonaId` a `undefined` y `ubicacion` a `undefined`.

El campo `zonaId` SHALL renderizarse como un select con las opciones cargadas desde `useZonasByLocal(localId)`. El select SHALL estar deshabilitado cuando `localId` no tiene valor seleccionado.

El componente `ubicacion` SHALL ser visible únicamente cuando `localId` tiene valor Y el local seleccionado tiene `planoPngUrl` definido. Si `localId` tiene valor pero el local no tiene `planoPngUrl`, el bloque SHALL mostrar el texto `incidents:form.ubicacion.sinPlano` ("Este local no tiene plano cargado; no se puede marcar la ubicación.") en lugar del plano. El plano clicable mantiene un ancho máximo de 360 px. En modo edición, el pin SHALL mostrarse en la `ubicacion` ya guardada del incidente (cargada en `defaultValues`). El componente muestra la imagen PNG del plano como fondo (usando `/mock/plano-placeholder.png` mientras el cliente no entregue assets reales). Al hacer clic sobre el PNG, el sistema SHALL calcular las coordenadas `x` e `y` como porcentaje (0–100) relativo al tamaño del contenedor del PNG y guardarlas en `ubicacion: { x, y }`. El pin SHALL renderizarse como un punto con clase `bg-coral` posicionado con `position: absolute` en `left: x%` / `top: y%`. El componente SHALL incluir un botón "Limpiar ubicación" que resetea `ubicacion` a `undefined` y un texto informativo "Haz clic sobre el plano para marcar la ubicación del incidente".

#### Scenario: Select de local cargado con useLocales
- **WHEN** el formulario se monta
- **THEN** el select `localId` muestra las opciones obtenidas de `useLocales()` (máx 4 locales activos)

#### Scenario: zonaId deshabilitado sin localId
- **WHEN** el campo `localId` no tiene valor seleccionado
- **THEN** el select `zonaId` está deshabilitado (`disabled={true}`)

#### Scenario: zonaId se habilita al seleccionar localId
- **WHEN** el usuario selecciona `localId = 'loc-001'`
- **THEN** el select `zonaId` se habilita y carga las zonas desde `useZonasByLocal('loc-001')`

#### Scenario: zonaId y ubicacion se resetean al cambiar localId
- **WHEN** el usuario tiene `localId = 'loc-001'`, `zonaId = 'zon-002'`, y `ubicacion = { x: 30, y: 50 }` y cambia `localId` a `'loc-002'`
- **THEN** `zonaId` vuelve a `undefined` y `ubicacion` vuelve a `undefined`

#### Scenario: Componente de mapa visible con local que tiene planoPngUrl
- **WHEN** el usuario selecciona `localId = 'loc-001'` (que tiene `planoPngUrl`)
- **THEN** aparece el componente de mapa con la imagen del plano como fondo

#### Scenario: Componente de mapa oculto sin localId
- **WHEN** `localId` no tiene valor
- **THEN** el componente de mapa interactivo no se renderiza

#### Scenario: Clic en mapa registra coordenadas porcentuales
- **WHEN** el usuario hace clic sobre el PNG en la posición (150px, 75px) dentro de un contenedor de 300×150 px
- **THEN** el sistema guarda `ubicacion = { x: 50, y: 50 }` (cada coordenada = posición / tamaño × 100)

#### Scenario: Pin coral visible en posición guardada
- **WHEN** `ubicacion = { x: 45, y: 30 }` está guardado
- **THEN** se muestra un punto con clase `bg-coral` posicionado en `left: 45%; top: 30%` relativo al contenedor del PNG

#### Scenario: Botón "Limpiar ubicación" resetea el pin
- **WHEN** el usuario hace clic en el botón "Limpiar ubicación"
- **THEN** `ubicacion` vuelve a `undefined` y el pin desaparece del mapa

#### Scenario: Campos opcionales no bloquean el submit
- **WHEN** el usuario envía el formulario sin seleccionar `localId`, `zonaId` ni `ubicacion`
- **THEN** el formulario se envía sin errores de validación (los tres campos son opcionales)

#### Scenario: Aviso cuando el local no tiene plano
- **WHEN** el usuario selecciona un local sin `planoPngUrl`
- **THEN** no se muestra el plano y aparece "Este local no tiene plano cargado; no se puede marcar la ubicación."

#### Scenario: Pin guardado visible en edición
- **WHEN** se abre el formulario en modo edición de un incidente con `ubicacion = { x: 60, y: 20 }` y un local con plano
- **THEN** el plano muestra el pin `bg-coral` en `left: 60%; top: 20%`
