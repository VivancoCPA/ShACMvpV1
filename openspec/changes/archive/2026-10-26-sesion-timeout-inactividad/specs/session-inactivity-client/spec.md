## ADDED Requirements

### Requirement: Detector de inactividad único por layout autenticado
El sistema SHALL montar un único gestor de inactividad (`SessionTimeoutManager`) en cada layout autenticado (`AppShell` y `MobileShell`).
- **Actividad que cuenta:** solo la interacción real del usuario (`mousemove`, `keydown`, `click`, `scroll`, `touchstart`, y `visibilitychange` al volver a primer plano), con throttle.
- **Actividad que no cuenta:** las peticiones de red (polling de notificaciones, contador de pendientes, eventos SignalR) SHALL NOT contar como actividad.
- **Reporte al servidor:** mientras haya interacción real, el gestor SHALL llamar a `POST /api/auth/actividad` como máximo una vez por minuto.
- **Sin política:** si no hay política disponible, el gestor SHALL NOT armar temporizadores.

#### Scenario: Polling sin interacción
- **WHEN** la app recibe respuestas del polling de notificaciones y no hay eventos de interacción
- **THEN** la última actividad registrada no cambia y no se llama a `POST /api/auth/actividad`

#### Scenario: Interacción continua
- **WHEN** el usuario mueve el mouse de forma continua durante 3 minutos
- **THEN** `POST /api/auth/actividad` se llama como máximo 4 veces (una por ventana de 60 s, más el envío trailing)

### Requirement: Aviso 60 segundos antes del cierre por inactividad
Cuando falten 60 segundos o menos para cumplirse la inactividad configurada, el sistema SHALL mostrar un modal con:
- cuenta regresiva: "Tu sesión se cerrará por inactividad en N s";
- botón "Seguir conectado": registra la actividad en el servidor, refresca el token y reinicia el contador;
- botón "Cerrar sesión".

Mientras el modal está abierto, la actividad pasiva (mover el mouse, hacer scroll) SHALL NOT cerrarlo. Al llegar a 0, el sistema SHALL cerrar la sesión con motivo inactividad.

#### Scenario: Aparece el aviso
- **WHEN** la inactividad es de 5 minutos y pasan 4 minutos sin interacción
- **THEN** se muestra el modal con la cuenta regresiva en 60 s

#### Scenario: Seguir conectado
- **WHEN** el usuario pulsa "Seguir conectado" en el modal
- **THEN** el modal se cierra, se llama a `POST /api/auth/actividad`, y el contador vuelve a la inactividad completa

#### Scenario: Cuenta regresiva agotada
- **WHEN** el modal llega a 0 sin interacción
- **THEN** la sesión se cierra y el login muestra "Tu sesión se cerró por inactividad"

### Requirement: Duración máxima absoluta en el cliente
Cuando el servidor haya informado `sesionIniciadaEn` y se cumpla `sesionMaximaHoras`, el sistema SHALL cerrar la sesión con motivo sesión máxima aunque haya actividad reciente.

#### Scenario: Sesión máxima cumplida con actividad
- **WHEN** se cumple `sesionIniciadaEn + sesionMaximaHoras` mientras el usuario interactúa
- **THEN** la sesión se cierra y el login muestra "Tu sesión alcanzó la duración máxima; vuelve a iniciar sesión"

### Requirement: Sincronización entre pestañas
La última actividad SHALL compartirse entre las pestañas del mismo origen (vía `BroadcastChannel` con respaldo en el evento `storage`): la actividad en una pestaña SHALL evitar el cierre en las demás. Un cierre de sesión en una pestaña SHALL cerrar la sesión en todas, con el mismo motivo.

#### Scenario: Actividad en otra pestaña
- **WHEN** el usuario trabaja en la pestaña A y la pestaña B no recibe interacción durante más tiempo que la inactividad
- **THEN** la pestaña B no cierra la sesión

#### Scenario: Logout en una pestaña
- **WHEN** la sesión se cierra en la pestaña A
- **THEN** la pestaña B también queda sin sesión y redirige al login

### Requirement: Cierre de sesión unificado con motivo y retorno
Todo cierre de sesión SHALL:
- llamar a `POST /api/auth/logout` (best-effort);
- limpiar el `authStore` y la caché de TanStack Query;
- desconectar SignalR;
- redirigir al login conservando la ruta actual.

El login SHALL mostrar el mensaje del motivo (inactividad o sesión máxima) cuando exista, y tras un login exitoso SHALL volver a la ruta donde estaba el usuario si su rol tiene acceso.

#### Scenario: Retorno tras re-login
- **WHEN** la sesión se cierra por inactividad estando en `/documentos/abc` y el mismo usuario vuelve a iniciar sesión
- **THEN** la app navega a `/documentos/abc`

### Requirement: El interceptor no reintenta ante cierre por política
Ante una respuesta 401 con `errorCode` `SESION_INACTIVA` o `SESION_MAXIMA_ALCANZADA`, el interceptor de Axios SHALL NOT intentar un refresh ni reintentar la petición. SHALL cerrar la sesión con el motivo correspondiente.

#### Scenario: Refresh rechazado por sesión máxima
- **WHEN** una petición recibe 401, el refresh responde 401 con `SESION_MAXIMA_ALCANZADA`
- **THEN** no se hace ningún otro intento de refresh y la sesión se cierra con motivo sesión máxima

### Requirement: Refresh de token single-flight
Las llamadas concurrentes a `refreshToken()` dentro de una pestaña SHALL compartir una única petición `/api/auth/refresh`. Entre pestañas, el refresh SHALL serializarse con Web Locks cuando el navegador los soporte.

#### Scenario: Dos 401 simultáneos
- **WHEN** dos peticiones reciben 401 al mismo tiempo
- **THEN** se hace una sola llamada a `/api/auth/refresh` y ambas peticiones se reintentan con el token nuevo
