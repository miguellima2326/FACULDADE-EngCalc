-- Spec 002 — tabelas do Better Auth 1.7 (core + plugin admin), schema padrão em Postgres.
-- Nomes de colunas em camelCase (padrão do Better Auth com o adaptador Kysely/pg).

create table if not exists "user" (
  "id"            text primary key,
  "name"          text not null,
  "email"         text not null unique,
  "emailVerified" boolean not null default false,
  "image"         text,
  "createdAt"     timestamptz not null default now(),
  "updatedAt"     timestamptz not null default now(),
  -- plugin admin
  "role"          text,
  "banned"        boolean default false,
  "banReason"     text,
  "banExpires"    timestamptz
);

create table if not exists "session" (
  "id"             text primary key,
  "expiresAt"      timestamptz not null,
  "token"          text not null unique,
  "createdAt"      timestamptz not null default now(),
  "updatedAt"      timestamptz not null default now(),
  "ipAddress"      text,
  "userAgent"      text,
  "userId"         text not null references "user"("id") on delete cascade,
  -- plugin admin
  "impersonatedBy" text
);
create index if not exists "session_userId_idx" on "session"("userId");

create table if not exists "account" (
  "id"                    text primary key,
  "accountId"             text not null,
  "providerId"            text not null,
  "userId"                text not null references "user"("id") on delete cascade,
  "accessToken"           text,
  "refreshToken"          text,
  "idToken"               text,
  "accessTokenExpiresAt"  timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope"                 text,
  "password"              text,
  "createdAt"             timestamptz not null default now(),
  "updatedAt"             timestamptz not null default now()
);
create index if not exists "account_userId_idx" on "account"("userId");
-- R3: uma conta Google pertence a um único usuário
create unique index if not exists "account_provider_account_uq" on "account"("providerId", "accountId");

create table if not exists "verification" (
  "id"         text primary key,
  "identifier" text not null,
  "value"      text not null,
  "expiresAt"  timestamptz not null,
  "createdAt"  timestamptz not null default now(),
  "updatedAt"  timestamptz not null default now()
);
create index if not exists "verification_identifier_idx" on "verification"("identifier");
