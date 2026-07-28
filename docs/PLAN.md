# Plan — Finanzas (App 2)

## Contexto

App móvil de finanzas personales para Jorge (estudiante UTP, Lima), pensada para ingresos irregulares, PEN, y métodos de pago locales (Yape, Plin). Planteada como SaaS multi-usuario desde el día 1, con doble objetivo: uso diario real + valor de portafolio.

## Decisiones cerradas

| Tema | Decisión |
|---|---|
| Alcance de usuarios | SaaS real, multi-tenant desde el día 1 |
| Offline | Offline-first — el registro de movimientos nunca debe depender de tener señal |
| Plataforma móvil | React Native + Expo (TypeScript) |
| Backend | Supabase (Postgres + Auth + Storage), Row Level Security para multi-tenancy |
| Notificaciones | Push notifications nativas (Expo Push) |
| IA | Fuera de Fase 1 — se evalúa después de validar el core con uso real |
| Auth móvil | Login (Supabase Auth) + bloqueo biométrico local, con sesión en secure storage |
| Reportes MVP | Flujo de caja mensual + gasto por categoría (tendencia y tasa de ahorro quedan para Fase 2) |

Ver el detalle y las alternativas descartadas en `docs/decisions/`.

## Documentos del plan

- `docs/ARCHITECTURE.md` — stack, comparación de alternativas, diagrama de flujo de datos
- `docs/DATA-MODEL.md` — entidades, relaciones, DDL completo
- `docs/SECURITY.md` — modelo de amenazas y medidas
- `docs/ROADMAP.md` — fases y criterios de aceptación
- `docs/decisions/` — ADRs

## Artefactos SDD (fuente de este plan)

Este plan fue producido siguiendo el flujo SDD (Spec-Driven Development), con artefactos versionados en:
- `openspec/changes/finanzas-mvp/proposal.md`
- `openspec/changes/finanzas-mvp/specs/` (6 capabilities: auth-and-security, accounts, transactions, budgets, reports, csv-import-export)
- `openspec/changes/finanzas-mvp/design.md`
- `openspec/changes/finanzas-mvp/tasks.md`

## Próximo paso

Este documento y sus anexos son el **plan a aprobar**. No se ha escrito código de la aplicación todavía. Una vez aprobado, la implementación de Fase 1 se ejecuta tarea por tarea desde `openspec/changes/finanzas-mvp/tasks.md` (fases sdd-apply / sdd-verify).
