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

  // Homepage illustration (cell 3): two spinning globes, "real weather" and an
  // AI model whose flat-map math breaks down at the south pole. The weather is
  // made-up waves, not model output; the look follows Bonev et al. 2023, Fig. 4.
  const globes = new Map();
  const GLOBE_SIZE = 200; // canvas pixels; CSS scales the canvas
  const DAYS = 10;
  const RUN_MS = 8000; // Day 0 to Day 10
  const HOLD_MS = 1500; // rest on "unstable" before looping
  const SPIN_MS = 16000; // one turn of the globe
  const FRAME_MS = 1000 / 15; // enough for a slow spin, and light on phones

  // Fixed pseudo-random waves, so every visitor sees the same weather.
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const waves = Array.from({ length: 14 }, () => {
    const z = random() * 2 - 1;
    const angle = random() * 2 * Math.PI;
    const k = 5 + random() * 4;
    const r = Math.sqrt(1 - z * z);
    return { kx: k * r * Math.cos(angle), ky: k * r * Math.sin(angle), kz: k * z, phase: random() * 2 * Math.PI, speed: (random() - 0.5) * 1.2 };
  });

  // Diverging colors like the paper's: dark violet, blue, near white, red, dark
  // red. Entries 256-511 are the same colors darkened, for the grid lines. Each
  // entry is one whole RGBA pixel, so painting is a single write.
  const stops = [[29, 17, 69], [51, 102, 176], [242, 239, 233], [208, 96, 63], [103, 0, 13]];
  const paletteBytes = new Uint8ClampedArray(512 * 4);
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * 4;
    const j = Math.min(3, Math.floor(x));
    for (let c = 0; c < 3; c++) {
      const value = stops[j][c] + (stops[j + 1][c] - stops[j][c]) * (x - j);
      paletteBytes[i * 4 + c] = value;
      paletteBytes[(i + 256) * 4 + c] = value * 0.85;
    }
    paletteBytes[i * 4 + 3] = paletteBytes[(i + 256) * 4 + 3] = 255;
  }
  const palette = new Uint32Array(paletteBytes.buffer);

  // The weather lives on a latitude/longitude grid fixed to the Earth. Each wave
  // is split into sine and cosine parts once, so a frame only re-weights them
  // as the weather drifts, with no trigonometry per frame.
  const TAU = 2 * Math.PI;
  const COLS = 128;
  const ROWS = 64;
  const CELLS = COLS * ROWS;
  const waveSin = new Float32Array(waves.length * CELLS);
  const waveCos = new Float32Array(waves.length * CELLS);
  const starPattern = new Float32Array(CELLS); // flat-math errors around the south pole
  const gridPattern = new Float32Array(CELLS); // and, near the end, everywhere
  for (let row = 0; row < ROWS; row++) {
    const lat = -Math.PI / 2 + ((row + 0.5) / ROWS) * Math.PI;
    for (let col = 0; col < COLS; col++) {
      const lon = (col / COLS) * TAU;
      const x = Math.cos(lat) * Math.cos(lon);
      const y = Math.cos(lat) * Math.sin(lon);
      const z = Math.sin(lat);
      const cell = row * COLS + col;
      waves.forEach((wave, j) => {
        const d = wave.kx * x + wave.ky * y + wave.kz * z;
        waveSin[j * CELLS + cell] = Math.sin(d);
        waveCos[j * CELLS + cell] = Math.cos(d);
      });
      starPattern[cell] = Math.exp(-(1 + z) / 0.25) * (Math.cos(8 * lon) + 0.6 * Math.cos(24 * (lat + Math.PI / 2)));
      gridPattern[cell] = 0.9 * Math.cos(16 * lon) * Math.cos(18 * lat);
    }
  }
  const truthField = new Float32Array(CELLS);
  const flatField = new Float32Array(CELLS);

  const computeFields = (day) => {
    const progress = day / DAYS;
    const star = 1.8 * progress ** 3; // grows around the south pole
    const grid = Math.max(0, (progress - 0.8) / 0.2) ** 2; // then spreads everywhere
    const damp = 1 - 0.3 * progress;
    truthField.fill(0);
    waves.forEach((wave, j) => {
      // sin(d + phase) = sin(d)·cos(phase) + cos(d)·sin(phase)
      const phase = wave.phase + wave.speed * day;
      const a = 0.3 * Math.cos(phase);
      const b = 0.3 * Math.sin(phase);
      const offset = j * CELLS;
      for (let cell = 0; cell < CELLS; cell++) truthField[cell] += a * waveSin[offset + cell] + b * waveCos[offset + cell];
    });
    for (let cell = 0; cell < CELLS; cell++) {
      flatField[cell] = damp * truthField[cell] + star * starPattern[cell] + grid * gridPattern[cell];
    }
  };

  // Each canvas pixel's place on the globe (orthographic view from 60°S, north
  // up). Spinning only shifts longitude, so latitude is fixed. Edge shading is
  // a CSS overlay.
  const tilt = -Math.PI / 3;
  const step = Math.PI / 6; // grid lines every 30°
  const line = 0.008;
  const disc = { index: [], row: [], lon: [], cosLat: [], onLat: [] };
  for (let y = 0; y < GLOBE_SIZE; y++) {
    for (let x = 0; x < GLOBE_SIZE; x++) {
      const u = ((x + 0.5) / GLOBE_SIZE) * 2 - 1;
      const v = 1 - ((y + 0.5) / GLOBE_SIZE) * 2;
      const r2 = u * u + v * v;
      if (r2 > 1) continue;
      const w = Math.sqrt(1 - r2);
      const lat = Math.asin(v * Math.cos(tilt) + w * Math.sin(tilt));
      const onLat = Math.abs(lat / step - Math.round(lat / step)) * step < line;
      disc.index.push(y * GLOBE_SIZE + x);
      disc.row.push(Math.min(ROWS - 1, Math.max(0, ((lat + Math.PI / 2) / Math.PI) * ROWS - 0.5)));
      disc.lon.push(Math.atan2(u, -v * Math.sin(tilt) + w * Math.cos(tilt)));
      disc.cosLat.push(Math.abs(lat) < 1.4 ? Math.cos(lat) : 0); // no longitude lines near the poles
      disc.onLat.push(onLat ? 256 : 0);
    }
  }

  const paintGlobe = (pixels, field, spin) => {
    for (let i = 0; i < disc.index.length; i++) {
      const lon = (((disc.lon[i] + spin) % TAU) + TAU) % TAU;
      // Bilinear lookup in the grid
      const fx = (lon / TAU) * COLS;
      const c0 = Math.floor(fx) % COLS;
      const c1 = (c0 + 1) % COLS;
      const tx = fx - Math.floor(fx);
      const r0 = Math.floor(disc.row[i]);
      const r1 = Math.min(ROWS - 1, r0 + 1);
      const ty = disc.row[i] - r0;
      const top = field[r0 * COLS + c0] * (1 - tx) + field[r0 * COLS + c1] * tx;
      const bottom = field[r1 * COLS + c0] * (1 - tx) + field[r1 * COLS + c1] * tx;
      const f = top * (1 - ty) + bottom * ty;

      const level = Math.round(((Math.max(-1, Math.min(1, f)) + 1) / 2) * 255);
      const onLon = disc.cosLat[i] && Math.abs(lon / step - Math.round(lon / step)) * step * disc.cosLat[i] < line;
      pixels[disc.index[i]] = palette[level + (onLon ? 256 : disc.onLat[i])];
    }
  };

  document.querySelectorAll(".globe-figure").forEach((figure) => {
    const views = [...figure.querySelectorAll("canvas[data-model]")].map((canvas) => {
      canvas.width = canvas.height = GLOBE_SIZE;
      const context = canvas.getContext("2d");
      const image = context.createImageData(GLOBE_SIZE, GLOBE_SIZE);
      return { context, image, pixels: new Uint32Array(image.data.buffer), model: canvas.dataset.model };
    });
    const dayLabel = figure.querySelector(".globe-day");
    const toggle = figure.querySelector(".globe-toggle");
    let elapsed = 0;
    let playing = !reducedMotion;
    let visible = !("IntersectionObserver" in window);
    let revealed = false;
    let frame = 0;
    let previous = null;
    let pending = 0;

    const render = () => {
      const t = elapsed % (RUN_MS + HOLD_MS);
      const day = Math.min(DAYS, (t / RUN_MS) * DAYS);
      const spin = (elapsed / SPIN_MS) * 2 * Math.PI;
      computeFields(day);
      views.forEach((view) => {
        paintGlobe(view.pixels, view.model === "flat" ? flatField : truthField, spin);
        view.context.putImageData(view.image, 0, 0);
      });
      const unstable = t >= RUN_MS;
      const text = unstable ? `Day ${DAYS} · unstable` : `Day ${Math.floor(day)}`;
      if (dayLabel.textContent !== text) dayLabel.textContent = text;
      dayLabel.classList.toggle("is-unstable", unstable);
    };

    const tick = (now) => {
      pending += Math.min(now - (previous ?? now), 100);
      previous = now;
      if (pending >= FRAME_MS) {
        elapsed += pending;
        pending = 0;
        render();
      }
      frame = requestAnimationFrame(tick);
    };

    // Animate only while the cell has run, the figure is on screen and not paused.
    const update = () => {
      const run = playing && visible && revealed;
      if (run && !frame) frame = requestAnimationFrame(tick);
      if (!run && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
        previous = null;
      }
    };

    const setPlaying = (value) => {
      playing = value;
      toggle.textContent = playing ? "Pause" : "Play";
      toggle.setAttribute("aria-label", playing ? "Pause animation" : "Play animation");
      update();
    };

    toggle.addEventListener("click", () => setPlaying(!playing));
    if (!visible) {
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        update();
      }).observe(figure);
    }

    globes.set(figure, {
      // Running the cell starts the forecast again from Day 0; with reduced
      // motion it shows the breakdown as a still frame.
      restart: () => {
        revealed = true;
        elapsed = playing ? 0 : RUN_MS;
        render();
        update();
      },
    });
    setPlaying(playing);
    render();
  });

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
    cell.querySelectorAll(".globe-figure").forEach((figure) => globes.get(figure)?.restart());
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
