# ADR 0004: Offline-first con WatermelonDB

## Contexto
El registro de gastos es el flujo más usado de la app y debe funcionar aunque no haya señal (microbuses, sótanos, zonas sin cobertura en Lima) — si depende de la red, el requisito de "anotar en segundos" se rompe.

## Opciones
1. La app requiere conexión para registrar movimientos
2. Cola de sync manual construida a mano (REST + reintentos propios)
3. WatermelonDB (SQLite local + protocolo de sync `pullChanges`/`pushChanges`)

## Decisión
Opción 3.

## Consecuencias
- WatermelonDB ya resuelve ordering, batching y reintento parcial de sync — reimplementarlo a mano es riesgo innecesario para un MVP solo de 3-4 semanas.
- Cada movimiento offline lleva un `client_id` generado en el dispositivo, usado como clave de idempotencia (`unique(user_id, client_id)` en `transactions`) para que un reintento de sync nunca duplique un movimiento.
- El saldo (`balance`) nunca se sincroniza directamente: solo se sincronizan movimientos, y el saldo se recalcula siempre server-side vía la RPC (ver ADR 0003).
- Conflictos son poco probables en este dominio (un usuario registra desde un dispositivo a la vez); se resuelven por `updated_at` cuando aparecen.
