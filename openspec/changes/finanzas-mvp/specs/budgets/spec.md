# Budgets Specification

## Purpose

Monthly per-category spending limits with proactive alerts as the user approaches or exceeds them.

## Requirements

### Requirement: Budget Definition
The system MUST allow a user to define a monthly budget limit (in PEN centavos) for a specific category.

#### Scenario: Create a monthly budget
- GIVEN an authenticated user with category "Comida"
- WHEN they set a budget of 60000 centavos for "Comida" for the current month
- THEN the system MUST persist the budget scoped to that user, category, and month

### Requirement: Budget Evaluation Against Spending
The system MUST compute a category's spent amount for a given month as the sum of expense movements in that category within that user's local-timezone month boundaries.

#### Scenario: Spent amount reflects local month boundary
- GIVEN a budget for "Comida" of 60000 centavos in July
- WHEN expenses of 10000 and 15000 centavos are recorded within July in the user's local timezone
- THEN the system MUST report 25000 centavos spent against that budget

### Requirement: Approaching-Limit Alert
The system MUST send a push notification when spending in a budgeted category reaches 80% or more of the budget limit, at most once per budget per month.

#### Scenario: 80% threshold crossed
- GIVEN a budget of 60000 centavos with 47000 already spent
- WHEN a new expense of 1000 centavos brings the total to 48000 (80%)
- THEN the system MUST send exactly one "approaching limit" push notification for that budget that month

### Requirement: Limit-Exceeded Alert
The system MUST send a push notification when spending in a budgeted category exceeds 100% of the limit, at most once per budget per month.

#### Scenario: Limit exceeded
- GIVEN a budget of 60000 centavos with 59000 already spent
- WHEN a new expense of 2000 centavos brings the total to 61000 (over limit)
- THEN the system MUST send exactly one "limit exceeded" push notification for that budget that month

#### Scenario: No duplicate alerts for further overspending
- GIVEN the limit-exceeded alert already fired for a budget this month
- WHEN additional expenses are recorded in the same category and month
- THEN the system MUST NOT send another "limit exceeded" notification for that same budget/month
