# Mon premier MCP server — version EN LIGNE (Cloudflare)

Le même tool `valider_iban`, mais hébergé sur internet pour que de vrais agents
puissent l'appeler. Sans état, donc pas de base « Durable Objects » : un simple Worker.

---

## Ce qu'il te faut

- Node.js 18+
- Un compte **Cloudflare gratuit** (https://dash.cloudflare.com/sign-up)

L'offre gratuite couvre très largement ce projet. Tu ne paies rien pour démarrer.

---

## Déploiement en 4 commandes

```bash
cd mon-mcp-cloud
npm install
npx wrangler login      # ouvre le navigateur, tu autorises une fois
npm run deploy          # déploie
```

À la fin, Wrangler t'affiche une URL du type :

```
https://mon-premier-mcp.<ton-sous-domaine>.workers.dev
```

Ton **endpoint MCP**, c'est cette URL + `/mcp` :

```
https://mon-premier-mcp.<ton-sous-domaine>.workers.dev/mcp
```

C'est l'adresse que tu donnes aux agents.

---

## Tester que ça marche (3 options)

**Option A — la plus rapide : l'AI Playground de Cloudflare**
Va sur le « AI Playground » de Cloudflare, colle ton URL `/mcp`, clique Connect,
puis « List Tools ». Tu dois voir `valider_iban`.

**Option B — l'inspecteur officiel MCP**
```bash
npx @modelcontextprotocol/inspector
```
Ça ouvre un outil local. Mets le transport sur « Streamable HTTP », colle ton URL
`/mcp`, Connect → List Tools → teste `valider_iban` avec `BE68539007547034`.

**Option C — depuis Claude Desktop** (via un petit proxy)
Dans `claude_desktop_config.json` :
```json
{
  "mcpServers": {
    "mon-premier-mcp": {
      "command": "npx",
      "args": ["mcp-remote", "https://mon-premier-mcp.<ton-sous-domaine>.workers.dev/mcp"]
    }
  }
}
```
Redémarre Claude Desktop, puis demande : « Vérifie si l'IBAN BE68539007547034 est valide. »

---

## Voir les transactions (ton « suivi »)

Le code écrit une ligne à chaque appel (date, tool, entrée, statut). Pour les voir
en direct :

```bash
npm run tail        # = wrangler tail, affiche les logs en temps réel
```

Tu les retrouves aussi dans le dashboard Cloudflare (l'observabilité est activée
dans `wrangler.jsonc`).

Plus tard : remplace le `console.log(...)` dans `src/index.ts` par un insert dans
une table Supabase, et tu auras un vrai historique consultable.

---

## Modifier le serveur

Change le code dans `src/index.ts`, puis relance `npm run deploy`. C'est tout.
Pour ajouter un paiement (x402 ou Stripe MPP), c'est ici qu'on viendra greffer la
porte de paiement devant le tool — quand tu seras prêt.

---

## Fichiers

- `src/index.ts` — le serveur + le tool (c'est là que tu travailles)
- `wrangler.jsonc` — la config Cloudflare
- `package.json` — dépendances et scripts (`deploy`, `dev`, `tail`)
