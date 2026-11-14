## 1. Componente

- [x] 1.1 `QEACSection.tsx`: eliminar el botón "Crear AC" (`crearDesdeSolicitud`) del aviso de solicitudes; dejar solo "Descartar solicitud" con `!readOnly`

## 2. i18n

- [x] 2.1 es-PE y en-US: eliminar `detail.acSection.crearDesdeSolicitud`
- [x] 2.2 es-PE y en-US: actualizar `detail.acSection.solicitudesACBanner` con el texto que remite a «Nueva AC»
- [x] 2.3 Verificar con grep que `crearDesdeSolicitud` no quede referenciado (código y tests)

## 3. Tests

- [x] 3.1 `QEACSection.test.tsx`: con `solicitudesAC > 0`, el aviso no contiene "Crear AC", sí "Descartar solicitud", y el encabezado muestra "Nueva AC"
- [x] 3.2 Crear una AC desde "Nueva AC" con una solicitud pendiente hace desaparecer el aviso al refrescar el QE
- [x] 3.3 `readOnly`: el aviso se muestra sin acciones

## 4. Verificación

- [x] 4.1 Suite completa del frontend, `tsc --noEmit` y `npm run lint` sin errores
