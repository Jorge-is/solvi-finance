# ADR 0001: Dinero como enteros en céntimos, nunca float

## Contexto
La app maneja saldos, presupuestos y reportes agregados en PEN. El punto flotante acumula error de redondeo en sumas repetidas, lo cual es inaceptable para saldos financieros.

## Opciones
1. `float`/`double` en toda la pila
2. `NUMERIC`/`DECIMAL` de extremo a extremo (DB y app)
3. `BIGINT` en céntimos como unidad interna, formateo a soles solo en UI

## Decisión
Opción 3: enteros en céntimos (`BIGINT`) tanto en Postgres como en el dominio de la app RN.

## Consecuencias
- Toda la aritmética de negocio es exacta y determinista.
- Requiere disciplina: nunca dividir/multiplicar por 100 fuera de la capa de formateo de UI.
- Prorrateos (si aparecen) usan banker's rounding (`ROUND_HALF_EVEN`) para no sesgar reportes agregados.
