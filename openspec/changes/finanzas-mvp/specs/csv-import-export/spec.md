# CSV Import/Export Specification

## Purpose

Manual bulk import of movements from CSV and export of the user's own data, with no automatic bank connections.

## Requirements

### Requirement: CSV Export
The system MUST allow a user to export all of their own movements to a CSV file including date, type, account, category, payment method, amount (in soles, formatted from centavos), and note.

#### Scenario: Export all movements
- GIVEN a user has 50 movements across multiple accounts
- WHEN they request a CSV export
- THEN the system MUST generate a CSV containing exactly those 50 movements with correctly formatted PEN amounts (e.g., 1235 centavos exported as "12.35")

### Requirement: CSV Import
The system MUST allow a user to import movements from a CSV file matching the export format, validating each row before persisting.

#### Scenario: Valid import
- GIVEN a CSV file with 10 well-formed movement rows referencing an existing account and category
- WHEN the user imports it
- THEN the system MUST create 10 movements and update the affected account balances atomically

#### Scenario: Invalid row rejected without blocking valid rows
- GIVEN a CSV file where row 5 has a non-numeric amount
- WHEN the user imports it
- THEN the system MUST import the valid rows and report row 5 as failed with a specific reason, without corrupting account balances

### Requirement: No Automatic Bank Connection
The system MUST NOT connect automatically to any bank or payment provider API to fetch movements; all data entry MUST be manual or via explicit CSV import.

#### Scenario: No background bank sync exists
- GIVEN the app is running
- WHEN reviewing available data sources
- THEN the only ways to add movements MUST be manual entry or CSV import — no bank credential linking flow MUST exist
