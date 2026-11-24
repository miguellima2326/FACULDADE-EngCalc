-- Spec 007 — projetos (obras) e seus cálculos salvos.
create table if not exists "project" (
  "id"          bigint generated always as identity primary key,
  "userId"      text not null references "user"("id") on delete cascade,
  "name"        text not null,
  "client"      text not null default '',
  "description" text not null default '',
  "shareToken"  text unique,
  "createdAt"   timestamptz not null default now(),
  "updatedAt"   timestamptz not null default now()
);
create index if not exists "project_user_idx" on "project"("userId", "updatedAt" desc);

create table if not exists "project_item" (
  "id"        bigint generated always as identity primary key,
  "projectId" bigint not null references "project"("id") on delete cascade,
  "areaKey"   text not null,
  "calcId"    text not null,
  "calcName"  text not null,
  "vals"      jsonb not null default '{}'::jsonb,
  "inputs"    jsonb not null default '[]'::jsonb,
  "report"    text not null default '',
  "createdAt" timestamptz not null default now()
);
create index if not exists "project_item_project_idx" on "project_item"("projectId", "createdAt");
