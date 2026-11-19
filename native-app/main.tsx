import { createRoot } from "react-dom/client";

import "@/app/globals.css";
import "./app-shell.css";

import { installApiBridge } from "./api-bridge";
import { App } from "./App";

installApiBridge();
createRoot(document.getElementById("app")!).render(<App />);
