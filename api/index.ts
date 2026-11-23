// Função serverless da Vercel — toda requisição /api/* chega aqui (ver rewrite em vercel.json)
// e é tratada pelo mesmo roteador usado localmente.
import { handle } from "../apps/backend/dist/app.js";

export default handle;
