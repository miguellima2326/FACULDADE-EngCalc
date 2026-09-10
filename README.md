# EngCalc

Memória de cálculo técnica para engenharia — mecânica, computação e estruturas. Fórmulas verificadas, diagramas e verificação de norma.

## Stack

- Frontend: React 19 + Vite + TypeScript
- Backend: Node.js + TypeScript
- Pacotes: workspace compartilhado para dados e motor de cálculos

## Desenvolvimento

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

O frontend usa `http://127.0.0.1:3000` como proxy local para a API.

## Deploy

O frontend deve ser publicado na Vercel e o backend como Web Service no Render.
Configure `VITE_API_URL` na Vercel com a URL pública do serviço Render, sem barra final.
