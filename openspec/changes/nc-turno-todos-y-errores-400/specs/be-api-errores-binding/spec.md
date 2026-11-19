## ADDED Requirements

### Requirement: Errores de binding y deserialización responden 400
El sistema SHALL responder **400 Bad Request**, con el formato `ApiResponse.Fail` (`success: false`, `message`), cuando un endpoint de la API no puede enlazar la solicitud: JSON mal formado, valor de enum desconocido, tipo o formato incorrecto en el body (`JsonException`), o un parámetro de query string/ruta/header que no se puede convertir (`BadHttpRequestException`). El sistema MUST NOT responder 500 en estos casos. El `message` SHALL nombrar el campo o parámetro que falló cuando se conoce (p.ej. `"Valor inválido en el campo 'turno'."`), derivado de `JsonException.Path` (`$.turno` → `turno`) o del nombre del parámetro, y MUST NOT incluir el stack trace ni el texto técnico de la excepción. El detalle técnico SHALL registrarse en el log con nivel Warning (error del cliente), no Error. El comportamiento SHALL ser el mismo en todos los entornos (Development y Production).

#### Scenario: Valor de enum desconocido en el body
- **WHEN** un cliente envía `POST /api/nonconformities` con `"turno": "XYZ"`
- **THEN** el sistema responde 400 con `success: false` y un `message` que menciona `turno`, nunca 500

#### Scenario: JSON mal formado
- **WHEN** un cliente envía a cualquier endpoint con body JSON un contenido que no es JSON válido
- **THEN** el sistema responde 400 con `success: false` y un `message` de solicitud inválida, sin texto técnico de la excepción

#### Scenario: Parámetro de query string con formato inválido
- **WHEN** un cliente envía `GET /api/nonconformities?estado=XYZ`
- **THEN** el sistema responde 400 con un `message` que menciona `estado`, nunca 500

#### Scenario: GUID inválido en la ruta
- **WHEN** un cliente envía `GET /api/nonconformities/abc` (ruta con restricción `{id:guid}`)
- **THEN** el sistema responde 404 (la restricción de ruta no coincide), nunca 500
