# Instrucciones para Claude Code — Fix menor: el error real de conversión PDF nunca se registra en el log

Fecha: 2026-10-06
Autor: Cowork (verificado leyendo el código real)
Change sugerido: `fix-log-conversion-pdf`. Es un change pequeño y aparte de `pdf-distribucion-real`. Si ese change todavía no está archivado, puede ir como una tarea adicional dentro de él.

---

## Hallazgo

En `FirmarPublicarDocumentoHandler`, la conversión se envuelve así:

```
catch (PdfConversionException)
{
    // El detalle técnico ya quedó en el log de IDocumentoPdfConverter — ...
    throw new BusinessRuleException("No se pudo generar el PDF del documento...", "PDF_CONVERSION_FAILED");
}
```

El comentario **no es cierto**. `LibreOfficePdfConverter` no registra nada en el log cuando falla. Solo lanza `PdfConversionException`, con mensajes como "No se pudo iniciar el conversor (SofficePath=...)", "excedió el tiempo límite" o "terminó con código N + stderr", y el handler la descarta sin registrarla. El único log del converter es el `LogInformation` cuando la conversión sale bien. Resultado: cuando la conversión falla, el usuario recibe un 422 genérico y **en la consola del backend no queda ningún rastro de la causa**.

Este caso ocurrió de verdad: Toño puso `SofficePath` por error dentro de `ConnectionStrings`, así que el backend usó el valor por defecto `"soffice"`, que no está en el PATH de Windows. El diagnóstico solo fue posible leyendo el `appsettings`, porque el log no decía nada.

## Qué implementar

1. Registra el error en el punto donde se lanza la excepción o donde se captura, en **un solo lugar** para no duplicarlo:
   - Opción preferida: en el `catch (PdfConversionException ex)` del handler, con `_logger.LogError(ex, "Falló la conversión a PDF del documento {DocumentoId} ({Archivo})", documento.Id, nombreOriginal)`.
   - Corrige el comentario para que diga la verdad.
2. Haz lo mismo en cualquier otro consumidor de `IDocumentoPdfConverter`, si existe (por ejemplo, el PDF controlado).
3. **Aviso al arrancar:** confirma que existe el aviso de arranque que pedía `pdf-distribucion-real` cuando `SofficePath` no es ejecutable. Si no existe, agrégalo: un `LogWarning` al iniciar con la ruta efectiva que se está usando. Así una configuración mal puesta se detecta antes del primer intento de firma.
4. Test: un converter fake que lance `PdfConversionException` deja una entrada de log de nivel Error con el `DocumentoId`. Usa el logger de pruebas que ya use el proyecto.

## Reglas de siempre
- Corre la suite de tests del backend.
- Al terminar, Toño avisa con "listo". Cowork verifica releyendo el código real.
