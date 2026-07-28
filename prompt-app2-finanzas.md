# Prompt para Claude Code — App 2: finanzas personales

Actúa como arquitecto de software senior. **En este primer paso NO escribas código de la aplicación.** Tu única entrega es un plan técnico completo, discutido y aprobado conmigo antes de implementar.

### Contexto

Soy Jorge, estudiante de Ingeniería de Software en la UTP (Lima, Perú). Quiero una aplicación móvil de finanzas personales pensada para mi realidad: ingresos irregulares de estudiante, ingresos del trabajo, gastos en soles, y métodos de pago locales como Yape y Plin. Me gustaría que sea un SAS. El proyecto tiene un doble objetivo: **usarla de verdad todos los días**.

### Qué debe hacer la aplicación

- Registro rápido de ingresos y gastos, con categoría, método de pago y nota. La velocidad de registro es crítica: si anotar un gasto toma más de unos segundos, dejo de usarla. 
- Registros de gastos mediante fotos, capturas, pdf, etc.
- Cuentas o billeteras múltiples (efectivo, banco, Yape/Plin) con saldo calculado por cuenta y saldo total.
- Presupuestos mensuales por categoría, con aviso al acercarme al límite y al pasarlo.
- Metas de ahorro con monto objetivo, fecha y progreso.
- Gastos recurrentes y suscripciones (pensión UTP, ICPNA, transporte, servicios luz, agua, etc), con recordatorio antes del cobro.
- Reportes: flujo de caja mensual, gasto por categoría, tendencia en el tiempo y tasa de ahorro.
- Moneda en soles peruanos (PEN) con manejo correcto de decimales y redondeo.
- Importación de movimientos desde CSV, y exportación de mis datos.

### Puntos técnicos que quiero que trates con rigor

- **Precisión monetaria.** Nada de números en coma flotante para dinero: define el tipo de dato y la estrategia de redondeo desde el modelo.
- **Integridad contable.** Cómo se calculan los saldos (¿acumulado de movimientos o campo materializado?), cómo se manejan correcciones, transferencias entre cuentas y borrados.
- **Seguridad y privacidad.** Son mis datos financieros: autenticación, cifrado en tránsito y en reposo, qué se guarda y qué no, y bloqueo de la app. Trátalo como requisito de diseño, no como un detalle de última fase.
- **Zonas horarias y cortes de mes**, para que los reportes no bailen.

### Restricciones

- El uso principal es desde el celular.
- Presupuesto cercano a cero: prioriza servicios con capa gratuita.
- **No** quiero conexión automática con bancos: el registro es manual o por CSV.
- Idioma de la interfaz y documentación técnica: español. Código y commits : inglés.

### Lo que quiero que hagas

1. **Pregúntame primero.** Antes de planificar, hazme las preguntas que necesites para cerrar decisiones importantes (modelo de autenticación, uso individual o compartido, offline, alcance de los reportes, cómo se entregan los avisos). Máximo 8 preguntas, agrupadas y concretas. Espera mis respuestas antes de continuar.

2. **Evalúa alternativas de arquitectura.** 2 o 3 opciones reales con tabla comparativa de esfuerzo, costo, seguridad y valor para el portafolio. Da tu recomendación y defiéndela.

3. **Diseña el modelo de datos.** Entidades, relaciones, claves e índices, en diagrama y en DDL, resolviendo explícitamente los puntos de precisión monetaria e integridad contable de arriba.

4. **Define las reglas de negocio** en pseudocódigo: cálculo de saldos, evaluación de presupuestos, progreso de metas y generación de movimientos recurrentes.

5. **Especifica la capa de IA, si la hay.** Candidatos razonables: categorización automática de gastos, resumen mensual en lenguaje natural, detección de gastos inusuales. Sé escéptico: descarta lo que se resuelva mejor con reglas deterministas, y explica qué datos se envían al modelo y cuáles nunca deberían salir.

6. **Entrega un roadmap por fases**, con la Fase 1 acotada a algo desplegable y usable en 3 o 4 semanas a mi ritmo. Cada fase con criterios de aceptación verificables.

7. **Define la calidad**: estrategia de pruebas (con énfasis en los cálculos monetarios), manejo de errores, accesibilidad y respaldo/recuperación de mis datos.

### Formato de entrega

Después de que responda tus preguntas, crea estos archivos en el repositorio:

- `docs/PLAN.md` — el plan completo.
- `docs/ARCHITECTURE.md` — arquitectura, stack elegido y diagramas.
- `docs/DATA-MODEL.md` — entidades, diagrama y DDL.
- `docs/SECURITY.md` — modelo de amenazas y medidas.
- `docs/ROADMAP.md` — fases, tareas y criterios de aceptación.
- `docs/decisions/` — un ADR corto por decisión importante (contexto, opciones, decisión, consecuencias).

Sé directo y crítico. Si algo de lo que pido es mala idea, sobredimensionado para un solo desarrollador, o no me conviene para el portafolio, dímelo y propón la alternativa. Prefiero un alcance más pequeño y terminado que uno ambicioso y abandonado.

Empieza por las preguntas.
