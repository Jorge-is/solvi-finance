# Arquitectura

## Stack elegido

- **Cliente móvil**: React Native (Expo, TypeScript)
- **Persistencia local / offline**: WatermelonDB (SQLite) con protocolo de sync propio (`pullChanges`/`pushChanges`)
- **Backend**: Supabase — Postgres (datos), Auth (autenticación), Storage (fotos/PDFs de comprobantes), Edge Functions (sync endpoint, evaluación de presupuestos)
- **Notificaciones**: Expo Push Service
- **Multi-tenancy**: Row Level Security de Postgres (`user_id = auth.uid()`)

## Alternativas evaluadas

| Opción | Esfuerzo | Costo | Seguridad | Valor portafolio | Veredicto |
|---|---|---|---|---|---|
| **RN/Expo + Supabase** | Medio | Capa gratuita cubre el MVP | RLS de Postgres, multi-tenancy real, auth gestionada | Alto — Postgres/RLS/sync offline son temas fuertes en entrevistas | **Elegida** |
| Flutter + Firebase | Medio-alto | Gratis | Firestore (NoSQL) complica integridad contable — sin transacciones relacionales fuertes | Medio | Descartada — el modelo de datos financiero necesita relacional con integridad fuerte |
| RN + backend propio (NestJS + Postgres) | Alto | Gratis, pero hosting propio con cold starts (Render/Fly.io free tier) | Control total, pero hay que reimplementar auth y equivalente de RLS a mano | Muy alto, pero riesgo de no llegar a Fase 1 en 3-4 semanas | Descartada por riesgo de plazo — ver ADR 0002 |

## Por qué Supabase y no backend propio

El riesgo real no es la arquitectura, es terminar la Fase 1. RLS da multi-tenancy correcto sin escribir middleware de autorización a mano, y sigue siendo Postgres real — no se pierde el aprendizaje relacional. Detalle completo en `docs/decisions/0002-supabase-vs-backend-propio.md`.

## Flujo de datos

```
RN App (WatermelonDB, SQLite local)
    │  crear movimiento (funciona offline)
    ▼
Cola de sync (idempotencia por client_id)
    │  al reconectar
    ▼
Supabase Edge Function (endpoint de sync)
    │  llama al RPC
    ▼
apply_transaction() [Postgres, SECURITY DEFINER, transacción única]
    │  INSERT en transactions + UPDATE de accounts.balance
    ▼
Tablas protegidas por RLS (transactions, accounts, budgets, ...)
```

## Componentes del backend

| Componente | Responsabilidad |
|---|---|
| `supabase/migrations/` | Schema, políticas RLS, funciones RPC (`apply_transaction`, `apply_transfer`) |
| `supabase/functions/sync/` | Implementa el protocolo de sync de WatermelonDB |
| `supabase/functions/evaluate-budgets/` | Job programado: evalúa umbrales de presupuesto (80%/100%) y dispara push |

## Componentes del cliente

| Componente | Responsabilidad |
|---|---|
| `mobile/src/lib/supabase.ts` | Cliente Supabase + manejo de sesión (secure storage) |
| `mobile/src/models/` | Modelos WatermelonDB (Account, Transaction, Category, Budget) |
| `mobile/src/sync/` | Adaptador de sync WatermelonDB ↔ Edge Function |
| `mobile/src/screens/` | Auth, Quick Entry, Accounts, Budgets, Reports |
