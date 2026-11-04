## MODIFIED Requirements

### Requirement: Hooks useFuncionalidades y useAsistenteIA
`src/features/quality-events/hooks/useFuncionalidades.ts` SHALL export `useFuncionalidades()`, un `useQuery` sobre `getFuncionalidades()` con query key `['config', 'funcionalidades']`. Si la consulta falla, los consumidores SHALL tratar `asistenteIA` como `false`. `useAsistenteIA.ts` SHALL export `useAsistenteIA()`, un `useMutation` sobre `asistirCausaRaizIA(id, metodo)` (variables `{ id, metodo }`) que, en éxito, invalida el audit trail del QE y no muestra toasts propios.

#### Scenario: Error en funcionalidades
- **WHEN** `GET /api/config/funcionalidades` falla
- **THEN** el botón "Asistir con IA" no se muestra

### Requirement: Botón Asistir con IA según disponibilidad y permiso
`QEInvestigationSection` SHALL render el botón "Asistir con IA" solo si `useFuncionalidades().data.asistenteIA` es `true` y la causa raíz es editable: JCA o responsable asignado, estado EN_INVESTIGACION/ANALISIS_COMPLETADO, sin firma. Al hacer clic SHALL llamar a `useAsistenteIA().mutate({ id: qe.id, metodo })`, donde `metodo` es el valor **actual** del formulario (`watch('metodoAnalisis')`), aunque no esté guardado, y, mientras espera, mostrar un spinner con `t('qualityEvents:detail.investigation.ia.analizando')`.

Ante un error:
- con `errorCode` `IA_LIMITE_DIARIO`, SHALL mostrar `toast.error(t('qualityEvents:errors.IA_LIMITE_DIARIO'))`;
- con cualquier otro, SHALL mostrar `toast.error` con el `message` del servidor.

En ningún caso de error SHALL modificar el formulario.

#### Scenario: Funcionalidad desactivada
- **WHEN** `asistenteIA` es `false`
- **THEN** el botón no se renderiza

#### Scenario: Envía el método visible
- **WHEN** el formulario tiene Ishikawa elegido (sin guardar) y el usuario hace clic en "Asistir con IA"
- **THEN** la mutación recibe `{ id: qe.id, metodo: 'ISHIKAWA' }`

#### Scenario: Spinner mientras analiza
- **WHEN** el usuario hace clic y la mutación está pendiente
- **THEN** se ve "Analizando…"

#### Scenario: 503 no toca el formulario
- **WHEN** el servidor responde 503 `IA_NO_DISPONIBLE`
- **THEN** se muestra un toast con el mensaje del servidor y los campos conservan sus valores

### Requirement: Panel de sugerencia con Usar / Descartar / Crear AC
Ante una sugerencia exitosa, `QEInvestigationSection` SHALL mostrar un panel con la etiqueta visible `t('qualityEvents:detail.investigation.ia.etiqueta')` ("Sugerencia generada por IA — requiere validación"), el ícono `Sparkles` y un fondo diferenciado, sin escribir en el formulario. Si `useFuncionalidades().data.asistenteIASimulado` es `true`, la etiqueta SHALL agregar el sufijo `t('qualityEvents:detail.investigation.ia.simulado')` ("(modo simulado — no es una sugerencia real)"). El panel SHALL ofrecer:
- **Causa raíz probable:** "Usar" copia el texto al campo de causa raíz (marcándolo como modificado); "Descartar" oculta el bloque.
- **5 Porqués** (solo si la sugerencia trae `cincoPorques`): "Usar" copia las 5 filas (`pregunta` y `respuesta`) y deja el método en `5_PORQUES`. "Descartar" oculta el bloque.
- **Diagrama de Ishikawa** (solo si la sugerencia trae `ishikawa`), con el título `t('qualityEvents:detail.investigation.ia.bloqueIshikawa')`: lista las 6 categorías con su etiqueta `detail.investigation.ishikawaCategoria.*` y la causa. "Usar" aplica las causas en el orden de las categorías del formulario, buscando por `categoria` y no por posición, limpia los 5 Porqués y deja el método en `ISHIKAWA`. "Descartar" oculta el bloque.
- **Acciones sugeridas:** cada una tiene "Crear AC", visible solo para quien puede crear AC (`JEFE_CALIDAD_SYST` en EN_INVESTIGACION/ANALISIS_COMPLETADO/EN_EJECUCION). Abre el formulario de alta de AC de `QEACSection` con `descripcion` precargada, y muestra como ayuda el tipo, el rol y los días hábiles sugeridos. El usuario elige al responsable real y la fecha.

Confirmaciones al "Usar" un análisis, siempre con un toast de acción, nunca con `confirm()`:
- si el método actual del formulario no es el de la sugerencia (el usuario cambió de método mientras esperaba), SHALL pedir `t('qualityEvents:detail.investigation.ia.confirmarCambioMetodo', { metodo })` y, al confirmar, cambiar el método y aplicar;
- si el método coincide y había datos cargados en el análisis, SHALL pedir `confirmarReemplazo` (5 Porqués) o `confirmarReemplazoIshikawa` (Ishikawa);
- sin datos y con el mismo método, SHALL aplicar directamente.

Nada SHALL guardarse automáticamente: el usuario siempre presiona "Guardar investigación".

#### Scenario: Panel con etiqueta
- **WHEN** la sugerencia llega
- **THEN** se ve "Sugerencia generada por IA — requiere validación" y el campo de causa raíz no cambió

#### Scenario: Etiqueta en modo simulado
- **WHEN** la sugerencia llega y `asistenteIASimulado` es `true`
- **THEN** la etiqueta muestra además "(modo simulado — no es una sugerencia real)"

#### Scenario: Usar la causa raíz
- **WHEN** el usuario presiona "Usar" en la causa raíz
- **THEN** el textarea contiene la causa sugerida y su label muestra la marca "IA"

#### Scenario: 5 Porqués con datos previos pide confirmación
- **WHEN** ya había respuestas cargadas y el usuario presiona "Usar" en los 5 Porqués
- **THEN** se pide confirmación, y las filas se reemplazan solo después de confirmar

#### Scenario: Bloque Ishikawa en lugar de 5 Porqués
- **WHEN** la sugerencia trae `ishikawa` y no `cincoPorques`
- **THEN** el panel muestra "Diagrama de Ishikawa sugerido" con las 6 categorías y no muestra el bloque de 5 Porqués

#### Scenario: Usar el Ishikawa
- **WHEN** el método es Ishikawa, no hay datos y el usuario presiona "Usar" en el Ishikawa (con las filas en otro orden)
- **THEN** cada categoría del formulario recibe su causa y el método sigue siendo Ishikawa

#### Scenario: Ishikawa con datos previos pide confirmación
- **WHEN** ya había causas cargadas y el usuario presiona "Usar" en el Ishikawa
- **THEN** se pide `confirmarReemplazoIshikawa`, y las causas se reemplazan solo después de confirmar

#### Scenario: Método cambiado mientras esperaba
- **WHEN** la sugerencia trae 5 Porqués pero el formulario ya tiene Ishikawa elegido y el usuario presiona "Usar"
- **THEN** se pide `confirmarCambioMetodo` y el método cambia a 5 Porqués solo después de confirmar

#### Scenario: Crear AC precargada
- **WHEN** el JCA presiona "Crear AC" en una acción sugerida
- **THEN** se abre el formulario de alta de AC con la descripción sugerida precargada y el responsable vacío

### Requirement: Marca IA / IA (editado) y origenIA al guardar
Los campos de causa raíz y del análisis (5 Porqués o Ishikawa) que se llenaron con "Usar" SHALL mostrar junto al label una de dos marcas:
- `t('qualityEvents:detail.investigation.ia.marca')` ("IA"), mientras su valor sea igual al sugerido;
- `t('qualityEvents:detail.investigation.ia.marcaEditada')` ("IA (editado)"), si el usuario lo cambió.

La marca del análisis va junto al label del método y corresponde al método activo; el Ishikawa se compara por categoría. La marca SHALL derivarse en render, comparando el valor actual con el aplicado, sin `useEffect`. Al guardar, `data.origenIA` SHALL incluir `causaRaiz`, `cincoPorques` y/o `ishikawa` con `'IA'` o `'IA_EDITADO'`, solo para los campos aplicados desde la sugerencia que se envían en esa llamada.

#### Scenario: Edición cambia la marca
- **WHEN** después de "Usar" el usuario modifica la causa raíz
- **THEN** la marca pasa a "IA (editado)" y al guardar se envía `origenIA.causaRaiz = 'IA_EDITADO'`

#### Scenario: Ishikawa editado
- **WHEN** después de "Usar" en el Ishikawa el usuario edita una causa y guarda
- **THEN** la marca pasa a "IA (editado)" y se envía `origenIA.ishikawa = 'IA_EDITADO'`

#### Scenario: Sin sugerencia aplicada
- **WHEN** el usuario guarda sin haber usado ninguna sugerencia
- **THEN** `data` no incluye `origenIA`
