# Transactions Specification

## Purpose

Fast, offline-first recording of income and expense movements with category, payment method, and note.

## Requirements

### Requirement: Fast Movement Entry
The system MUST allow recording an income or expense movement in 3 steps or fewer from opening the app, capturing amount, type, account, category, payment method, and an optional note.

#### Scenario: Record an expense
- GIVEN an authenticated user with at least one account and category
- WHEN they enter amount 1550 centavos, type `expense`, account "Efectivo", category "Comida"
- THEN the system MUST create the movement and update the account's materialized balance

### Requirement: Monetary Precision
All monetary amounts MUST be stored and computed as integers in PEN centavos. Floating-point arithmetic MUST NOT be used for any monetary calculation.

#### Scenario: Amount stored without rounding error
- GIVEN a user enters S/ 12.35
- WHEN the movement is persisted
- THEN the stored value MUST be exactly 1235 centavos, not a floating-point approximation

### Requirement: Offline Creation
The system MUST allow creating a movement while the device has no network connection, queuing it for sync, using a client-generated idempotency key.

#### Scenario: Movement created offline
- GIVEN the device has no connectivity
- WHEN the user records an expense
- THEN the system MUST save it locally with a `client_id` and mark it as pending sync, and it MUST remain visible in the UI as "pending"

### Requirement: Sync Without Duplication
When connectivity is restored, the system MUST sync pending offline movements to the backend exactly once per `client_id`, even if the sync is retried.

#### Scenario: Sync succeeds on reconnect
- GIVEN a movement was created offline with `client_id = "abc123"`
- WHEN connectivity returns and sync runs
- THEN the system MUST create exactly one server-side movement for `client_id = "abc123"`, even if the sync request is sent twice

#### Scenario: Sync failure is visible, not silent
- GIVEN a pending movement fails to sync (e.g., server error)
- WHEN the failure occurs
- THEN the system MUST keep the movement marked as "pending"/"failed" in the UI, and MUST NOT delete or silently drop it

### Requirement: Timezone-Correct Timestamps
Movement timestamps MUST be stored in UTC (`timestamptz`) and MUST be interpreted in the user's configured timezone (default `America/Lima`) when determining which calendar month/day they belong to for reports and budgets.

#### Scenario: Late-night movement assigned to correct local day
- GIVEN a user in `America/Lima` (UTC-5) records a movement at 11:30 PM local time on the 31st
- WHEN the movement's month is computed for a monthly report
- THEN it MUST be attributed to the 31st in the user's local timezone, not to the next UTC day
