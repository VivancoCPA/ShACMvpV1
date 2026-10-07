## 1. i18n

- [x] 1.1 Agregar `semaforo.hoy`, `semaforo.enDias_one`/`semaforo.enDias_other`, `semaforo.haceDias_one`/`semaforo.haceDias_other` en `i18n/es-PE.json` y `i18n/en-US.json` (namespace `documents`)
- [x] 1.2 Eliminar la clave huérfana `semaforo.diasRestantes` en ambos idiomas (solo la usaba el tooltip que se quita)

## 2. RevisionSemaforo.tsx

- [x] 2.1 Formatear siempre la fecha con `formatCalendarDate` y mostrarla junto al indicador en los 4 estados (verde/ámbar/rojo-próximo/rojo-vencido)
- [x] 2.2 Mostrar el texto relativo visible (sin hover) en ámbar y rojo: `semaforo.hoy` si `diasRestantes === 0`, `semaforo.enDias` (con `count`) si `diasRestantes >= 1`, `semaforo.haceDias` (con `count: Math.abs(diasRestantes)`) si `diasRestantes < 0`
- [x] 2.3 Quitar los tooltips (`role="tooltip"`, `aria-describedby`, `useId`) — el texto visible los reemplaza
- [x] 2.4 Layout en dos líneas (fecha / relativo) manteniendo el punto de color a la izquierda; verde solo con la fecha

## 3. Confirmar DocumentDetailHeader

- [x] 3.1 Confirmar (ya hecho en design.md D4) que `DocumentDetailHeader.tsx` no necesita cambios — ya muestra la fecha de "Próx. revisión" con `formatCalendarDateMedium` en su grid, independiente del badge

## 4. Tests

- [x] 4.1 `RevisionSemaforo.test.tsx`: la fecha aparece siempre en los 4 estados y también sin fecha (dash, sin fecha ni texto)
- [x] 4.2 Textos "en N días" (singular y plural), "hace N días" (singular y plural) y "hoy" en sus estados correspondientes
- [x] 4.3 Caso UTC-5 (ya existe uno en el archivo, de `fix-fechas-utc`) extendido o nuevo para confirmar que la fecha visible y el texto relativo no se corren un día
- [x] 4.4 Quitar/actualizar cualquier assertion existente basada en el tooltip (`role="tooltip"`, `semaforo.diasRestantes`)

## 5. Verificación

- [x] 5.1 Suite completa: 175 archivos, 1362/1363 (único fallo preexistente `JefeCalidadDashboard.test.tsx`, ya verificado); `tsc` solo con el error preexistente de `IncidentForm.tsx:377`, sin relación
- [x] 5.2 Prueba manual con MSW apagado contra backend real (empresa de prueba propia, sesión aislada): creé 4 documentos con `fechaRevisionProxima` en 45+/13/3/-10 días. Verificado visualmente en la lista: verde "15 nov 2026" solo fecha; ámbar "13 oct 2026 · en 13 días"; rojo próximo "3 oct 2026 Próximo · en 3 días"; vencido "20 set 2026 Vencido · hace 10 días"; sin fecha "—". Columna sin romper layout
- [ ] 5.3 Avisar a Toño ("listo"); Cowork verifica releyendo el código real
