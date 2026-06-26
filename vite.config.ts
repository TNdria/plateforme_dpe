import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
<<<<<<< HEAD
=======

    // proxy les requêtes vers le backend Django,
    // on peut utiliser la configuration suivante :
    /*proxy: {
      "/sig": {
        target: "https://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
    },*/
>>>>>>> f4c6f350 (Refonte du SIG : amélioration des déplacements, des API et de l'interface)
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
