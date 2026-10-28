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

  // 404 page: show the requested path, relative to the site root (read from a
  // script's address, so it works at a domain root or in a subfolder), in the
  // error message.
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
    // Quarto labels every one "Toggle callout"; let the visible title name it.
    toggle.removeAttribute("aria-label");
    toggle.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle.click();
      }
    });
  });

  // Track the header's height, which changes when the phone menu opens, so
  // cells scrolled into view clear the sticky header.
  const header = document.querySelector("#quarto-header");
  if (header) {
    const syncHeaderHeight = () =>
      document.documentElement.style.setProperty("--nb-header-h", `${header.offsetHeight}px`);
    syncHeaderHeight();
    if ("ResizeObserver" in window) new ResizeObserver(syncHeaderHeight).observe(header);

    // Reading progress: a thin line along the header's bottom edge.
    const progress = Object.assign(document.createElement("div"), { className: "nb-progress" });
    progress.setAttribute("aria-hidden", "true");
    header.append(progress);
    let progressQueued = false;
    const updateProgress = () => {
      progressQueued = false;
      const range = document.documentElement.scrollHeight - window.innerHeight;
      progress.hidden = range < 1;
      progress.style.transform = `scaleX(${range < 1 ? 0 : Math.min(1, window.scrollY / range)})`;
    };
    const queueProgress = () => {
      if (progressQueued) return;
      progressQueued = true;
      requestAnimationFrame(updateProgress);
    };
    window.addEventListener("scroll", queueProgress, { passive: true });
    window.addEventListener("resize", queueProgress);
    if ("ResizeObserver" in window) new ResizeObserver(queueProgress).observe(document.body);
    updateProgress();
  }

  // Title row, as in Jupyter: "Last checkpoint" beside the title, and on the
  // right, where Jupyter names the kernel, the funder and the project's years.
  // checkpoint.lua writes the render date into each page.
  const FUNDER = "Alfred P. Sloan Foundation";
  const FUNDER_URL = "https://sloan.org/";
  const YEARS = "2026–2028";
  const brand = document.querySelector(".navbar-brand-container");
  let kernel = null;
  if (brand) {
    const checkpoint = document.querySelector(".nb-checkpoint[hidden]");
    if (checkpoint) {
      checkpoint.hidden = false;
      brand.append(checkpoint);
    }
    const label = Object.assign(document.createElement("span"), { className: "visually-hidden", textContent: "Funded by " });
    // Decorative kernel circle: filled while a cell runs. It stays on the
    // years' line when a phone wraps the funder line.
    kernel = Object.assign(document.createElement("span"), { className: "nb-kernel-dot" });
    kernel.setAttribute("aria-hidden", "true");
    const years = Object.assign(document.createElement("span"), { className: "nb-kernel-years", textContent: YEARS });
    years.append(kernel);
    const funder = Object.assign(document.createElement("span"), { className: "nb-kernel" });
    // The funder's name links to its site, styled as plain text until hovered.
    const sloan = Object.assign(document.createElement("a"), { className: "nb-kernel-link", href: FUNDER_URL, textContent: FUNDER });
    funder.append(label, sloan, " · ", years);
    brand.append(funder);
  }

  // Homepage headline: types "…does is work", backspaces "work" and types
  // "fail." over the real sentence (see notebook.scss for the layout).
  // index.qmd's header script sets .hero-type-pending when it should play.
  const heroType = document.querySelector(".hero-type");
  const pageRoot = document.documentElement;
  // Past 2.5s the CSS fallback is about to show the headline, so don't retype it;
  // nor in a background tab, where timers slow to one tick a second.
  if (heroType && pageRoot.classList.contains("hero-type-pending") && performance.now() < 2500 && !document.hidden) {
    // Timings in ms. Each keystroke adds up to JITTER at random, so it feels typed.
    const START = 200;
    const LEAD_KEY = 32;
    const WRONG_KEY = 70;
    const PAUSE = 650;
    const BACKSPACE = 70;
    const BEFORE_FIX = 220;
    const FIX_KEY = 95;
    const JITTER = 20;
    const CURSOR_HOLD = 3000;
    const CURSOR_FADE = 400;

    const finalText = heroType.querySelector(".hero-type-final").textContent.trim();
    const fix = finalText.slice(finalText.lastIndexOf(" ") + 1); // "fail."
    const lead = finalText.slice(0, -fix.length); // "Sometimes … does is "
    const wrong = heroType.dataset.typeWrong;

    const span = (className = "", text = "") => Object.assign(document.createElement("span"), { className, textContent: text });
    const leadTyped = span();
    const leadRest = span("hero-type-ghost", lead);
    const wordTyped = span();
    const overlay = span("hero-type-overlay");
    const word = span("hero-type-word");
    const cursor = span("hero-type-cursor");
    overlay.append(wordTyped);
    word.append(span("hero-type-ghost", fix), overlay);
    const live = heroType.querySelector(".hero-type-live");
    live.replaceChildren(leadTyped, cursor, leadRest, word);
    heroType.classList.add("is-typing");

    const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const typeOut = async (text, keyMs, show) => {
      for (let i = 1; i <= text.length; i += 1) {
        await wait(keyMs + Math.random() * JITTER);
        show(text.slice(0, i));
      }
    };
    const showWord = (text) => {
      wordTyped.textContent = text;
    };
    // Like an editor's cursor: solid while keys are typed, blinking in pauses.
    const idle = async (ms) => {
      cursor.classList.add("is-idle");
      await wait(ms);
      cursor.classList.remove("is-idle");
    };

    (async () => {
      await idle(START);
      await typeOut(lead, LEAD_KEY, (text) => {
        leadTyped.textContent = text;
        leadRest.textContent = lead.slice(text.length);
      });
      overlay.append(cursor);
      await typeOut(wrong, WRONG_KEY, showWord);
      await idle(PAUSE);
      for (let i = wrong.length - 1; i >= 0; i -= 1) {
        await wait(BACKSPACE);
        showWord(wrong.slice(0, i));
      }
      await idle(BEFORE_FIX);
      await typeOut(fix, FIX_KEY, showWord);
      await idle(CURSOR_HOLD);
      cursor.classList.add("is-done");
      await wait(CURSOR_FADE);
      heroType.classList.remove("is-typing");
      live.replaceChildren();
    })();
  }
  pageRoot.classList.remove("hero-type-pending");

  // About page: the branch-and-merge timeline. The list works on its own as a
  // rail; this folds the literature branches, draws the branch lanes on wide
  // screens, and draws them downward as the visitor scrolls.
  document.querySelectorAll(".git-timeline").forEach((timeline) => {
    const log = timeline.querySelector(".git-log");
    const commits = [...log.querySelectorAll(".commit")];
    const merge = log.querySelector(".commit.merge");
    const motion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window;
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.classList.add("git-lanes");
    svg.setAttribute("aria-hidden", "true");
    const hits = svg.cloneNode(); // wide invisible copies of the lines, for hovering
    hits.classList.add("git-lane-hits");
    timeline.prepend(svg, hits);
    let reveal = null; // clip rectangle that uncovers the lanes on scroll

    // Fold each literature branch to its first entry, with a toggle for the rest.
    (timeline.dataset.fold || "").split(" ").filter(Boolean).forEach((branch) => {
      const [first, ...rest] = commits.filter((commit) => commit.dataset.branch === branch);
      if (!rest.length) return;
      rest.forEach((commit) => (commit.hidden = true));
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "fold-toggle";
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = `+${rest.length} more from ${branch}`;
      toggle.addEventListener("click", () => {
        const open = toggle.getAttribute("aria-expanded") !== "true";
        rest.forEach((commit) => {
          commit.hidden = !open;
          commit.classList.add("is-visible");
        });
        toggle.setAttribute("aria-expanded", String(open));
        toggle.textContent = open ? `Show fewer from ${branch}` : `+${rest.length} more from ${branch}`;
      });
      first.append(toggle);
    });

    const center = (commit) => {
      const dot = commit.querySelector(".commit-dot").getBoundingClientRect();
      const box = log.getBoundingClientRect();
      return [dot.left + dot.width / 2 - box.left, dot.top + dot.height / 2 - box.top];
    };

    const path = (d, branch, dashed = false) => {
      const line = document.createElementNS(svgNS, "path");
      line.setAttribute("d", d);
      line.dataset.branch = branch;
      line.style.stroke = getComputedStyle(log.querySelector(`.commit[data-branch="${branch}"]`)).getPropertyValue("--branch");
      if (dashed) line.setAttribute("stroke-dasharray", "4 6");
      return line;
    };

    const updateReveal = () => {
      if (!reveal) return;
      const top = log.getBoundingClientRect().top;
      const height = motion && !revealAll ? window.innerHeight * 0.6 - top : log.offsetHeight + 40;
      reveal.setAttribute("height", Math.max(0, height));
    };

    // One branch at a time is brought forward, the others fading back: by
    // default the one being read, at the same line where entries fade in and
    // the lanes are uncovered; while the pointer is on a line, a dot or a
    // branch name, that branch instead.
    let hovered = null;
    let reading = null;
    const highlight = () => {
      const branch = hovered || reading;
      svg.querySelectorAll("path").forEach((line) => line.classList.toggle("is-dim", Boolean(branch) && line.dataset.branch !== branch));
    };
    const updateReading = () => {
      const y = window.innerHeight * 0.6;
      const box = log.getBoundingClientRect();
      const entry = box.top <= y && box.bottom >= y && commits.filter((commit) => !commit.hidden && commit.getBoundingClientRect().top <= y).pop();
      reading = entry ? entry.dataset.branch : null;
      highlight();
    };

    // HEAD: the line between done (above) and planned (below). The pointer
    // above the timeline names the latest entry and links down to HEAD.
    const head = log.querySelector(".head");
    let revealAll = false;
    if (head) {
      const latest = [...commits].reverse().find((commit) => commit.compareDocumentPosition(head) & Node.DOCUMENT_POSITION_FOLLOWING);
      const pointer = document.querySelector(".head-pointer");
      if (latest) {
        head.querySelector(".head-ref").textContent = `HEAD → ${latest.dataset.branch}`;
        const text = latest.querySelector(".commit-text").cloneNode(true);
        text.querySelectorAll(".cite").forEach((cite) => cite.remove());
        if (pointer) {
          const line = document.createElement("span");
          line.className = "head-latest";
          const date = document.createElement("b");
          date.textContent = latest.querySelector("time").textContent;
          line.append("Latest: ", date, ` · ${text.textContent.trim()}`);
          pointer.prepend(line);
        }
      }
      // Jumping to HEAD (or back to the start) shows everything at once: the
      // visitor asked to skip the story, so nothing waits to fade in.
      const showAll = () => {
        revealAll = true;
        commits.forEach((commit) => commit.classList.add("is-visible"));
        head.classList.add("is-visible");
        updateReveal();
      };
      // Links can be rewritten to full URLs, so match on the hash, not the href.
      document.addEventListener("click", (event) => {
        const link = event.target.closest("a");
        if (!link || link.pathname !== location.pathname || !["#now", "#how-it-started"].includes(link.hash)) return;
        showAll();
        if (link.hash === "#now") setTimeout(() => head.focus({ preventScroll: true }), 0);
      });
      if (["#now", "#how-it-started"].includes(location.hash)) showAll();
    }

    // Lanes. Branches that start before main exists run from their first entry
    // down to the next merge and curve into it. Branches that start later fork
    // out of main (from the nearest main entry above, or the entry named by
    // data-from) and merge at the next merge. Everything above HEAD is solid,
    // everything below it dashed.
    const drawLanes = () => {
      svg.replaceChildren();
      hits.replaceChildren();
      reveal = null;
      if (!timeline.classList.contains("is-lanes") || !merge) return;
      const clip = (id, y, height) => {
        const path = document.createElementNS(svgNS, "clipPath");
        path.id = id;
        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", "-20");
        rect.setAttribute("y", String(y));
        rect.setAttribute("width", "400");
        rect.setAttribute("height", String(Math.max(0, height)));
        path.append(rect);
        svg.append(path);
        return rect;
      };
      const box = log.getBoundingClientRect();
      const headY = head ? head.getBoundingClientRect().top - box.top : Infinity;
      reveal = clip("git-reveal", 0, 0);
      clip("git-done", -20, Math.min(headY, 1e6) + 20);
      clip("git-planned", Math.min(headY, 1e6), 1e6);
      const group = document.createElementNS(svgNS, "g");
      group.setAttribute("clip-path", "url(#git-reveal)");
      svg.append(group);

      const lines = []; // [d, branch]
      const open = new Map(); // branch -> { d, x, startY }
      let mainX = null, mainStart = null, mainEnd = null, lastMain = null;
      commits.forEach((commit) => {
        if (commit.hidden) return;
        const branch = commit.dataset.branch;
        const [x, y] = center(commit);
        if (branch === "main") {
          if (commit.classList.contains("merge")) {
            open.forEach((lane, name) => {
              const bend = Math.min(40, (y - lane.startY) / 2);
              lines.push([`${lane.d} V${y - bend} Q${lane.x} ${y} ${x} ${y}`, name]);
            });
            open.clear();
          }
          if (mainStart === null) [mainX, mainStart] = [x, y];
          mainEnd = y;
          lastMain = commit;
          return;
        }
        if (open.has(branch)) {
          open.get(branch).lastY = y;
          return;
        }
        const from = commit.dataset.from ? log.querySelector(`#${commit.dataset.from}`) : lastMain;
        if (from) {
          const [px, py] = center(from);
          const bend = Math.min(40, (y - py) / 2);
          open.set(branch, { d: `M${px} ${py} Q${x} ${py} ${x} ${py + bend}`, x, startY: py + bend, lastY: y });
        } else {
          open.set(branch, { d: `M${x} ${y}`, x, startY: y, lastY: y });
        }
      });
      open.forEach((lane, name) => lines.push([`${lane.d} V${lane.lastY}`, name])); // never merged
      if (mainStart !== null) lines.push([`M${mainX} ${mainStart} V${mainEnd}`, "main"]);

      [["git-done", false], ["git-planned", true]].forEach(([id, dashed]) => {
        const part = document.createElementNS(svgNS, "g");
        part.setAttribute("clip-path", `url(#${id})`);
        lines.forEach(([d, branch]) => part.append(path(d, branch, dashed)));
        group.append(part);
      });
      // Main goes last, so where lines meet at a main entry, main wins.
      const hitGroup = document.createElementNS(svgNS, "g");
      hitGroup.setAttribute("clip-path", "url(#git-reveal)");
      lines.forEach(([d, branch]) => {
        const hit = document.createElementNS(svgNS, "path");
        hit.setAttribute("d", d);
        hit.dataset.branch = branch;
        hitGroup.append(hit);
      });
      hits.append(hitGroup);
      updateReveal();
      updateReading();
    };

    // Lanes need room; below that width the plain rail stays.
    const layout = () => {
      timeline.classList.toggle("is-lanes", log.clientWidth >= 560);
      drawLanes();
    };
    if ("ResizeObserver" in window) new ResizeObserver(layout).observe(log);
    else layout();
    document.fonts?.ready.then(drawLanes);

    // A line, a dot or a branch name shows a bubble saying what the branch is;
    // the text comes from the visually hidden legend, which screen readers
    // read instead.
    const descriptions = new Map(
      [...document.querySelectorAll(".branch-legend li")].map((item) => {
        const text = item.cloneNode(true);
        text.querySelector("code")?.remove();
        return [item.dataset.branch, text.textContent.trim()];
      })
    );
    const tip = document.createElement("div");
    tip.className = "branch-tip";
    tip.setAttribute("aria-hidden", "true");
    document.body.append(tip);
    const hideTip = () => tip.classList.remove("is-shown");
    const showTip = (branch, x, y) => {
      if (!descriptions.has(branch)) return hideTip();
      if (tip.dataset.branch !== branch) {
        const name = document.createElement("code");
        name.textContent = branch;
        tip.replaceChildren(name, descriptions.get(branch));
        tip.dataset.branch = branch;
      }
      const { width, height } = tip.getBoundingClientRect();
      tip.style.left = `${Math.max(8, Math.min(x + 14, window.innerWidth - width - 8))}px`;
      tip.style.top = `${y + 18 + height > window.innerHeight ? y - height - 10 : y + 18}px`;
      tip.classList.add("is-shown");
    };
    const branchAt = (target) => target.closest(".branch-tag, .commit-dot, .git-lane-hits path")?.closest("[data-branch]")?.dataset.branch;

    timeline.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      const branch = branchAt(event.target);
      if (branch) showTip(branch, event.clientX, event.clientY);
      else hideTip();
      hovered = branch || null;
      highlight();
    });
    timeline.addEventListener("pointerleave", () => {
      hideTip();
      hovered = null;
      highlight();
    });
    // On touch screens a tap on a branch name or dot shows the bubble; the
    // next tap anywhere else, or scrolling, puts it away.
    document.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch") return;
      const branch = timeline.contains(event.target) && branchAt(event.target);
      if (branch) showTip(branch, event.clientX, event.clientY);
      else hideTip();
    });

    // Scrolling moves the page out from under a resting pointer, so the
    // highlight goes back to following the reading line until it moves again.
    let ticking = false;
    window.addEventListener(
      "scroll",
      () => {
        hideTip();
        hovered = null;
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          updateReveal();
          updateReading();
          ticking = false;
        });
      },
      { passive: true }
    );

    if (!motion) return;

    // Entries fade in as they reach the middle of the screen; the lanes are
    // uncovered down to the same point.
    timeline.classList.add("has-motion");
    const fadeIn = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          fadeIn.unobserve(entry.target);
        }),
      { rootMargin: "0px 0px -40% 0px" }
    );
    commits.forEach((commit) => fadeIn.observe(commit));
    if (head) fadeIn.observe(head);
    // Keyboard focus never lands on an entry that hasn't faded in yet.
    log.addEventListener("focusin", (event) => event.target.closest(".commit, .head")?.classList.add("is-visible"));
  });

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

  const TAU = 2 * Math.PI;
  const COLS = 128; // a power of two, so longitude wraps with a bit mask
  const ROWS = 64;
  const CELLS = COLS * ROWS;
  const GRID_STEP = 12; // grid lines every 30° of longitude...
  const LINE = 0.008; // ...and latitude, this wide (radians)
  const truthField = new Float32Array(CELLS);
  const flatField = new Float32Array(CELLS);
  let shared = null;

  // Built on first use, not at page load, since cell 3 starts off screen.
  const prepareGlobes = () => {
    // Diverging colors like the paper's: dark violet, blue, near white, red,
    // dark red. Entries 256-511 are the same colors darkened, for the grid
    // lines. Each entry is one whole RGBA pixel, so painting is a single write.
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

    // The weather lives on a latitude/longitude grid fixed to the Earth. Each
    // wave is split into sine and cosine parts once, so a frame only re-weights
    // them as the weather drifts, with no trigonometry per frame.
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
        for (let j = 0; j < waves.length; j++) {
          const d = waves[j].kx * x + waves[j].ky * y + waves[j].kz * z;
          waveSin[j * CELLS + cell] = Math.sin(d);
          waveCos[j * CELLS + cell] = Math.cos(d);
        }
        starPattern[cell] = Math.exp(-(1 + z) / 0.25) * (Math.cos(8 * lon) + 0.6 * Math.cos(24 * (lat + Math.PI / 2)));
        gridPattern[cell] = 0.9 * Math.cos(16 * lon) * Math.cos(18 * lat);
      }
    }

    // Each canvas pixel's place on the globe (orthographic view from 60°S,
    // north up), as a position in the grid. Spinning only shifts the column, so
    // the row and its blend weight are fixed. Edge shading is a CSS overlay.
    const tilt = -Math.PI / 3;
    const latStep = Math.PI / 6;
    const max = GLOBE_SIZE * GLOBE_SIZE;
    const index = new Int32Array(max);
    const col = new Float32Array(max);
    const row0 = new Int32Array(max);
    const row1 = new Int32Array(max);
    const rowWeight = new Float32Array(max);
    const lonLine = new Float32Array(max);
    const latLine = new Int32Array(max);
    let count = 0;
    for (let y = 0; y < GLOBE_SIZE; y++) {
      for (let x = 0; x < GLOBE_SIZE; x++) {
        const u = ((x + 0.5) / GLOBE_SIZE) * 2 - 1;
        const v = 1 - ((y + 0.5) / GLOBE_SIZE) * 2;
        const r2 = u * u + v * v;
        if (r2 > 1) continue;
        const w = Math.sqrt(1 - r2);
        const lat = Math.asin(v * Math.cos(tilt) + w * Math.sin(tilt));
        const lon = Math.atan2(u, -v * Math.sin(tilt) + w * Math.cos(tilt));
        const row = Math.min(ROWS - 1, Math.max(0, ((lat + Math.PI / 2) / Math.PI) * ROWS - 0.5));
        const r0 = Math.floor(row);
        index[count] = y * GLOBE_SIZE + x;
        col[count] = ((lon / TAU) * COLS + COLS) % COLS;
        row0[count] = r0 * COLS;
        row1[count] = Math.min(ROWS - 1, r0 + 1) * COLS;
        rowWeight[count] = row - r0;
        // Longitude lines stop short of the poles, where they would bunch up.
        lonLine[count] = Math.abs(lat) < 1.4 ? ((TAU / GRID_STEP) * Math.cos(lat)) / LINE : 0;
        latLine[count] = Math.abs(lat / latStep - Math.round(lat / latStep)) * latStep < LINE ? 256 : 0;
        count++;
      }
    }
    return {
      palette: new Uint32Array(paletteBytes.buffer),
      waveSin,
      waveCos,
      starPattern,
      gridPattern,
      count,
      index,
      col,
      row0,
      row1,
      rowWeight,
      lonLine,
      latLine,
    };
  };

  const computeFields = (day) => {
    const { waveSin, waveCos, starPattern, gridPattern } = shared;
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

  const colorOf = (f, line) => shared.palette[(f >= 1 ? 255 : f <= -1 ? 0 : (f * 127.5 + 128) | 0) + line];

  // Paints both globes in one pass: the grid lookup is the same for each.
  const paintGlobes = (truthPixels, flatPixels, spin) => {
    const { count, index, col, row0, row1, rowWeight, lonLine, latLine } = shared;
    const spinCols = (spin % 1) * COLS;
    for (let i = 0; i < count; i++) {
      const x = col[i] + spinCols;
      const c = x | 0;
      const tx = x - c;
      const c0 = c & (COLS - 1);
      const c1 = (c + 1) & (COLS - 1);
      const ty = rowWeight[i];
      const w00 = (1 - tx) * (1 - ty);
      const w01 = tx * (1 - ty);
      const w10 = (1 - tx) * ty;
      const w11 = tx * ty;
      const a = row0[i];
      const b = row1[i];
      const truth = truthField[a + c0] * w00 + truthField[a + c1] * w01 + truthField[b + c0] * w10 + truthField[b + c1] * w11;
      const flat = flatField[a + c0] * w00 + flatField[a + c1] * w01 + flatField[b + c0] * w10 + flatField[b + c1] * w11;
      const steps = (x * GRID_STEP) / COLS;
      const line = lonLine[i] > 0 && Math.abs(steps - Math.round(steps)) * lonLine[i] < 1 ? 256 : latLine[i];
      truthPixels[index[i]] = colorOf(truth, line);
      flatPixels[index[i]] = colorOf(flat, line);
    }
  };

  document.querySelectorAll(".globe-figure").forEach((figure) => {
    // Canvases are set up on the first frame too.
    let views = null;
    const setUpViews = () => {
      views = {};
      figure.querySelectorAll("canvas[data-model]").forEach((canvas) => {
        canvas.width = canvas.height = GLOBE_SIZE;
        const context = canvas.getContext("2d");
        const image = context.createImageData(GLOBE_SIZE, GLOBE_SIZE);
        views[canvas.dataset.model] = { context, image, pixels: new Uint32Array(image.data.buffer) };
      });
    };
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
      prepare();
      computeFields(day);
      paintGlobes(views.truth.pixels, views.flat.pixels, elapsed / SPIN_MS);
      Object.values(views).forEach((view) => view.context.putImageData(view.image, 0, 0));
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
      // The icon shows what the button does, like the cells' run buttons.
      const icon = playing ? "M4 2.5h3v11H4zM9 2.5h3v11H9z" : "M4 2.5v11l9-5.5z";
      toggle.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="${icon}"/></svg>${playing ? "Pause" : "Play"}`;
      toggle.setAttribute("aria-label", playing ? "Pause animation" : "Play animation");
      update();
    };

    toggle.addEventListener("click", () => setPlaying(!playing));
    if (!visible) {
      // One callback can batch several changes; the last one is current.
      new IntersectionObserver((entries) => {
        visible = entries[entries.length - 1].isIntersecting;
        update();
      }).observe(figure);
    }

    const prepare = () => {
      shared ??= prepareGlobes();
      if (!views) setUpViews();
    };

    globes.set(figure, {
      prepare,
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

    // Build the globes' data during the pause, once "In [*]:" has painted.
    cell.querySelectorAll(".globe-figure").forEach((figure) => window.setTimeout(() => globes.get(figure)?.prepare(), 50));

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
