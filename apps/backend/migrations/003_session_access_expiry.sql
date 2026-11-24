-- Spec 002 R10–R12: expiração do acesso (6 h) separada da sessão (6 h + 1 h de janela de restauração).
alter table "session" add column if not exists "accessExpiresAt" timestamptz;
