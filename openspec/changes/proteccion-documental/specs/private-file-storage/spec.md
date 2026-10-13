## ADDED Requirements

### Requirement: Raíz de almacenamiento privada fuera de wwwroot
El sistema SHALL guardar todo archivo subido por un usuario (documentos originales y de distribución, planos de Locales, evidencias e informe médico de Incidentes) bajo una raíz de almacenamiento configurable (`FileStorage:RootPath`), resuelta contra `IWebHostEnvironment.ContentRootPath`, nunca `WebRootPath`. Los campos que persisten la ubicación del archivo (`Documento.ArchivoOriginalUrl`, `Documento.ArchivoDistribucionUrl`, `Local.PlanoPngUrl`, `IncidenteEvidencia.Url`, `Incidente.InformeMedicoAdjunto`) SHALL guardar una clave relativa a esa raíz, nunca una URL servible directamente por el navegador.

#### Scenario: Un documento nuevo se guarda fuera de wwwroot
- **WHEN** se sube el archivo original de un documento nuevo
- **THEN** el archivo físico queda bajo `FileStorage:RootPath`, fuera de cualquier carpeta `wwwroot`, y `ArchivoOriginalUrl` guarda una clave relativa sin el prefijo `/uploads/`

#### Scenario: Un plano nuevo se guarda fuera de wwwroot
- **WHEN** se sube el plano de un Local nuevo
- **THEN** el archivo físico queda bajo `FileStorage:RootPath`, y `PlanoPngUrl` guarda una clave relativa

#### Scenario: Una evidencia de incidente nueva se guarda fuera de wwwroot
- **WHEN** se sube una evidencia vía `POST /api/incidents/evidencias`
- **THEN** el archivo físico queda bajo `FileStorage:RootPath`, y la `Url` devuelta es una clave relativa, no una ruta pública

### Requirement: Acceso estático a archivos de usuario cerrado
El sistema SHALL NOT exponer ningún archivo de usuario (documentos, planos, evidencias) a través de una ruta estática sin autenticación. `GET /uploads/{cualquier-ruta}` SHALL responder `404`.

#### Scenario: Ruta estática antigua responde 404
- **WHEN** se solicita `GET /uploads/documentos/{empresaId}/{documentoId}/original/{archivo}` sin ningún token de autenticación
- **THEN** el sistema responde `404`

#### Scenario: Ninguna ruta bajo /uploads queda accesible
- **WHEN** se solicita cualquier ruta bajo `/uploads/` (planos, incidentes, documentos)
- **THEN** el sistema responde `404` en todos los casos

### Requirement: Migración idempotente de archivos existentes
Al iniciar la aplicación en el entorno `Development`, el sistema SHALL ejecutar una rutina que, para cada fila con un campo de archivo cuyo valor todavía tenga el formato antiguo (prefijo `/uploads/`):
1. Si el archivo físico existe bajo la ubicación antigua (`wwwroot/{valor}`), lo copia a la ubicación privada equivalente, verifica que el tamaño coincide, actualiza la fila con la nueva clave relativa, y solo entonces borra el archivo de la ubicación antigua.
2. Si el archivo físico no existe bajo la ubicación antigua (ya migrado en una corrida anterior, o referencia huérfana), SHALL NOT modificar la fila — la rutina SHALL ser idempotente: ejecutarla una segunda vez sobre datos ya migrados no debe fallar ni duplicar nada.
3. SHALL registrar en el log, a nivel `Information`, cuántos archivos migró por dominio (Documentos, Locales, Incidentes).

#### Scenario: Primera ejecución migra archivos existentes
- **WHEN** la aplicación arranca por primera vez tras este change, con archivos existentes bajo `wwwroot/uploads/`
- **THEN** cada archivo se copia a la raíz privada, las filas correspondientes quedan con la clave nueva, y el archivo antiguo se borra solo después de verificar la copia

#### Scenario: Segunda ejecución no duplica ni rompe nada
- **WHEN** la aplicación arranca una segunda vez después de una migración ya completada
- **THEN** la rutina no encuentra archivos en formato antiguo para mover, y no produce ningún error ni cambio

#### Scenario: Archivo huérfano no rompe la migración
- **WHEN** una fila referencia un archivo que ya no existe físicamente bajo la ubicación antigua
- **THEN** la rutina deja esa fila sin modificar y continúa con las demás, sin lanzar una excepción que detenga el arranque

### Requirement: Endpoint autenticado para el plano de un Local
El sistema SHALL exponer `GET /api/locales/{id}/plano`, protegido por `.RequireAuthorization()`, que SHALL validar que el `Local` pertenece a la empresa activa del actor (`404` si no) y responder los bytes del plano (`image/png`) leídos desde la raíz privada. Cualquier rol autenticado de la empresa SHALL poder acceder — no hay gate de rol adicional.

#### Scenario: Usuario autenticado de la empresa obtiene el plano
- **WHEN** un usuario autenticado solicita `GET /api/locales/{id}/plano` de un Local de su empresa activa con plano cargado
- **THEN** el sistema responde `200` con `Content-Type: image/png`

#### Scenario: Local de otra empresa responde 404
- **WHEN** un usuario solicita el plano de un Local que pertenece a otra empresa
- **THEN** el sistema responde `404`

#### Scenario: Local sin plano responde 404
- **WHEN** se solicita el plano de un Local cuyo `PlanoPngUrl` es `null`
- **THEN** el sistema responde `404`

### Requirement: Endpoint autenticado para evidencias de Incidentes
El sistema SHALL exponer `GET /api/incidents/{incidenteId}/evidencias/{evidenciaId}/archivo`, protegido por `.RequireAuthorization()`, validando que el `Incidente` pertenece a la empresa activa del actor (`404` si no). Cualquier rol autenticado de la empresa SHALL poder acceder, consistente con el resto del detalle del incidente (sin gate de confidencialidad, a diferencia de Documentos).

**Nota (confirmado durante la implementación):** `Incidente.InformeMedicoAdjunto` no existe en el backend real (campo frontend-only, nunca implementado, código muerto en producción) — no se crea ningún endpoint `GET /api/incidents/{id}/informe-medico` ni se migra nada para ese campo, porque no hay ningún dato real que exponer ni migrar.

#### Scenario: Usuario autenticado obtiene una evidencia
- **WHEN** un usuario autenticado de la empresa solicita `GET /api/incidents/{incidenteId}/evidencias/{evidenciaId}/archivo` de una evidencia existente
- **THEN** el sistema responde `200` con el contenido del archivo y el `Content-Type` correspondiente a su tipo

#### Scenario: Evidencia de un incidente de otra empresa responde 404
- **WHEN** se solicita una evidencia de un incidente que pertenece a otra empresa
- **THEN** el sistema responde `404`
