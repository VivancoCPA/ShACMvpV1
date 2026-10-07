## ADDED Requirements

### Requirement: IDocumentoPdfConverter
El sistema SHALL definir una interfaz `IDocumentoPdfConverter` con `Task<byte[]> ConvertirAsync(Stream original, string nombreArchivo, CancellationToken ct)`, e implementarla con `LibreOfficePdfConverter`, que invoca el ejecutable `soffice` en modo headless (`--headless --convert-to pdf --outdir <tmp> <archivo>`) para convertir un archivo `.docx` o `.xlsx` a PDF. Los handlers SHALL depender solo de la interfaz, nunca de la implementación concreta.

#### Scenario: Conversión exitosa de un .docx
- **WHEN** se llama `ConvertirAsync` con el stream de un `.docx` válido
- **THEN** el método retorna los bytes de un PDF válido con al menos una página

#### Scenario: Conversión exitosa de un .xlsx
- **WHEN** se llama `ConvertirAsync` con el stream de un `.xlsx` válido
- **THEN** el método retorna los bytes de un PDF válido con al menos una página

### Requirement: Configuración de conversión
El sistema SHALL leer la configuración del conversor desde la sección `PdfConversion` de `appsettings` (`SofficePath`, `TimeoutSeconds`, `MaxConcurrentConversions`) vía `IOptions<PdfConversionOptions>`. `SofficePath` SHALL tener un valor por defecto de `"soffice"` (resuelto desde el PATH del sistema) cuando no está configurado explícitamente. `appsettings.Development.json.example` SHALL documentar el valor típico de una instalación de LibreOffice en Windows.

#### Scenario: Configuración ausente usa el valor por defecto
- **WHEN** la sección `PdfConversion:SofficePath` no está presente en la configuración
- **THEN** el conversor intenta ejecutar `soffice` resuelto desde el PATH del sistema

### Requirement: Aislamiento de perfil y directorio temporal por conversión
Cada conversión SHALL ejecutarse en un directorio temporal único, con un perfil de usuario de LibreOffice aislado (`-env:UserInstallation=file:///<tmp>/lo-profile`), para que conversiones simultáneas o una instancia de LibreOffice abierta en la misma máquina no interfieran entre sí. El directorio temporal SHALL eliminarse siempre al finalizar la conversión (éxito, error o timeout), en un bloque `finally`.

#### Scenario: Dos conversiones simultáneas no fallan
- **WHEN** se invocan dos conversiones en paralelo sobre archivos distintos
- **THEN** ambas completan exitosamente, cada una con su propio perfil de LibreOffice aislado

#### Scenario: El directorio temporal se limpia incluso si la conversión falla
- **WHEN** una conversión falla o excede el timeout
- **THEN** el directorio temporal creado para esa conversión ya no existe después de que `ConvertirAsync` retorna o lanza la excepción

### Requirement: Límite de concurrencia
El sistema SHALL limitar el número de conversiones ejecutándose simultáneamente a `MaxConcurrentConversions` mediante un `SemaphoreSlim` compartido a nivel de servicio. Una conversión que no puede adquirir el semáforo de inmediato SHALL esperar en cola, no fallar.

#### Scenario: Conversiones por encima del límite esperan en cola
- **WHEN** se invocan más conversiones simultáneas que `MaxConcurrentConversions`
- **THEN** las conversiones adicionales esperan hasta que se libera un slot, y todas completan exitosamente (ninguna falla por el límite)

### Requirement: Timeout con terminación de proceso
El sistema SHALL aplicar un timeout de `TimeoutSeconds` a cada conversión. Si el proceso `soffice` no termina dentro de ese tiempo, el sistema SHALL terminarlo (`Process.Kill` con el árbol de procesos) y lanzar una excepción propia (`PdfConversionException`) con un mensaje claro.

#### Scenario: Timeout mata el proceso y lanza una excepción clara
- **WHEN** el proceso `soffice` no termina dentro de `TimeoutSeconds`
- **THEN** el sistema termina el proceso y `ConvertirAsync` lanza `PdfConversionException` con un mensaje que identifica el timeout como causa

### Requirement: Manejo de fallos de conversión
El sistema SHALL lanzar `PdfConversionException` cuando: el ejecutable configurado en `SofficePath` no existe o no puede ejecutarse; el proceso `soffice` termina con código de salida distinto de 0; o el archivo PDF esperado no aparece en el directorio de salida tras la ejecución. El sistema SHALL usar `ProcessStartInfo` con `ArgumentList` (nunca concatenación de strings en una shell, ni `UseShellExecute = true`) para invocar `soffice`, de forma que el nombre del archivo del usuario nunca se interprete como argumentos de shell.

#### Scenario: Ejecutable inexistente lanza una excepción clara
- **WHEN** `SofficePath` apunta a una ruta que no existe
- **THEN** `ConvertirAsync` lanza `PdfConversionException` con un mensaje que identifica el problema, sin intentar ejecutar el proceso

#### Scenario: Código de salida distinto de cero lanza una excepción clara
- **WHEN** el proceso `soffice` termina con código de salida distinto de 0
- **THEN** `ConvertirAsync` lanza `PdfConversionException`, sin retornar bytes parciales

### Requirement: Registro de duración y tamaño del resultado
El sistema SHALL registrar en el log la duración de cada conversión exitosa y el tamaño en bytes del PDF resultante.

#### Scenario: Conversión exitosa deja un log con duración y tamaño
- **WHEN** una conversión completa exitosamente
- **THEN** el log registra la duración de la conversión y el tamaño en bytes del PDF resultante

### Requirement: Aviso de arranque si el ejecutable no es válido
Al iniciar la aplicación, el sistema SHALL verificar si `SofficePath` es una ruta de archivo existente cuando no es simplemente `"soffice"` (ruta relativa al PATH), y SHALL registrar una advertencia en el log si no lo es. Esta verificación SHALL NOT impedir el arranque de la aplicación.

#### Scenario: Ruta de soffice inválida en appsettings no impide el arranque
- **WHEN** `PdfConversion:SofficePath` apunta a una ruta de archivo que no existe
- **THEN** la aplicación arranca normalmente y el log registra una advertencia sobre la ruta inválida
