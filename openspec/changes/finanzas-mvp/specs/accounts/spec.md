# Accounts Specification

## Purpose

Multiple wallets/accounts (efectivo, banco, Yape, Plin) with materialized balances and transfers between them.

## Requirements

### Requirement: Account Creation
The system MUST allow a user to create an account with a name, type (efectivo/banco/yape/plin), and starting balance in PEN centavos.

#### Scenario: Create a new account
- GIVEN an authenticated user
- WHEN they create an account named "Yape" of type `yape` with starting balance 0
- THEN the system MUST persist the account with `balance = 0` centavos, owned by that user

### Requirement: Materialized Balance
Each account MUST store a `balance` field in integer centavos that is updated only as part of the same atomic transaction that inserts a related movement, never written directly by the client.

#### Scenario: Balance updates on new transaction
- GIVEN an account with balance 500000 centavos (S/ 5,000.00)
- WHEN a new expense of 2500 centavos is recorded against it
- THEN the account balance MUST become 497500 centavos, updated in the same transaction as the movement insert

#### Scenario: Direct balance write rejected
- GIVEN an authenticated user
- WHEN they attempt to update an account's `balance` field directly (not via the movement RPC)
- THEN the system MUST reject the write

### Requirement: Total Balance
The system MUST compute the total balance across all of a user's accounts as the sum of each account's materialized balance.

#### Scenario: Total balance reflects all accounts
- GIVEN a user has three accounts with balances 100000, 50000, and -2000 centavos
- WHEN the total balance is requested
- THEN the system MUST return 148000 centavos

### Requirement: Transfers Between Accounts
The system MUST support transfers between two of the user's own accounts as a single atomic operation producing a linked debit and credit movement.

#### Scenario: Successful transfer
- GIVEN accounts A (balance 100000) and B (balance 0), both owned by the same user
- WHEN the user transfers 20000 centavos from A to B
- THEN the system MUST create two linked movements (debit on A, credit on B) sharing a `transfer_id`, and A's balance becomes 80000 while B's becomes 20000, atomically

#### Scenario: Transfer fails if accounts belong to different users
- GIVEN account A owned by user 1 and account B owned by user 2
- WHEN user 1 attempts to transfer from A to B
- THEN the system MUST reject the operation

### Requirement: Account Correction Without Data Loss
Correcting a past movement MUST NOT destructively overwrite the original record; it MUST be implemented as a reversal movement plus a new corrected movement, preserving full history.

#### Scenario: User corrects a mis-entered amount
- GIVEN a movement of -5000 centavos was recorded by mistake (should have been -500)
- WHEN the user corrects it
- THEN the system MUST insert a reversal of +5000 and a new movement of -500, leaving the original movement intact in history, and the account balance MUST reflect the net effect (-500)
