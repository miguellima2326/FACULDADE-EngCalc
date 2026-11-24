import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        // repassa o host original (a API compara Origin × host na defesa CSRF — spec 012 S3)
        configure: (proxy) => proxy.on("proxyReq", (proxyReq, req) => { if (req.headers.host) proxyReq.setHeader("x-forwarded-host", req.headers.host); }),
      },
    },
  },
});
