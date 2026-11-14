## ADDED Requirements

### Requirement: Mensaje de lista vacía de candidatos orientado por rol
Cuando la lista de candidatos a responsable para el tipo elegido viene vacía, `QEACSection` SHALL mostrar "No hay usuarios activos que puedan ser responsables de este tipo de acción." seguido de "Revisa la configuración en Usuarios → Responsables de acciones correctivas." si el usuario es ADMINISTRADOR_EMPRESA, o de "Consulta al administrador de tu empresa." para cualquier otro rol.

#### Scenario: Lista vacía para el JCA
- **WHEN** un JEFE_CALIDAD_SYST elige un tipo sin candidatos
- **THEN** el formulario muestra el mensaje de lista vacía y "Consulta al administrador de tu empresa."

#### Scenario: Lista vacía para el ADMINISTRADOR_EMPRESA
- **WHEN** un ADMINISTRADOR_EMPRESA ve el formulario con un tipo sin candidatos
- **THEN** el mensaje incluye "Revisa la configuración en Usuarios → Responsables de acciones correctivas."
