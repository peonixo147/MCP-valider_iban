// MCP server EN LIGNE (Cloudflare Worker) — modèle McpAgent (officiel, fiable).
// Un seul tool gratuit : valider_iban.
// Endpoint MCP : https://<ton-worker>.workers.dev/mcp

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// --- Logique du tool : validation IBAN par checksum mod-97 (100% autonome).
function ibanEstValide(iban: string): boolean {
  const propre = iban.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(propre)) return false;
  const rearrange = propre.slice(4) + propre.slice(0, 4);
  const numerique = rearrange.replace(/[A-Z]/g, (c) =>
    String(c.charCodeAt(0) - 55)
  );
  let reste = 0;
  for (const chiffre of numerique) {
    reste = (reste * 10 + Number(chiffre)) % 97;
  }
  return reste === 1;
}

// --- Le serveur MCP, porté par un McpAgent (Durable Object par session).
export class MyMCP extends McpAgent {
  server = new McpServer({ name: "mon-premier-mcp", version: "1.0.0" });

  async init() {
    this.server.registerTool(
      "valider_iban",
      {
        title: "Valider un IBAN",
        description:
          "Vérifie si un numéro IBAN est valide (format + checksum). Renvoie valide: true/false.",
        inputSchema: {
          iban: z
            .string()
            .describe("Le numéro IBAN à vérifier, ex: BE68539007547034"),
        },
      },
      async ({ iban }) => {
        const valide = ibanEstValide(iban);

        // --- Journal : 1 ligne par appel (visible dans Observability / wrangler tail).
        //     Plus tard : remplace par un insert Supabase.
        console.log(
          JSON.stringify({
            date: new Date().toISOString(),
            tool: "valider_iban",
            entree: iban,
            statut: valide ? "valide" : "invalide",
          })
        );

        return {
          content: [
            {
              type: "text",
              text: valide
                ? `✅ L'IBAN ${iban} est valide.`
                : `❌ L'IBAN ${iban} est invalide.`,
            },
          ],
        };
      }
    );
  }
}

// --- Routage du Worker.
export default {
  fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    const { pathname } = new URL(request.url);
    if (pathname === "/") {
      return new Response("MCP server en ligne. Endpoint MCP : /mcp", {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    // Transport moderne (Streamable HTTP) :
    if (pathname === "/mcp") {
      return MyMCP.serve("/mcp").fetch(request, env as never, ctx);
    }
    // Transport SSE (clients plus anciens) :
    if (pathname === "/sse") {
      return MyMCP.serveSSE("/sse").fetch(request, env as never, ctx);
    }
    return new Response("Not found", { status: 404 });
  },
};
