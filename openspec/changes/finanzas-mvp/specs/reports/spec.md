# Reports Specification

## Purpose

Monthly cash flow and per-category spending reports, computed in the user's local timezone.

## Requirements

### Requirement: Monthly Cash Flow Report
The system MUST compute, for a given calendar month in the user's local timezone, total income, total expenses, and net cash flow (income minus expenses), in PEN centavos.

#### Scenario: Cash flow for a month with income and expenses
- GIVEN a user recorded income of 150000 centavos and expenses totaling 90000 centavos in July (local time)
- WHEN the July cash flow report is requested
- THEN the system MUST return income = 150000, expenses = 90000, net = 60000

#### Scenario: Month with no movements
- GIVEN a user has no movements in a given month
- WHEN the report for that month is requested
- THEN the system MUST return income = 0, expenses = 0, net = 0, not an error

### Requirement: Spending by Category Report
The system MUST compute, for a given month, the total expense amount grouped by category, sorted by amount descending.

#### Scenario: Category breakdown
- GIVEN expenses of 30000 in "Comida" and 15000 in "Transporte" within the same month
- WHEN the category report is requested for that month
- THEN the system MUST return "Comida": 30000 before "Transporte": 15000

### Requirement: Transfers Excluded from Reports
Account-to-account transfers MUST NOT be counted as income or expense in cash flow or category reports.

#### Scenario: Transfer does not inflate cash flow
- GIVEN a user transfers 20000 centavos between two of their own accounts
- WHEN the monthly cash flow report is requested
- THEN the transfer amount MUST NOT appear in income or expense totals
