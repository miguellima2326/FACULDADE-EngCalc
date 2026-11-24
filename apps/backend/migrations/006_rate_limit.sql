-- Spec 012 S5 — rate limit do Better Auth persistido no banco (funciona entre instâncias serverless).
create table if not exists "rateLimit" (
  "id"          text primary key default gen_random_uuid()::text,
  "key"         text not null unique,
  "count"       integer not null,
  "lastRequest" bigint not null
);
