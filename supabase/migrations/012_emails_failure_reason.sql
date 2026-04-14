-- Migration: 012_emails_failure_reason
-- Adds failure_reason column to emails table for Edge Function error reporting.
-- The send-emails Edge Function populates this when status transitions to 'failed'.

alter table public.emails
  add column if not exists failure_reason text;
