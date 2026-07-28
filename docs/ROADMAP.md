# Roadmap

## Fase 1 — MVP (3-4 semanas, a tu ritmo)

Alcance: registro rápido offline-first, cuentas múltiples con saldo materializado, transferencias, presupuestos con alertas push, reportes básicos, import/export CSV, auth + biometría, multi-tenancy vía RLS.

Detalle de tareas: `openspec/changes/finanzas-mvp/tasks.md`.

### Criterios de aceptación

- [ ] Anotar un gasto toma ≤3 pasos desde abrir la app
- [ ] Saldos correctos en céntimos tras 100+ movimientos simulados, incluyendo transferencias
- [ ] La app funciona sin conexión y sincroniza sin duplicar movimientos al reconectar
- [ ] Un usuario no puede leer ni escribir datos de otro usuario (verificado con test de RLS)
- [ ] Un presupuesto que llega al 80% dispara exactamente una notificación push; al superar el 100%, otra
- [ ] Reporte de flujo de caja mensual y de gasto por categoría devuelven totales correctos, excluyendo transferencias
- [ ] CSV export/import funcionan de punta a punta con al menos un caso de fila inválida manejado sin corromper saldos

## Fase 2 (después de validar Fase 1 en uso real)

- Metas de ahorro (monto objetivo, fecha, progreso)
- Gastos recurrentes y suscripciones, con recordatorio antes del cobro
- Reportes de tendencia en el tiempo y tasa de ahorro

## Fase 3 (evaluar con escepticismo, solo si Fase 1-2 están sólidas)

- OCR de comprobantes (foto/PDF → monto y fecha) para acelerar el registro
- Categorización automática de gastos
- Resumen mensual en lenguaje natural
- Detección de gastos inusuales

Cada candidato de IA se evalúa contra la alternativa determinista antes de implementarse (ver `docs/decisions/` para el criterio). Qué datos se envían a un modelo y cuáles nunca deben salir se define en su propio ADR al momento de abordar esta fase.
