# INSTRUCCIONES PARA CLAUDE CODE — QE: quitar el botón "+ Crear AC" duplicado del aviso de solicitudes

- **Fecha:** 2026-11-13
- **Autor:** Cowork (para Toño)
- **Origen:** Toño reportó que en la pantalla del QE aparecen dos botones para crear una AC, "+ Crear AC" y "+ Nueva AC", y pidió quitar el primero.
- **Change OpenSpec:** `qe-quitar-boton-crear-ac-duplicado`
- **Flujo:** `/opsx:sync → /opsx:propose → /opsx:apply → /opsx:archive`
- **Solo frontend + i18n.** Es un cambio chico.

---

## 1. Diagnóstico confirmado leyendo el código

`shc-controldoc/src/features/quality-events/components/QEACSection.tsx` tiene dos botones:

- **"+ Crear AC"**, dentro del aviso de solicitudes pendientes. Se agregó en `solicitudes-ac-y-ac-del-qe-en-origen`. Está en las líneas 789–799 aprox.: `onClick={() => setShowAddModal(true)}`, con la clave `detail.acSection.crearDesdeSolicitud`.
- **"+ Nueva AC"**, en el encabezado de la sección, en las líneas 819–829 aprox.: `onClick={() => setShowAddModal(true)}`, con la clave `detail.acSection.actions.add`.

Los dos abren **el mismo modal**, con la misma condición (`canAsignarAC`). Crear la AC desde cualquiera de los dos ya descuenta la solicitud pendiente en el backend (`CrearAccionCorrectivaQEHandler`). El del aviso es redundante.

**No confundir** con "Crear AC" del panel de sugerencias de la IA (`detail.investigation.ia.crearAC`). Ese botón precarga la AC con la acción sugerida, así que **se mantiene**.

---

## 2. Decisión de Toño

- Se **quita "+ Crear AC"** del aviso de solicitudes y se mantiene "+ Nueva AC" del encabezado.

---

## 3. Qué implementar (`shc-controldoc/src/`)

**a) `features/quality-events/components/QEACSection.tsx`**

- Eliminar el botón `{canAsignarAC && (<button … crearDesdeSolicitud …>)}` del aviso de solicitudes.
- En el aviso queda **solo "Descartar solicitud"**, con su condición actual (`!readOnly`).
- Para que el JCA sepa cómo atender la solicitud, el texto del aviso pasa a ser: `"{{count}} solicitud(es) de nueva AC pendientes — registradas desde el origen del QE. Créala con «Nueva AC» o descártala."`.

**b) i18n (`qualityEvents`, es-PE y en-US)**

- Eliminar `detail.acSection.crearDesdeSolicitud`.
- Actualizar `detail.acSection.solicitudesACBanner`:

  | Idioma | Texto |
  |---|---|
  | es-PE | {{count}} solicitud(es) de nueva AC pendientes — registradas desde el origen del QE. Créala con «Nueva AC» o descártala. |
  | en-US | {{count}} pending new CA request(s) — logged from the QE's origin. Create it with "New CA" or dismiss it. |

- Verificar con grep que `crearDesdeSolicitud` no quede referenciado en ningún lugar, incluidos los tests.

**c) Tests**

- Actualizar los tests de `QEACSection` que buscaban el botón del aviso.
- Con `solicitudesAC > 0`:
  - el aviso **no** contiene un botón "Crear AC";
  - sí contiene "Descartar solicitud";
  - el encabezado sigue mostrando "Nueva AC".
- Crear una AC desde "Nueva AC" con una solicitud pendiente hace que el aviso desaparezca (regresión de `solicitudes-ac-y-ac-del-qe-en-origen`).

---

## 4. Reglas de siempre

- Toda divergencia entre esta instrucción y el código real va en `design.md`, con su motivo.
- Correr la **suite completa** del frontend + `tsc --noEmit` + **`npm run lint` con cero errores**.
- No hay cambios de backend. Ctrl+F5 en el navegador.
- **Prueba manual con MSW apagado:**
  1. Abrir un QE con una solicitud de AC pendiente, como JCA. Solo aparecen "+ Nueva AC" en el encabezado y "Descartar solicitud" en el aviso, cuyo texto indica usar «Nueva AC».
  2. Crear la AC con "+ Nueva AC": el aviso desaparece.
  3. En un QE sin solicitudes, "+ Nueva AC" sigue funcionando igual.
- Toño avisa con **"listo"** para que Cowork verifique.
