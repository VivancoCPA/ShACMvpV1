# SHAC — Product Requirements Document

**Especificaciones funcionales · Reglas de negocio · Criterios de aceptación**

Operador Logístico · Almacén de Minerales · Importación & Exportación

ISO 9001:2015 §7.5 + ISO 45001:2018 §10.2

| Código | Versión | Fecha | Estado |
|---|---|---|---|
| SHAC-PRD-003 | **v1.1** | Octubre 2026 | **CONSOLIDADO — Pendiente de aprobación** |

**Documentos relacionados:** SHAC-PRD-001 · Planificación Base │ SHAC-PRD-002 · Documento de Alcance │ SHAC-M1-RACI-v1.0 · Matriz de Responsabilidades M1

> **Novedad de la versión 1.1.** Esta versión consolida el Módulo M1 (Control Documentario) con los addenda **ADD-01** (Seguridad documental y confidencialidad) y **ADD-02** (Archivo original editable + PDF de distribución), más todas las decisiones tomadas por el Product Owner (Toño) durante el cutover al backend real y la etapa de verificación de Documentos (septiembre–octubre 2026). Los módulos M4, M2, M3 y M5 y las reglas globales se mantienen **sin cambios** respecto a la v1.0. Los addenda ADD-03 (Multi-local) y ADD-04 (Edición del QE) siguen vigentes como documentos separados. El detalle de qué cambió y por qué está en el **Anexo A — Control de cambios v1.0 → v1.1**.

| # | Módulo | Secciones del PRD | Estado en v1.1 |
|---|---|---|---|
| **M1** | **Control Documentario** | Tipos · Estados · Permisos · Archivos · Distribución · Revisión periódica · Reglas · Criterios | **Actualizado (consolida ADD-01, ADD-02 y decisiones 2026)** |
| **M2** | **Gestión de No Conformidades** | Tipos NC · Campos · Validaciones · Reglas de plazo | Sin cambios respecto a v1.0 |
| **M3** | **Gestión de Incidentes SyST** | Reporte móvil · Severidad · Escalado · Investigación | Sin cambios (ver ADD-03) |
| **M4** | **Quality Event (núcleo)** | Estados · Transiciones · Vinculaciones · Cierre · Reapertura | Sin cambios (ver ADD-04) |
| **M5** | **Dashboard e Indicadores** | KPIs · Semáforo · Alertas · Exportación | Sin cambios respecto a v1.0 |
| **M6** | **Gestión de Usuarios y Roles** | RBAC · Permisos · Firma electrónica | Por elaborar (PIN de firma: ver §4.10) |

---

# MÓDULO M4 — Quality Event: Núcleo del Sistema

*Entidad central · Estados · Transiciones · Reglas de negocio · Criterios de aceptación*

## 1. Quality Event (QE) — Especificación Funcional

El Quality Event es la entidad central del SHAC. Todo hallazgo de calidad o seguridad — independientemente de su origen — se gestiona como un único Quality Event trazable que agrupa el reporte inicial, la investigación, las acciones correctivas y la verificación de eficacia.

### 1.1 Orígenes del Quality Event

El sistema admite cuatro fuentes de creación de un QE, todas con igual jerarquía normativa pero con flujos de ingreso diferenciados:

| # | Origen | Actor que crea | Canal de ingreso | Dato mínimo obligatorio al crear |
|---|---|---|---|---|
| **O1** | **Incidente en campo (almacén/patio/muelle)** | Operario / Supervisor | App móvil (PWA) offline-capable | Descripción + área + turno + foto (recomendada) |
| **O2** | No Conformidad detectada por Supervisor o Auditor | Supervisor / Jefe Calidad / Auditor | Web | Descripción + proceso + clasificación de NC |
| **O3** | Hallazgo de auditoría interna o externa | Auditor Interno / Ente externo | Web (carga manual o desde módulo Auditorías v2.0) | Código de hallazgo + norma + cláusula + descripción |
| **O4** | Reporte de cliente o proveedor | Jefe Calidad / Supervisor (registra en nombre del externo) | Web | Nombre del cliente/proveedor + descripción + fecha de recepción |

### 1.2 Campos del Quality Event

Los campos se agrupan en tres bloques: cabecera (se completa al crear), cuerpo (se enriquece durante la investigación) y cierre (se completa al finalizar).

| Bloque | Campo | Tipo de dato | Obligatorio | Editable post-cierre | Regla de negocio |
|---|---|---|---|---|---|
| Cabecera | **Número de QE** | Autonumérico (QE-AAAA-NNN) | Sí (auto) | No | Generado por el sistema al crear. Formato: QE-2025-001. |
| Cabecera | **Origen** | Lista: O1/O2/O3/O4 | Sí | No | Determina el formulario de ingreso a mostrar. |
| Cabecera | **Tipo de evento** | Lista: Calidad / SyST / Aduanero / Operacional | Sí | No | Condiciona los campos del cuerpo. |
| Cabecera | **Severidad** | Lista: Baja / Media / Alta / Crítica | Sí | Solo por Jefe Calidad | Crítica: notifica a Gerencia en < 2 min. |
| Cabecera | **Descripción del evento** | Texto largo (máx 2000 chars) | Sí | No (se adiciona en bitácora) | Admite adjunto de foto/video en móvil. |
| Cabecera | **Área / Proceso afectado** | Lista configurable (almacén, patio, muelle, adm.) | Sí | No | Determina el supervisor de área a notificar. |
| Cabecera | **Mineral involucrado** | Lista configurable + campo libre | No | Sí | Aplica solo a eventos tipo Calidad y Operacional. |
| Cabecera | **Turno** | Lista: Día / Tarde / Noche | Sí | No | Registrado automáticamente si hay sesión activa. |
| Cabecera | **Fecha y hora del evento** | DateTime | Sí | No | Diferente a fecha de reporte. No puede ser futura. |
| Cabecera | **Fecha y hora de reporte** | DateTime (auto) | Sí (auto) | No | Generado por el sistema al guardar por primera vez. |
| Cabecera | **Reportado por** | Usuario (auto desde sesión) | Sí (auto) | No | — |
| Cuerpo | **Descripción ampliada** | Texto largo | No (recomendado) | Sí (bitácora) | — |
| Cuerpo | **Análisis de causa raíz (5 Por Qués)** | Tabla 5 filas: Pregunta / Respuesta | No | No | Puede ser asistido por IA. Validado por Jefe Calidad. |
| Cuerpo | **Diagrama Ishikawa (alternativo)** | 6 categorías: Método/Máquina/Material/Mano/Medición/Medio | No | No | Alternativa al 5 Porqués. Solo uno activo por QE. |
| Cuerpo | **Causa raíz definitiva** | Texto (100–500 chars) | Sí (antes de pasar a EN EJECUCIÓN) | No | Aprobada y firmada por Jefe Calidad. |
| Cuerpo | **Acciones correctivas (AC)** | 1–N ACs (ver spec M2) | Sí (mín. 1) | Ver spec AC | Cada AC tiene responsable, plazo y evidencia. |
| Cuerpo | **Documentos vinculados** | Lista de documentos del M1 | No | Sí | Para vincular procedimientos afectados por el QE. |
| Cuerpo | **Evaluación de riesgos actualizada** | Check + referencia a matriz IPER | Requerido si Tipo = SyST | No | Obligatorio por ISO 45001 §10.2.c. |
| Cierre | **Resultado del cierre** | Texto (100–500 chars) | Sí (al cerrar) | No | Firmado por Jefe Calidad + Supervisor de área. |
| Cierre | **Plazo de verificación de eficacia** | Número de días (30 / 60 / 90 / personalizado) | Sí (al cerrar) | No | Configurable con aprobación. Default: 60 días. |
| Cierre | **Resultado de verificación de eficacia** | Efectivo / No efectivo + evidencia | Sí (al verificar) | No | Si No efectivo: QE se reabre automáticamente. |
| Cierre | **Lecciones aprendidas** | Texto largo | No | No | Campo libre para capitalizar el aprendizaje. |

### 1.3 Estados y Transiciones del Quality Event

El QE atraviesa 8 estados. Las transiciones son unidireccionales salvo la reapertura, que es automática y se documenta en bitácora.

| # | Estado | Quién transiciona | Condición para avanzar | Notifica a | Plazo máximo en este estado |
|---|---|---|---|---|---|
| 1 | **ABIERTO** | Sistema (al crear) | — (estado inicial) | Supervisor área + Jefe Calidad + SyST | 48 h para ser asignado a investigación |
| 2 | **EN INVESTIGACIÓN** | Jefe Calidad (asigna investigador) | QE tiene responsable de investigación asignado | Responsable investigador | Según tipo: Baja 15d · Media 10d · Alta 7d · Crítica 3d |
| 3 | **ANÁLISIS COMPLETADO** | Responsable investigador | Causa raíz definitiva completada + mín. 1 AC creada | Jefe Calidad (revisión pendiente) | 2 días hábiles para aprobación del Jefe Calidad |
| 4 | **EN EJECUCIÓN** | Jefe Calidad (aprueba análisis) | Causa raíz aprobada y firmada por Jefe Calidad | Responsables de cada AC | Según plazo de cada AC (ver reglas de plazo §1.6) |
| 5 | **PENDIENTE CIERRE** | Sistema (automático cuando todas las ACs están cerradas) | Todas las ACs del QE tienen estado CERRADA con evidencia | Jefe Calidad + Supervisor de área | 5 días hábiles para aprobación del cierre |
| 6 | **CERRADO** | Jefe Calidad + Supervisor de área (firma dual) | Ambas firmas electrónicas registradas + plazo de verificación definido | Gerencia (si Severidad Alta/Crítica) + Reportante | Inicia cuenta regresiva de verificación de eficacia |
| 7 | **EN VERIFICACIÓN** | Sistema (automático al vencer plazo de verificación) | — (disparado por el sistema) | Jefe Calidad (tarea de verificación creada) | 10 días hábiles para completar la verificación |
| 8 | **VERIFICADO** | Jefe Calidad | Formulario REG-EFEC completado con resultado Efectivo | Gerencia + Reportante | — (estado terminal positivo) |
| R | **REABIERTO** | Sistema (automático) | Verificación resulta No efectivo, O no se completó en plazo | Gerencia + Jefe Calidad + Supervisor (escalado) | Vuelve a EN INVESTIGACIÓN. Se registra en bitácora. |

### 1.4 Reglas de Negocio del Quality Event

Las siguientes reglas son invariantes del sistema. No pueden ser omitidas por ningún usuario, independientemente de su rol:

| Código | Regla |
|---|---|
| **RN-QE-001** | Un QE solo puede estar en un estado a la vez. El historial de transiciones es inmutable en el audit trail. |
| **RN-QE-002** | Un QE no puede avanzar a EN EJECUCIÓN sin causa raíz definitiva aprobada y firmada por el Jefe de Calidad. |
| **RN-QE-003** | Un QE no puede cerrarse si tiene al menos una Acción Correctiva en estado PENDIENTE o EN EJECUCIÓN sin evidencia. |
| **RN-QE-004** | El cierre de un QE requiere obligatoriamente firma electrónica del Jefe de Calidad Y del Supervisor del área afectada. Si son la misma persona, se requiere aprobación de Gerencia como segunda firma. |
| **RN-QE-005** | Todo QE de Severidad Crítica debe notificar a Gerencia en un plazo máximo de 2 horas desde su creación, independientemente del horario. |
| **RN-QE-006** | La descripción del evento (campo de cabecera) no puede editarse una vez que el QE sale del estado ABIERTO. Las aclaraciones posteriores se registran en la bitácora de notas. |
| **RN-QE-007** | Un QE reabierto conserva todo el historial del ciclo anterior. El nuevo ciclo se inicia con un número de iteración (Ciclo 2, Ciclo 3...) visible en la cabecera. |
| **RN-QE-008** | Si el responsable de verificación no completa el REG-EFEC en el plazo de 10 días hábiles desde la notificación, el sistema reabre el QE automáticamente y escala a Gerencia. |
| **RN-QE-009** | Cada QE puede tener vinculados 1 a N documentos del M1 (Control Documentario). La vinculación no genera el cambio automáticamente; solo referencia que ese documento es afectado. |
| **RN-QE-010** | Los QEs de Origen O3 (hallazgo de auditoría) deben registrar obligatoriamente la cláusula de la norma incumplida (ISO 9001 o ISO 45001) en el campo 'Normativa vinculada'. |

### 1.5 Flujo de Cierre Dual (Jefe Calidad + Supervisor de Área)

Este es el flujo detallado de la transición PENDIENTE CIERRE → CERRADO, que requiere dos firmantes:

| Paso | Actor | Acción en el sistema | Validaciones y reglas |
|---|---|---|---|
| **P1** | Sistema (automático) | Detecta que todas las ACs del QE tienen estado CERRADA con evidencia adjunta. Cambia el QE a PENDIENTE CIERRE y notifica a Jefe Calidad y Supervisor del área. | La notificación incluye enlace directo al QE. Plazo: 5 días hábiles para completar el cierre. |
| **P2** | Jefe de Calidad | Revisa el QE completo: descripción, causa raíz, ACs, evidencias. Completa el campo 'Resultado del cierre' (100–500 chars). Selecciona el plazo de verificación de eficacia. | No puede cerrar si alguna AC no tiene evidencia adjunta. No puede cerrar si la causa raíz no está aprobada. El plazo de verificación es obligatorio. |
| **P3** | Jefe de Calidad | Hace clic en 'Aprobar y solicitar segunda firma'. El sistema registra timestamp y huella de la primera firma. | El sistema muestra un resumen del QE al Jefe Calidad antes de la firma. Requiere confirmación con contraseña o PIN. |
| **P4** | Sistema (automático) | Notifica al Supervisor del área que hay un QE esperando su aprobación de cierre. Incluye resumen del QE y enlace directo. | El Supervisor recibe notificación push + email. Plazo para firmar: 3 días hábiles adicionales desde P3. |
| **P5** | Supervisor de Área | Revisa el QE, las ACs y las evidencias. Si está de acuerdo, hace clic en 'Aprobar cierre'. Si no, rechaza con comentario. | Si rechaza, el QE vuelve a EN EJECUCIÓN con el comentario visible. El Jefe Calidad recibe notificación de rechazo. |
| **P6** | Sistema (automático) | Registra la segunda firma, cambia el estado a CERRADO, inicia el contador del plazo de verificación. Envía notificación de cierre a todas las partes. | El audit trail registra: quién firmó, cuándo, desde qué IP. Si Severidad Alta/Crítica, notifica también a Gerencia. |

### 1.6 Reglas de Plazo para Acciones Correctivas

El plazo de cada AC combina un valor sugerido por tipo de evento con la posibilidad de ajuste con aprobación:

| Severidad del QE | Plazo sugerido (días hábiles) | Plazo mínimo permitido | Quién puede ajustar el plazo | Proceso de aprobación del ajuste |
|---|---|---|---|---|
| **Baja** | 30 días hábiles | 15 días hábiles | Responsable propone · Jefe Calidad aprueba | Sin aprobación adicional. Solo firma del Jefe Calidad. |
| **Media** | 20 días hábiles | 10 días hábiles | Responsable propone · Jefe Calidad aprueba | Sin aprobación adicional. Solo firma del Jefe Calidad. |
| **Alta** | 10 días hábiles | 5 días hábiles | Responsable propone · Jefe Calidad propone · Gerencia aprueba | Requiere aprobación de Gerencia si se extiende más del 50% del plazo sugerido. |
| **Crítica** | 5 días hábiles | 2 días hábiles | Solo Gerencia puede extender el plazo | Gerencia justifica por escrito. Se notifica a todas las partes. Queda en audit trail. |

### 1.7 Asistencia por IA — Análisis de Causa Raíz

La integración con Claude API asiste al investigador en el análisis. El sistema envía al modelo el contexto del QE y recibe sugerencias estructuradas:

| Elemento | Especificación | Regla de negocio |
|---|---|---|
| **Datos enviados a la IA** | Descripción del evento, área, tipo, mineral involucrado, historial de QEs similares (últimos 12 meses, mismo proceso). | Los datos enviados NO incluyen información personal de trabajadores ni datos de clientes/proveedores. Solo datos operacionales. |
| **Salida esperada de la IA** | (a) Sugerencia de causa raíz probable (texto), (b) borrador de 5 Porqués pre-completado, (c) 2–3 acciones correctivas sugeridas con responsable y plazo estimado. | Toda salida de IA lleva etiqueta visible 'Sugerencia generada por IA — requiere validación'. El investigador no puede guardar sin revisar cada campo. |
| **Aprobación del análisis IA** | El Jefe de Calidad revisa campo por campo. Puede aceptar, editar o rechazar cada sugerencia individualmente. | El audit trail registra qué fue generado por IA y qué fue editado manualmente. Esto es requerido para la trazabilidad normativa. |
| **Fallback sin IA** | Si la API de IA no está disponible, el formulario se muestra vacío para llenado manual. No se bloquea el flujo. | El sistema no puede depender exclusivamente de la IA para completar el proceso. El trabajo manual siempre es posible. |
| **Idioma** | La IA responde siempre en español. | El prompt del sistema incluye instrucción de idioma. Se usa el modelo claude-sonnet-4-6. |

### 1.8 Criterios de Aceptación — Quality Event

Los siguientes criterios deben cumplirse para considerar el módulo M4 como listo para producción (Definition of Done):

| ID | Criterio | Descripción |
|---|---|---|
| **QE-AC-001** | Crear QE desde móvil (O1) | Un operario sin conexión puede completar el formulario de incidente, guardarlo offline y verificar que se sincroniza al recuperar señal. El QE aparece en estado ABIERTO en el sistema. |
| **QE-AC-002** | Crear QE desde web (O2, O3, O4) | Un supervisor/auditor puede registrar una NC, hallazgo de auditoría o reporte externo con todos los campos de cabecera. El sistema asigna número QE-AAAA-NNN automáticamente. |
| **QE-AC-003** | Notificación de evento crítico | Al crear un QE con Severidad=Crítica, el Jefe de Calidad y Gerencia reciben notificación push+email en menos de 2 minutos. |
| **QE-AC-004** | Bloqueo de avance sin causa raíz | El sistema rechaza el intento de pasar a EN EJECUCIÓN si el campo 'Causa raíz definitiva' está vacío o no tiene firma del Jefe de Calidad. Muestra mensaje de error descriptivo. |
| **QE-AC-005** | Asistencia IA en análisis | El botón 'Asistir con IA' genera en menos de 15 segundos: causa raíz probable, 5 Porqués pre-completado y 2 ACs sugeridas. Todos los campos aparecen marcados como 'Sugerencia IA'. |
| **QE-AC-006** | Cierre dual | El sistema rechaza el cierre con una sola firma. Ambas firmas (Jefe Calidad + Supervisor) quedan registradas en el audit trail con timestamp y usuario. |
| **QE-AC-007** | Ajuste de plazo de AC | Un responsable de AC puede proponer un nuevo plazo. El Jefe de Calidad recibe notificación y puede aprobar/rechazar. Si aprueba, el plazo se actualiza y queda en historial. |
| **QE-AC-008** | Reapertura automática | Si el resultado de verificación es 'No efectivo' o vence el plazo de 10 días sin completarse, el QE cambia a REABIERTO automáticamente, se crea la iteración Ciclo N+1 y se notifica a Gerencia. |
| **QE-AC-009** | Exportación PDF para auditoría | El Jefe de Calidad puede exportar el QE completo en PDF (cabecera, cuerpo, ACs, evidencias, firmas, audit trail) en menos de 5 segundos. |
| **QE-AC-010** | Audit trail inmutable | No existe opción de editar o eliminar un registro del audit trail desde ningún rol, incluyendo administradores del sistema. |

---

# MÓDULO M2 — Gestión de No Conformidades

*Clasificación · Campos · Reglas · Acciones Correctivas · Criterios de aceptación*

## 2. Módulo M2 — Gestión de No Conformidades

Una No Conformidad (NC) en el SHAC es el incumplimiento de un requisito, sea normativo (ISO 9001, ISO 45001), operacional (procedimientos propios) o regulatorio (aduanas, normativa minera). Toda NC genera automáticamente un Quality Event.

### 2.1 Clasificación de No Conformidades

| Tipo | Categoría | Ejemplos en almacén de minerales | Norma vinculada |
|---|---|---|---|
| **NC-CAL** | **Calidad del Servicio / Producto** | Diferencia de peso en despacho, mineral mezclado con otro tipo, certificado de análisis incorrecto, empaque dañado. | ISO 9001:2015 §8.7 |
| **NC-SST** | **Seguridad y Salud en el Trabajo** | Trabajo sin EPP, maniobra sin vigía, derrame no reportado, falta de señalización en zona de carga. | ISO 45001:2018 §10.2 |
| **NC-ADU** | **Aduanera / Regulatoria** | Error en declaración aduanera, documentos de exportación incorrectos, incumplimiento de restricciones de importación de minerales. | Normativa SUNAT / MINEM |
| **NC-OPE** | **Operacional / Proceso** | Procedimiento no seguido, equipo sin checklist de operación, registro no completado, plazo de atención incumplido. | ISO 9001:2015 §8.1 |
| **NC-PRV** | **Proveedor / Contratista** | Servicio de transporte incumplido, producto/servicio no conforme de proveedor, incidente causado por contratista. | ISO 9001:2015 §8.4 |

### 2.2 Especificación de Acción Correctiva (AC)

Una AC es la unidad de trabajo dentro de un Quality Event. Cada QE puede tener entre 1 y N ACs. Las ACs son independientes entre sí pero todas deben cerrarse para que el QE avance a PENDIENTE CIERRE.

| Campo de la AC | Tipo de dato | Obligatorio | Editable | Regla de negocio |
|---|---|---|---|---|
| **Número de AC** | Autonumérico (AC-QE-NNN-01) | Sí (auto) | No | Vinculado al QE padre. Formato: AC-QE-2025-001-01. |
| **Descripción de la acción** | Texto (50–500 chars) | Sí | Sí (hasta EN EJECUCIÓN) | Debe describir la acción, no el problema. |
| **Tipo de acción** | Lista: Correctiva / Preventiva / Mejora | Sí | No | Las de tipo Preventiva pueden crearse sin QE origen. |
| **Responsable de ejecución** | Usuario del sistema | Sí | Solo Jefe Calidad | Recibe notificación al ser asignado. |
| **Plazo de ejecución** | Fecha (días hábiles) | Sí | Con aprobación (ver §1.6) | Calculado desde la fecha de creación de la AC. |
| **Evidencia de cierre** | Archivo adjunto (PDF/imagen/video) | Sí (para cerrar) | No (post-cierre) | Máx. 50 MB por archivo. Tipos: PDF, JPG, PNG, MP4. |
| **Descripción de la evidencia** | Texto (50–300 chars) | Sí (para cerrar) | No | Explica qué demuestra el archivo adjunto. |
| **Verificado por** | Usuario (auto al verificar) | Sí (auto al cerrar AC) | No | El Jefe Calidad es quien cierra la AC con la evidencia. |
| **Comentarios/bitácora** | Texto + fecha + usuario | No | Sí (siempre) | Historial de notas. No reemplaza los campos formales. |

### 2.3 Reglas de Negocio — No Conformidades y Acciones Correctivas

| Código | Regla |
|---|---|
| **RN-NC-001** | Toda NC de tipo NC-SST genera automáticamente un Quality Event con el campo 'Requiere evaluación IPER actualizada' activado. No puede cerrarse sin adjuntar la referencia a la matriz de riesgos revisada. |
| **RN-NC-002** | Una NC de tipo NC-ADU debe notificar al área de Comercio Exterior dentro de las 4 horas siguientes a su creación, independientemente de la severidad asignada. |
| **RN-NC-003** | No es posible eliminar una NC una vez creada. Si fue un error, se registra como 'Anulada' con justificación, y el registro queda en el historial con ese estado visible. |
| **RN-NC-004** | Una AC no puede ser asignada a un usuario que no tenga acceso al módulo correspondiente. Si el usuario es desactivado, el Jefe de Calidad recibe alerta para reasignar. |
| **RN-NC-005** | El sistema detecta NCs duplicadas comparando área + tipo + descripción con NCs abiertas de los últimos 30 días. Si hay coincidencia > 80%, muestra alerta al creador para vincular o descartar. |
| **RN-NC-006** | Una AC marcada como 'No completada en plazo' por el sistema puede ser extendida o reasignada, pero el incumplimiento original queda registrado en el audit trail y se contabiliza en el KPI de cumplimiento de plazos. |

### 2.4 Criterios de Aceptación — Módulo M2

| ID | Criterio | Descripción |
|---|---|---|
| **NC-AC-001** | Crear NC web | Un supervisor puede registrar una NC tipo NC-CAL con todos los campos de cabecera desde la interfaz web en menos de 3 minutos. El QE se crea automáticamente y aparece en el panel de pendientes. |
| **NC-AC-002** | Alerta NC-ADU | Al crear una NC tipo NC-ADU, el área de Comercio Exterior recibe notificación en menos de 4 horas. El sistema registra timestamp de envío de la notificación. |
| **NC-AC-003** | Detección de duplicados | Al crear una NC similar a una abierta en los últimos 30 días, el sistema muestra el alerta de posible duplicado con enlace al QE existente antes de guardar. |
| **NC-AC-004** | Cierre de AC con evidencia | El Jefe de Calidad puede adjuntar un archivo PDF y un texto de descripción para cerrar una AC. El sistema rechaza el cierre si el archivo supera 50 MB o si la descripción está vacía. |
| **NC-AC-005** | Alerta de vencimiento de AC | A 5 días hábiles del vencimiento de una AC, el responsable y el Jefe de Calidad reciben notificación. Al día del vencimiento, la AC aparece en rojo en el panel de pendientes. |

---

# MÓDULO M3 — Gestión de Incidentes SyST

*Reporte móvil · Clasificación · Escalado · Investigación · ISO 45001 §10.2*

## 3. Módulo M3 — Gestión de Incidentes SyST

Un Incidente SyST es cualquier evento relacionado con la seguridad y salud en el trabajo que ocurre o podría ocurrir en las instalaciones del operador logístico. Incluye accidentes, incidentes, cuasi-accidentes (near misses) y condiciones inseguras. Todo Incidente SyST genera un Quality Event.

### 3.1 Clasificación de Incidentes SyST

| Tipo | Definición | Ejemplos en almacén de minerales | Plazo máximo de reporte inicial |
|---|---|---|---|
| **ACCIDENTE** | Evento no deseado con lesión o daño a la salud de un trabajador. | Trabajador atropellado por montacargas, caída desde plataforma de almacenamiento, atrapamiento en faja transportadora. | Inmediato (< 30 min). Reporte formal < 24 h. |
| **INCIDENTE** | Evento no deseado sin lesión pero con potencial de daño. | Derrame de mineral controlado, carga suspendida sobre personal, falla de frenos en montacargas sin víctimas. | < 4 horas desde el evento. |
| **CUASI-ACCIDENTE (Near Miss)** | Situación que pudo derivar en un incidente o accidente pero no lo hizo. | Casi-colisión entre equipos, trabajador sin EPP en zona de riesgo, señalización faltante detectada a tiempo. | < 24 horas desde la detección. |
| **CONDICIÓN INSEGURA** | Estado o condición del entorno que representa un riesgo para los trabajadores. | Piso resbaladizo por derrame, estantería inestable, extinguidor vencido, iluminación deficiente en patio nocturno. | < 48 horas desde la detección. |

### 3.2 Campos del Formulario de Reporte de Incidente (Móvil)

El formulario móvil está optimizado para ser completado en campo, con mínimos campos obligatorios para el reporte inicial. Los campos adicionales se completan en la investigación posterior:

| Fase | Campo | Input en móvil | Obligatorio | Notas de UX / Regla |
|---|---|---|---|---|
| Reporte inicial | **Tipo de incidente** | Botones grandes: ACCIDENTE / INCIDENTE / CUASI / COND. INSEGURA | Sí | Primer campo. Botones de mínimo 48×48 px. Lenguaje simple. |
| Reporte inicial | **Descripción del evento** | Campo de texto + icono de micrófono (speech-to-text) | Sí | Mínimo 20 chars. El micrófono transcribe en español. |
| Reporte inicial | **Área / Ubicación** | Lista desplegable + campo GPS automático | Sí | El GPS se activa al abrir el formulario. El usuario puede corregir la ubicación. |
| Reporte inicial | **Fecha y hora del evento** | DateTime picker | Sí | Default = ahora. No puede ser más de 72 h en el pasado. |
| Reporte inicial | **Foto / Video** | Botón de cámara directa | No (recomendado) | Máx 3 archivos. Fotos < 10 MB. Video < 50 MB. Comprime automáticamente. |
| Reporte inicial | **¿Hubo lesionados?** | Toggle Sí/No | Sí | Si Sí: aparece campo adicional 'N° de personas afectadas'. |
| Reporte inicial | **Turno** | Lista: Día / Tarde / Noche | Sí | Default = turno actual del usuario (según horario registrado). |
| Investigación | **Personal involucrado** | Campo de búsqueda de usuarios + campo libre para externos | No | Se completa en investigación. No bloquea el reporte inicial. |
| Investigación | **Testigos** | Campo de búsqueda de usuarios + campo libre | No | Se completa en investigación. |
| Investigación | **Equipos involucrados** | Lista configurable + campo libre | No | Aplica para incidentes con maquinaria (montacargas, grúas, fajas). |
| Investigación | **Condiciones del entorno** | Checkboxes: Iluminación / Piso / Señalización / EPP / Clima / Otro | No | Multi-selección. Se completa en investigación. |
| Investigación | **Atención médica requerida** | Toggle Sí/No + campo libre para descripción | No | Si Sí: activa flujo de seguimiento médico (v2.0). |

### 3.3 Escalado Automático por Tipo y Severidad

| Tipo de incidente | Severidad auto-asignada | Notificación inmediata a | Plazo para investigación | Acción adicional del sistema |
|---|---|---|---|---|
| **ACCIDENTE** | Alta o Crítica (según N° lesionados) | Jefe SyST + Supervisor + Gerencia + Jefe RRHH | Inicio de investigación < 24 h · Informe preliminar < 72 h | Bloquea cierre del QE hasta que exista informe médico adjunto. |
| **INCIDENTE** | Media | Jefe SyST + Supervisor del área | Inicio de investigación < 48 h | Activa revisión de matriz IPER del área afectada. |
| **CUASI-ACCIDENTE** | Media o Baja | Jefe SyST + Supervisor del área | Inicio de investigación < 72 h | Sugiere revisión de procedimiento operativo relacionado. |
| **CONDICIÓN INSEGURA** | Baja | Supervisor del área | Asignación de AC < 48 h · Corrección < 5 días hábiles | Si no se asigna AC en 48 h, escala automáticamente al Jefe SyST. |

### 3.4 Reglas de Negocio — Incidentes SyST

| Código | Regla |
|---|---|
| **RN-INC-001** | Todo accidente con lesión debe reportarse con formulario inicial en menos de 30 minutos desde el evento. El sistema registra el timestamp del reporte. Si el plazo se supera, queda anotado en el audit trail como 'Reporte tardío'. |
| **RN-INC-002** | Un incidente de tipo ACCIDENTE no puede cerrarse sin adjuntar: (a) informe médico o de primeros auxilios, (b) evidencia fotográfica del área, (c) evaluación de riesgos IPER actualizada para el proceso involucrado. |
| **RN-INC-003** | La investigación de un incidente debe incluir la participación documentada del trabajador involucrado o testigos directos, conforme a ISO 45001:2018 §10.2.b. El sistema solicita al menos un participante adicional al investigador principal. |
| **RN-INC-004** | Los incidentes con mineral derramado involucrado deben activar adicionalmente el campo 'Notificación ambiental requerida'. El área responsable es notificada automáticamente (campo configurable por el administrador). |
| **RN-INC-005** | El formulario de reporte de incidente debe funcionar en modo offline. Los datos se almacenan localmente y se sincronizan al recuperar conexión. El sistema muestra indicador de estado de sincronización. |

### 3.5 Criterios de Aceptación — Módulo M3

| ID | Criterio | Descripción |
|---|---|---|
| **INC-AC-001** | Reporte offline móvil | Un operario sin conexión completa el formulario de CUASI-ACCIDENTE, lo guarda y al recuperar señal el QE aparece en el sistema con todos los campos. El indicador de sincronización cambia de 'Pendiente' a 'Sincronizado'. |
| **INC-AC-002** | Reporte con foto desde cámara | Al hacer clic en el botón de cámara en el formulario móvil, el sistema abre directamente la cámara del dispositivo. La foto tomada se adjunta al formulario sin necesidad de ir a galería. |
| **INC-AC-003** | Escalado de accidente | Al crear un QE con Tipo=ACCIDENTE y Severidad=Crítica, Jefe SyST, Supervisor, Gerencia y Jefe RRHH reciben notificación en menos de 2 minutos. El QE aparece destacado en el panel de todos ellos. |
| **INC-AC-004** | Bloqueo de cierre sin informe médico | El sistema rechaza el intento de cerrar un QE tipo ACCIDENTE si no hay archivo de informe médico adjunto. El mensaje de error indica exactamente qué falta. |
| **INC-AC-005** | Participación documentada del trabajador | El Jefe SyST no puede completar la causa raíz sin haber registrado al menos un participante adicional (el trabajador o testigo). El campo es obligatorio antes de guardar el análisis. |

---

# MÓDULO M1 — Control Documentario

*Ciclo de vida · Estados · Versiones · Permisos · Archivos · Distribución controlada · ISO 9001:2015 §7.5*

## 4. Módulo M1 — Control Documentario

El Control Documentario gestiona el ciclo de vida completo de toda la información documentada del SHAC, cumpliendo los requisitos de identificación, versión, formato, revisión, aprobación, distribución, acceso, almacenamiento, control de cambios, conservación y disposición establecidos en ISO 9001:2015 §7.5 (y su equivalente en ISO 45001:2018 §7.5).

En la versión 1.1, este capítulo integra en un solo lugar:

- el texto base de la v1.0;
- **ADD-01**: seguridad documental y confidencialidad (RN-DOC-007 a 012, CA-12 a CA-24);
- **ADD-02**: archivo original editable y PDF de distribución (RN-DOC-013 a 018, CA-25 a CA-34);
- las decisiones del Product Owner tomadas entre septiembre y octubre de 2026, durante el cutover al backend real y la verificación del módulo.

Cuando una regla cambia respecto a su versión anterior, se marca **[MODIFICADA v1.1]**; cuando es nueva, **[NUEVA v1.1]**. El Anexo A detalla el origen de cada cambio.

> **Principio de multi-empresa (transversal).** Todo documento pertenece a una empresa. El `empresaId` se toma siempre de la sesión del usuario, nunca del cliente. Cualquier acceso a un documento, archivo, vínculo o usuario de otra empresa responde **404** (nunca 403), para no revelar su existencia.

### 4.1 Tipos de Documentos Gestionados

| Prefijo | Tipo | Descripción | Aprobador típico (referencial) | Revisión periódica | Periodicidad sugerida por el sistema | Formato del archivo original |
|---|---|---|---|---|---|---|
| **POL** | **Política** | Declaraciones de alto nivel: Política de Calidad, Política SyST, Política de Privacidad. | Gerencia General | Anual | 12 meses | Word (.docx) o Excel (.xlsx) |
| **PRC** | **Procedimiento** | Describe CÓMO se realiza un proceso. Incluye responsables, pasos, registros asociados y referencias normativas. | Jefe Calidad / SyST | Anual o al cambiar el proceso | 12 meses | Word o Excel |
| **INS** | **Instrucción de trabajo** | Tarea específica a nivel operacional: cómo operar un equipo, cómo llenar un formato. | Supervisor de área | Cada 2 años o al cambiar la tarea | 24 meses | Word o Excel |
| **REG** | **Registro / Formulario** | Evidencia objetiva de actividades: formularios, listas de chequeo, plantillas. | Jefe Calidad | Al cambiar el proceso vinculado | Sin fecha (opcional) | Word o Excel |
| **INF** | **Informe** | Informes de gestión, ejecutivos, de auditoría, de revisión por la dirección. | Quien lo emite (firmado) | No aplica (doc. por evento) | Sin fecha (opcional) | Word, Excel **o PDF** |
| **MAT** | **Matriz** (en la interfaz: "Material"; ver P-15) | Matrices de riesgo (IPER), competencias, comunicaciones. | Jefe Calidad / SyST | Semestral o al cambiar el proceso | 6 meses | Word, Excel **o PDF** |
| **PLAN** | **Plan** | Planes de acción, planes de emergencia, planes de continuidad. | Jefe Calidad / Gerencia | Anual | 12 meses | Word, Excel **o PDF** |

**[MODIFICADA v1.1]** La columna "Aprobado por" de la v1.0 pasa a ser **referencial**. En el sistema, el aprobador se elige por documento entre los roles habilitados de §4.5 (Jefe de Control Documentario o Alta Dirección).

**[NUEVA v1.1]** Las columnas "Periodicidad sugerida" y "Formato del archivo original" provienen de RN-DOC-027 y RN-DOC-035.

### 4.2 Roles que intervienen en M1

Los permisos se calculan combinando dos dimensiones:

- el **rol global** del usuario en la empresa;
- su **rol en el documento** (docRole), es decir, qué papel cumple en ese documento concreto.

| Código | Rol global | Responsabilidad principal en M1 |
|---|---|---|
| **OPE** | OPERARIO | Lectura de documentos vigentes según su confidencialidad. |
| **SUP** | SUPERVISOR | Igual que OPE en M1. |
| **JCA** | JEFE_CALIDAD_SYST | Supervisión del sistema documental. Edita borradores. Gestiona la revisión periódica. Puede ser revisor. Puede restaurar. |
| **JCD** | JEFE_CONTROL_DOCUMENTARIO | Responsable del módulo. Gestiona confidencialidad, revisión periódica y copias controladas. Puede ser revisor o aprobador. |
| **AUD** | AUDITOR_INTERNO | Lectura. Accede a CONFIDENCIAL. Puede ser revisor. |
| **DIR** | ALTA_DIRECCION | Gestiona confidencialidad. Puede ser revisor o aprobador. Puede restaurar. Accede a originales históricos. |

**docRole.** Para cada documento, el sistema resuelve un único docRole con esta precedencia: **AUTOR → REVISOR → APROBADOR → JEFE_CALIDAD → OPERARIO**.

- JEFE_CALIDAD aplica a un JCA o JCD que no participa en el documento.
- OPERARIO aplica a cualquier otro usuario.

Ejemplo: un JCD que es aprobador de un documento actúa como APROBADOR en ese documento, no como JEFE_CALIDAD.

Hay acciones que **no** dependen del docRole sino del rol global:

- la revisión periódica (RN-DOC-026);
- la nueva versión (RN-DOC-025);
- restaurar (RN-DOC-036);
- la gestión de confidencialidad (RN-DOC-011);
- la emisión de copias controladas (RN-DOC-032);
- la impresión (RN-DOC-010);
- el acceso histórico a OBSOLETO (CA-34).

### 4.3 Ciclo de Vida y Transiciones

| Transición | Quién la ejecuta | Condiciones | Registro en audit trail | Notifica a |
|---|---|---|---|---|
| Crear → **BORRADOR** | Cualquier usuario con acceso al módulo (típicamente el autor, JCA o JCD) | Campos obligatorios válidos. Revisor y aprobador opcionales al crear, pero deben ser candidatos válidos si se informan (RN-DOC-021). | `DOCUMENTO_CREADO` | Revisor y aprobador designados (informativo: "fuiste designado; recibirás aviso cuando sea tu turno") |
| **BORRADOR → EN_REVISION** | Autor o Jefe de Calidad (docRole) | Revisor **y** aprobador asignados (RN-DOC-022) | `ESTADO_CAMBIADO` | Revisor (asignación) |
| **EN_REVISION → EN_APROBACION** | Revisor asignado | — | `ESTADO_CAMBIADO` | Aprobador (asignación) + autor (informativo; verificar implementación, P-12) |
| **EN_REVISION → BORRADOR** (rechazo) | Revisor asignado | Motivo obligatorio de 20 a 500 caracteres (RN-DOC-024) | `RECHAZADO_EN_REVISION` + motivo | Autor, con extracto del motivo (hoy condicionado a un indicador; ver P-02) |
| **EN_REVISION → BORRADOR** (cancelación) | Jefe de Calidad (docRole) | Sin motivo | `REVISION_CANCELADA` | Autor + revisor |
| **EN_APROBACION → PUBLICADO** | Aprobador asignado, con firma por PIN | PIN configurado y correcto (RN-DOC-004). Archivo original presente (RN-DOC-017). Conversión a PDF exitosa (RN-DOC-034). La versión previa no tiene un QE activo vinculado (RN-DOC-005). | `FIRMA_REGISTRADA` (hash), `ARCHIVO_ORIGINAL_CONGELADO`, `ARCHIVO_DISTRIBUCION_GENERADO`, `ESTADO_CAMBIADO` | Autor + revisor (informativo) |
| **EN_APROBACION → BORRADOR** (rechazo) | Aprobador asignado | Motivo obligatorio de 20 a 500 caracteres | `RECHAZADO_EN_APROBACION` + motivo | Autor, con extracto del motivo (ver P-02) |
| **PUBLICADO / EN_REVISION_PERIODICA → OBSOLETO** | Sistema, automático al publicar una versión nueva del mismo código (RN-DOC-001; verificar el caso EN_REVISION_PERIODICA, P-12) | Bloqueado si esta versión tiene un QE vinculado que no está CERRADO ni VERIFICADO (RN-DOC-005) | `ESTADO_CAMBIADO` | JCD activos, si hay copias controladas por recoger (RN-DOC-032) |
| **PUBLICADO → EN_REVISION_PERIODICA** | JCA o JCD (rol global) | — | `REVISION_PERIODICA_INICIADA` + motivo automático (RN-DOC-028) | Autor |
| **EN_REVISION_PERIODICA → PUBLICADO** (confirmar vigencia) | JCA o JCD (rol global) | Nueva fecha de revisión ≥ hoy + 30 días (RN-DOC-027) | `REVISION_PERIODICA_CONFIRMADA` (fecha anterior → nueva) | — |
| **EN_REVISION_PERIODICA → BORRADOR** (cancelar) | JCA o JCD (rol global) | — | `ESTADO_CAMBIADO` | — |
| **PUBLICADO / EN_REVISION_PERIODICA → nueva versión** (nuevo BORRADOR vN+1) | Autor del documento de origen, o JCA/JCD (rol global) | No existe otra versión en proceso del mismo código (RN-DOC-023). Motivo y tipo de cambio (menor/mayor) obligatorios. | `NUEVA_VERSION_INICIADA`, `ARCHIVO_ORIGINAL_COPIADO_A_VERSION` | Revisor y aprobador heredados (RN-DOC-025) |

**Estados terminales y especiales:**

- OBSOLETO es terminal: se puede consultar en el visor con sello, pero no editar, distribuir ni descargar (RN-DOC-003).
- Mientras está en EN_REVISION_PERIODICA, el documento **sigue vigente**: se lee y se descarga como copia no controlada.

### 4.4 Matriz de Permisos por Estado y docRole **[MODIFICADA v1.1]**

Esta matriz es la fuente de verdad. Está implementada de forma idéntica en el backend (`DocumentPermissionResolver`) y en el frontend (`permissions.ts`). Siempre se aplica **después** del filtro de confidencialidad (§4.9): si el usuario no tiene acceso por confidencialidad, el documento no existe para él.

| Estado | AUTOR | REVISOR | APROBADOR | JEFE_CALIDAD (JCA/JCD no participante) | OPERARIO (resto de roles) |
|---|---|---|---|---|---|
| **BORRADOR** | Leer · Editar · Eliminar · Enviar a revisión | Leer | Leer | Leer · Editar · Comentar · Eliminar · Enviar a revisión | Sin acceso |
| **EN_REVISION** | Leer | Leer · Comentar · Aprobar · Rechazar | Leer | Leer · Editar · Comentar · Eliminar · Cancelar revisión | Sin acceso |
| **EN_APROBACION** | Leer | Leer | Leer · **Firmar** · Rechazar | Leer | Sin acceso |
| **PUBLICADO** | **Leer** [MODIFICADA v1.1] | Leer | Leer | Leer | Leer |
| **EN_REVISION_PERIODICA** | Leer (y Editar · Comentar si es el autor asignado de esta versión) | Leer · Comentar | Leer | Leer · Editar · Comentar | Leer |
| **OBSOLETO** | **Leer** [MODIFICADA v1.1] | Leer | Leer | Leer | Sin acceso (salvo JCD/DIR por CA-34) |

**Reglas complementarias de la matriz:**

1. **Lectura del autor en PUBLICADO y OBSOLETO.** En la v1.0, el autor figuraba "Sin acceso" en estos estados. En la v1.1 puede **leer** su propio documento. Se interpreta que "Sin acceso" se refería a edición (decisión del 08-oct-2026).
2. **Acciones por rol global**, independientes de la matriz:
   - Revisión periódica (iniciar, confirmar, cancelar): JCA o JCD.
   - Nueva versión: autor de origen, JCA o JCD.
   - Restaurar: JCA o DIR.
   - Copias controladas: JCD.
   - Imprimir: JCD o DIR.
   - Acceso histórico a OBSOLETO (visor y archivo original): JCD o DIR.
3. **Archivo original:**
   - Ver y descargar: cualquier docRole distinto de OPERARIO, en BORRADOR o EN_REVISION (RN-DOC-013). JCD y DIR también en OBSOLETO (CA-34).
   - Reemplazar: solo AUTOR o JEFE_CALIDAD, en BORRADOR o EN_REVISION, y si no está congelado (RN-DOC-018).
4. **Firma:** solo el aprobador asignado puede firmar, aunque otro usuario tenga un rol global superior.
5. **Precedencia:** un JCA o JCD que es revisor o aprobador de un BORRADOR ajeno actúa con su docRole de revisor o aprobador, así que no puede enviarlo a revisión.

### 4.5 Asignación de Revisor y Aprobador **[NUEVA v1.1]**

| Asignación | Roles globales elegibles | Restricciones |
|---|---|---|
| **Revisor** | JCA, JCD, AUD, DIR | Activo, con asignación activa en la empresa. No puede ser el autor. Distinto del aprobador. |
| **Aprobador** | JCD, DIR | Activo, con asignación activa en la empresa. No puede ser el autor. Distinto del revisor. Necesita PIN de firma configurado para poder firmar (RN-DOC-004). |

- **Fuente de candidatos:** el sistema ofrece solo candidatos válidos (`GET /api/documents/candidatos-asignacion?tipo=REVISOR|APROBADOR`) y excluye al autor. Al crear, el autor es el usuario de la sesión; al editar, es el autor del documento.
- **Validación en el servidor:** el servidor vuelve a validar al crear, al editar y en nueva versión. Un candidato inválido es un error de validación del campo (400/422), no un 404.
- **Asignado que ya no califica:** si en edición el usuario asignado ya no es candidato, se muestra como "(no disponible)" para que se reasigne.
- **Nombres:** las pantallas muestran siempre el nombre de la persona, nunca su identificador interno. Si no se puede resolver, muestran "Usuario no disponible".

### 4.6 Modelo de Archivos: Original Editable + PDF de Distribución

Cada documento puede tener dos archivos con funciones distintas:

| Archivo | Propósito | Formato | Quién accede | Ciclo |
|---|---|---|---|---|
| **Archivo original** (`archivoOriginal`) | Edición y base para generar el PDF | .docx / .xlsx. Además .pdf solo para INF, MAT y PLAN (RN-DOC-035). | docRoles distintos de OPERARIO, en BORRADOR o EN_REVISION. JCD y DIR en OBSOLETO (CA-34). | Se reemplaza libremente en BORRADOR o EN_REVISION. Se **congela** al publicar. Se copia a la nueva versión. |
| **PDF de distribución** (`archivoDistribucion`) | Documento maestro publicado | PDF generado por el sistema | **Nadie lo descarga.** El sistema lo usa internamente para el visor y para generar copias (RN-DOC-030). | Se genera al firmar (RN-DOC-034). Es inmutable: su hash es la evidencia de la firma. |

- **Sin carga manual del PDF de distribución.** El PDF de distribución lo genera siempre el sistema; no hay una zona para subirlo a mano. Para los tipos INF, MAT y PLAN, un PDF nativo se carga como archivo original (RN-DOC-035), y así se cumple el caso "documento solo en PDF" de RN-DOC-017.
- **Validación del archivo:** el servidor valida la extensión y la firma real del archivo (un PDF empieza con `%PDF-`; .docx y .xlsx son contenedores ZIP). Un archivo renombrado se rechaza. Tamaño máximo: 50 MB.
- **Nombres en las descargas:** el archivo se descarga con su nombre real y su extensión (incluidos nombres con tildes) y con el tipo de contenido correcto.

### 4.7 Firma, Publicación y PDF de Distribución **[NUEVA v1.1]**

Al firmar (EN_APROBACION → PUBLICADO), el sistema ejecuta estos pasos de forma atómica:

1. Valida estado, aprobador asignado y PIN.
2. Obtiene el PDF base: si el original es .docx o .xlsx, lo convierte con LibreOffice en el servidor; si es PDF, lo usa tal cual.
3. Estampa en cada página: código, versión, "PUBLICADO", fecha de emisión, nombre del aprobador y "Página X de N".
4. Calcula el SHA-256 del PDF sellado y lo registra en `FIRMA_REGISTRADA`.
5. Guarda el PDF de distribución, congela el original, pasa la versión previa a OBSOLETO y escribe el audit trail.

Si falla la validación, la obtención del PDF base o el guardado, **no se publica nada**:

- el documento sigue en EN_APROBACION y no quedan archivos huérfanos;
- el usuario recibe un error de negocio claro (por ejemplo `PDF_CONVERSION_FAILED`, `SIN_ARCHIVO_ORIGINAL` o "PDF protegido o dañado"), nunca un error genérico;
- el detalle técnico queda en el log del servidor.

**Excepción vigente (degradación):** si solo falla el **sellado** (paso 3), el sistema publica el PDF convertido **sin sello** y deja constancia en el log del servidor. Lo mismo ocurre con las marcas de la vista previa y del sello OBSOLETO. Está pendiente de decisión si esto debe bloquear la publicación (P-13).

### 4.8 Visualización, Descarga y Distribución Controlada **[NUEVA v1.1]**

**a) Visor integrado (RN-DOC-029).** La forma principal de consultar un documento es el visor dentro de la app; no hace falta descargarlo.

| Estado | Qué muestra el visor | Quién lo ve |
|---|---|---|
| BORRADOR, EN_REVISION, EN_APROBACION | Vista previa en PDF generada desde el original, con la marca "VISTA PREVIA — NO CONTROLADO — {ESTADO}" | docRoles distintos de OPERARIO con lectura en ese estado. Incluye al aprobador en EN_APROBACION, aunque no pueda descargar el original. |
| PUBLICADO, EN_REVISION_PERIODICA | El PDF de distribución publicado | Cualquier usuario con lectura y acceso por confidencialidad |
| OBSOLETO | El PDF de distribución con el sello "OBSOLETO — No usar", aplicado al servir (no modifica el archivo firmado) | Lectores según la matriz, más JCD y DIR (CA-34) |

- El visor no tiene botón de descarga para nadie.
- Solo JCD y DIR tienen el botón de imprimir (RN-DOC-010).
- No hay texto seleccionable ni menú contextual.
- Cada apertura registra una entrada `VISUALIZACION`.

**b) Copia no controlada: la única descarga de un documento vigente (RN-DOC-030).**

- Cualquier lector con acceso puede descargar, en PUBLICADO o EN_REVISION_PERIODICA, una copia del PDF con:
  - la leyenda **"COPIA NO CONTROLADA — Solo válido al momento de impresión"**;
  - su nombre completo, y la fecha y hora de Lima;
  - un hash propio.
- Cada descarga registra `DESCARGA` con el hash.
- La copia no permite copiar texto. Solo se puede imprimir si quien la descarga es JCD o DIR.
- Un documento OBSOLETO no se descarga.

**c) Copia controlada registrada (RN-DOC-032).** Cuando hace falta distribuir un documento vigente en papel o en un punto de uso (tablero de planta, entrega a un auditor), el **JCD** emite una copia controlada:

- **Numeración y asignación:** número `{código}-v{versión}-C{nnn}`, correlativo por documento y versión, asignado a un destinatario (persona, área o ubicación).
- **Leyenda en cada página:** "COPIA CONTROLADA N° … — Asignada a: … — Emitida el … por …", más "Verifique la vigencia en SHAC antes de usar" y el hash.
- **Estados:** `VIGENTE`, `RECOGIDA` o `ANULADA` (anular exige motivo). Las copias nunca se borran.
- **Reimpresión:** conserva el número y lleva la marca "REIMPRESIÓN".
- **Al quedar obsoleta la versión:** el sistema avisa a los JCD qué copias de esa versión siguen por recoger. No cambia el estado de las copias de forma automática.
- **Formato del PDF:** se puede imprimir y no permite copiar texto.

**d) Impresión registrada (RN-DOC-033).** Imprimir desde el visor (solo JCD y DIR) registra `IMPRESION` antes de abrir el diálogo de impresión. Para papel controlado se usa la copia controlada. Está pendiente decidir si lo impreso desde el visor debe llevar la leyenda de copia no controlada (P-14).

**e) Almacenamiento privado (RN-DOC-031).**

- Ningún archivo de usuario se guarda en una carpeta pública ni es accesible por URL directa. Esto incluye originales, PDF, vistas previas, planos de locales y fotos de perfil.
- Toda descarga o visualización es una petición autenticada que valida empresa, confidencialidad y permiso, y que queda en el audit trail.

> **Alcance de las protecciones técnicas.** Bloquear la descarga, la impresión o la copia de texto en el visor y en los PDF es una medida **disuasoria**: un usuario con conocimientos técnicos podría extraer el contenido. La protección real es el control de acceso en el servidor más el audit trail.

### 4.9 Confidencialidad (consolida ADD-01)

| Nivel | Quién ve el documento | Quién puede asignarlo |
|---|---|---|
| **PUBLICO** | Todos los usuarios autenticados de la empresa | JCD o DIR |
| **INTERNO** (default) | Todos los roles internos de la empresa | JCD o DIR. Para el resto de roles, el campo aparece deshabilitado y fijo en INTERNO. |
| **CONFIDENCIAL** | Solo JCA, JCD, AUD y DIR | JCD o DIR |
| **RESTRINGIDO** | Solo los roles listados en `rolesAutorizados` (al menos uno) | JCD o DIR |

- Un documento sin acceso por confidencialidad es **invisible**: no aparece en listas, búsquedas, contadores ni vínculos.
- Si se pide por identificador, responde 404.
- El filtro se aplica en el servidor.

### 4.10 Firma Electrónica con PIN **[MODIFICADA v1.1]**

- **PIN:** de **4 dígitos**. Cada usuario lo configura en *Mi Perfil → PIN de firma*, confirmando su contraseña actual. Se guarda solo como hash; el sistema expone únicamente si el usuario lo tiene configurado (`tienePinFirma`), nunca el valor.
- **Firma sin PIN configurado:** responde con el código estable `PIN_NO_CONFIGURADO`. El modal de firma muestra un aviso con enlace a Mi Perfil. Si el PIN no coincide, responde "PIN incorrecto".
- **Reseteo:** el SUPERADMIN puede resetear el PIN de un usuario, que deberá configurarlo de nuevo.
- **Alcance:** la misma regla de PIN aplica a la firma de cierre de QE.

### 4.11 Revisión Periódica **[MODIFICADA v1.1]**

1. **Aviso previo** (≤ 30 días antes de `fechaRevisionProxima`, documento PUBLICADO): el sistema notifica al autor y a todos los JCA y JCD activos de la empresa.
2. **Vencimiento:** cuando llega la fecha o ya pasó, el sistema **no cambia el estado**; el inicio de la revisión es manual. Lo que hace el sistema:
   - registra en el log del documento `REVISION_PERIODICA_VENCIDA`, con el actor "Sistema" y la fecha que venció;
   - envía una notificación de "revisión vencida" a los mismos destinatarios;
   - muestra en el detalle un aviso rojo que indica que el documento sigue vigente pero debe revisarse.
3. **Inicio:** lo hace un JCA o JCD (rol global, aunque haya participado en el documento). Se registra `REVISION_PERIODICA_INICIADA`, con un motivo calculado automáticamente:
   - "programada": la fecha está a 30 días o menos, o ya pasó;
   - "anticipada": la fecha está a más de 30 días;
   - "sin fecha programada": el documento no tiene fecha.
4. **Resolución**, en EN_REVISION_PERIODICA, por JCA o JCD:
   - **Confirmar vigencia sin cambios:** el sistema sugiere la próxima fecha según la periodicidad del tipo (§4.1), y el usuario puede editarla. La fecha debe ser al menos hoy + 30 días (calendario de Lima).
   - **Crear una nueva versión:** ver §4.12.
   - **Cancelar la revisión:** el documento pasa a BORRADOR.
5. **Idempotencia por ciclo:** cada fecha de revisión genera como máximo un aviso previo y un aviso de vencido. Al confirmar con una fecha nueva, el ciclo siguiente vuelve a avisar.
6. **Alcance de los avisos:** solo documentos PUBLICADO. Los BORRADOR, en flujo, OBSOLETO o EN_REVISION_PERIODICA no generan avisos.
7. **Semáforo de revisión** (lista y detalle): siempre muestra la fecha (dd/mm/aaaa) y la distancia en días ("en N días", "hoy", "hace N días").

| Color | Cuándo |
|---|---|
| Verde | Más días que el umbral de alerta (por defecto 30) |
| Ámbar | Entre 8 días y el umbral |
| Rojo "Próximo" | De 1 a 7 días |
| Rojo "Vencido" | 0 días o menos |

**Aviso en el detalle del documento:**

- ámbar: pendiente de revisión, a 30 días o menos;
- rojo: revisión vencida;
- informativo: "En revisión periódica desde {fecha}, iniciada por {nombre}".

### 4.12 Nueva Versión, Eliminación y Restauración **[MODIFICADA v1.1]**

- **Nueva versión:**
  - Puede crearla el autor del documento de origen, o un JCA o JCD.
  - **El autor de la nueva versión es quien la crea.**
  - El revisor y el aprobador se heredan solo si siguen siendo candidatos válidos y son distintos del nuevo autor; si no, quedan vacíos y hay que reasignarlos antes de enviar a revisión. El audit trail registra qué se vació y por qué.
  - El archivo original se copia al nuevo borrador.
  - Versionado (RN-DOC-002): menor v1.0 → v1.1, mayor v1.x → v2.0.
- **Eliminar:**
  - Es un borrado lógico, desde BORRADOR, por el autor o el Jefe de Calidad. Queda pendiente si también se permite en EN_REVISION (P-07).
  - Solo si el documento no tiene QE ni NC vinculados.
  - Queda en el audit trail (`DOCUMENTO_ELIMINADO`).
- **Restaurar:**
  - Solo JCA o DIR. Cualquier otro rol recibe 403.
  - El documento vuelve a BORRADOR.

### 4.13 Vínculos con Quality Events y No Conformidades **[NUEVA v1.1]**

- **Vinculación N:N:** un documento puede vincularse con N Quality Events y con N No Conformidades, mediante tablas de relación. Los vínculos se crean desde el documento o desde el QE o la NC.
- **Comportamiento de las operaciones:**
  - Crear un vínculo que ya existe no da error (idempotente).
  - Borrar un vínculo inexistente responde 404.
  - Un vínculo con una entidad de otra empresa responde 404.
- **Visualización:** el detalle de cada lado muestra un resumen de lo vinculado.
  - Documento → QE: número, tipo, severidad, estado.
  - QE/NC → documento: código, título, estado.
  - La lista se ve en modo lectura; el selector para vincular solo aparece a quien tiene permiso de edición.
- **RN-DOC-005** aplica solo a QE activos (ver §4.16).

### 4.14 Notificaciones y Bandeja de Pendientes **[NUEVA v1.1]**

**Destinatarios por evento:** ver la columna "Notifica a" de §4.3. Además:

- aviso previo y aviso de vencimiento de la revisión periódica (§4.11);
- copias controladas por recoger (§4.8c).

**Reglas de envío:**

- nunca se notifica al propio actor ni se duplica un aviso;
- solo se notifica a usuarios de la misma empresa;
- si no hay destinatario asignado, no se envía nada;
- el envío es *best-effort*: ocurre después de confirmar la transición y un fallo no la revierte;
- las notificaciones informativas son de tipo `CAMBIO_ESTADO` y las que requieren acción, `ASIGNACION`;
- el enlace lleva al detalle del documento.

**Bandeja "Pendientes"** (contador y lista). Depende **solo de la asignación** del usuario, con una excepción:

- BORRADOR, si es el autor;
- EN_REVISION, si es el revisor;
- EN_APROBACION, si es el aprobador;
- EN_REVISION_PERIODICA, si es JCA o JCD (la única etapa que depende del rol).

El contador y la lista aplican el mismo filtro de confidencialidad y excluyen los documentos eliminados.

### 4.15 Audit Trail del Documento **[MODIFICADA v1.1]**

**Reglas generales:**

- El audit trail es append-only: ningún rol puede editar ni borrar entradas.
- El detalle del documento lo muestra completo, ordenado por fecha, y se actualiza al instante tras cada acción del usuario: no hace falta salir y volver a entrar.
- **Acciones automáticas:** las registra el actor **"Sistema"**.
- **Fechas:** se guardan en UTC y se muestran en la hora de Lima. Las fechas de calendario (vigencia, próxima revisión) se muestran tal cual, sin conversión de zona horaria.

| Acción | Cuándo | Datos clave |
|---|---|---|
| `DOCUMENTO_CREADO` | Alta del documento | — |
| `CAMPO_EDITADO` | Edición de metadatos | Campo, valor anterior → nuevo |
| `ESTADO_CAMBIADO` | Transiciones sin acción propia | Estado anterior → nuevo |
| `RECHAZADO_EN_REVISION` / `RECHAZADO_EN_APROBACION` | Rechazos | Estado anterior → nuevo, **motivo** |
| `REVISION_CANCELADA` | Cancelación de la revisión por el Jefe de Calidad | Estado anterior → nuevo |
| `FIRMA_REGISTRADA` | Firma con PIN | Hash SHA-256 del PDF publicado |
| `ARCHIVO_DISTRIBUCION_GENERADO` / `ARCHIVO_ORIGINAL_CONGELADO` | Al publicar | — |
| `ARCHIVO_ORIGINAL_ACTUALIZADO` | Reemplazo del original | Nombre del archivo anterior |
| `NUEVA_VERSION_INICIADA` | Nueva versión (en el log del documento de **origen**) | Versión nueva |
| `DOCUMENTO_CREADO` + `ARCHIVO_ORIGINAL_COPIADO_A_VERSION` | Nueva versión (en el log de la **versión nueva**) | Campos de revisor y aprobador vaciados y motivo |
| `VISUALIZACION` | Cada apertura del visor | — |
| `DESCARGA` | Cada descarga de la copia no controlada | Hash de la copia |
| `DESCARGA_ARCHIVO_ORIGINAL` | Descarga del original | — |
| `IMPRESION` | Impresión desde el visor | — |
| `REVISION_PERIODICA_VENCIDA` | La fecha de revisión se alcanzó (actor Sistema) | Fecha vencida |
| `REVISION_PERIODICA_INICIADA` | Inicio manual de la revisión periódica | Motivo automático |
| `REVISION_PERIODICA_CONFIRMADA` | Confirmación de vigencia | Fecha anterior → nueva |
| `COPIA_CONTROLADA_EMITIDA` / `_REIMPRESA` / `_RECOGIDA` / `_ANULADA` | Gestión de copias controladas | Número, destinatario, motivo |
| `COPIAS_CONTROLADAS_POR_RECOGER` | La versión quedó obsoleta con copias vigentes (actor Sistema) | Lista de números |
| `DOCUMENTO_ELIMINADO` | Borrado lógico | — |
| `RESTAURADO` | Restauración de un documento eliminado | — |

**Pestaña Historial:** muestra solo los hitos del ciclo:

- creación, cambios de estado, rechazos (con motivo) y cancelaciones;
- firma, nueva versión, eliminación y restauración;
- inicio, vencimiento y confirmación de la revisión periódica.

Las visualizaciones, descargas e impresiones van solo en el **Log**.

### 4.16 Reglas de Negocio — Control Documentario (catálogo consolidado)

| Código | Regla | Estado |
|---|---|---|
| **RN-DOC-001** | Solo puede existir una versión PUBLICADA/VIGENTE de cada código de documento a la vez. Al publicar una nueva versión, la anterior pasa automáticamente a OBSOLETO. Esta transición es irreversible. | Sin cambios |
| **RN-DOC-002** | El sistema asigna el número de versión automáticamente. Cambios menores (correcciones de forma, sin cambio de contenido sustancial): v1.0 → v1.1. Cambios mayores (cambio de proceso, requisito nuevo): v1.1 → v2.0. La clasificación la define quien crea la nueva versión. El formato es `vX.Y`. | Sin cambios de fondo |
| **RN-DOC-003** | Un documento OBSOLETO puede consultarse solo en el **visor**, donde se ve con el sello "OBSOLETO — No usar" aplicado al servir. No puede descargarse, distribuirse ni referenciarse en nuevas ACs. | MODIFICADA v1.1 |
| **RN-DOC-004** | La firma de aprobación es electrónica y requiere el **PIN de 4 dígitos** del aprobador asignado. Sin firma no hay publicación. La firma registra usuario, timestamp y hash SHA-256 del PDF publicado (`FIRMA_REGISTRADA`). Si el usuario no tiene PIN configurado, el sistema responde `PIN_NO_CONFIGURADO`. | MODIFICADA v1.1 |
| **RN-DOC-005** | No se puede pasar a OBSOLETO (y por lo tanto no se puede publicar la versión siguiente) un documento vinculado a un QE cuyo estado **no** sea CERRADO ni VERIFICADO. El sistema bloquea la operación completa y muestra el número del QE. | MODIFICADA v1.1 |
| **RN-DOC-006** | El sistema avisa al autor y a los JCA y JCD activos con 30 días de anticipación cuando un documento PUBLICADO se acerca a su fecha de revisión periódica, y otra vez cuando la fecha vence (ver RN-DOC-028). | MODIFICADA v1.1 |
| **RN-DOC-007** | Toda descarga de un documento vigente es una copia generada en el servidor al momento de la solicitud, con marca de agua dinámica: nombre completo del usuario, fecha y hora de Lima (GMT-5) y la leyenda "COPIA NO CONTROLADA — Solo válido al momento de impresión". El archivo almacenado no se modifica. | Sin cambios de fondo (ver nota DOC-AC-005) |
| **RN-DOC-008** | Cada visualización, descarga e impresión queda registrada en el audit trail del documento (usuario, acción, timestamp). Es append-only y no puede eliminarse ni modificarse. | MODIFICADA v1.1 (agrega impresión) |
| **RN-DOC-009** | ~~URLs firmadas con TTL de 15 minutos~~ → **Sin URLs directas a archivos.** El frontend nunca recibe ni expone una URL de un archivo. Toda descarga o visualización se hace con una petición autenticada (JWT) que valida empresa, confidencialidad y permiso, y que se registra en el audit trail. El circuito de URLs firmadas se retira. | REEMPLAZADA v1.1 |
| **RN-DOC-010** | Los PDF que entrega el sistema llevan permisos restrictivos: copia de texto deshabilitada para todos; impresión permitida solo a JCD y DIR (y en las copias controladas, que son para imprimir). En el visor, solo JCD y DIR ven el botón de imprimir. | MODIFICADA v1.1 |
| **RN-DOC-011** | Todo documento tiene un nivel de confidencialidad (PUBLICO, INTERNO, CONFIDENCIAL, RESTRINGIDO). El acceso se determina por ese nivel combinado con la matriz §4.4. Solo JCD y DIR asignan o cambian el nivel y `rolesAutorizados`. | Sin cambios (ADD-01) |
| **RN-DOC-012** | Un documento no autorizado es completamente invisible: no se muestra título, código, estado ni metadatos en ninguna lista, búsqueda, contador o vínculo. El filtrado se aplica en el backend; si se pide por identificador, responde 404. | Sin cambios (ADD-01) |
| **RN-DOC-013** | El archivo original solo se puede ver y descargar en BORRADOR o EN_REVISION, por cualquier docRole distinto de OPERARIO (autor, revisor, aprobador, Jefe de Calidad). En otros estados responde 403. Excepción CA-34: JCD y DIR en OBSOLETO. Cada descarga registra `DESCARGA_ARCHIVO_ORIGINAL`. | MODIFICADA v1.1 |
| **RN-DOC-014** | Al publicar, el original queda congelado (`archivoOriginalBloqueado = true`). Ninguna acción puede sobrescribirlo mientras el documento esté PUBLICADO o EN_REVISION_PERIODICA. Solo una nueva versión trabaja sobre una copia. | Sin cambios (ADD-02) |
| **RN-DOC-015** | Al crear una nueva versión, el sistema copia automáticamente el archivo original del documento de origen al nuevo BORRADOR. La copia es independiente. | Sin cambios (ADD-02) |
| **RN-DOC-016** | Los usuarios con docRole OPERARIO (incluidos OPE y SUP) nunca ven ni acceden al archivo original. En documentos vigentes acceden solo al visor y a la copia no controlada. | MODIFICADA v1.1 |
| **RN-DOC-017** | El archivo original es opcional mientras el documento está en BORRADOR, pero **es obligatorio para firmar**. Sin él, la firma se bloquea con `SIN_ARCHIVO_ORIGINAL`. Los documentos que solo existen en PDF se gestionan cargando ese PDF como original, permitido para INF, MAT y PLAN (RN-DOC-035). | MODIFICADA v1.1 |
| **RN-DOC-018** | El autor o el Jefe de Calidad pueden reemplazar el original en BORRADOR o EN_REVISION, si no está congelado. Cada reemplazo registra `ARCHIVO_ORIGINAL_ACTUALIZADO` con el nombre del archivo anterior. Solo se conserva el último original. | Sin cambios (ADD-02) |
| **RN-DOC-019** | El revisor y el aprobador de un documento deben ser personas distintas. | NUEVA v1.1 (ya implementada) |
| **RN-DOC-020** | Si el documento tiene `fechaVigencia`, la `fechaRevisionProxima` es obligatoria (salvo INF) y debe ser al menos 30 días posterior a la vigencia. | NUEVA v1.1 (ya implementada) |
| **RN-DOC-021** | **Segregación de funciones.** El autor no puede ser revisor ni aprobador de su documento. Revisor ∈ {JCA, JCD, AUD, DIR}; aprobador ∈ {JCD, DIR}; ambos activos y con asignación activa en la empresa. El servidor lo valida al crear, al editar y en nueva versión. | NUEVA v1.1 |
| **RN-DOC-022** | Para enviar un documento a revisión (BORRADOR → EN_REVISION) debe tener revisor **y** aprobador asignados. Si falta alguno, el error indica el campo; no es un 403. | NUEVA v1.1 |
| **RN-DOC-023** | Por cada código de documento solo puede haber una versión en proceso (BORRADOR, EN_REVISION o EN_APROBACION) a la vez. | NUEVA v1.1 |
| **RN-DOC-024** | Todo rechazo (en revisión o en aprobación) devuelve el documento a BORRADOR y exige un motivo de 20 a 500 caracteres (verificar que el servidor también lo exija en el rechazo de aprobación, P-12). Queda registrado con una acción propia (`RECHAZADO_EN_REVISION` / `RECHAZADO_EN_APROBACION`) y se muestra en el detalle mientras el documento siga en BORRADOR. La cancelación de la revisión por el Jefe de Calidad es una acción distinta (`REVISION_CANCELADA`), sin motivo. | NUEVA v1.1 |
| **RN-DOC-025** | Una nueva versión la puede crear el autor del documento de origen, o un JCA o JCD por su rol global. El autor de la nueva versión es quien la crea. El revisor y el aprobador se heredan solo si siguen siendo válidos y distintos del nuevo autor; si no, quedan vacíos. | NUEVA v1.1 |
| **RN-DOC-026** | Las acciones de revisión periódica (iniciar, confirmar vigencia, cancelar) se autorizan por **rol global**: JCA o JCD, aunque hayan sido autor, revisor o aprobador del documento. Otros roles reciben 403. | NUEVA v1.1 |
| **RN-DOC-027** | Al confirmar la vigencia, la próxima fecha de revisión se sugiere según la periodicidad del tipo y es editable, con un mínimo de hoy + 30 días (calendario de Lima). Para REG e INF es opcional. Se registra `REVISION_PERIODICA_CONFIRMADA` con la fecha anterior y la nueva. | NUEVA v1.1 |
| **RN-DOC-028** | El vencimiento de la revisión periódica no cambia el estado del documento. El sistema registra `REVISION_PERIODICA_VENCIDA` (actor Sistema), notifica y muestra un aviso en el detalle. El inicio es siempre manual y registra `REVISION_PERIODICA_INICIADA` con un motivo automático (programada, anticipada o sin fecha). Los avisos son idempotentes por ciclo (documento + fecha) y solo aplican a documentos PUBLICADO. | NUEVA v1.1 |
| **RN-DOC-029** | Los documentos se consultan en un visor integrado: vista previa con marca "NO CONTROLADO" en los estados de trabajo, PDF publicado en los estados vigentes y PDF con sello en OBSOLETO. El visor no permite descargar ni seleccionar texto; solo JCD y DIR pueden imprimir. Cada apertura registra `VISUALIZACION`. | NUEVA v1.1 |
| **RN-DOC-030** | La única descarga de un documento vigente (PUBLICADO o EN_REVISION_PERIODICA) es la copia no controlada de RN-DOC-007. Exige acceso por confidencialidad y lectura según la matriz. Nadie descarga el PDF maestro. | NUEVA v1.1 |
| **RN-DOC-031** | Ningún archivo de usuario se guarda en una carpeta pública ni se puede obtener por URL directa (incluye documentos, vistas previas, planos de locales y fotos de perfil). | NUEVA v1.1 |
| **RN-DOC-032** | **Copias controladas.** Solo el JCD emite copias controladas numeradas (`{código}-v{versión}-C{nnn}`) y asignadas a un destinatario, solo de documentos vigentes. Cada copia se registra con su hash y estado (`VIGENTE`, `RECOGIDA`, `ANULADA`) y nunca se borra. Al quedar obsoleta la versión, el sistema avisa a los JCD qué copias faltan recoger. | NUEVA v1.1 |
| **RN-DOC-033** | Toda impresión desde el visor (solo JCD y DIR) queda registrada (`IMPRESION`) antes de imprimirse. | NUEVA v1.1 |
| **RN-DOC-034** | El PDF de distribución se genera en el servidor al firmar. Si el original es .docx o .xlsx se convierte con LibreOffice; si es PDF se usa tal cual. Lleva un sello por página (código, versión, PUBLICADO, fecha, aprobador, página). Si la conversión falla, no se publica nada y el documento sigue en EN_APROBACION. Si solo falla el sellado, hoy se publica sin sello (P-13). | NUEVA v1.1 |
| **RN-DOC-035** | El archivo original debe ser Word (.docx) o Excel (.xlsx). Se acepta PDF solo para los tipos INF, MAT y PLAN. El servidor valida la extensión y la firma real del archivo. No se permite cambiar el tipo de un documento a uno que no admita el formato de su original. | NUEVA v1.1 |
| **RN-DOC-036** | Solo se puede eliminar (borrado lógico) un documento en BORRADOR y sin QE ni NC vinculados (EN_REVISION pendiente, P-07). Solo JCA y DIR pueden restaurar un documento eliminado, que vuelve a BORRADOR. | NUEVA v1.1 |
| **RN-DOC-037** | La bandeja de pendientes depende solo de la asignación del usuario a cada documento (autor en BORRADOR, revisor en EN_REVISION, aprobador en EN_APROBACION). La única excepción es EN_REVISION_PERIODICA, que corresponde a JCA y JCD. | NUEVA v1.1 |

### 4.17 Pantalla de Detalle del Documento **[NUEVA v1.1]**

- **Distribución general:**
  - encabezado fijo con código, título, estado, versión, confidencialidad, semáforo de revisión y acciones de gestión (como máximo dos visibles, el resto en un menú "⋯");
  - franja de avisos: rechazo, revisión próxima, vencida o en curso, obsoleto, restringido, falta de asignación y copias por recoger;
  - dos columnas a partir de 1280 px.
- **Columna principal (pestañas):** **Resumen**, **Historial**, **Versiones**, **Vínculos** (QE y NC), **Copias** (lectura: JCD, JCA, DIR y AUD; acciones: solo JCD) y **Log**.
  - La pestaña activa queda en la URL (`?tab=`), así un enlace o una notificación puede abrir una pestaña concreta.
  - El Log se pagina de 20 en 20.
- **Pestaña Resumen:** descripción; tarjeta "Documento publicado" en PUBLICADO, EN_REVISION_PERIODICA y OBSOLETO (firmante, fecha y hora, hash abreviado, botón Ver); motivo del cambio; fecha de vigencia; y sección del archivo original cuando corresponde.
- **Barra lateral fija:**
  - acciones de lectura: Ver documento, Descargar copia y Emitir copia controlada;
  - ficha: versión vigente, fecha de publicación, tipo, área, próxima revisión, confidencialidad, y responsables con foto o iniciales;
  - actividad reciente: últimos 5 eventos, con enlace al Log.
- **Comportamiento:**
  - La reorganización visual no cambia ninguna regla de permisos.
  - Debajo de 1280 px la página pasa a una sola columna, sin scroll horizontal.

### 4.18 Criterios de Aceptación — Módulo M1 (consolidado)

**Criterios del PRD base (actualizados):**

| ID | Criterio | Descripción | Estado |
|---|---|---|---|
| **DOC-AC-001** | Ciclo completo de publicación | Un autor crea un documento con revisor y aprobador asignados, lo envía a revisión, el revisor lo aprueba, el aprobador lo firma con su PIN y el documento queda PUBLICADO con su PDF de distribución sellado. Todo el ciclo en menos de 10 clics en total. | MODIFICADO |
| **DOC-AC-002** | Obsolescencia automática | Al publicar la v2.0, la v1.0 pasa a OBSOLETO. Al abrir la v1.0 en el visor se ve el sello "OBSOLETO — No usar" y no hay opción de descarga. | MODIFICADO |
| **DOC-AC-003** | Bloqueo por QE vinculado | Al intentar publicar una versión nueva cuando la anterior está vinculada a un QE que no está CERRADO ni VERIFICADO, el sistema rechaza la operación y muestra el número del QE. | MODIFICADO |
| **DOC-AC-004** | Alerta de revisión periódica | A 30 días de la fecha de revisión de un documento PUBLICADO, el autor y los JCA/JCD reciben una notificación con código, nombre y fecha. Al vencer, aparece `REVISION_PERIODICA_VENCIDA` en el log y el aviso rojo en el detalle. | MODIFICADO |
| **DOC-AC-005** | Exportación controlada | Al descargar un documento PUBLICADO, la copia incluye la leyenda "COPIA NO CONTROLADA — Solo válido al momento de impresión", la fecha y hora de descarga, el nombre del usuario y la versión, y la descarga aparece en el log. Para distribución controlada se usa la copia controlada (DOC-AC-012). | MODIFICADO (leyenda) |
| **DOC-AC-006** | Rechazo visible | Al rechazar en revisión o aprobación con un motivo de al menos 20 caracteres, el documento vuelve a BORRADOR, el log muestra la acción de rechazo con el motivo, el autor recibe la notificación y el detalle muestra el aviso con el motivo. | NUEVO |
| **DOC-AC-007** | Segregación de funciones | Las listas de revisor y aprobador muestran solo candidatos válidos de la empresa y nunca al autor. Forzar un candidato inválido desde la API devuelve un error de validación. | NUEVO |
| **DOC-AC-008** | Firma sin PIN | Un aprobador sin PIN ve en el modal de firma un aviso con enlace a Mi Perfil. Después de configurar el PIN, puede firmar. | NUEVO |
| **DOC-AC-009** | Visor | Un revisor abre un documento en EN_REVISION y ve la vista previa con la marca de agua, sin botón de descarga ni texto seleccionable. Un aprobador ve el documento en EN_APROBACION. Un operario ve el PDF publicado. Solo JCD y DIR ven el botón de imprimir. Cada apertura aparece en el log sin recargar la página. | NUEVO |
| **DOC-AC-010** | Revisión periódica por rol | Un JCD que fue aprobador de un documento vencido puede iniciar su revisión periódica y confirmar la vigencia con una fecha editable de al menos hoy + 30 días. Un operario no ve esas acciones y la API le responde 403. | NUEVO |
| **DOC-AC-011** | Almacenamiento privado | Abrir sin sesión una URL antigua de un archivo (`/uploads/...`) falla. Los documentos y planos se siguen viendo con sesión iniciada. | NUEVO |
| **DOC-AC-012** | Copia controlada | Un JCD emite dos copias para destinatarios distintos y recibe C001 y C002 con la leyenda y el destinatario. Al publicar una versión nueva, recibe el aviso de copias por recoger. Al recogerlas o anularlas (con motivo), el aviso desaparece. Un operario no puede emitir copias. | NUEVO |
| **DOC-AC-013** | Original en PDF | Un PLAN con un original en PDF se ve en el visor y se publica con sello sin pasar por la conversión. Un PRC no acepta un PDF como original. | NUEVO |
| **DOC-AC-014** | Bandeja de pendientes | Cada usuario ve en Pendientes solo los documentos en los que le toca actuar. El contador coincide con la lista. | NUEVO |
| **DOC-AC-015** | Nueva versión | Al crear una nueva versión, el creador queda como autor. Si el revisor o el aprobador heredado era el creador, el campo queda vacío y hay que reasignarlo para poder enviar a revisión. | NUEVO |

**Criterios heredados de ADD-01 y ADD-02:**

| ID | Criterio | Estado en v1.1 |
|---|---|---|
| CA-12 a CA-16 | Campo de confidencialidad y `rolesAutorizados` en el formulario (4 opciones, multiselección para RESTRINGIDO, limpieza al cambiar de nivel, campo deshabilitado sin permiso, error si RESTRINGIDO no tiene roles) | Vigentes |
| CA-17 | La copia descargada contiene la marca de agua con nombre, fecha y hora de Lima y la leyenda COPIA NO CONTROLADA | Vigente |
| CA-18 | Cada descarga registra `DESCARGA` en el audit trail | Vigente |
| CA-19 | ~~La URL de descarga expira tras 15 minutos~~ | **Reemplazado** por DOC-AC-011 (RN-DOC-009) |
| CA-20 | El PDF entregado no permite copiar texto | Vigente |
| CA-21, CA-22 | CONFIDENCIAL invisible para OPE y SUP; RESTRINGIDO invisible para quienes no figuran en la lista | Vigentes |
| CA-23 | Un rol sin permiso no puede modificar la confidencialidad | Vigente |
| CA-24 | Impresión desde el visor solo para JCD y DIR | Vigente (además se registra, RN-DOC-033) |
| CA-25 | El formulario de creación tiene una zona de carga del archivo original | **Modificado:** no hay zona de carga manual del PDF de distribución; el PDF se genera al firmar (§4.6) |
| CA-26 | OPE y SUP no ven el original en ningún estado | Vigente |
| CA-27 | El original solo es visible y descargable en BORRADOR y EN_REVISION | **Modificado:** para cualquier docRole distinto de OPERARIO (RN-DOC-013) |
| CA-28 | Descargar el original de un PUBLICADO da error | Vigente (403) |
| CA-29, CA-30, CA-31, CA-32 | Copia del original a la nueva versión; botón de reemplazo; audit del reemplazo; congelamiento al publicar | Vigentes |
| CA-33 | Un documento solo con PDF completa el flujo | **Modificado:** se cumple cargando el PDF como original en INF, MAT y PLAN (RN-DOC-035). Sin original, la firma se bloquea (RN-DOC-017). |
| CA-34 | JCD y DIR acceden al original histórico de un OBSOLETO | Vigente (también al visor con sello) |

### 4.19 Temas Abiertos de M1 (pendientes de decisión)

| # | Tema | Situación actual | Recomendación |
|---|---|---|---|
| P-01 | ¿El ADMINISTRADOR_EMPRESA puede resetear el PIN de firma? | Solo SUPERADMIN | Decidir junto con el módulo M6 |
| P-02 | ¿Se notifica siempre al autor cuando hay un rechazo? | Depende de un indicador interno | Notificar siempre |
| P-03 | ¿Se exige un archivo original para enviar a revisión (no solo para firmar)? | Hoy solo se exige para firmar | Exigirlo al enviar a revisión, para que el revisor vea la vista previa |
| P-04 | ¿Un OPERARIO debe ver en el Log quién visualizó o descargó? | Cualquier lector ve el Log completo | Restringir el Log de accesos a JCA, JCD, AUD y DIR |
| P-05 | Ratificación formal del retiro de las URLs firmadas como cumplimiento de RN-DOC-009 | Adoptado en `proteccion-documental` | Ratificar |
| P-06 | ¿Quién puede vincular documentos con QE y NC, y se vincula desde el alta de la NC? | Permiso de edición sobre la entidad desde la que se vincula | Confirmar; no vincular desde el alta de la NC |
| P-07 | ¿El Jefe de Calidad puede eliminar en EN_REVISION? | La matriz lo permite y el servidor acepta BORRADOR o EN_REVISION sin validar el permiso; la interfaz solo ofrece eliminar en BORRADOR | Limitar a BORRADOR y validar el permiso en el servidor |
| P-08 | Canal email para las alertas (RNG-002, DOC-AC-004) | Las notificaciones son dentro de la app | Definir junto con el hosting |
| P-09 | ¿Alta Dirección también emite copias controladas? | Solo JCD | Mantener solo JCD; se amplía cambiando una línea |
| P-10 | Hosting y dominio de producción | Diferido por decisión del PO | — |
| P-11 | ¿El JCD también puede restaurar? | Solo JCA y DIR; la RACI v1.0 se contradice | Mantener JCA y DIR |
| P-12 | Verificación en el código actual de: (a) obsolescencia de la versión de origen cuando está en EN_REVISION_PERIODICA; (b) aviso informativo al autor al pasar a EN_APROBACION; (c) motivo obligatorio en el servidor para el rechazo en aprobación | Detectado al consolidar el PRD | Cowork verifica y, si corresponde, emite el change de corrección |
| P-13 | ¿La falla del sellado debe bloquear la publicación? | Se publica sin sello y queda en el log | Bloquear: un PDF publicado sin sello no identifica versión ni aprobador |
| P-14 | ¿Lo impreso desde el visor lleva la leyenda "COPIA NO CONTROLADA"? | Recomendado, no decidido | Sí |
| P-15 | ¿MAT significa "Matriz" (PRD v1.0) o "Material" (interfaz actual y mapa de proceso)? | Inconsistente | Unificar el nombre en el PRD y en la interfaz |

---

# MÓDULO M5 — Dashboard e Indicadores

*KPIs · Semáforo de pendientes · Alertas · Exportación ejecutiva*

## 5. Módulo M5 — Dashboard e Indicadores

### 5.1 Vistas del Dashboard por Rol

| Rol | Widgets visibles | Acciones disponibles desde el dashboard |
|---|---|---|
| **Operario / Trabajador** | Mis QEs reportados (estado y semáforo) · Mis ACs asignadas · Notificaciones pendientes. | Crear nuevo reporte · Ver detalle de QE · Cerrar AC propia (con evidencia). |
| **Supervisor de Área** | Panel de pendientes del área (semáforo) · QEs abiertos por tipo · ACs vencidas del área · Alertas de incidentes recientes. | Validar QEs del área · Asignar responsables · Ver timeline de QE · Firmar cierre de QE. |
| **Jefe de Calidad / SyST** | Todos los KPIs del sistema · QEs por estado · Mapa de calor por área · Tendencia mensual · ACs por vencer en 5 días. | Aprobar análisis · Firmar cierres · Gestionar plazos · Exportar informe ejecutivo. |
| **Alta Dirección / Gerencia** | KPIs ejecutivos con tendencia · QEs críticos activos · Comparativa mes actual vs anterior · Alertas de reaperturas. | Ver detalle de QEs críticos · Exportar informe · Aprobar extensiones de plazo. |
| **Auditor Interno** | QEs por módulo de auditoría · Estado de hallazgos · Evidencias disponibles · Tasa de cierre por área. | Consultar QEs y evidencias · Exportar evidencias para auditoría externa. |

### 5.2 KPIs del Sistema — Especificación Completa

| Código | Indicador | Fórmula | Meta | Frec. | Fuente de datos |
|---|---|---|---|---|---|
| **KPI-01** | Tasa de cierre de QE en plazo | (QEs cerrados en plazo / QEs totales cerrados en período) × 100 | ≥ 90% | Mensual | Tabla QualityEvents, campo fecha_cierre vs plazo_máximo |
| **KPI-02** | Tiempo promedio de cierre de QE | Promedio de (fecha_cierre − fecha_creación) en días hábiles | ≤ 15 días | Mensual | Tabla QualityEvents |
| **KPI-03** | Tasa de reincidencia (reaperturas) | (QEs reabiertos / QEs cerrados en período) × 100 | ≤ 5% | Trimestral | Campo ciclo_actual > 1 en tabla QualityEvents |
| **KPI-04** | Índice de frecuencia de incidentes | (N° incidentes × 1,000,000) / Horas trabajadas en período | Reducción ≥ 10% anual | Mensual | Tabla QualityEvents tipo=INC + tabla HorasTrabajadas |
| **KPI-05** | Tasa de eficacia de acciones correctivas | (ACs con verificación Efectiva / ACs totales verificadas) × 100 | ≥ 85% | Mensual | Tabla AccionesCorrectivas, campo resultado_verificacion |
| **KPI-06** | % Documentos vigentes bajo control | (Docs PUBLICADOS con revisión al día / Total docs activos) × 100 | 100% | Mensual | Tabla Documentos, estado=PUBLICADO y fecha_revision_proxima |
| **KPI-07** | Tiempo promedio de investigación | Promedio de (fecha_analisis_completado − fecha_creacion) en días hábiles | ≤ 7 días | Mensual | Tabla QualityEvents, fechas de transición de estado |
| **KPI-08** | ACs vencidas activas | Conteo de ACs con estado=EN EJECUCIÓN y fecha_vencimiento < hoy | = 0 (ideal) ≤ 3 (aceptable) | Tiempo real | Tabla AccionesCorrectivas |
| **KPI-09** | NCs por área (mapa de calor) | Conteo de QEs por área en el período | Identificar top 3 áreas para plan de mejora | Mensual | Tabla QualityEvents, campo area_afectada |

### 5.3 Especificación del Semáforo de Pendientes

El semáforo es la funcionalidad de mayor impacto para el día a día. Cada QE o AC en el panel de pendientes muestra su color según el tiempo restante hasta el vencimiento:

| Color | Criterio de tiempo | Aplica a | Comportamiento visual | Notificación adicional |
|---|---|---|---|---|
| 🟢 **VERDE** | Más de 5 días hábiles al vencimiento | QEs en todos los estados · ACs en ejecución | Color de fondo verde suave en la fila del panel. | Ninguna adicional. |
| 🟡 **AMARILLO** | Entre 1 y 5 días hábiles al vencimiento | QEs en todos los estados · ACs en ejecución | Color de fondo amarillo. Icono de alerta visible. | Notificación push + email al responsable y al Jefe Calidad. |
| 🔴 **ROJO** | Vencido (0 días o fecha pasada) | QEs y ACs vencidos sin cerrar | Color de fondo rojo. Negrita en el nombre. Icono de urgencia. | Notificación inmediata al responsable, Jefe Calidad y Supervisor. |
| ⚫ **CRÍTICO** | Evento de Severidad Crítica sin cerrar | Solo QEs con Severidad=Crítica | Banner especial al tope del panel para todos los roles que lo ven. | Notificación a Gerencia + recordatorio diario hasta cierre. |

> El semáforo de **revisión periódica de documentos** (M1) tiene sus propios umbrales en días calendario; ver §4.11.

---

## Resumen de Reglas de Negocio Globales del Sistema

| Código | Regla |
|---|---|
| **RNG-001** | Toda acción que modifica el estado de un QE, AC o Documento queda registrada en el audit trail con usuario, timestamp e IP. No existe forma de eliminar un registro del audit trail desde ningún rol. |
| **RNG-002** | Las notificaciones del sistema (push + email) son obligatorias para las transiciones de estado. El sistema no puede proceder a la siguiente fase si la notificación no fue encolada exitosamente. *(Nota v1.1: en M1 las notificaciones son, por ahora, in-app y best-effort; ver §4.14 y el pendiente P-08.)* |
| **RNG-003** | Los plazos del sistema se calculan siempre en días hábiles (lunes a viernes, excluyendo feriados configurables por el administrador). El calendario de feriados es editable solo por el Administrador del sistema. *(Nota v1.1: la revisión periódica de documentos usa días calendario en zona America/Lima; ver §4.11.)* |
| **RNG-004** | Toda información generada por la IA (Claude API) queda marcada como 'Sugerencia IA' y no puede guardarse sin ser revisada y confirmada por un usuario con rol Jefe Calidad o superior. |
| **RNG-005** | El sistema debe ser accesible en modo offline para las funciones de reporte de incidentes (Módulo M3) y creación básica de NC (Módulo M2). La sincronización es automática al recuperar conectividad. |
| **RNG-006** | **[NUEVA v1.1] Multi-empresa.** Toda entidad pertenece a una empresa. El `empresaId` se obtiene siempre de la sesión. El acceso a recursos de otra empresa responde 404, sin revelar su existencia. |
| **RNG-007** | **[NUEVA v1.1] Fechas.** Los instantes (timestamps) se almacenan en UTC y se muestran en la hora de Lima. Las fechas de calendario (vigencia, próxima revisión, plazos) se almacenan como fecha a medianoche UTC y se muestran sin conversión de zona horaria, para que no se corran un día. |

---

# Anexo A — Control de Cambios v1.0 → v1.1

| Versión | Fecha | Autor | Descripción |
|---|---|---|---|
| v1.0 | Junio 2025 | Equipo SHAC | Versión inicial del PRD (M1 a M5 y reglas globales). |
| v1.1 | Octubre 2026 | Equipo SHAC (PO: Toño; redacción: Cowork) | Consolida en M1 los addenda ADD-01 y ADD-02 y las decisiones de la etapa de verificación de Documentos (sep–oct 2026). Agrega RNG-006 y RNG-007. Corrige dos errores tipográficos de la v1.0 ("perminido" → "permitido" en §1.6; "derramen" → "derramado" en RN-INC-004). M2, M3, M4 y M5 sin cambios de fondo. |

### A.1 Cambios en M1 y su origen

| Tema | Cambio en v1.1 | Origen (decisión / change) | Fecha |
|---|---|---|---|
| Firma con PIN | PIN de 4 dígitos; payload `{pin}`; códigos `PIN_NO_CONFIGURADO` y "PIN incorrecto" | `cutover-documentos` D1; `pin-firma-ui` | 15-sep / 05-oct-2026 |
| Revisor y aprobador | Candidatos por rol (revisor JCA/JCD/AUD/DIR; aprobador JCD/DIR); autor excluido; validación en el servidor | `revisor-aprobador-reales` D1 (opción flexible), D2 | 24-sep-2026 |
| Fechas | Normalización a UTC; fechas de calendario sin desfase | `fix-fechas-utc` D1 | 29-sep-2026 |
| Historial y audit trail | Se retira `historialVersiones`; el detalle trae el audit trail real; el Historial se arma con los hitos | `fix-detalle-documento-historial-audit` D1 | 30-sep-2026 |
| Semáforo de revisión | La fecha siempre visible, con distancia en días | `semaforo-revision-con-fecha` | 30-sep-2026 |
| Nombres de usuarios | Nunca se muestran identificadores internos; endpoint de nombres | `nombres-usuarios-reales` D1 | 05-oct-2026 |
| Notificaciones y pendientes | Matriz de destinatarios por transición; pendientes solo por asignación | `documentos-notificaciones-pendientes` D1 | 05-oct-2026 |
| Restaurar | Solo JCA y DIR | `documentos-notificaciones-pendientes` D2 | 05-oct-2026 |
| Rechazo visible | Acciones propias, motivo de 20 a 500 caracteres, aviso en el detalle | `documentos-rechazo-visible` D1 | 06-oct-2026 |
| PDF de distribución | Conversión con LibreOffice al firmar, sello por página, hash; error de negocio si falla | `pdf-distribucion-real` D1, D2; `fix-log-conversion-pdf` | 06-oct-2026 |
| Descargas | Nombre y extensión reales; tipo de contenido correcto | `fix-descarga-archivos-nombre` | 06-oct-2026 |
| Nueva versión | El autor es quien la crea; herencia condicionada; revisor y aprobador obligatorios para enviar a revisión | `nueva-version-autor-permisos` D1 | 07-oct-2026 |
| Confirmar vigencia | Fecha sugerida y editable, mínimo hoy + 30 días | `revision-periodica-fecha-editable` D1 | 07-oct-2026 |
| Vencimiento de revisión | Inicio manual; registro de vencimiento (actor Sistema); aviso en el detalle; idempotencia por ciclo | `revision-periodica-trazabilidad` D1 (opción B) | 07-oct-2026 |
| Revisión periódica por rol | JCA y JCD por rol global, aunque hayan participado | `revision-periodica-permiso-por-rol` D1 | 07-oct-2026 |
| Visor integrado | Vista previa en el servidor; sin descarga; impresión solo JCD/DIR; el aprobador ve en EN_APROBACION | `visor-documentos` D1–D4 | 07-oct-2026 |
| Lectura del autor | El autor lee su documento en PUBLICADO y OBSOLETO (diverge a propósito del texto literal de §4.2 v1.0) | `autor-lectura-publicado` D1 | 08-oct-2026 |
| Protección documental | Única descarga = copia no controlada; almacenamiento privado; retiro de las URLs firmadas | `proteccion-documental` D1–D3 | 09-oct-2026 |
| Leyenda de la copia | Se mantiene "COPIA NO CONTROLADA" (diverge a propósito del texto de DOC-AC-005 v1.0) | `proteccion-documental` D2 | 09-oct-2026 |
| Log en tiempo real | El log se actualiza sin salir de la pantalla | `fix-log-refresco-inmediato` | 12-oct-2026 |
| Copias controladas | Emisión registrada por el JCD, numeración, recogida al quedar obsoleta; impresión registrada | `copias-controladas` D1–D3 | 12-oct-2026 |
| Pantalla de detalle | Dos columnas, pestañas, barra lateral, foto de los responsables, información de publicación | `detalle-documento-dos-columnas`; `resumen-info-publicacion` | 13-oct-2026 |
| Original en PDF | Se acepta PDF como original solo en INF, MAT y PLAN | `original-pdf-tipos-permitidos` D1, D2 | 13-oct-2026 |
| Vínculos QE/NC | Tablas de relación, endpoints idempotentes, RN-DOC-005 solo con QE activos | `vinculacion-documento-qe`; `vinculacion-documento-nc` | 26-ago-2026 |

### A.2 Divergencias intencionales respecto al texto de la v1.0 y los addenda

1. **§4.2 v1.0, autor "Sin acceso" en PUBLICADO y OBSOLETO:** ahora el autor tiene lectura (RN-DOC-016 y matriz §4.4).
2. **DOC-AC-005 v1.0, "COPIA CONTROLADA":** la descarga ordinaria es "COPIA NO CONTROLADA" (práctica ISO). La copia controlada pasa a ser un proceso registrado aparte (RN-DOC-032).
3. **RN-DOC-009 (ADD-01), URLs firmadas de 15 minutos:** se reemplaza por "sin URLs directas, toda descarga autenticada y registrada".
4. **RN-DOC-017 (ADD-02), "el original null no bloquea ningún estado":** ahora el original es obligatorio para firmar. El caso "solo PDF" se cubre con RN-DOC-035.
5. **RN-DOC-013 (ADD-02), original solo para Autor y JCD:** se amplía a todo docRole distinto de OPERARIO que participa del documento.
6. **Matriz RACI M1 v1.0, revisor "JCD típicamente" y firma "solo DIR":** los roles elegibles se amplían (RN-DOC-021). La RACI queda **desactualizada** y debe regenerarse a partir de esta versión.

### A.3 Documentos que quedan absorbidos o desactualizados

- **SHAC-PRD-003-ADD-01** y **SHAC-PRD-003-ADD-02:** su contenido queda **absorbido** en el capítulo M1 de esta versión. Se conservan como referencia histórica.
- **SHAC-M1-Matriz-Responsabilidades-v1.0:** **desactualizada**; debe regenerarse como v1.1 a partir de §4.3, §4.4 y §4.15.
- **SHAC-Mapa-Proceso-Control-Documentario.md:** debe actualizarse con los avisos por paso, la nueva versión, la revisión periódica, el visor, la protección documental y las copias controladas.
- **SHAC-PRD-003-ADD-03** y **ADD-04:** siguen vigentes como addenda de M3 y M4.

*SHAC-PRD-003 · v1.1 · Octubre 2026 · Confidencial — Uso Interno*
