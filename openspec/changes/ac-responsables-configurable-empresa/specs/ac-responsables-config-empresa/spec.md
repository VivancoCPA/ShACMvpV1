## ADDED Requirements

### Requirement: Configuración por empresa de roles responsables por tipo de AC
El sistema SHALL persistir, por empresa y por `AccionCorrectivaTipo`, la lista de roles que pueden ser responsables (tabla `config_responsables_ac_empresa`, PK `(empresa_id, tipo)`, `roles text[]`, `actualizado_en`, `actualizado_por_id`, `actualizado_por_nombre`). Una empresa sin fila para un tipo SHALL usar los valores por defecto (`ResponsablesAcDefaults`, la tabla de `ac-tipo-responsables`). La migración `AddConfiguracionResponsablesAc` MUST NOT insertar datos semilla.

#### Scenario: Empresa sin configuración
- **WHEN** una empresa no tiene filas en `config_responsables_ac_empresa`
- **THEN** los roles permitidos de cada tipo son los defaults de `ac-tipo-responsables`

#### Scenario: Aislamiento entre empresas
- **WHEN** la empresa A configura `MEJORA = [JEFE_CALIDAD_SYST]` y la empresa B no tiene configuración
- **THEN** en la empresa B los roles de `MEJORA` siguen siendo JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO y ALTA_DIRECCION

### Requirement: GET de la configuración de responsables de AC
El backend SHALL exponer `GET /api/empresas/{id}/responsables-ac`, que devuelve `{ empresaId, tipos: [{ tipo, roles, esDefault }], rolesDisponibles, actualizadoPorNombre?, actualizadoEn? }` con los 3 tipos en orden CORRECTIVA, PREVENTIVA, MEJORA. `esDefault` MUST ser `true` cuando la empresa no tiene fila para ese tipo. `rolesDisponibles` SHALL ser los 6 roles operativos (OPERARIO, SUPERVISOR, JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, AUDITOR_INTERNO, ALTA_DIRECCION).

#### Scenario: Lectura sin configuración
- **WHEN** un ADMINISTRADOR_EMPRESA consulta su empresa sin configuración
- **THEN** la respuesta es 200 con los 3 tipos con `esDefault: true` y los roles por defecto

### Requirement: PUT de la configuración de responsables de AC
El backend SHALL exponer `PUT /api/empresas/{id}/responsables-ac` con body `{ tipos: [{ tipo, roles }] }`. MUST validar que estén los 3 tipos sin repetir, que cada tipo tenga al menos un rol y que todos los roles sean operativos; cualquier rol de administración (ADMINISTRADOR_EMPRESA, ADMINISTRADOR_SISTEMA, SUPERADMIN) o desconocido MUST rechazarse. Los errores SHALL responder 400 como errores de validación de campo (`tipos` o `tipos[i].roles`). Si es válido, SHALL hacer upsert de las 3 filas y devolver la configuración actualizada.

#### Scenario: Tipo sin roles
- **WHEN** el body trae `PREVENTIVA` con `roles: []`
- **THEN** la respuesta es 400 con error en `tipos[1].roles` y no se guarda nada

#### Scenario: Rol de administración
- **WHEN** el body incluye `ADMINISTRADOR_EMPRESA` en algún tipo
- **THEN** la respuesta es 400

#### Scenario: Falta un tipo
- **WHEN** el body solo trae `CORRECTIVA` y `PREVENTIVA`
- **THEN** la respuesta es 400 con error en `tipos`

#### Scenario: Guardado válido
- **WHEN** el body trae los 3 tipos válidos con `MEJORA = [JEFE_CALIDAD_SYST]`
- **THEN** la respuesta es 200 y `MEJORA` queda con `esDefault: false` y `roles: [JEFE_CALIDAD_SYST]`

### Requirement: Restablecer la configuración de responsables de AC
El backend SHALL exponer `POST /api/empresas/{id}/responsables-ac/restablecer`, que borra las filas de la empresa y devuelve la configuración con los 3 tipos en `esDefault: true`.

#### Scenario: Restablecer
- **WHEN** una empresa con `MEJORA` configurado llama a restablecer
- **THEN** la respuesta es 200, los 3 tipos tienen `esDefault: true` y `MEJORA` vuelve a los roles por defecto

### Requirement: Permisos y alcance de la configuración de responsables de AC
Los tres endpoints SHALL requerir rol ADMINISTRADOR_EMPRESA o SUPERADMIN (cualquier otro rol → 403). El ADMINISTRADOR_EMPRESA MUST operar solo sobre la empresa activa de su sesión; cualquier otra empresa MUST responder 404. El SUPERADMIN SHALL poder operar sobre cualquier empresa; una empresa inexistente MUST responder 404.

#### Scenario: ADMIN_EMPRESA sobre otra empresa
- **WHEN** un ADMINISTRADOR_EMPRESA llama `GET /api/empresas/{otra}/responsables-ac`
- **THEN** la respuesta es 404

#### Scenario: SUPERADMIN sobre cualquier empresa
- **WHEN** un SUPERADMIN llama `PUT` sobre cualquier empresa existente con un body válido
- **THEN** la respuesta es 200

#### Scenario: Rol operativo
- **WHEN** un JEFE_CALIDAD_SYST llama `GET /api/empresas/{suya}/responsables-ac`
- **THEN** la respuesta es 403

### Requirement: Auditoría de cambios de la configuración de responsables de AC
Cada `PUT` o restablecer SHALL registrar una entrada append-only por cada tipo cuyo valor efectivo cambió, con empresa, campo `responsablesAc.{TIPO}`, valor anterior y nuevo (roles separados por coma; el anterior es el default si no había fila), quién y cuándo. Una operación sin cambios MUST NOT registrar nada.

#### Scenario: Cambio de un tipo
- **WHEN** se guarda la configuración cambiando solo `MEJORA`
- **THEN** se registra exactamente una entrada de auditoría, para `responsablesAc.MEJORA`

#### Scenario: PUT sin cambios
- **WHEN** se guarda la misma configuración vigente
- **THEN** no se registra ninguna entrada

### Requirement: Sección de responsables de AC en Usuarios y modal en Administración de Empresas
El frontend SHALL mostrar `ResponsablesAcSection` en `/usuarios`, debajo de "Seguridad de sesión", solo al ADMINISTRADOR_EMPRESA con empresa activa, y SHALL ofrecer al SUPERADMIN la acción "Responsables de AC" por empresa en Administración de Empresas, que abre un modal con el mismo formulario para esa empresa. El formulario SHALL ser una matriz de 3 filas (tipos, con etiqueta `acTipo.*`) × 6 columnas de casillas (roles operativos, con su etiqueta i18n), con badge "Por defecto" en las filas con `esDefault`. Una fila sin casillas marcadas SHALL marcarse en error ("Selecciona al menos un rol.") y deshabilitar Guardar. SHALL ofrecer "Restablecer valores por defecto" con confirmación en la UI (nunca `confirm()`), y mostrar la nota fija "Los cambios aplican a las nuevas asignaciones. Las acciones correctivas existentes conservan a su responsable.". Al guardar o restablecer SHALL mostrar el toast "Configuración guardada." e invalidar `['acciones-correctivas', 'candidatos']`.

#### Scenario: Matriz por defecto
- **WHEN** el ADMINISTRADOR_EMPRESA abre `/usuarios` sin configuración guardada
- **THEN** ve la matriz con los defaults marcados y el badge "Por defecto" en los 3 tipos

#### Scenario: Fila vacía
- **WHEN** desmarca todos los roles de Preventiva
- **THEN** la fila se marca en error y Guardar queda deshabilitado

#### Scenario: Guardar invalida candidatos
- **WHEN** guarda un cambio válido
- **THEN** se envía el `PUT` y se invalidan las queries `['acciones-correctivas', 'candidatos']`

#### Scenario: Restablecer pide confirmación
- **WHEN** hace clic en "Restablecer valores por defecto"
- **THEN** se pide confirmación y solo al confirmar se llama al endpoint de restablecer

#### Scenario: Rol operativo no ve la sección
- **WHEN** un JEFE_CALIDAD_SYST abre una pantalla que monta `ResponsablesAcSection`
- **THEN** la sección no se renderiza

#### Scenario: Modal del SUPERADMIN
- **WHEN** el SUPERADMIN elige "Responsables de AC" en una empresa
- **THEN** se abre el modal con la configuración de esa empresa

### Requirement: MSW de la configuración de responsables de AC
El MSW SHALL exponer `GET`, `PUT` y `POST …/restablecer` de `/api/empresas/:id/responsables-ac` con una configuración en memoria por empresa, los mismos defaults, validaciones (400), permisos (403 a roles no administradores, 404 al ADMIN_EMPRESA sobre otra empresa) y forma de respuesta que el backend.

#### Scenario: PUT MSW con tipo vacío
- **WHEN** con MSW activo se envía un `PUT` con un tipo sin roles
- **THEN** el handler responde 400
