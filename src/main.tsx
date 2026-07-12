import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./nav-hover.css";
import "./industry.css";
import "./hydro.css";
import "./consumer.css";
import "./resource.css";
import "./oilgas.css";
import "./tollroad.css";
import "./nuclear.css";
import "./telecom.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>,
);
