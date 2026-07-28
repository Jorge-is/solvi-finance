# Seguridad y privacidad

Tratado como requisito de diseño, no como detalle de última fase (ver `openspec/changes/finanzas-mvp/specs/auth-and-security/spec.md`).

## Modelo de amenazas

| Amenaza | Impacto | Mitigación |
|---|---|---|
| Un usuario lee/escribe datos financieros de otro usuario | Alto — fuga de datos financieros sensibles | RLS en Postgres (`user_id = auth.uid()`) en toda tabla; nunca depende de filtrado en el cliente |
| Robo del dispositivo con la app desbloqueada | Alto | Bloqueo biométrico local obligatorio para reabrir la app; sesión en `expo-secure-store` (Keychain/Keystore), no en `AsyncStorage` plano |
| Intercepción de tráfico en red pública | Medio | TLS obligatorio en toda comunicación con Supabase; HTTP plano prohibido |
| Acceso a comprobantes (fotos/PDF) de otro usuario | Medio | Bucket privado en Supabase Storage con políticas equivalentes a RLS por usuario |
| Escritura directa de `accounts.balance` (bypass de integridad contable) | Alto — saldos incorrectos | Solo las funciones RPC `apply_transaction`/`apply_transfer` (`SECURITY DEFINER`) pueden mutar `balance`; no hay política RLS de `UPDATE` directo sobre esa columna desde el cliente |
| Pérdida de datos por fallo de sync silencioso | Medio | Todo movimiento offline que falle al sincronizar queda visible como "pendiente"/"fallido" en la UI, nunca se descarta silenciosamente |
| Credenciales de terceros (conexión bancaria automática) | Alto (fuera de alcance) | Explícitamente descartado por requisito del usuario — solo entrada manual o CSV |

## Autenticación

- Registro/login vía Supabase Auth (email/password o magic link)
- Sesión persistida cifrada en el keystore del sistema operativo
- Reapertura de la app protegida por biometría (Face ID / huella); si no está disponible, cae a login estándar

## Cifrado

- **En tránsito**: TLS en todas las llamadas a Supabase (API, Storage, Edge Functions)
- **En reposo**: cifrado nativo de Postgres gestionado por Supabase; `expo-secure-store` para el token de sesión en el dispositivo

## Qué se guarda y qué no

- Se guarda: movimientos, cuentas, categorías, presupuestos, comprobantes subidos por el usuario
- No se guarda: credenciales bancarias, número de tarjeta, ningún dato de conexión automática a bancos (no existe esa integración)

## Respaldo y recuperación

- Backups automáticos gestionados por Supabase (Postgres administrado)
- Exportación CSV manual del usuario como respaldo adicional bajo su propio control
