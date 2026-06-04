import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const reloaded = sessionStorage.getItem("dpe_chunk_reload_attempted");
  if (!reloaded) {
    sessionStorage.setItem("dpe_chunk_reload_attempted", "1");
    window.location.reload();
  }
});

window.addEventListener("load", () => {
  sessionStorage.removeItem("dpe_chunk_reload_attempted");
});

createRoot(document.getElementById("root")!).render(<App />);
