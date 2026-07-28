# Auth and Security Specification

## Purpose

Login, multi-tenant data isolation, and local app lock for a SaaS personal finance app.

## Requirements

### Requirement: User Registration and Login
The system MUST authenticate users via Supabase Auth (email/password or magic link) before granting access to any financial data.

#### Scenario: Successful login
- GIVEN a registered user with valid credentials
- WHEN they submit email and password (or request a magic link and follow it)
- THEN the system issues a session token and grants access to their own data only

#### Scenario: Invalid credentials
- GIVEN a user submits an incorrect password
- WHEN the login request is processed
- THEN the system MUST reject access and show a generic error without revealing whether the email exists

### Requirement: Multi-Tenant Data Isolation
The system MUST enforce data isolation between users using Postgres Row Level Security on every table containing user data.

#### Scenario: User cannot read another user's data
- GIVEN two users A and B each with their own accounts and transactions
- WHEN user A queries their transactions via the API
- THEN the system MUST return only user A's rows, never user B's, regardless of client-side filtering

#### Scenario: User cannot write to another user's data
- GIVEN user A is authenticated
- WHEN user A attempts to insert or update a row with `user_id` belonging to user B
- THEN the database MUST reject the write via RLS policy

### Requirement: Local Biometric Lock
The system MUST allow the user to unlock the app on a trusted device using biometric authentication (Face ID / fingerprint) after an initial login, without re-entering credentials.

#### Scenario: Biometric unlock succeeds
- GIVEN a user has logged in previously and enabled biometric lock
- WHEN they open the app and biometric authentication succeeds
- THEN the system MUST restore the existing session and grant access

#### Scenario: Biometric unavailable or fails
- GIVEN biometric authentication is not available or fails
- WHEN the user attempts to unlock the app
- THEN the system MUST fall back to requiring standard login credentials

### Requirement: Session Storage
The session token MUST be stored in the device's secure storage (Keychain/Keystore), never in plain text or unencrypted local storage.

#### Scenario: Session persists across app restarts
- GIVEN a user has an active session stored in secure storage
- WHEN the app is closed and reopened
- THEN the system MUST restore the session without requiring full re-login, subject to biometric unlock

### Requirement: Data Encryption
The system MUST encrypt data in transit (TLS) and rely on the backend provider's encryption at rest for all stored financial data and uploaded files.

#### Scenario: API calls use TLS
- GIVEN the mobile app communicates with Supabase
- WHEN any request is made
- THEN it MUST occur over HTTPS; plaintext HTTP MUST NOT be used

### Requirement: Private File Storage
Uploaded receipt photos/PDFs MUST be stored in a private bucket accessible only to the owning user, following the same RLS-equivalent isolation as database rows.

#### Scenario: User cannot access another user's uploaded file
- GIVEN user B uploaded a receipt photo
- WHEN user A requests the file URL directly
- THEN the system MUST deny access
