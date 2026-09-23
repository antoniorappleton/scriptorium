// Botão discreto para instalar a PWA — só aparece quando a instalação é
// mesmo possível, sem popups automáticos.
// - Android/Chrome/Edge: aguarda o evento nativo `beforeinstallprompt`,
//   revela o botão e, ao clicar, dispara o diálogo nativo do sistema.
// - iOS Safari: não suporta `beforeinstallprompt`, por isso o botão fica
//   sempre visível (se ainda não instalada) e, ao clicar, mostra um pequeno
//   balão com as instruções manuais ("Partilhar" → "Adicionar ao Ecrã Principal").
(function () {
  let deferredPrompt = null;

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent || "");
  }

  function createButton() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "pwaInstallBtn";
    btn.title = "Instalar aplicação no dispositivo";
    btn.innerHTML = "📲 Instalar";
    return btn;
  }

  function showIosTooltip(anchorBtn) {
    const existing = document.getElementById("pwaIosTooltip");
    if (existing) {
      existing.remove();
      return;
    }
    const tip = document.createElement("div");
    tip.id = "pwaIosTooltip";
    tip.style.cssText =
      "position:absolute;z-index:9999;max-width:230px;background:var(--surface);" +
      "border:1px solid var(--surface-border);border-radius:var(--radius-md);" +
      "box-shadow:var(--shadow-lg);padding:10px 12px;font-size:12px;" +
      "color:var(--text-main);line-height:1.4;";
    tip.textContent =
      'Toque em "Partilhar" e depois em "Adicionar ao Ecrã Principal".';

    const rect = anchorBtn.getBoundingClientRect();
    tip.style.top = window.scrollY + rect.bottom + 6 + "px";
    tip.style.right =
      document.documentElement.clientWidth - (window.scrollX + rect.right) + "px";

    document.body.appendChild(tip);

    const closeOnOutsideClick = (e) => {
      if (!tip.contains(e.target) && e.target !== anchorBtn) {
        tip.remove();
        document.removeEventListener("click", closeOnOutsideClick);
      }
    };
    setTimeout(() => document.addEventListener("click", closeOnOutsideClick), 0);
  }

  function attachButton() {
    if (isStandalone()) return; // já instalada
    if (document.getElementById("pwaInstallBtn")) return;

    const btn = createButton();
    const navMenu = document.querySelector("nav.nav-menu");

    if (navMenu) {
      const signOutBtn = document.getElementById("signOutBtn");
      if (signOutBtn) {
        navMenu.insertBefore(btn, signOutBtn);
      } else {
        navMenu.appendChild(btn);
      }
    } else {
      // Páginas sem header/nav (ex: login.html) — botão discreto num canto.
      btn.style.cssText =
        "position:fixed;right:16px;bottom:16px;z-index:9998;" +
        "background:var(--surface);border:1px solid var(--surface-border);" +
        "color:var(--text-muted);font-size:12px;padding:8px 12px;" +
        "border-radius:var(--radius-md);box-shadow:var(--shadow-sm);cursor:pointer;";
      document.body.appendChild(btn);
    }

    btn.addEventListener("click", async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (choice?.outcome === "accepted") btn.remove();
        return;
      }
      if (isIos()) {
        showIosTooltip(btn);
      }
    });
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    attachButton();
  });

  window.addEventListener("appinstalled", () => {
    const btn = document.getElementById("pwaInstallBtn");
    if (btn) btn.remove();
    const tip = document.getElementById("pwaIosTooltip");
    if (tip) tip.remove();
  });

  document.addEventListener("DOMContentLoaded", () => {
    if (isIos() && !isStandalone()) attachButton();
  });
})();
