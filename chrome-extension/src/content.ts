import { isRetailerProductPage } from "./lib/pdp";

const APP_ORIGIN = (
  import.meta.env.VITE_FITCHECK_APP_ORIGIN ?? "http://localhost:3000"
).replace(/\/$/, "");

const HOST_ID = "fitcheck-run-host";

function buildDashboardUrl(productHref: string): string {
  return `${APP_ORIGIN}/chat?import=${encodeURIComponent(productHref)}`;
}

function injectUi(): void {
  if (document.getElementById(HOST_ID)) return;
  if (!isRetailerProductPage(window.location.href)) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("data-fitcheck-extension", "1");
  Object.assign(host.style, {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: "2147483646",
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  } as CSSStyleDeclaration);

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 16px;
      z-index: 2147483647;
    }
    .backdrop.open { display: flex; }
    .card {
      width: min(360px, 100%);
      background: #fff;
      border-radius: 16px;
      padding: 20px 20px 16px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
    }
    .card h2 {
      margin: 0 0 8px;
      font-size: 17px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.3;
    }
    .card p {
      margin: 0 0 16px;
      font-size: 13px;
      color: #64748b;
      line-height: 1.45;
    }
    .actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      flex-wrap: wrap;
    }
    button {
      font: inherit;
      cursor: pointer;
      border: none;
      border-radius: 10px;
      padding: 10px 16px;
      font-size: 14px;
      font-weight: 600;
    }
    .btn-secondary {
      background: #f1f5f9;
      color: #334155;
    }
    .btn-secondary:hover { background: #e2e8f0; }
    .btn-primary {
      background: #2563eb;
      color: #fff;
    }
    .btn-primary:hover { background: #1d4ed8; }
    .fab {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #2563eb;
      color: #fff;
      border: none;
      border-radius: 999px;
      padding: 12px 18px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.45);
      font-family: inherit;
    }
    .fab:hover { background: #1d4ed8; }
    .fab:focus-visible {
      outline: 2px solid #93c5fd;
      outline-offset: 2px;
    }
  `;

  const fab = document.createElement("button");
  fab.type = "button";
  fab.className = "fab";
  fab.setAttribute("aria-haspopup", "dialog");
  fab.innerHTML =
    '<span aria-hidden="true">✓</span><span>Run Fit Check</span>';

  const backdrop = document.createElement("div");
  backdrop.className = "backdrop";
  backdrop.setAttribute("role", "presentation");

  const card = document.createElement("div");
  card.className = "card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-labelledby", "fitcheck-dlg-title");

  card.innerHTML = `
    <h2 id="fitcheck-dlg-title">Open in FitCheck?</h2>
    <p>We’ll add this product to your FitCheck imports in a new tab. You can sign in there if needed.</p>
    <div class="actions">
      <button type="button" class="btn-secondary" data-action="cancel">Cancel</button>
      <button type="button" class="btn-primary" data-action="confirm">Continue</button>
    </div>
  `;

  backdrop.appendChild(card);
  shadow.appendChild(style);
  shadow.appendChild(fab);
  shadow.appendChild(backdrop);

  function openModal(): void {
    backdrop.classList.add("open");
  }

  function closeModal(): void {
    backdrop.classList.remove("open");
  }

  function go(): void {
    const url = buildDashboardUrl(window.location.href);
    window.open(url, "_blank", "noopener,noreferrer");
    closeModal();
  }

  fab.addEventListener("click", () => openModal());
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
  card.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const action = t.closest("[data-action]")?.getAttribute("data-action");
    if (action === "cancel") closeModal();
    if (action === "confirm") go();
  });

  document.body.appendChild(host);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectUi);
} else {
  injectUi();
}
