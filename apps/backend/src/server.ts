import { createServer } from "node:http";
import { calculate, DATA } from "@engcalc/core";

const json = (response: import("node:http").ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type",
  });
  response.end(JSON.stringify(body));
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://localhost");
  if (request.method === "OPTIONS") return json(response, 204, {});
  if (request.method === "GET" && url.pathname === "/api/health") return json(response, 200, { status: "ok" });
  if (request.method === "GET" && url.pathname === "/api/catalog") {
    const catalog = Object.entries(DATA).map(([id, area]) => ({ id, label: area.label, icon: area.icon, calculations: area.calcs.map((item: any) => ({ ...item, calc: undefined })) }));
    return json(response, 200, catalog);
  }
  const match = url.pathname.match(/^\/api\/calculations\/([^/]+)\/([^/]+)$/);
  if (request.method === "POST" && match) {
    try {
      const areaKey = match[1];
      const calculationId = match[2];
      if (!areaKey || !calculationId) return json(response, 404, { error: "Cálculo não encontrado" });
      let raw = "";
      for await (const chunk of request) raw += chunk;
      const body = JSON.parse(raw) as { values?: Record<string, number | string> };
      if (!body.values) return json(response, 400, { error: "values é obrigatório" });
      const result = calculate(areaKey, calculationId, body.values);
      return json(response, 200, { calculationId, result: { value: result.val, unit: result.unit ?? "", multi: result.multi ?? false } });
    } catch (error) {
      return json(response, 422, { error: error instanceof Error ? error.message : "Erro no cálculo" });
    }
  }
  return json(response, 404, { error: "Rota não encontrada" });
});

const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () => console.log(`EngCalc API em http://0.0.0.0:${port}`));
