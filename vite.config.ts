import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/**
 * Vite ne sert pas les fonctions serverless de `api/`. En développement, ce
 * middleware charge les fichiers de `api/` via le pipeline SSR de Vite pour
 * que `/api/donnees` et `/api/diagnostic` répondent comme en production.
 *
 * Les identifiants de la base restent côté serveur : ils ne portent pas le
 * préfixe `VITE_` et ne sont donc jamais exposés au bundle client.
 */
function apiDevPlugin(env: Record<string, string>): Plugin {
  const serverKeys = [
    "DATABASE_URL",
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD",
    "DB_SSL",
    "TDB_SESSION_SECRET",
  ];
  const endpoints: Record<string, string> = {
    "/api/donnees": "/api/donnees.ts",
    "/api/diagnostic": "/api/diagnostic.ts",
  };

  return {
    name: "api-dev",
    apply: "serve",
    configureServer(server) {
      for (const key of serverKeys) {
        if (env[key] && !process.env[key]) process.env[key] = env[key];
      }

      for (const [route, modulePath] of Object.entries(endpoints)) {
        server.middlewares.use(route, async (req, res) => {
          try {
            const mod = await server.ssrLoadModule(modulePath);
            const url = new URL(req.url ?? "/", "http://localhost");
            await mod.default(
              {
                method: req.method,
                url: req.url,
                query: Object.fromEntries(url.searchParams),
                body: req,
              },
              res,
            );
          } catch (error) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(
              JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              }),
            );
          }
        });
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    server: {
      host: "::",
      port: 8080,


      // proxy les requêtes vers le backend Django,
      // on peut utiliser la configuration suivante :
      /*proxy: {
        "/sig": {
          target: "https://localhost:8000",
          changeOrigin: true,
          secure: false,
        },
      },*/
    },
    plugins: [react(), mode === "development" && componentTagger(), mode === "development" && apiDevPlugin(env)].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
