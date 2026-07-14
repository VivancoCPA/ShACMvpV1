## 1. Schema y validación de contraseña compartida

- [x] 1.1 Extraer `passwordField` de `features/auth/schemas/resetPassword.schema.ts` a un export reutilizable (sin cambiar `resetPasswordSchema` ni sus mensajes)
- [x] 1.2 Crear `features/auth/schemas/changePassword.schema.ts` con `changePasswordSchema` (`currentPassword`, `newPassword` reutilizando `passwordField`, `confirmPassword` con `.refine` de coincidencia)

## 2. API y mock de cambio de contraseña

- [x] 2.1 Agregar `changePassword(data: { currentPassword: string; newPassword: string }): Promise<void>` a `features/auth/api/auth.api.ts` (`POST /api/auth/change-password`)
- [x] 2.2 Agregar handler `POST /api/auth/change-password` en `mocks/handlers/auth.handlers.ts`: extraer `userId` del header `Authorization: Bearer mock-access-token-<userId>-<timestamp>` (regex análoga a `readRefreshUserId`), validar `currentPassword` contra `authFixtures`, responder 401 con mensaje descriptivo si no coincide, y mutar `user.password` en memoria si es correcto
- [x] 2.3 Crear hook `useChangePassword()` en `features/auth/hooks/useChangePassword.ts` (TanStack `useMutation`, toast de éxito/error vía Sonner, sin `navigate`)

## 3. i18n

- [x] 3.1 Registrar namespace `users` en `i18n/index.ts` (arreglo `ns`)
- [x] 3.2 Agregar claves de `/perfil` (títulos de sección, labels de campos de solo lectura, botón "Guardar contraseña", mensaje de error de contraseña actual incorrecta) en `i18n/es-PE.json` y `i18n/en-US.json` bajo el namespace `users`
- [x] 3.3 Verificar que los mensajes de validación del formulario reutilicen las claves existentes `auth:validation.password*` (sin duplicarlas en `users`)

## 4. Página de perfil

- [x] 4.1 Crear `features/users/pages/ProfilePage.tsx` con sección de solo lectura: `UserAvatar` tamaño `lg`, nombre completo, email, badge de rol (`ROLE_BG_CLASSES`), área propia
- [x] 4.2 Agregar fila de `areasAsignadas[]` como lista de tags, renderizada solo cuando `rol === 'SUPERVISOR'` y el arreglo no está vacío
- [x] 4.3 Agregar formulario de cambio de contraseña (React Hook Form + `changePasswordSchema` + `useChangePassword`) con los 3 campos y errores de validación localizados
- [x] 4.4 Verificar Light/Dark mode sin defectos visuales y accesibilidad (labels asociados a inputs, `aria-label` en botones sin texto)

## 5. Ruteo y navegación

- [x] 5.1 Agregar ruta `/perfil` en `router/index.tsx` como hija directa de `AppShell`, junto a `/dev/semaforo-preview`, sin `RoleGuard requiredRoles` adicional
- [x] 5.2 Actualizar el botón "Mi perfil" en `components/layout/TopNav.tsx` para navegar a `/perfil` (además de cerrar el dropdown) usando `useNavigate`
- [x] 5.3 Confirmar que `/perfil` no se agrega a `components/layout/Sidebar.tsx`

## 6. Tests

- [x] 6.1 Test unitario de `ProfilePage`: renderiza datos de solo lectura para un usuario no-SUPERVISOR (sin fila de áreas asignadas)
- [x] 6.2 Test unitario de `ProfilePage`: un SUPERVISOR ve `areasAsignadas` como lista de tags
- [x] 6.3 Test del formulario de cambio de contraseña: contraseña actual incorrecta muestra error y no muta el mock
- [x] 6.4 Test del formulario de cambio de contraseña: flujo exitoso permite login posterior con la nueva contraseña dentro de la misma sesión
- [x] 6.5 Test de `RoleGuard`/routing: los 7 roles acceden a `/perfil` sin redirigir a `/no-autorizado`; un usuario no autenticado es redirigido a `/login`

## 7. Fechas de cuenta (createdAt / lastLogin)

- [x] 7.1 Agregar `createdAt: string` (obligatorio) y `lastLogin?: string` (opcional) a `MockUser` (`auth.fixtures.ts`) y a `User` (`types/auth.types.ts`); sembrar `createdAt` variado para los 11 usuarios
- [x] 7.2 Actualizar el handler `POST /api/auth/login` en `mocks/handlers/auth.handlers.ts` para mutar `user.lastLogin` a la fecha/hora actual (ISO 8601) en cada login exitoso antes de retornar el usuario
- [x] 7.3 Agregar helper de formato fecha+hora localizado en `utils/date.utils.ts` (reutilizando `Intl.DateTimeFormat`) para la fila "Último acceso"
- [x] 7.4 Agregar claves `profile.readOnlySection.createdAt` y `profile.readOnlySection.lastLogin` en `i18n/es-PE.json` y `i18n/en-US.json` (namespace `users`)
- [x] 7.5 Actualizar `ProfilePage.tsx`: fila "Cuenta creada" siempre visible (formateada), fila "Último acceso" visible solo si `lastLogin` está definido
- [x] 7.6 Tests: `ProfilePage` muestra `createdAt` formateado siempre; muestra `lastLogin` formateado cuando está definido; omite la fila de último acceso cuando `lastLogin` es `undefined`
- [x] 7.7 Test de `auth.handlers`: login exitoso actualiza `lastLogin` del usuario correspondiente en `authFixtures` y lo incluye en la respuesta
