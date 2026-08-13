## MODIFIED Requirements

### Requirement: Un reporte fallido no bloquea a los siguientes
Si la sincronización de un reporte falla con un error clasificado como de **backend** (validación, permisos, o el bug de coordinación de Service Workers `ERR_INVALID_RESPONSE_ENVELOPE`), el sistema SHALL marcarlo en `status: 'error'` de forma independiente en ese mismo intento. Si el fallo se clasifica como error de **red** y la entrada no agotó sus reintentos automáticos (ver Requirement: Clasificación de errores de sincronización y reintento automático), el sistema SHALL devolverla a `status: 'pending'` en vez de `'error'`. En ambos casos, el sistema SHALL continuar procesando el resto de la cola en orden, sin tratar la cola como una transacción atómica ni bloquear a los reportes siguientes por el fallo de uno.

#### Scenario: El primer reporte de la cola falla por error de servidor
- **WHEN** el primer reporte pendiente falla la sincronización por un error de validación del servidor
- **THEN** el sistema lo marca en `status: 'error'` con el mensaje correspondiente y continúa sincronizando el siguiente reporte pendiente de la cola

#### Scenario: El primer reporte de la cola falla por corte de señal
- **WHEN** el primer reporte pendiente falla la sincronización por un error de red (sin agotar sus reintentos automáticos)
- **THEN** el sistema lo devuelve a `status: 'pending'` (no `'error'`) y continúa sincronizando el siguiente reporte pendiente de la cola en el mismo ciclo

## ADDED Requirements

### Requirement: Clasificación de errores de sincronización y reintento automático ante fallos de red
Ante cada intento fallido de sincronización de una entrada, el sistema SHALL clasificar el error reutilizando el mismo criterio que `classifySubmitError()` (red / envelope inválido / servidor). Si la clasificación es **red**, el sistema SHALL reintentar automáticamente en ciclos de sincronización posteriores hasta un máximo de 3 intentos fallidos consecutivos por causa de red; al superar ese máximo, SHALL marcar la entrada en `status: 'error'` con un mensaje que indique que se agotaron los reintentos automáticos. Si la clasificación es **envelope inválido** o **servidor**, el sistema SHALL marcar la entrada en `status: 'error'` de inmediato, sin reintento automático. El sistema SHALL NOT mostrar una notificación (`toast`) de error mientras una entrada permanece en reintento automático (`status: 'pending'` tras un fallo de red bajo el límite) — solo al llegar efectivamente a `status: 'error'`.

#### Scenario: Fallo de red por debajo del límite de reintentos
- **WHEN** la sincronización de una entrada falla con un error clasificado como red y su `retryCount` es menor a 3
- **THEN** el sistema incrementa `retryCount`, devuelve la entrada a `status: 'pending'` y NO muestra una notificación de error al usuario

#### Scenario: Fallo de red que agota los reintentos automáticos
- **WHEN** la sincronización de una entrada falla con un error clasificado como red y su `retryCount` ya es 3
- **THEN** el sistema marca la entrada en `status: 'error'` con un mensaje indicando que se agotaron los reintentos automáticos, y muestra una notificación de error al usuario

#### Scenario: Fallo de backend no se reintenta automáticamente
- **WHEN** la sincronización de una entrada falla con un error clasificado como servidor (4xx/5xx con `error.response`) o como envelope inválido
- **THEN** el sistema marca la entrada en `status: 'error'` en ese mismo intento, sin incrementar `retryCount`, y muestra una notificación de error al usuario

#### Scenario: Reintento manual tras agotar los reintentos automáticos
- **WHEN** el usuario reintenta manualmente una entrada que había llegado a `status: 'error'` por agotar sus reintentos automáticos de red
- **THEN** el sistema reinicia su `retryCount` a 0, de forma que un nuevo fallo de red parte de un contador limpio en vez de heredar el anterior
