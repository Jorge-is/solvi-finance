# ADR 0003: Saldo materializado, mutado solo vía función RPC

## Contexto
Hay que decidir cómo se calcula el saldo de una cuenta: sumando movimientos en cada consulta, o manteniendo un campo materializado.

## Opciones
1. Calcular el saldo sumando `transactions` en cada lectura
2. Campo materializado `accounts.balance`, actualizado por trigger `AFTER INSERT`
3. Campo materializado `accounts.balance`, actualizado solo por una función RPC (`apply_transaction`/`apply_transfer`), `SECURITY DEFINER`

## Decisión
Opción 3.

## Consecuencias
- Lectura de saldo es O(1), crítico para que la pantalla principal (saldo total) sea instantánea incluso con historial largo.
- Un único punto de entrada para escritura permite expresar transferencias (dos filas ligadas, una llamada) de forma atómica, algo que un trigger por fila no modela tan limpiamente.
- El cliente nunca escribe `balance` directamente — se aplica también en el cliente offline: WatermelonDB guarda el movimiento localmente, pero el saldo autoritativo solo se confirma tras pasar por la RPC en el servidor durante el sync.
- Requiere que toda corrección de movimiento pasado sea un movimiento de reversión + uno nuevo (nunca `UPDATE` destructivo), para que el balance materializado siga siendo consistente con el historial.
