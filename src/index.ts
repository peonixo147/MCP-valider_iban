// MCP server EN LIGNE + PAIEMENT x402 (Cloudflare Worker, modèle McpAgent).
// Le tool "valider_iban" est désormais PAYANT : l'agent paie en USDC par appel.
// Endpoint MCP : https://<ton-worker>.workers.dev/mcp

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withX402, type X402Config } from "agents/x402";
import { z } from "zod";

// ============================================================
//  CONFIG PAIEMENT — les 2 seules choses à régler :
// ============================================================
const X402_CONFIG: X402Config = {
  // "base-sepolia" = réseau de TEST (argent fictif, gratuit). Pour tester.
  // "base"         = réseau RÉEL (vrai USDC). À mettre quand tu es prêt.
  network: "base-sepolia",

  // 👇 REMPLACE par TON adresse de portefeuille (commence par 0x).
  //    C'est là que l'argent arrive. Voir explications sous le code.
  recipient: "0xRemplaceParTonAdresse",

  // Le "facilitateur" public de Coinbase vérifie et règle le paiement.
  // Tu n'as rien à faire ici, c'est la valeur par défaut.
  facilitator: { url: "https://x402.org/facilitator" },
};
// ============================================================

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

export class MyMCP extends McpAgent {
  // On enveloppe le serveur avec la couche de paiement.
  server = withX402(
    new McpServer({ name: "mon-premier-mcp", version: "1.0.0" }),
    X402_CONFIG
  );

  async init() {
    // paidTool = comme tool, mais payant. Signature :
    // (nom, description, prixUSD, schéma, annotations, handler)
    this.server.paidTool(
      "valider_iban",
      "Vérifie si un numéro IBAN est valide (format + checksum mod-97).",
      0.01, // prix en USD par appel
      {
        iban: z
          .string()
          .describe("Le numéro IBAN à vérifier, ex: BE68539007547034"),
      },
      {}, // annotations MCP (vide ici)
      async ({ iban }) => {
        const valide = ibanEstValide(iban);

        // Journal : 1 ligne par appel PAYÉ (visible dans Observability).
        console.log(
          JSON.stringify({
            date: new Date().toISOString(),
            tool: "valider_iban",
            entree: iban,
            statut: valide ? "valide" : "invalide",
            paye: true,
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

export default {
  fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    const { pathname } = new URL(request.url);
    if (pathname === "/") {
      return new Response(
        "MCP server en ligne (tool payant). Endpoint MCP : /mcp",
        {
          status: 200,
          headers: { "content-type": "text/plain; charset=utf-8" },
        }
      );
    }
    if (pathname === "/mcp") {
      return MyMCP.serve("/mcp").fetch(request, env as never, ctx);
    }
    if (pathname === "/sse") {
      return MyMCP.serveSSE("/sse").fetch(request, env as never, ctx);
    }
    return new Response("Not found", { status: 404 });
  },
};
