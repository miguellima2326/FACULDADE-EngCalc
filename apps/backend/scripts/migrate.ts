/**
 * Aplica as migrações SQL de apps/backend/migrations em ordem, uma única vez cada.
 * Usa a conexão DIRETA (DATABASE_URL_UNPOOLED), como recomenda o Neon para migrações.
 *
 *   npm run db:migrate            (lê .env.local / .env da raiz)
 *   npm run db:seed-admin         (cria/promove os e-mails de ADMIN_EMAILS a admin)
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import pg from "pg";

const root = fileURLToPath(new URL("../../../", import.meta.url));
for (const name of [".env.local", ".env"]) if (existsSync(root + name)) process.loadEnvFile(root + name);

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL_UNPOOLED não configurada");
const client = new pg.Client({ connectionString: url.replace(/sslmode=(require|prefer|verify-ca)/, "sslmode=verify-full") });

async function migrate() {
  await client.query(`create table if not exists "_migrations" ("name" text primary key, "appliedAt" timestamptz not null default now())`);
  const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const { rows } = await client.query<{ name: string }>(`select "name" from "_migrations"`);
  const done = new Set(rows.map((r) => r.name));
  for (const file of files) {
    if (done.has(file)) { console.log(`= ${file} (já aplicada)`); continue; }
    await client.query("begin");
    try {
      await client.query(readFileSync(dir + file, "utf8"));
      await client.query(`insert into "_migrations"("name") values ($1)`, [file]);
      await client.query("commit");
      console.log(`✓ ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
}

/** R4 — primeiro(s) admin(s) vêm de ADMIN_EMAILS (ninguém pode se cadastrar sozinho). */
async function seedAdmins() {
  const emails = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!emails.length) { console.log("ADMIN_EMAILS vazio — nada a fazer"); return; }
  for (const email of emails) {
    const r = await client.query(
      `insert into "user"("id","name","email","emailVerified","role","createdAt","updatedAt")
       values ($1, $2, $3, false, 'admin', now(), now())
       on conflict ("email") do update set "role" = 'admin', "updatedAt" = now()
       returning (xmax = 0) as inserted`,
      [randomUUID(), email.split("@")[0], email],
    );
    console.log(`${r.rows[0].inserted ? "✓ criado" : "✓ promovido"} admin: ${email}`);
  }
}

await client.connect();
try {
  if (process.argv.includes("--seed-admin")) await seedAdmins();
  else await migrate();
} finally {
  await client.end();
}
