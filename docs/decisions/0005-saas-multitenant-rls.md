# ADR 0005: Multi-tenancy vía Row Level Security de Postgres

## Contexto
La app se plantea como SaaS multi-usuario desde el día 1, no como app personal de un solo usuario. Los datos son financieros y sensibles.

## Opciones
1. Aislar datos por usuario en la capa de aplicación (siempre filtrar por `user_id` en cada query del backend)
2. Row Level Security de Postgres, aplicada a nivel de base de datos

## Decisión
Opción 2.

## Consecuencias
- Un bug en el código de la app (olvidar un `WHERE user_id = ...`) no puede filtrar datos entre usuarios, porque la base de datos rechaza la fila igual.
- Se trata la seguridad como requisito de diseño desde el modelo de datos (cada tabla nace con su política RLS en la misma migración que la crea), no como algo agregado después.
- Costo: hay que pensar en `auth.uid()` en cada política y probarlas explícitamente (ver tarea 4.3 en `openspec/changes/finanzas-mvp/tasks.md`), pero es menor que el riesgo de una fuga de datos financieros entre usuarios.
