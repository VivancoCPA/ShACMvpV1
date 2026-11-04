# Instrucciones para Claude Code — Cierre de sesión por inactividad y duración máxima de sesión, configurables por empresa

Fecha: 2026-10-19
Autor: Cowork (diagnóstico leyendo el código real)
Origen: Toño. No está definido el cierre de sesión tras un periodo de inactividad, y ese periodo debe configurarlo un administrador.
Change sugerido: `sesion-timeout-inactividad` (backend + frontend + migración)

Ciclo: `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

---

## Diagnóstico (confirmado leyendo el código)

- **Backend:**
  - `appsettings`: `Jwt:AccessTokenExpirationMinutes = 60` y `Jwt:RefreshTokenExpirationDays = 7`.
  - `RefreshHandler` **rota** el refresh token en cada `/api/auth/refresh` y crea uno nuevo con 7 días más. La sesión se extiende indefinidamente mientras haya un refresh cada menos de 7 días.
  - `RefreshToken` tiene `CreatedAt`, `ExpiresAt` y `RevokedAt`. No guarda la última actividad ni el inicio de la sesión original, porque cada rotación crea una entidad nueva con `CreatedAt` nuevo.
- **Frontend:**
  - `lib/axios.ts` hace un refresh automático ante cualquier 401.
  - No existe ninguna detección de inactividad.
  - Las notificaciones hacen polling cada 60 s, y SignalR mantiene la conexión. Con la app abierta en una pestaña, **la sesión no expira nunca**, aunque nadie la use.
- `Empresa` no tiene ninguna configuración de seguridad (solo `RazonSocial`, `Ruc`, `Estado`, `LogoUrl` y `FechaAlta`).

Riesgo: en una PC compartida de almacén o de garita, cualquiera puede operar con la sesión de otro usuario, incluida la firma de documentos (el PIN mitiga, pero no cubre la lectura de documentos CONFIDENCIALES).

## Decisiones de Toño (2026-10-19)

- **D1 — ✅ Configuración por empresa.**
  - El **ADMINISTRADOR_EMPRESA** define los valores de **su** empresa.
  - El **SUPERADMIN** define el **valor por defecto global** y los **límites mínimo y máximo** permitidos. También puede editar la configuración de cualquier empresa.
  - Una empresa sin configuración propia usa el valor global.
  - El SUPERADMIN, que no tiene empresa activa, usa el valor global.
- **D2 — ✅ Inactividad: 30 minutos por defecto, configurable entre 5 y 240.** El aviso aparece **60 segundos antes**, con el botón **"Seguir conectado"**.
- **D3 — ✅ Duración máxima absoluta de la sesión: 12 horas por defecto**, configurable por el mismo administrador. Al cumplirse, hay que volver a iniciar sesión aunque el usuario esté activo.
  - Propuesta de rango (confírmalo en `design.md` si encuentras una razón para otro): de 1 a 24 horas.
  - La duración máxima nunca puede ser menor que el tiempo de inactividad.

---

## Qué implementar

### 1. Modelo y configuración (backend, migración)
- Crea una entidad `ConfiguracionSeguridadEmpresa` (o columnas en `Empresa`; documenta la elección):
  - `EmpresaId`;
  - `InactividadMinutos` (nullable = usa el global);
  - `SesionMaximaHoras` (nullable = usa el global);
  - `ActualizadoPorId` y `ActualizadoEn`.
- **Valor global y límites:** guárdalos en una tabla de configuración del sistema editable por el SUPERADMIN, **no** en `appsettings`, para poder cambiarlos sin desplegar.
  - Valores semilla: inactividad 30 (mínimo 5, máximo 240); sesión máxima 12 (mínimo 1, máximo 24).
  - Si ya existe una tabla de parámetros globales, reutilízala.
- **Resolución en un solo lugar**, por ejemplo `PoliticaSesionResolver.ObtenerAsync(empresaId?)`:
  - devuelve `{ inactividadMinutos, sesionMaximaHoras }` efectivos;
  - si el valor de la empresa no existe, usa el global;
  - si el valor de la empresa quedó fuera de los límites porque el SUPERADMIN los cambió después, lo ajusta al límite más cercano.
- **Validación al guardar:**
  - cada valor dentro de los límites globales;
  - la sesión máxima, convertida a minutos, debe ser mayor o igual que la inactividad;
  - si no se cumple, responde 400 con un error por campo.

### 2. Aplicación en el servidor (la protección real)
El temporizador del navegador solo es comodidad; el servidor debe hacer cumplir la política.

1. **Inicio de la sesión original:** agrega a `RefreshToken` los campos `SesionIniciadaEn` y `UltimaActividadEn`.
   - En el login: los dos campos toman el momento actual.
   - En cada rotación (`/refresh`): el token nuevo **hereda** `SesionIniciadaEn` del anterior. Así la sesión máxima no se reinicia al rotar.
2. **En `/api/auth/refresh`**, antes de emitir tokens, con la política de la empresa activa del token:
   - si `ahora - SesionIniciadaEn > sesionMaximaHoras`, revoca el token y responde 401 con el código `SESION_MAXIMA_ALCANZADA`;
   - si `ahora - UltimaActividadEn > inactividadMinutos`, revoca el token y responde 401 con el código `SESION_INACTIVA`;
   - si pasa las dos comprobaciones, actualiza `UltimaActividadEn` **solo** si el cliente declaró actividad reciente (punto 3).
3. **Qué cuenta como actividad:** las peticiones automáticas (polling de notificaciones, contador de pendientes, SignalR) **no** cuentan; si contaran, la sesión nunca expiraría.
   - Recomendación: un endpoint liviano `POST /api/auth/actividad`, que el frontend llama como máximo una vez por minuto mientras haya interacción real del usuario. Ese endpoint actualiza `UltimaActividadEn` del refresh token vigente, identificado por la cookie.
   - Alternativa equivalente: un encabezado `X-User-Activity` en las peticiones iniciadas por el usuario. Elige una y documéntala.
4. **Vigencia del access token:** baja su duración a **un valor menor o igual que la inactividad mínima posible (5 min)**, por ejemplo 5 minutos, para que una sesión expirada en el servidor no siga operando hasta 60 minutos con un JWT válido.
   - Antes, verifica el impacto en SignalR: el hub debe renovar o volver a autenticar la conexión con el token nuevo (`accessTokenFactory`).
   - Si prefieres validar la política en un middleware en cada petición, en lugar de acortar el JWT, justifícalo en `design.md`.
5. **Cambio de empresa** (`/switch-empresa`): la política aplicable pasa a ser la de la empresa nueva. No reinicia `SesionIniciadaEn`.
6. **Auditoría:**
   - registra el cierre por inactividad o por sesión máxima en el log de seguridad o de autenticación, si existe;
   - registra **también** cada cambio de la configuración: quién, cuándo, valor anterior y valor nuevo.

### 3. Frontend
1. **Detector de inactividad**, montado una sola vez en el layout autenticado:
   - escucha `mousemove`, `keydown`, `click`, `scroll`, `touchstart` y `visibilitychange`, con throttle;
   - **ignora** el polling y las respuestas de SignalR;
   - con actividad real, avisa al servidor según la opción elegida en 2.3, como máximo una vez por minuto.
2. **Aviso 60 segundos antes** del vencimiento:
   - un modal con cuenta regresiva: "Tu sesión se cerrará por inactividad en N s";
   - botones **"Seguir conectado"** (registra la actividad y refresca) y **"Cerrar sesión"**.
   - Si la cuenta llega a 0, se cierra la sesión.
3. **Varias pestañas:** sincroniza la última actividad entre pestañas, por ejemplo con `BroadcastChannel` o el evento `storage`. Así una pestaña abierta en segundo plano no cierra la sesión mientras el usuario trabaja en otra, y al cerrar sesión en una se cierran todas.
4. **Cierre de sesión:**
   - llama a `/api/auth/logout`, limpia el `authStore` y la caché de TanStack Query, y desconecta SignalR;
   - redirige al login con un mensaje según el motivo: "Tu sesión se cerró por inactividad" o "Tu sesión alcanzó la duración máxima; vuelve a iniciar sesión";
   - después del login, vuelve a la ruta donde estaba el usuario.
5. **No se pierde trabajo:** la cola offline de incidentes (`lib/offlineQueue.ts`, IndexedDB) **no** se borra al cerrar la sesión. Se sincroniza cuando el mismo usuario vuelva a entrar. Confirma en el código que el logout no la limpia, y si guarda datos de otro usuario, documenta cómo se aíslan.
6. **401 con `SESION_INACTIVA` o `SESION_MAXIMA_ALCANZADA`:** el interceptor de `lib/axios.ts` **no** debe reintentar el refresh. Debe cerrar la sesión con el mensaje correspondiente.
7. **Pantalla de configuración "Seguridad de sesión":**
   - **ADMINISTRADOR_EMPRESA**: una sección dentro de la administración de su empresa (ubícala donde ya gestiona su empresa y sus usuarios) con dos campos, "Cierre por inactividad (minutos)" y "Duración máxima de sesión (horas)". Debajo de cada campo muestra el rango permitido y el valor global, y agrega la opción "Usar valor por defecto del sistema".
   - **SUPERADMIN**: una pantalla de "Parámetros globales" con los valores por defecto y los límites. En la administración de empresas, también puede editar los valores de cada empresa.
   - Usa RHF + Zod con los mismos límites que el servidor, que se obtienen de un endpoint para no duplicarlos.
   - Muestra quién hizo el último cambio y cuándo.
8. i18n (es-PE / en-US) para todos los textos nuevos. MSW con los mismos contratos y reglas.

### 4. Endpoints sugeridos
| Endpoint | Quién | Qué hace |
|---|---|---|
| `GET /api/auth/politica-sesion` | Cualquier usuario autenticado | Devuelve la política efectiva de su sesión `{ inactividadMinutos, sesionMaximaHoras, sesionIniciadaEn }` para el temporizador del cliente |
| `POST /api/auth/actividad` | Cualquier usuario autenticado | Registra actividad real (si se elige esta opción en 2.3) |
| `GET/PUT /api/empresas/{id}/seguridad-sesion` | ADMINISTRADOR_EMPRESA (solo su empresa; otra empresa → 404) y SUPERADMIN | Lee y actualiza la configuración de la empresa |
| `GET/PUT /api/sistema/parametros-sesion` | SUPERADMIN | Lee y actualiza el valor global y los límites |

---

## Tests
- **Backend:**
  - la política efectiva usa el valor de la empresa y, si no existe, el global;
  - un valor fuera de rango → 400; sesión máxima menor que la inactividad → 400;
  - un ADMINISTRADOR_EMPRESA que edita otra empresa → 404; un OPERARIO que edita → 403;
  - `/refresh` con `UltimaActividadEn` vencida → 401 `SESION_INACTIVA` y el token queda revocado;
  - `/refresh` con `SesionIniciadaEn` mayor a la sesión máxima → 401 `SESION_MAXIMA_ALCANZADA`, aunque haya actividad reciente;
  - la rotación conserva `SesionIniciadaEn`;
  - el polling de notificaciones no actualiza `UltimaActividadEn`;
  - el cambio de configuración queda auditado con los valores anterior y nuevo.
- **Frontend** (con fake timers):
  - el aviso aparece 60 s antes y "Seguir conectado" reinicia el contador;
  - sin interacción, se cierra la sesión y se muestra el mensaje de inactividad;
  - con actividad en otra pestaña, no se cierra la sesión;
  - un 401 `SESION_MAXIMA_ALCANZADA` cierra la sesión sin reintentar el refresh;
  - la cola offline sobrevive al cierre de sesión;
  - el formulario de configuración valida los rangos.

## Reglas de siempre
- El código real manda sobre este doc; cualquier divergencia va en `design.md`.
- Un contrato nuevo se refleja a la vez en backend, MSW, tipos TS y tests.
- Corre la suite completa del frontend, los tests del backend y `tsc`.
- **Detén el backend, ejecuta `dotnet ef database update` y luego `dotnet build`** antes de la prueba manual.
- Prueba manual con MSW apagado:
  1. Como ADMINISTRADOR_EMPRESA, configura 5 minutos de inactividad.
  2. Entra como operario y no toques nada: a los 4 minutos aparece el aviso, y a los 5 se cierra la sesión con el mensaje.
  3. Repite, pero pulsa "Seguir conectado": la sesión continúa.
  4. Con dos pestañas abiertas, trabaja en una: la otra no cierra la sesión.
  5. Como SUPERADMIN, baja la sesión máxima global a 1 hora y verifica que, pasada la hora, hay que volver a iniciar sesión aunque haya actividad.
  6. Registra un incidente offline, deja que la sesión expire, vuelve a entrar y confirma que se sincroniza.
- Al terminar, Toño avisa con "listo". Cowork verifica releyendo el código real y agrega las reglas al PRD (módulo M6 o reglas globales).
