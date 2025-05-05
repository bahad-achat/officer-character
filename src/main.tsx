import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.tsx"
import "./index.css"
import { initializeTypst } from "./typst"
import { registerSW } from "virtual:pwa-register"

import "@fortawesome/fontawesome-free/css/all.css"
import "@mantine/core/styles.css"
import "@mantine/dropzone/styles.css"
import "@mantine/notifications/styles.css"
import "@mantine/dates/styles.css"
import "@mantine/tiptap/styles.css"
import "leaflet/dist/leaflet.css"
import { getLocalStorage, setLocalStorage } from "./hooks.ts"
import { Settings } from "./pages/SettingsPage.tsx"
import { OCDocuments } from "./models.ts"

const performMigrations = () => {
  const settings = getLocalStorage<Settings>("Settings")
  let dirty = false
  const signature = getLocalStorage<string>("Signature", "")
  const signatureExtension = getLocalStorage<string>("Signature Extension", "")
  if (signature !== "") {
    settings.signature = signature
    dirty = true
  }
  if (signatureExtension !== "") {
    settings.signatureExtension = signatureExtension
    dirty = true
  }

  if (dirty) {
    setLocalStorage("Settings", settings)
    localStorage.removeItem("Signature")
    localStorage.removeItem("Signature Extension")
  }

  dirty = false
  const documents = getLocalStorage<OCDocuments>("Documents")
  for (const documentName in documents) {
    if (typeof documents[documentName].to === "string") {
      documents[documentName].to = [documents[documentName].to]
      dirty = true
    }
  }

  if (dirty) {
    setLocalStorage("Documents", documents)
  }
}

performMigrations()
initializeTypst()
const UPDATE_INTERVAL_MS = 60 * 60 * 1000

registerSW({
  onRegistered(r) {
    r &&
      setInterval(() => {
        r.update()
      }, UPDATE_INTERVAL_MS)
  },
})

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
