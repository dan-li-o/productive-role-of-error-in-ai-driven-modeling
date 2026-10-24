(() => {
  // Email addresses are stored in pieces and assembled here, so the page
  // source and the repo never contain a plain address.
  document.querySelectorAll(".email-obfuscate[data-user][data-domain]").forEach((element) => {
    const address = `${element.dataset.user}@${element.dataset.domain}`;
    const link = document.createElement("a");
    link.href = `mailto:${address}`;
    link.textContent = address;
    element.replaceChildren(link);
  });

  // 404 page: show the requested path, relative to the site root (which is a
  // subfolder on github.io), in the error message.
  document.querySelectorAll("[data-missing-path]").forEach((element) => {
    const nav = document.querySelector('script[src$="site_libs/quarto-nav/quarto-nav.js"]');
    const root = nav ? new URL(nav.src).pathname.replace("site_libs/quarto-nav/quarto-nav.js", "") : "/";
    const path = window.location.pathname.startsWith(root) ? window.location.pathname.slice(root.length) : window.location.pathname;
    element.textContent = ` '${path}'`;
  });

  // Quarto puts role="menu" on the menu toggle button, which isn't a valid role there.
  document.querySelector(".navbar-toggler[role='menu']")?.removeAttribute("role");

  // Quarto's collapsible callouts toggle on a plain div; make it a keyboard-usable button.
  document.querySelectorAll(".callout-header[data-bs-toggle='collapse']").forEach((toggle) => {
    toggle.setAttribute("role", "button");
    toggle.tabIndex = 0;
    toggle.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle.click();
      }
    });
  });

  // The homepage toolbar sticks just below the header; track the header's
  // height, which changes when the phone menu opens.
  const header = document.querySelector("#quarto-header");
  if (header) {
    const syncHeaderHeight = () =>
      document.documentElement.style.setProperty("--nb-header-h", `${header.offsetHeight}px`);
    syncHeaderHeight();
    if ("ResizeObserver" in window) new ResizeObserver(syncHeaderHeight).observe(header);
  }

  // Title row: "Last updated" where Jupyter shows "Last checkpoint".
  // GitHub Pages sends Last-Modified, so this is the date of the last deploy.
  const brand = document.querySelector(".navbar-brand-container");
  let kernel = null;
  if (brand) {
    const checkpoint = document.createElement("span");
    checkpoint.className = "nb-checkpoint";
    checkpoint.textContent = `Last updated ${new Date(document.lastModified).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`;
    if (document.querySelector(".notebook")) {
      // Decorative kernel circle: filled while a cell runs.
      kernel = document.createElement("span");
      kernel.className = "nb-kernel";
      kernel.setAttribute("aria-hidden", "true");
      checkpoint.append(kernel);
    }
    brand.append(checkpoint);
  }

  const cells = [...document.querySelectorAll(".notebook-cell")];
  const codeCells = cells.filter((cell) => cell.classList.contains("code-cell"));
  const announcer = document.querySelector(".notebook-announcer");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let executionCount = 1;
  let running = 0;
  let selectedCell = null;
  let observer = null;

  if (!codeCells.length) return;

  document.documentElement.classList.add("has-notebook-js");

  const setPrompt = (cell, text) => {
    const label = cell.querySelector(".prompt-label");
    if (label) label.dataset.prompt = text;
  };

  const announce = (message) => {
    if (announcer) announcer.textContent = message;
  };

  // The run number is taken when a run starts, so cells keep their order.
  const nextCount = () => executionCount++;

  const reveal = (cell, { count = nextCount(), silent = false } = {}) => {
    cell.classList.remove("is-running");
    cell.classList.add("is-revealed");
    setPrompt(cell, `In [${count}]:`);
    const outPrompt = cell.querySelector(".output-prompt");
    if (outPrompt) outPrompt.dataset.prompt = `Out[${count}]:`;
    if (!silent) {
      const firstLine = cell.querySelector(".cell-output")?.textContent.trim().split("\n")[0] ?? "";
      announce(`Cell ${cell.dataset.cell} output: ${firstLine}`);
    }
  };

  const runCell = (cell, { replay = false, silent = false } = {}) => {
    if (cell.classList.contains("is-running")) return;
    if (cell.classList.contains("is-revealed") && !replay) return;
    observer?.unobserve(cell);

    if (reducedMotion) {
      reveal(cell, { silent });
      return;
    }

    const count = nextCount();
    cell.classList.remove("is-revealed");
    cell.classList.add("is-running");
    setPrompt(cell, "In [*]:");
    running += 1;
    kernel?.classList.add("is-busy");

    // A short pause (400–600ms) as if the cell were computing; CSS fades the output in.
    window.setTimeout(() => {
      reveal(cell, { count, silent });
      running -= 1;
      if (!running) kernel?.classList.remove("is-busy");
    }, 400 + Math.random() * 200);
  };

  const selectCell = (cell) => {
    if (selectedCell === cell) return;
    selectedCell?.classList.remove("is-selected");
    selectedCell = cell;
    cell?.classList.add("is-selected");
  };

  const focusCell = (cell) => {
    cell.focus({ preventScroll: true });
    cell.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
  };

  codeCells.forEach((cell) => {
    setPrompt(cell, "In [ ]:");
    cell.querySelector(".run-cell")?.addEventListener("click", () => runCell(cell, { replay: true }));
  });

  // Clicking or tabbing into a cell selects it (cells are focusable).
  cells.forEach((cell) => {
    cell.addEventListener("focusin", (event) => {
      selectCell(cell);
      // Tabbing onto a link in an output that hasn't run yet: show it at once,
      // so keyboard focus never lands on invisible content.
      const hidden = !cell.matches(".is-revealed, .is-running");
      if (hidden && event.target.closest(".cell-output")) {
        observer?.unobserve(cell);
        reveal(cell, { silent: true });
      }
    });
    cell.addEventListener("focusout", (event) => {
      if (!cell.contains(event.relatedTarget) && selectedCell === cell) selectCell(null);
    });
  });

  // Jupyter shortcuts, only while a cell is selected; no arrow or single-letter keys.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !selectedCell?.contains(event.target)) return;
    if (event.target.closest("a")) return;
    const isCode = selectedCell.classList.contains("code-cell");

    if (event.shiftKey) {
      // Run and advance
      event.preventDefault();
      if (isCode) runCell(selectedCell, { replay: true });
      const next = cells[cells.indexOf(selectedCell) + 1];
      if (next) focusCell(next);
    } else if (event.ctrlKey || event.metaKey) {
      // Run in place
      event.preventDefault();
      if (isCode) runCell(selectedCell, { replay: true });
    }
  });

  document.querySelector("[data-nb-run]")?.addEventListener("click", () => {
    const target = selectedCell?.classList.contains("code-cell")
      ? selectedCell
      : codeCells.find((cell) => !cell.classList.contains("is-revealed")) ?? codeCells[0];
    runCell(target, { replay: true });
    focusCell(target);
  });

  document.querySelector("[data-nb-run-all]")?.addEventListener("click", () => {
    const gap = reducedMotion ? 0 : 150;
    codeCells.forEach((cell, index) => {
      window.setTimeout(() => runCell(cell, { replay: true, silent: true }), index * gap);
    });
    // One announcement once the last cell has finished.
    window.setTimeout(
      () => announce("All cells run. Every output is now shown."),
      reducedMotion ? 0 : codeCells.length * gap + 650
    );
  });

  if (reducedMotion || !("IntersectionObserver" in window)) {
    // No animation: every output is simply shown.
    codeCells.forEach((cell) => reveal(cell, { silent: true }));
    return;
  }

  // Scrolling runs a cell once, when about 60% of it is in view (or, for a
  // cell taller than the screen, when it fills most of the screen).
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const fillsScreen = entry.intersectionRect.height >= 0.6 * window.innerHeight;
        if (entry.isIntersecting && (entry.intersectionRatio >= 0.6 || fillsScreen)) runCell(entry.target);
      });
    },
    { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] }
  );

  codeCells.forEach((cell) => observer.observe(cell));
})();
