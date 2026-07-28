# Proposal: Finanzas MVP — Fase 1

## Intent

Jorge necesita una app de finanzas personales que use a diario, pensada para su realidad (ingresos irregulares, PEN, Yape/Plin), planteada como SaaS multi-usuario. Sin un MVP acotado y desplegable, el riesgo real es abandonar el proyecto antes de tenerlo usable. Esta propuesta cubre solo la Fase 1: lo mínimo para registrar movimientos con precisión monetaria correcta y usarlo todos los días, offline-first.

## Scope

### In Scope
- Auth (Supabase Auth) + bloqueo biométrico local
- Multi-tenancy vía Postgres RLS
- Registro rápido de ingresos/gastos (categoría, método de pago, nota), offline-first (WatermelonDB)
- Cuentas múltiples (efectivo/banco/Yape/Plin) con saldo materializado por cuenta y total
- Transferencias entre cuentas
- Presupuestos mensuales por categoría con aviso (push) al acercarse/pasar el límite
- Reportes: flujo de caja mensual, gasto por categoría
- Import/export CSV

### Out of Scope (Fase 2+)
- Metas de ahorro
- Gastos recurrentes/suscripciones y recordatorios
- Reportes de tendencia en el tiempo y tasa de ahorro
- Cualquier capa de IA (OCR de comprobantes, categorización automática, resumen mensual)

## Capabilities

### New Capabilities
- `auth-and-security`: login, bloqueo biométrico, RLS multi-tenant, cifrado en tránsito/reposo
- `accounts`: cuentas/billeteras, saldo materializado, transferencias
- `transactions`: registro de movimientos, offline-first, sync
- `budgets`: presupuestos mensuales por categoría y evaluación de límites
- `reports`: flujo de caja mensual, gasto por categoría
- `csv-import-export`: importación y exportación de movimientos

### Modified Capabilities
- None (proyecto greenfield)

## Approach

React Native (Expo, TS) + Supabase (Postgres/Auth/Storage) + WatermelonDB para sync offline. Dinero en enteros (centavos), nunca float; saldos materializados mutados solo vía RPC transaccional de Postgres. RLS por `user_id = auth.uid()` en cada tabla. `occurred_at` en `timestamptz` UTC, cortes de mes calculados en el `timezone` del usuario.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `mobile/` (RN/Expo app) | New | App móvil completa |
| `supabase/migrations/` | New | Schema, RLS policies, RPC de balance |
| `supabase/functions/` | New | Evaluación de presupuestos (si aplica como edge function) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Sync offline introduce duplicados o pérdida de movimientos | Med | `client_id` idempotente + tests de integración de sync |
| Cálculo de saldo incorrecto por condición de carrera | Med | Toda mutación de balance pasa por una única RPC transaccional |
| Alcance de Fase 1 se expande y no se entrega en 3-4 semanas | Med | Scope out explícito arriba; metas/recurrentes/IA quedan fuera |

## Rollback Plan

Cada capability tiene su propia migración de Supabase versionada; si una fase falla en producción, se revierte la migración correspondiente y se remueve la feature flag/pantalla del cliente sin afectar datos ya registrados de otras capabilities.

## Dependencies

- Cuenta Supabase (capa gratuita)
- Cuenta Expo/EAS para push notifications

## Success Criteria

- [ ] Anotar un gasto toma ≤3 pasos desde abrir la app
- [ ] Saldos correctos en céntimos tras 100+ movimientos simulados, incluyendo transferencias
- [ ] La app funciona sin conexión y sincroniza sin duplicar al reconectar
- [ ] RLS verificado: un usuario no puede leer/escribir datos de otro
- [ ] Presupuesto excedido dispara push notification
