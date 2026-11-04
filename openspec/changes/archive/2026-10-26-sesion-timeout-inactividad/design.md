## Context

Diagnóstico confirmado leyendo el código real (2026-10-19):

- **Backend:**
  - `JwtSettings.AccessTokenExpirationMinutes = 60` y `RefreshTokenExpirationDays = 7` (`appsettings.Development.json`).
  - `RefreshHandler` revoca el token actual y emite uno nuevo con `CreatedAt = ahora` en cada `/refresh`, así que no queda rastro del inicio real de la sesión.
  - `SwitchEmpresaHandler` **no** rota el token: actualiza `EmpresaActivaId` in-place.
  - La cookie `shac_refresh_token` usa `Path=/api/auth`, de modo que el navegador la manda a cualquier endpoint bajo `/api/auth/*`.
- **Frontend:**
  - `lib/axios.ts` refresca ante cualquier 401 sin coordinación entre llamadas concurrentes.
  - `useNotifications` (60 s) y `useDocumentosPendientesCount` (60 s) hacen polling.
  - `useNotificationsHub` conecta SignalR atado a `isAuthenticated`.
  - No existe detección de inactividad.
- `Empresa` solo tiene `RazonSocial`, `Ruc`, `Estado`, `LogoUrl` y `FechaAlta`.
- No existe una tabla de parámetros globales ni un log de seguridad o autenticación persistente. El único registro de auditoría existente es por entidad (`*AuditTrail`).
- Cola offline (`lib/offlineQueue.ts`):
  - `authStore.logout()` y `useLogout` no la tocan (`clearAll()` no tiene ningún llamador).
  - Las entradas guardan `empresaId`, pero **no** `usuarioId`. Si otro usuario inicia sesión en el mismo dispositivo, el ciclo de sync enviaría los reportes del primero con la identidad del segundo.

## Goals / Non-Goals

**Goals:**
- Cerrar la sesión por inactividad y por duración máxima, con valores configurables por empresa dentro de límites globales.
- La protección real vive en el servidor. El temporizador del navegador es solo comodidad y UX.
- No perder trabajo offline.

**Non-Goals:**
- Bloqueo de pantalla con re-ingreso de PIN (sin cerrar la sesión).
- Política de complejidad de contraseñas o bloqueo por intentos fallidos.
- Un log de seguridad persistente genérico. El cierre por política va al ILogger estructurado (D8).
- Invalidar en vivo los access tokens ya emitidos (no hay lista de revocación de JWT, ver D5).

## Decisions

### D1 — Tablas propias, no columnas en `Empresa` ni `appsettings`
- **`ParametrosSesionSistema`:** fila única, `Id = 1`, sembrada por la migración con `HasData`. Columnas tipadas:
  - `InactividadDefaultMinutos`, `InactividadMinMinutos`, `InactividadMaxMinutos` (semilla: 30 / 5 / 240);
  - `SesionMaximaDefaultHoras`, `SesionMaximaMinHoras`, `SesionMaximaMaxHoras` (semilla: 12 / 1 / 24);
  - `ActualizadoPorId?`, `ActualizadoPorNombre?`, `ActualizadoEn?`.
  - Se elige una fila tipada en vez de una tabla clave/valor genérica: no existe ninguna tabla de parámetros que reutilizar, y la fila tipada da validación y migración explícitas.
- **`ConfiguracionSeguridadEmpresa`:**
  - PK = `EmpresaId`, con FK a `Empresa` y borrado en cascada.
  - Columnas: `InactividadMinutos?`, `SesionMaximaHoras?` (null = usa el global), `ActualizadoPorId`, `ActualizadoPorNombre` y `ActualizadoEn`.
  - Se descartan las columnas en `Empresa`: así se evita tocar `GET /api/empresas`, el PATCH y el contrato del logo (cambio `administracion-empresas` en vuelo), y la configuración tiene su propio "quién/cuándo".
- **`ConfiguracionSesionAuditTrail`** (append-only):
  - `Id`, `Ambito` (`GLOBAL` | `EMPRESA`), `EmpresaId?`, `Campo`, `ValorAnterior?`, `ValorNuevo?`, `RealizadoPorId`, `RealizadoPorNombre` y `Timestamp`.
  - Se escribe una fila por cada campo que cambió, en la misma transacción que el cambio.

### D2 — Rangos absolutos (piso duro en código)
El SUPERADMIN puede mover los límites, pero nunca fuera de estos rangos:
- inactividad: de 5 a 1440 min;
- sesión máxima: de 1 a 168 h.

El piso de 5 min coincide con la vigencia del access token (D5). Si el mínimo bajara de ahí, el servidor no podría hacer cumplir la inactividad con esa precisión. Validación de los parámetros globales:
- `min ≤ default ≤ max` en cada par;
- `SesionMaximaDefaultHoras × 60 ≥ InactividadDefaultMinutos`.

Se confirma el rango 1–24 h propuesto para la semilla de la sesión máxima: cubre un turno de 12 h con margen y no hay razón en el código para otro.

### D3 — `PoliticaSesionResolver` (único lugar)
`ObtenerAsync(Guid? empresaId)` devuelve `{ InactividadMinutos, SesionMaximaHoras }` efectivos:
1. Lee los parámetros globales.
2. Si `empresaId` es null (SUPERADMIN), devuelve los valores por defecto.
3. Si no, usa el valor de la empresa o, si es null, el global.
4. Ajusta (*clamp*) cada valor a los límites actuales.
5. Si después del ajuste `inactividad > sesionMaxima × 60`, reduce la inactividad a `sesionMaxima × 60`. Ese caso solo puede ocurrir con límites raros: el resolver nunca devuelve una política incoherente.

La validación de escritura (`PoliticaSesionValidator`, una función pura) está en el mismo archivo. Comprueba cada valor no nulo dentro de los límites y que la sesión máxima efectiva × 60 sea ≥ la inactividad efectiva. Si falla, lanza `FieldValidationException` (400 con `"campo: mensaje"`).

En el frontend, `features/sesion/utils/politicaSesion.ts` replica el resolver y el validador. Lo usan el MSW y el schema Zod dinámico. Los límites **no se duplican**: siempre vienen del servidor en la respuesta del GET (D9).

### D4 — Actividad: endpoint `POST /api/auth/actividad` (no un header)
Se elige el endpoint en lugar de un encabezado `X-User-Activity`:
- No hay que marcar cada petición "iniciada por el usuario". Distinguirlas en el interceptor es frágil: las mutaciones se disparan desde efectos de TanStack Query, desde invalidaciones, etc.
- La cadencia queda acotada (como máximo 1 por minuto).
- Vive bajo `/api/auth`, así que recibe la cookie del refresh token y no necesita Bearer. Funciona aunque el access token haya vencido hace segundos.

Funcionamiento del endpoint:
1. Identifica la sesión por la cookie.
2. Aplica las mismas dos comprobaciones que `/refresh`. Si alguna falla, revoca y responde 401 con el código correspondiente.
3. Si pasa, actualiza `UltimaActividadEn = ahora` en el token vigente.
4. Devuelve `{ inactividadMinutos, sesionMaximaHoras, sesionIniciadaEn, ultimaActividadEn }`.

`/refresh` **nunca** actualiza `UltimaActividadEn`: solo hereda el valor del token anterior. Por eso el polling (que dispara refresh) no extiende la sesión.

### D5 — Access token de 5 min (no un middleware por petición)
`AccessTokenExpirationMinutes = 5` en `appsettings*.json`. El default de `JwtSettings` también baja a 5.
- Con eso, una sesión expirada en el servidor sigue operando como máximo 5 min (más 30 s de *ClockSkew*), en vez de 60.
- Se descarta un middleware que valide la política en cada petición: obligaría a una consulta extra por request, y el JWT no lleva el id del refresh token. Habría que agregar un claim `sid` y buscar la sesión siempre. La precisión de 5 min es suficiente para el riesgo descrito (PC compartida).
- **Impacto en SignalR:** una conexión WebSocket ya establecida no se corta al vencer el JWT, porque `CloseOnAuthenticationExpiration` sigue en `false`. La reconexión usa `accessTokenFactory`, que ahora es asíncrono: si el token en memoria está vencido (`exp` del JWT), primero llama a `refreshToken()`. Al cerrar la sesión, `useNotificationsHub` detiene la conexión, porque su efecto depende de `isAuthenticated`.

### D6 — Campos de sesión en `RefreshToken`
- Columnas nuevas no nulas: `SesionIniciadaEn` y `UltimaActividadEn`. La migración rellena las filas existentes con `created_at` (`defaultValueSql` temporal en la migración).
- **Login:** ambos campos toman el momento actual.
- **Refresh:** el token nuevo hereda los dos campos del anterior.
- **Switch-empresa:** no rota el token ni toca estos campos, así que no reinicia `SesionIniciadaEn`. La política aplicable pasa a ser la de la empresa nueva, porque se resuelve con `EmpresaActivaId` del token en cada comprobación.

El orden de las comprobaciones es: sesión máxima primero, inactividad después. Si las dos vencieron, se informa la sesión máxima, que es la causa estructural.

### D7 — Código de error en 401
- `UnauthorizedBusinessException` gana un parámetro opcional `ErrorCode`.
- `ApiExceptionHandler` lo propaga a `ApiResponse.ErrorCode`, el mismo campo que ya usa `PIN_NO_CONFIGURADO`.
- Mensajes:
  - `SESION_INACTIVA`: "Tu sesión se cerró por inactividad";
  - `SESION_MAXIMA_ALCANZADA`: "Tu sesión alcanzó la duración máxima".
- La revocación del token se guarda **antes** de lanzar la excepción, porque el handler de excepciones no hace `SaveChanges`.

### D8 — Auditoría
- **Cierre por política:** `ILogger<RefreshHandler>`/`ILogger<RegistrarActividadHandler>` con `LogInformation("Sesión cerrada por {Motivo}: usuario {UsuarioId}, empresa {EmpresaId}, iniciada {SesionIniciadaEn}, última actividad {UltimaActividadEn}")`. No existe ningún log de seguridad o de autenticación persistente; crearlo queda fuera de alcance.
- **Cambios de configuración:** tabla `ConfiguracionSesionAuditTrail` (D1).

### D9 — Endpoints y forma de las respuestas

| Endpoint | Auth | Respuesta |
|---|---|---|
| `GET /api/auth/politica-sesion` | Bearer (cualquier rol) + cookie opcional | `{ inactividadMinutos, sesionMaximaHoras, sesionIniciadaEn?, ultimaActividadEn? }` |
| `POST /api/auth/actividad` | Cookie (AllowAnonymous, igual que refresh/logout) | lo mismo, o 401 con código |
| `GET/PUT /api/empresas/{id}/seguridad-sesion` | ADMINISTRADOR_EMPRESA (solo `id == empresaActivaId`, otra → 404) o SUPERADMIN (cualquier empresa existente, si no existe → 404). Otros roles → 403 | `SeguridadSesionEmpresaDto` |
| `GET/PUT /api/sistema/parametros-sesion` | SUPERADMIN | `ParametrosSesionDto` |

- `SeguridadSesionEmpresaDto`: `{ empresaId, inactividadMinutos: number|null, sesionMaximaHoras: number|null, efectiva: { inactividadMinutos, sesionMaximaHoras }, parametrosGlobales: ParametrosSesionDto, actualizadoPorId?, actualizadoPorNombre?, actualizadoEn? }`.
- El cuerpo del PUT de empresa es `{ inactividadMinutos: number|null, sesionMaximaHoras: number|null }`. `null` significa "Usar valor por defecto del sistema".
- `ParametrosSesionDto`: `{ inactividadDefaultMinutos, inactividadMinMinutos, inactividadMaxMinutos, sesionMaximaDefaultHoras, sesionMaximaMinHoras, sesionMaximaMaxHoras, actualizadoPorId?, actualizadoPorNombre?, actualizadoEn? }`.
- Los límites que necesita el formulario de empresa viajan dentro del GET de empresa (`parametrosGlobales`). Así el ADMINISTRADOR_EMPRESA no necesita acceso a `/api/sistema`, y el frontend no duplica constantes.

### D10 — Detector de inactividad en el cliente
- **Componente:** `SessionTimeoutManager` (`features/sesion/components/`). Se monta en `AppShell` y en `MobileShell`. Son hermanos en el router, así que nunca hay dos instancias a la vez.
- **Fuente de la política:** `usePoliticaSesion()` (TanStack Query, key `['sesion','politica', empresaActivaId]`), que se recarga al cambiar de empresa.
- **Última actividad:** vive en `lib/sessionActivity.ts`.
  - Se guarda en `localStorage` con la clave `shac_last_activity` y se difunde por `BroadcastChannel('shac-session')`, con el evento `storage` como respaldo.
  - El mismo canal difunde `logout` con su motivo, para que al cerrar sesión en una pestaña se cierren todas.
- **Eventos escuchados:** `mousemove`, `keydown`, `click`, `scroll` (capture), `touchstart` y `visibilitychange` (solo al pasar a visible, y después de evaluar primero el vencimiento: una pestaña que vuelve a primer plano ya vencida no se "revive").
  - Las marcas locales tienen *throttle* de 5 s.
  - Las peticiones de red nunca marcan actividad, de modo que el polling y SignalR quedan excluidos por construcción.
- **Reporte al servidor:** `POST /api/auth/actividad` como máximo 1 vez cada 60 s, con envío *trailing*: si hubo actividad dentro de la ventana, se manda al cerrarse. El servidor registra la hora en que recibe el reporte, que es ≥ que la actividad real, así que el servidor nunca vence antes que el cliente.
- **Tick cada 1 s** contra timestamps, con lo que el *throttling* de pestañas en segundo plano no importa:
  - `restante = ultimaActividad + inactividad − ahora`;
  - `restanteMax = sesionIniciadaEn + sesionMaxima − ahora` (si el servidor envió `sesionIniciadaEn`).
- **Comportamiento:**
  - con `restante ≤ 60 s`, muestra el modal; mientras está abierto, la actividad pasiva (mousemove/scroll) **no** lo cierra: solo "Seguir conectado" o la actividad en otra pestaña;
  - con `restante ≤ 0`, llama a `endSession('INACTIVIDAD')`;
  - con `restanteMax ≤ 0`, llama a `endSession('SESION_MAXIMA')`.
- **"Seguir conectado":** marca la actividad, hace `POST /actividad` inmediato (sin *throttle*) y luego `refreshToken()`.

### D11 — `endSession(reason)` único (`lib/sessionEnd.ts`)
Todo cierre de sesión pasa por aquí, sea del detector, del interceptor, del botón de logout, de otra pestaña o del bootstrap:
1. Hace `POST /api/auth/logout` en modo *best-effort*, salvo que el cierre venga de otra pestaña (esa ya lo hizo).
2. `authStore.logout(reason)`, que guarda `sessionEndReason`.
3. `queryClient.clear()`.
4. Difunde a las otras pestañas.

SignalR se desconecta solo, porque su efecto depende de `isAuthenticated`. `RoleGuard` redirige a `/login` con `state.from = location`, y `useLogin` ya navega a `from` después del login: el retorno a la ruta original reutiliza el mecanismo existente. `LoginPage` muestra un aviso (`role="status"`) según `sessionEndReason` (`INACTIVIDAD` | `SESION_MAXIMA`), y `login()` lo limpia.

### D12 — Interceptor y refresh *single-flight*
- **401 con código de política:** si cualquier respuesta 401 trae `errorCode` ∈ {`SESION_INACTIVA`, `SESION_MAXIMA_ALCANZADA`}, sea de `/refresh`, de `/actividad` o de otra petición, el interceptor llama a `endSession` con el motivo correspondiente y **no** reintenta.
- **Refresh fallido sin código:** mantiene el comportamiento actual (logout sin motivo).
- **`authStore.refreshToken()`:** comparte una única promesa en vuelo dentro de la pestaña. Entre pestañas, se serializa con `navigator.locks.request('shac-auth-refresh')` cuando está disponible.
  - **Por qué hace falta ahora:** con access tokens de 5 min, dos 401 concurrentes son frecuentes. El segundo `/refresh` llegaría con la cookie ya revocada por el primero y cerraría la sesión por error.
  - Entre pestañas, la cookie es compartida: con la serialización, la segunda pestaña rota ya con la cookie nueva.

### D13 — Aislamiento de la cola offline por usuario
- `QueuedIncident` gana el campo opcional `usuarioId?` (no se sube `DB_VERSION`, porque no cambian índices).
- `enqueue()` lo guarda.
- `listPending(usuarioId)` y `listVisible(usuarioId)` filtran por `entry.usuarioId === usuarioId || entry.usuarioId === undefined`. Las entradas *legacy* sin `usuarioId` conservan el comportamiento anterior: las sincroniza quien esté logueado, como hoy.
- El logout **no** llama a `clearAll()`. Esto queda verificado con un test.

### D14 — UI de configuración
- `SeguridadSesionForm` (reutilizable, `empresaId` como prop):
  - dos campos numéricos, cada uno con su casilla "Usar valor por defecto del sistema";
  - debajo de cada campo, texto de ayuda con el rango y el valor global;
  - pie con "Último cambio: {nombre}, {fecha}" (`Intl.DateTimeFormat`).
  - Schema Zod construido con `buildSeguridadSesionSchema(parametrosGlobales)`.
- Dónde aparece:
  - **ADMINISTRADOR_EMPRESA:** sección "Seguridad de sesión" en `UsersListPage` (`/usuarios`, donde ya gestiona su empresa y sus usuarios), con su propio `ErrorBoundary`;
  - **SUPERADMIN, por empresa:** botón con el ícono `ShieldCheck` en cada fila de `EmpresaList`, que abre `SeguridadSesionEmpresaModal` con el mismo formulario;
  - **SUPERADMIN, valores globales:** página `ParametrosSesionPage` en `/admin/parametros-sesion` (ruta y entrada de Sidebar solo para SUPERADMIN, `ROUTE_ROLE_GROUPS.parametrosSesion`).

### D15 — MSW
- `mocks/fixtures/sesion.fixtures.ts`: almacenes mutables con los parámetros globales (semilla D1), la configuración por empresa, el audit trail y las sesiones mock por refresh token.
  - Cada sesión mock guarda `{ userId, sesionIniciadaEn, ultimaActividadEn }`. El *mock refresh token* sigue rotando; el handler de refresh copia la entrada al token nuevo.
- `mocks/handlers/sesion.handlers.ts`: los 4 endpoints nuevos (6 métodos), con el mismo resolver y validador puros del frontend.
- `auth.handlers.ts`: login crea la sesión mock; refresh aplica las comprobaciones y responde 401 con `errorCode`.
- La vigencia del access token mock no cambia: el mock no valida la expiración de JWT, y el cierre por política se prueba vía refresh y actividad.

## Risks / Trade-offs

- **[Riesgo]** El access token de 5 min multiplica las llamadas a `/refresh` (~12/h por pestaña activa). → **Mitigación:** son baratas, y la rotación es *single-flight* y está serializada entre pestañas (D12).
- **[Riesgo]** Una conexión SignalR abierta sigue recibiendo push hasta 5 min después del cierre en el servidor. → **Mitigación:** el cliente la corta al cerrar sesión, y el push solo lleva notificaciones del propio usuario.
- **[Riesgo]** El reloj del cliente está desfasado del servidor. → **Mitigación:** el cliente usa su propio reloj para la inactividad local. El servidor decide con el suyo, y como gana el más estricto, un desfase solo adelanta o atrasa el aviso.
- **[Riesgo]** Navegadores sin `BroadcastChannel` o sin `navigator.locks`. → **Mitigación:** el evento `storage` cubre la difusión, y sin locks queda solo el *single-flight* dentro de la pestaña (degradación aceptable).
- **[Trade-off]** El cierre por política queda en ILogger y no en una tabla consultable. Es aceptable hasta que exista un módulo de auditoría de seguridad.
- **[Trade-off]** Las entradas *legacy* de la cola offline sin `usuarioId` no quedan aisladas.

## Migration Plan

1. Migración `AddPoliticaSesion`:
   - tablas `parametros_sesion` (con la fila semilla), `configuraciones_seguridad_empresa` y `configuracion_sesion_audit_trail` (nombres derivados de los DbSet por `UseSnakeCaseNaming`; el DbSet de la fila única se llama `ParametrosSesion` para no colisionar con el nombre del tipo dentro de `ShacDbContext`);
   - columnas `sesion_iniciada_en` y `ultima_actividad_en` en `refresh_tokens`, rellenadas con `created_at`.
2. Detener el backend, ejecutar `dotnet ef database update` y luego `dotnet build`.
3. Cambiar `AccessTokenExpirationMinutes` a 5 en `appsettings.Development.json` local. Es un archivo no versionado: va en las instrucciones de la prueba manual. El `.example` sí se actualiza.
4. **Rollback:** revertir la migración (`dotnet ef database update <anterior>`) y volver `AccessTokenExpirationMinutes` a 60. El frontend tolera la ausencia de `/api/auth/politica-sesion`: sin política, el detector no arma temporizadores.

## Open Questions

- Ninguna bloqueante. A futuro: ¿aviso previo también antes de la sesión máxima (p. ej. 5 min antes)? Hoy solo se pide para la inactividad.
