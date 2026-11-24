-- Spec 011 — registro de atividades administrativas.
create table if not exists "audit_log" (
  "id"          bigint generated always as identity primary key,
  "actorId"     text,
  "actorEmail"  text not null,
  "action"      text not null,
  "targetEmail" text,
  "details"     jsonb not null default '{}'::jsonb,
  "createdAt"   timestamptz not null default now()
);
create index if not exists "audit_log_created_idx" on "audit_log"("createdAt" desc);
