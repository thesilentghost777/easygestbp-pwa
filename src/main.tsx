import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Enregistrement PWA (requis pour SW et mise à jour)
import { registerSW } from 'virtual:pwa-register'

registerSW({
  immediate: true,
  onNeedRefresh: () => {
    // Optionnel: popup confirmation (seulement si registerType: 'prompt')
    if (confirm('Nouvelle version disponible. Recharger?')) {
      window.location.reload()
    }
  },
  onOfflineReady: () => {
    console.log('EasyGest prête pour offline!')
  },
})

createRoot(document.getElementById("root")!).render(<App />);
