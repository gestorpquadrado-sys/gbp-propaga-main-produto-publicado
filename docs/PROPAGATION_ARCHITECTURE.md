# Architecture Plan: Real Propagation Verification

## Goal
Provide a reliable way to confirm that each company listing was actually propagated
to each directory, not just "sent". The system should track status transitions,
support scheduled verification, and expose results to the panel UI.

## Current Baseline (MVP)
- Sync sends data to directories via n8n and returns a per-channel result.
- UI marks "Enviado" based on that response, stored in localStorage.
- No real verification of propagation.

## Target Status Model
Each directory per company should move through a small state machine:

- pending (no attempt yet)
- sent (request/email delivered or accepted)
- verified (listing confirmed live)
- failed (explicit failure or rejection)
- stale (was verified, but currently missing)

These states should be stored in the database, not just localStorage.

## Data Model (Supabase)
Suggested tables:

1) directory_submissions
   - id (uuid)
   - company_external_id (text)
   - directory_code (text)
   - sync_id (text)
   - status (text: pending/sent/verified/failed/stale)
   - last_sent_at (timestamptz)
   - last_verified_at (timestamptz)
   - last_result (jsonb)
   - created_at, updated_at

2) directory_verification_runs
   - id (uuid)
   - started_at (timestamptz)
   - finished_at (timestamptz)
   - status (text: running/success/error)
   - metadata (jsonb)

3) directory_verification_results
   - id (uuid)
   - run_id (uuid, fk)
   - company_external_id (text)
   - directory_code (text)
   - status (text: verified/failed/stale)
   - evidence (jsonb)  // e.g. url, match_score, response payload
   - checked_at (timestamptz)

## Where Status Updates Happen

1) After Sync (sent)
- Trigger: response from n8n sync
- Action: upsert into directory_submissions with status "sent"
- Store payload for audit in last_result

2) Verification (verified/failed/stale)
- Trigger: scheduled job or manual "Reverificar" button
- Action: run verification pipeline and update directory_submissions

## Verification Pipeline (n8n)
Use a single n8n workflow to verify listings across directories.

Inputs:
- company_external_id
- directory_code list (optional, default all active)

Steps:
1) Fetch company data (name, phone, address) from database.
2) For each directory_code, run a directory-specific check:
   - API check if available (ideal)
   - Search endpoint / HTML check (fallback)
   - Email inbox status (for email-only directories)
3) Return result with evidence and confidence.

Outputs:
- results: [{ directory_code, status, evidence, checked_at }]

## Directory-Specific Check Strategies
Maintain a registry of strategies by directory_code:

- api_check: uses official APIs
- search_check: search endpoint + fuzzy match
- manual_check: no automated verification (keep "sent")

Each strategy returns:
- status: verified / failed / stale
- evidence: url, response payload, match score

## Orchestration Options

Option A: n8n only
- Cron node triggers verification runs
- Supabase nodes update tables
- Webhook for manual re-verify from UI

Option B: Supabase Edge Function + n8n
- Edge function enqueues verification tasks
- n8n processes tasks
- Edge function exposes a simple API to the UI

## UI Updates

Directory Panel:
- Read from directory_submissions table
- Display: Sent, Verified, Failed, Stale
- Show "Last verified at"
- Add button "Reverificar" to trigger verification webhook

## Incremental Delivery Plan

Phase 1 (DB persistence)
- Create directory_submissions table
- On sync success, upsert status to "sent"
- Panel reads from table instead of localStorage

Phase 2 (verification pipeline)
- Build n8n verification workflow with 2-3 directories
- Store verification results
- UI shows verified vs sent

Phase 3 (coverage)
- Add more directories
- Add alerting and scheduled re-checks

## Open Questions
- Which directories have APIs vs require scraping?
- Acceptable rate limits and re-check frequency?
- Should manual checks be tracked (human verified)?

## Suggested First Concrete Implementation

1) Add Supabase table directory_submissions
2) Update sync-service/n8n to upsert "sent" status
3) Update DirectoryPanel to read from table and show "sent"
4) Add a single n8n verification workflow for one directory as a proof-of-concept
5) Add UI button to trigger verification webhook
