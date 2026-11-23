import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Desenvolvimento local: carrega variáveis da raiz do monorepo (.env.local tem prioridade).
// Na Vercel as variáveis vêm do painel — este arquivo não é usado lá.
for (const name of [".env.local", ".env"]) {
  const file = fileURLToPath(new URL(`../../../${name}`, import.meta.url));
  if (existsSync(file)) process.loadEnvFile(file);
}

const { handle } = await import("./app.js");
const port = Number(process.env.PORT || 3000);
createServer(handle).listen(port, "0.0.0.0", () => console.log(`EngCalc API em http://0.0.0.0:${port}`));
