-- Spec 002, história 6 — histórico de cálculos por usuário.
create table if not exists "calc_history" (
  "id"           bigint generated always as identity primary key,
  "userId"       text not null references "user"("id") on delete cascade,
  "areaKey"      text not null,
  "calcId"       text not null,
  "calcName"     text not null,
  "inputSummary" text not null default '',
  "resultStr"    text not null default '',
  "vals"         jsonb not null default '{}'::jsonb,
  "createdAt"    timestamptz not null default now()
);
create index if not exists "calc_history_user_created_idx" on "calc_history"("userId", "createdAt" desc);
