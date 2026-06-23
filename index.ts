// MCP server EN LIGNE (Cloudflare Worker), sans état.
// Un seul tool gratuit : valider_iban.
// Endpoint MCP : https://<ton-worker>.workers.dev/mcp

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
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

// --- On crée le serveur MCP et on enregistre le tool.
const server = new McpServer({ name: "mon-premier-mcp", version: "1.0.0" });

server.registerTool(
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

    // --- Le "journal" : 1 ligne par appel, visible avec `wrangler tail`
    //     ou dans les logs du dashboard Cloudflare.
    //     Plus tard : remplace ce console.log par un insert Supabase.
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

// --- createMcpHandler transforme le serveur en handler HTTP (route /mcp).
const handler = createMcpHandler(server);

export default {
  async fetch(
    request: Request,
    env: unknown,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      return new Response(
        "MCP server en ligne. Endpoint MCP : /mcp",
        { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } }
      );
    }
    return handler(request, env, ctx);
  },
};
