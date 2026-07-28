# ADR 0002: Supabase en vez de backend propio

## Contexto
Presupuesto cercano a cero, un solo desarrollador, plazo de Fase 1 de 3-4 semanas, y el proyecto también debe sumar al portafolio.

## Opciones
1. Backend propio (NestJS + Postgres) con hosting gratuito (Render/Fly.io)
2. Firebase (Auth + Firestore)
3. Supabase (Auth + Postgres + Storage + Edge Functions)

## Decisión
Opción 3, Supabase.

## Consecuencias
- Row Level Security da multi-tenancy correcto sin escribir middleware de autorización a mano.
- Sigue siendo Postgres real: no se pierde el aprendizaje relacional ni el valor de portafolio de diseñar un modelo de datos con integridad fuerte.
- Se descarta Firestore (Firebase) porque su modelo NoSQL complica la integridad contable (sin transacciones relacionales fuertes entre cuentas y movimientos).
- Se descarta backend propio para el MVP por riesgo de plazo: el valor de "armar todo desde cero" es menor que el riesgo de no terminar la Fase 1. Puede reconsiderarse en una fase posterior si el proyecto crece.
