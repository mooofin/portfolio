/* mooofin's Home Machine OS */
(function () {
  "use strict";

  /* ============================================================
     CONFIG
     ============================================================ */
  const Z_BASE = 100;
  let zCounter = Z_BASE;

  /* ============================================================
     BOOT SEQUENCE
     ============================================================ */
  const BIOS_LINES = [
    "Award Modular BIOS v4.51PG, An Energy Star Ally",
    "Copyright (C) 1984-98, Award Software, Inc.",
    "",
    "PENTIUM-S CPU at MMX",
    "Memory Test :  65536K OK",
    "",
    "Detecting Primary Master ... QUANTUM FIREBALL      2040 MB",
    "Detecting Primary Slave  ... None                     ",
    "Detecting Secondary Master   \u2192 SAMSUNG SV4002H       4096 MB",
    "Detecting Secondary Slave  ... None                     ",
    "",
    "BIOS Flash Checksum OK",
    "",
    "Starting POST...",
    "Initializing USB Controllers...",
    "Loading MooofinOS v1.0...",
    "",
    "Booting from Hard Disk...",
  ];

  async function boot() {
    const bootScreen = document.getElementById("boot-screen");
    const bootText = document.getElementById("boot-text");
    const cursor = document.createElement("span");
    cursor.id = "boot-cursor";
    bootText.appendChild(cursor);

    for (const line of BIOS_LINES) {
      await typeLine(bootText, line, cursor);
    }

    // brief pause, then transition
    await sleep(800);
    bootScreen.style.transition = "opacity 0.6s ease";
    bootScreen.style.opacity = "0";
    setTimeout(() => {
      bootScreen.remove();
      document.getElementById("os").style.display = "";
      initDesktop();
    }, 600);
  }

  function typeLine(container, text, cursor) {
    return new Promise((resolve) => {
      const span = document.createElement("span");
      container.insertBefore(span, cursor);
      let i = 0;
      const speed = Math.max(8, 30 - text.length * 0.3);
      function ch() {
        if (i < text.length) {
          span.textContent += text[i];
          i++;
          setTimeout(ch, speed + Math.random() * 15);
        } else {
          resolve();
        }
      }
      ch();
    });
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /* ============================================================
     CLOCK
     ============================================================ */
  function updateClock() {
    const now = new Date();
    const h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    document.getElementById("clock").textContent = `${h12}:${m} ${ampm}`;
  }
  setInterval(updateClock, 1000);
  updateClock();

  /* ============================================================
     DESKTOP ICONS
     ============================================================ */
  const DESKTOP_ICONS = [
    { id: "my-computer", label: "My Computer", icon: "https://win98icons.alexmeub.com/icons/png/computer-3.png", action: "explorer" },
    { id: "documents", label: "Documents", icon: "https://win98icons.alexmeub.com/icons/png/docs-0.png", action: "explorer", path: "/c/users/sid/documents" },
    { id: "projects", label: "Projects", icon: "https://win98icons.alexmeub.com/icons/png/directory_folder_options-5.png", action: "projects" },
    { id: "about", label: "About Me", icon: "https://win98icons.alexmeub.com/icons/png/users-1.png", action: "about" },
    { id: "blog", label: "Blog", icon: "https://win98icons.alexmeub.com/icons/png/folder_open-0.png", action: "blog" },
    { id: "contact", label: "Contact", icon: "https://win98icons.alexmeub.com/icons/png/envelope_closed-1.png", action: "contact" },
    { id: "terminal", label: "Terminal", icon: "https://win98icons.alexmeub.com/icons/png/console_dos-0.png", action: "terminal" },
    { id: "notepad", label: "Notepad", icon: "https://win98icons.alexmeub.com/icons/png/notepad-0.png", action: "notepad" },
    { id: "browser", label: "Internet Explorer", icon: "https://win98icons.alexmeub.com/icons/png/internet-2.png", action: "browser" },
    { id: "noVMP", label: "NoVMP", icon: "https://win98icons.alexmeub.com/icons/png/gear-0.png", action: "about", extra: true },
  ];

  function initDesktop() {
    const desktop = document.getElementById("desktop");
    const grid = document.createElement("div");
    grid.className = "desktop-icons";

    for (const ic of DESKTOP_ICONS) {
      const el = document.createElement("div");
      el.className = "desktop-icon";
      el.dataset.app = ic.action;
      el.innerHTML = `<img src="${ic.icon}" alt="${ic.label}" /><span>${ic.label}</span>`;

      el.addEventListener("click", (e) => {
        document.querySelectorAll(".desktop-icon").forEach((x) => x.classList.remove("selected"));
        el.classList.add("selected");
        e.stopPropagation();
      });

      el.addEventListener("dblclick", () => {
        openApp(ic.action, ic);
      });

      grid.appendChild(el);
    }

    desktop.appendChild(grid);

    // Click on desktop background deselects
    desktop.addEventListener("click", (e) => {
      if (e.target === desktop) {
        document.querySelectorAll(".desktop-icon").forEach((x) => x.classList.remove("selected"));
        hideMenus();
      }
    });

    // Right-click context menu
    desktop.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY);
    });
  }

  /* ============================================================
     CONTEXT MENU
     ============================================================ */
  function showContextMenu(x, y) {
    const menu = document.getElementById("context-menu");
    menu.style.left = x + "px";
    menu.style.top = y + "px";
    menu.classList.remove("hidden");

    // Adjust if off-screen
    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + "px";
      if (rect.bottom > window.innerHeight - 28) menu.style.top = (y - rect.height) + "px";
    });
  }

  function hideMenus() {
    document.getElementById("context-menu").classList.add("hidden");
    document.getElementById("start-menu").classList.add("hidden");
    document.getElementById("programs-menu").classList.add("hidden");
    document.getElementById("start-btn").classList.remove("active");
  }

  // Context menu actions
  document.querySelectorAll(".context-item").forEach((item) => {
    item.addEventListener("click", () => {
      const action = item.dataset.action;
      if (action === "refresh") location.reload();
      if (action === "properties") openApp("about");
      hideMenus();
    });
  });

  // Close context menu on any click
  document.addEventListener("click", (e) => {
    const ctx = document.getElementById("context-menu");
    if (!ctx.contains(e.target)) ctx.classList.add("hidden");
  });

  /* ============================================================
     START MENU
     ============================================================ */
  const startBtn = document.getElementById("start-btn");
  const startMenu = document.getElementById("start-menu");
  const programsMenu = document.getElementById("programs-menu");

  startBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = !startMenu.classList.contains("hidden");
    hideMenus();
    if (!isOpen) {
      startMenu.classList.remove("hidden");
      startBtn.classList.add("active");
    }
  });

  // Menu item clicks
  startMenu.addEventListener("click", (e) => {
    const item = e.target.closest(".menu-item");
    if (!item) return;
    const action = item.dataset.action;

    if (action === "programs") {
      startMenu.classList.add("hidden");
      programsMenu.classList.remove("hidden");
    } else if (action === "run") {
      hideMenus();
      const cmd = prompt("Run:");
      if (cmd) openApp(cmd.trim().toLowerCase().replace(/\s+/g, "-"));
    } else if (action === "shutdown") {
      hideMenus();
      if (confirm("Are you sure you want to shut down?")) {
        document.body.innerHTML = '<div style="position:fixed;inset:0;background:#000;display:flex;align-items:center;justify-content:center;color:#c3ff00;font-family:monospace;font-size:14px">It is now safe to turn off your computer.</div>';
      }
    } else if (action === "settings") {
      hideMenus();
      openApp("about");
    } else if (action === "documents") {
      hideMenus();
      openApp("explorer", { path: "/c/users/sid/documents" });
    }
  });

  programsMenu.addEventListener("click", (e) => {
    const item = e.target.closest(".menu-item");
    if (!item) return;

    if (item.classList.contains("sidebar-back")) {
      programsMenu.classList.add("hidden");
      startMenu.classList.remove("hidden");
      return;
    }

    if (item.classList.contains("app-launcher")) {
      hideMenus();
      openApp(item.dataset.app);
    }
  });

  document.addEventListener("click", (e) => {
    if (!startMenu.contains(e.target) && !startBtn.contains(e.target)) {
      hideMenus();
    }
    if (!programsMenu.contains(e.target)) {
      programsMenu.classList.add("hidden");
    }
  });

  /* ============================================================
     WINDOW MANAGER
     ============================================================ */
  function createWindow(opts) {
    const { id, title, icon, width, height, content, resizable = true } = opts;

    const win = document.createElement("div");
    win.className = "window";
    win.id = id || `win-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    win.style.width = (width || 500) + "px";
    win.style.height = (height || 380) + "px";
    win.style.left = (80 + Math.random() * 200) + "px";
    win.style.top = (40 + Math.random() * 120) + "px";
    win.style.zIndex = ++zCounter;

    const titleBar = document.createElement("div");
    titleBar.className = "window-title";
    titleBar.innerHTML = `
      <span class="window-title-text">
        ${icon ? `<img src="${icon}" class="icon-16" />` : ""}
        ${title}
      </span>
      <div class="window-controls">
        <button class="win-minimize" title="Minimize">\u2212</button>
        <button class="win-maximize" title="Maximize">\u25a1</button>
        <button class="win-close" title="Close">\u00d7</button>
      </div>
    `;

    const body = document.createElement("div");
    body.className = "window-body";
    if (typeof content === "string") {
      body.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      body.appendChild(content);
    } else if (typeof content === "function") {
      content(body);
    }

    win.appendChild(titleBar);
    win.appendChild(body);

    if (resizable) {
      const handle = document.createElement("div");
      handle.className = "resize-handle";
      win.appendChild(handle);
      makeResizable(win, handle);
    }

    document.getElementById("windows").appendChild(win);

    // Dragging
    makeDraggable(win, titleBar);

    // Focus on click
    win.addEventListener("mousedown", () => focusWindow(win));

    // Button controls
    titleBar.querySelector(".win-close").addEventListener("click", () => destroyWindow(win));
    titleBar.querySelector(".win-minimize").addEventListener("click", () => minimizeWindow(win));
    titleBar.querySelector(".win-maximize").addEventListener("click", () => maximizeWindow(win));

    // Add taskbar button
    addTaskbarButton(win, title, icon);

    return win;
  }

  function focusWindow(win) {
    document.querySelectorAll(".window").forEach((w) => {
      w.querySelector(".window-title").classList.add("inactive");
    });
    win.style.zIndex = ++zCounter;
    win.querySelector(".window-title").classList.remove("inactive");

    // Update taskbar buttons
    document.querySelectorAll(".taskbar-btn").forEach((b) => b.classList.remove("active"));
    const tb = document.querySelector(`.taskbar-btn[data-win="${win.id}"]`);
    if (tb) tb.classList.add("active");
  }

  function minimizeWindow(win) {
    win.classList.add("minimized");
    const tb = document.querySelector(`.taskbar-btn[data-win="${win.id}"]`);
    if (tb) tb.classList.remove("active");
  }

  function maximizeWindow(win) {
    if (win.dataset.maximized === "true") {
      // Restore
      win.style.left = win.dataset.origLeft;
      win.style.top = win.dataset.origTop;
      win.style.width = win.dataset.origWidth;
      win.style.height = win.dataset.origHeight;
      win.style.maxWidth = "";
      win.style.maxHeight = "";
      win.dataset.maximized = "false";
    } else {
      // Save current
      win.dataset.origLeft = win.style.left;
      win.dataset.origTop = win.style.top;
      win.dataset.origWidth = win.style.width;
      win.dataset.origHeight = win.style.height;
      win.style.left = "0";
      win.style.top = "0";
      win.style.width = "100%";
      win.style.height = "calc(100% - 28px)";
      win.style.maxWidth = "100%";
      win.style.maxHeight = "calc(100% - 28px)";
      win.dataset.maximized = "true";
    }
  }

  function destroyWindow(win) {
    win.style.transition = "opacity 0.15s ease";
    win.style.opacity = "0";
    setTimeout(() => {
      win.remove();
      const tb = document.querySelector(`.taskbar-btn[data-win="${win.id}"]`);
      if (tb) tb.remove();
    }, 150);
  }

  function makeDraggable(win, handle) {
    let dragging = false, startX, startY, origX, origY;

    handle.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON") return;
      if (win.dataset.maximized === "true") return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      origX = win.offsetLeft;
      origY = win.offsetTop;
      focusWindow(win);

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      e.preventDefault();
    });

    function onMove(e) {
      if (!dragging) return;
      win.style.left = (origX + e.clientX - startX) + "px";
      win.style.top = (origY + e.clientY - startY) + "px";
    }

    function onUp() {
      dragging = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
  }

  function makeResizable(win, handle) {
    let resizing = false, startX, startY, origW, origH;

    handle.addEventListener("mousedown", (e) => {
      if (win.dataset.maximized === "true") return;
      resizing = true;
      startX = e.clientX;
      startY = e.clientY;
      origW = win.offsetWidth;
      origH = win.offsetHeight;

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      e.preventDefault();
      e.stopPropagation();
    });

    function onMove(e) {
      if (!resizing) return;
      win.style.width = Math.max(200, origW + e.clientX - startX) + "px";
      win.style.height = Math.max(120, origH + e.clientY - startY) + "px";
    }

    function onUp() {
      resizing = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
  }

  /* ============================================================
     TASKBAR BUTTONS
     ============================================================ */
  function addTaskbarButton(win, title, icon) {
    const container = document.getElementById("taskbar-buttons");
    const btn = document.createElement("button");
    btn.className = "taskbar-btn active";
    btn.dataset.win = win.id;
    btn.innerHTML = `${icon ? `<img src="${icon}" />` : ""} ${title}`;

    btn.addEventListener("click", () => {
      if (win.classList.contains("minimized")) {
        win.classList.remove("minimized");
        focusWindow(win);
      } else if (parseInt(win.style.zIndex) === zCounter) {
        minimizeWindow(win);
      } else {
        focusWindow(win);
      }
    });

    container.appendChild(btn);
  }

  /* ============================================================
     APP LAUNCHER
     ============================================================ */
  function openApp(name, opts) {
    const apps = {
      terminal:   () => apps.terminal(),
      notepad:    () => apps.notepad(),
      explorer:   () => apps.explorer(opts),
      about:      () => apps.about(),
      projects:   () => apps.projects(),
      blog:       () => apps.blog(),
      contact:    () => apps.contact(),
      browser:    () => apps.browser(),
    };

    if (apps[name]) {
      apps[name]();
    } else {
      // Try as URL for browser
      if (name.startsWith("http") || name.includes(".")) {
        apps.browser(name);
      } else {
        createWindow({
          title: `"${name}" - Program Error`,
          icon: "https://win98icons.alexmeub.com/icons/png/error-1.png",
          width: 300,
          height: 150,
          content: `<div style="text-align:center;padding:20px"><p>Windows cannot find '${name}'. Make sure you typed the correct name.</p><button onclick="this.closest('.window').querySelector('.win-close').click()">OK</button></div>`,
          resizable: false,
        });
      }
    }
  }

  /* ============================================================
     APPS
     ============================================================ */
  const apps = {};

  apps.terminal = function () {
    const output = [];
    const history = [];
    let histIdx = -1;

    function render() {
      el.querySelector(".terminal-output").innerHTML = output.map(l =>
        l.type === "error" ? `<span style="color:#ff5c57">${esc(l.text)}</span>` :
        l.type === "command" ? `<span style="color:#5af78e">${esc(l.text)}</span>` :
        esc(l.text)
      ).join("\n");
      el.querySelector(".terminal-output").scrollTop = 999999;
    }

    function cmd(line) {
      const parts = line.trim().split(/\s+/);
      const c = parts[0]?.toLowerCase();
      const args = parts.slice(1);

      output.push({ text: `sid@mooofin:~$ ${line}`, type: "command" });

      switch (c) {
        case "": break;
        case "help":
          output.push({ text: `Available commands:
  help        - Show this help
  ls [path]   - List directory contents
  cd <dir>    - Change directory
  cat <file>  - Display file contents
  whoami      - Current user
  uname       - System information
  date        - Current date/time
  neofetch    - System info with flair
  clear       - Clear terminal
  echo <text> - Print text
  calc <expr> - Simple calculator
  matrix      - Enter the matrix
  exit        - Close terminal`, type: "info" });
          break;
        case "ls":
          const target = args[0] || cwd;
          const dir = fs[target] || fs["/c/users/sid"];
          if (dir && dir._items) {
            output.push({ text: dir._items.map(i => i.dir ? "[DIR]  " : "       " + i.name).join("\n"), type: "info" });
          } else {
            output.push({ text: `Directory not found: ${target}`, type: "error" });
          }
          break;
        case "cd":
          if (!args[0] || args[0] === "~" || args[0] === "/c/users/sid") {
            cwd = "/c/users/sid";
          } else if (args[0] === "..") {
            cwd = cwd.split("/").slice(0, -1).join("/") || "/c/users/sid";
          } else if (fs[cwd + "/" + args[0]]) {
            cwd = cwd + "/" + args[0];
          } else {
            output.push({ text: `cd: no such directory: ${args[0]}`, type: "error" });
          }
          break;
        case "cat":
          if (!args[0]) { output.push({ text: "Usage: cat <file>", type: "error" }); break; }
          const fpath = args[0].startsWith("/") ? args[0] : cwd + "/" + args[0];
          const file = fs[fpath];
          if (file && !file._items && typeof file._content === "string") {
            output.push({ text: file._content, type: "info" });
          } else {
            output.push({ text: `cat: ${args[0]}: No such file`, type: "error" });
          }
          break;
        case "whoami":
          output.push({ text: "sid", type: "info" });
          break;
        case "uname":
          output.push({ text: "MooofinOS 1.0 x86_64 GNU/Linux", type: "info" });
          break;
        case "date":
          output.push({ text: new Date().toString(), type: "info" });
          break;
        case "neofetch":
          output.push({ text: `
       ___           sid@mooofin
      /   \\          ------------
     | ^   |         OS: MooofinOS x86_64
     |  o  |         Host: Portfolio Machine
     |     |         Kernel: JS ES2024
      \\___/          Uptime: ${Math.floor((Date.now() - startTime) / 60000)} mins
    /|     |\\        Shell: mooshell 1.0
   / |  .  | \\       WM: win95.js
  |  |     |  |      Theme: Windows 98
  |   \\___/  |      Terminal: mooshell
   \\         /      CPU: Pentium-S MMX
    \\_______/       Memory: 64MB

    Projects: NoVMP | LLVM | VMProtect RE | Fuzzing
    Blog: 17 posts | CTFs | Systems Programming`, type: "info" });
          break;
        case "clear":
          output.length = 0;
          break;
        case "echo":
          output.push({ text: args.join(" "), type: "info" });
          break;
        case "calc":
          try {
            const expr = args.join(" ");
            if (/^[\d\s+\-*/().]+$/.test(expr)) {
              output.push({ text: "= " + Function('"use strict";return (' + expr + ")")(), type: "info" });
            } else {
              output.push({ text: "calc: invalid expression", type: "error" });
            }
          } catch {
            output.push({ text: "calc: error", type: "error" });
          }
          break;
        case "matrix":
          output.push({ text: "Follow the white rabbit... \u{1f430}", type: "info" });
          break;
        case "exit":
          const w = el.closest(".window");
          if (w) destroyWindow(w);
          break;
        default:
          output.push({ text: `mooshell: command not found: ${c}`, type: "error" });
      }

      render();
    }

    const el = document.createElement("div");
    el.className = "terminal";
    el.innerHTML = `
      <div class="terminal-output"></div>
      <div class="terminal-input-line">
        <span class="terminal-prompt">sid@mooofin:~$</span>
        <input class="terminal-input" type="text" autofocus />
      </div>
    `;

    const input = el.querySelector(".terminal-input");
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        cmd(input.value);
        history.unshift(input.value);
        histIdx = -1;
        input.value = "";
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (histIdx < history.length - 1) {
          histIdx++;
          input.value = history[histIdx];
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (histIdx > 0) {
          histIdx--;
          input.value = history[histIdx];
        } else {
          histIdx = -1;
          input.value = "";
        }
      }
    });

    render();
    output.push({ text: "MooofinOS Terminal v1.0\nType 'help' for available commands.\n", type: "info" });
    render();

    createWindow({
      title: "Terminal",
      icon: "https://win98icons.alexmeub.com/icons/png/console_dos-0.png",
      width: 620,
      height: 420,
      content: el,
    });

    // Focus input after window creation
    setTimeout(() => input.focus(), 100);
  };

  apps.notepad = function () {
    const el = document.createElement("div");
    el.className = "notepad";
    el.innerHTML = `<textarea placeholder="Start typing...">Welcome to Notepad!

This is a simple text editor running in your browser.
Features:
- Basic text editing
- Saved to localStorage automatically
- Retro Win98 styling

Try editing this text!</textarea>`;

    const ta = el.querySelector("textarea");
    const saved = localStorage.getItem("notepad-content");
    if (saved) ta.value = saved;

    ta.addEventListener("input", () => {
      localStorage.setItem("notepad-content", ta.value);
    });

    createWindow({
      title: "Untitled - Notepad",
      icon: "https://win98icons.alexmeub.com/icons/png/notepad-0.png",
      width: 500,
      height: 350,
      content: el,
    });
  };

  apps.explorer = function (opts) {
    const path = opts?.path || "/c/users/sid";

    function renderExplorer(container) {
      container.innerHTML = "";

      const toolbar = document.createElement("div");
      toolbar.className = "explorer-toolbar";
      toolbar.innerHTML = `
        <button class="explorer-back" title="Back">\u25c2</button>
        <div class="explorer-path">${path}</div>
      `;
      container.appendChild(toolbar);

      const content = document.createElement("div");
      content.className = "explorer-content";

      const dir = fs[path];
      if (dir && dir._items) {
        for (const item of dir._items) {
          const row = document.createElement("div");
          row.className = "explorer-file";
          row.innerHTML = `
            <img src="${item.dir ? 'https://win98icons.alexmeub.com/icons/png/directory_folder_options-5.png' : 'https://win98icons.alexmeub.com/icons/png/docs-0.png'}" />
            <span>${item.name}</span>
            <span style="margin-left:auto;color:#808080;font-size:10px">${item.size || ""}</span>
          `;

          if (item.dir) {
            row.addEventListener("dblclick", () => {
              const newPath = path + "/" + item.name;
              if (fs[newPath]?._items) {
                toolbar.querySelector(".explorer-path").textContent = newPath;
                renderExplorer(content);
              }
            });
          } else {
            const fileKey = path + "/" + item.name;
            const fileData = fs[fileKey];
            if (fileData && fileData._content) {
              row.addEventListener("dblclick", () => {
                apps.notepad(fileData._content);
              });
            }
          }

          content.appendChild(row);
        }
      }

      // Back navigation
      toolbar.querySelector(".explorer-back").addEventListener("click", () => {
        const parent = path.split("/").slice(0, -1).join("/") || "/c/users/sid";
        toolbar.querySelector(".explorer-path").textContent = parent;
        renderExplorer(content);
      });

      container.appendChild(content);
    }

    const el = document.createElement("div");
    el.className = "explorer";
    renderExplorer(el);

    createWindow({
      title: `My Computer - ${path}`,
      icon: "https://win98icons.alexmeub.com/icons/png/computer-3.png",
      width: 600,
      height: 400,
      content: el,
    });
  };

  apps.about = function () {
    const html = `
      <div class="app-page" style="padding:16px">
        <h2 style="margin-top:0;color:#08216b;border-bottom:2px groove #c0c0c0;padding-bottom:8px">About Me</h2>
        <table cellpadding="6" cellspacing="0">
          <tr><td width="100" valign="top">Name:</td><td>siddharth (sid / mooofin)</td></tr>
          <tr><td>Interests:</td><td>VMProtect reverse engineering, static devirtualization, LLVM, systems programming</td></tr>
          <tr><td>CURRENTLY WORKING ON:</td><td><strong>NoVMP</strong> — a static devirtualizer for VMProtect x64 3.x backed by LLVM IR. Adjacent interests include MLIR dialects, VAST for C/C++ lifting, SCEV, and the compiler/hardware boundary.</td></tr>
          <tr><td>Stack:</td><td>C++, Rust, NixOS, Gentoo</td></tr>
        </table>
        <hr />
        <h3 style="color:#08216b">Adjacent Interests</h3>
        <ul>
          <li><strong>MLIR dialects</strong> — designing custom IR representations for VM opcodes</li>
          <li><strong>VAST</strong> — studying C/C++ binary lifting approaches</li>
          <li><strong>SCEV</strong> — symbolic constant evolution analysis on lifted code</li>
          <li><strong>Compiler/hardware boundary</strong> — where decompilation meets actual execution</li>
        </ul>
        <hr />
        <p style="font-size:10px;color:#808080;margin-bottom:0">MooofinOS v1.0 &mdash; Built with vanilla JS. No frameworks. Just vibes.</p>
      </div>
    `;
    createWindow({ title: "About Me", icon: "https://win98icons.alexmeub.com/icons/png/users-1.png", width: 550, height: 420, content: html });
  };

  apps.projects = function () {
    const projects = [
      { name: "NoVMP", desc: "Static devirtualizer for VMProtect x64 3.x backed by LLVM IR", lang: "C++", link: "#" },
      { name: "hypv64", desc: "RISC-V 64 hypervisor written in Rust, built for QEMU virt", lang: "Rust", link: "https://github.com/mooofin/hypv64" },
      { name: "IRAnatomy", desc: "Instruments the LLVM optimization pipeline using opt -print-after-all", lang: "C++", link: "https://github.com/mooofin/IRAnatomy" },
      { name: "Honeymoon", desc: "Emacs-inspired C++20 terminal editor. No Lisp. No bloat.", lang: "C++20", link: "https://github.com/mooofin/honeymoon" },
      { name: "AETHERION", desc: "Raycaster engine inspired by DOOM", lang: "C", link: "https://github.com/mooofin/Aetherion" },
      { name: "AFL-exercises", desc: "Coverage-guided fuzzing experiments using AFL++", lang: "C", link: "https://github.com/mooofin/AFL-exercises" },
      { name: "Thalix", desc: "High-performance process management and memory editing toolkit", lang: "C++", link: "https://github.com/mooofin/Thalix" },
      { name: "nix-dotfiles", desc: "NixOS setup with Niri + Hyprland and Home-manager", lang: "Nix", link: "https://github.com/mooofin/nix-dotfiles" },
      { name: "CTFs", desc: "CTF writeups", lang: "-", link: "https://github.com/mooofin/CTFs" },
      { name: "JuliaScope", desc: "Multithreaded subdomain enumerator", lang: "Julia", link: "https://github.com/mooofin/JuliaScope" },
    ];

    let rows = projects.map(p => `
      <tr>
        <td><strong>${p.name}</strong></td>
        <td>${p.desc}</td>
        <td style="width:60px">${p.lang}</td>
        <td style="width:80px">${p.link !== "#" ? `<a href="${p.link}" target="_blank">GitHub</a>` : "\u2014"}</td>
      </tr>
    `).join("");

    const html = `
      <div class="app-page" style="padding:8px">
        <table>
          <thead><tr><th>Project</th><th>Description</th><th>Lang</th><th>Link</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    createWindow({ title: "Projects", icon: "https://win98icons.alexmeub.com/icons/png/directory_folder_options-5.png", width: 650, height: 400, content: html });
  };

  apps.blog = function () {
    const posts = [
      { title: "RISC-V H-Extension: The Only Hypervisor Spec You Can Read at Lunch", date: "2026-05-23", slug: "risc-v-hypervisor" },
      { title: "My First Patch to LLVM", date: "2026-04-16", slug: "my-first-llvm-patch" },
      { title: "AFL++ Internals: Coverage-Guided Fuzzing from First Principles", date: "2026-03-17", slug: "afl-internals-coverage-guided-fuzzing" },
      { title: "Slay the JIT: From Hotpatches to Symbolic Couture in Miasm", date: "2025-12-12", slug: "vmware" },
      { title: "Like Father Like Son - DFIR report", date: "2025-12-17", slug: "like-father-like-son" },
      { title: "Strings Don't Lie, Packers Do", date: "2025-10-05", slug: "strings-dont-lie-packers-do" },
      { title: "ROPFU - Return-Oriented Programming in Userland", date: "2025-08-22", slug: "ropfu" },
      { title: "Format String Vulnerabilities: Part 3", date: "2025-06-11", slug: "format-string-3" },
    ];

    let rows = posts.map(p => `
      <tr>
        <td>${p.date}</td>
        <td><a href="blog/${p.slug}.html" target="_blank">${p.title}</a></td>
      </tr>
    `).join("");

    const html = `
      <div class="app-page" style="padding:8px">
        <h3 style="margin-top:0;color:#08216b">Blog Posts (${posts.length})</h3>
        <table>
          <thead><tr><th width="100px">Date</th><th>Title</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    createWindow({ title: "Blog", icon: "https://win98icons.alexmeub.com/icons/png/folder_open-0.png", width: 580, height: 380, content: html });
  };

  apps.contact = function () {
    const html = `
      <div class="app-page" style="padding:16px">
        <h2 style="margin-top:0;color:#08216b;border-bottom:2px groove #c0c0c0;padding-bottom:8px">Contact</h2>
        <table cellpadding="6" cellspacing="0">
          <tr><td width="120">Email:</td><td><a href="mailto:siddharthqln@gmail.com">siddharthqln@gmail.com</a></td></tr>
          <tr><td>GitHub:</td><td><a href="https://github.com/mooofin" target="_blank">github.com/mooofin</a></td></tr>
          <tr><td>Last.fm:</td><td><a href="https://www.last.fm/user/kxllswxch" target="_blank">last.fm/user/kxllswxch</a></td></tr>
          <tr><td>MyAnimeList:</td><td><a href="https://myanimelist.net/profile/kurapika_99" target="_blank">kurapika_99</a></td></tr>
          <tr><td>Letterboxd:</td><td><a href="https://letterboxd.com/ptolemeaa4u/" target="_blank">ptolemeaa4u</a></td></tr>
        </table>
        <hr />
        <p style="font-size:10px;color:#808080;margin-bottom:0">Open for collaborations on RE, compiler work, or anything low-level.</p>
      </div>
    `;
    createWindow({ title: "Contact", icon: "https://win98icons.alexmeub.com/icons/png/envelope_closed-1.png", width: 450, height: 300, content: html });
  };

  apps.browser = function (url) {
    url = url || "https://github.com/mooofin";

    const el = document.createElement("div");
    el.style.display = "flex";
    el.style.flexDirection = "column";
    el.style.height = "100%";

    const toolbar = document.createElement("div");
    toolbar.className = "browser-toolbar";
    toolbar.innerHTML = `
      <button class="browser-back" title="Back">\u25c2</button>
      <input class="browser-url" type="text" value="${url}" />
      <button class="browser-go">Go</button>
    `;
    el.appendChild(toolbar);

    const frame = document.createElement("iframe");
    frame.className = "browser-frame";
    frame.src = url;
    frame.sandbox = "allow-same-origin allow-scripts allow-forms";
    el.appendChild(frame);

    toolbar.querySelector(".browser-go").addEventListener("click", navigate);
    toolbar.querySelector(".browser-url").addEventListener("keydown", (e) => {
      if (e.key === "Enter") navigate();
    });

    function navigate() {
      let u = toolbar.querySelector(".browser-url").value.trim();
      if (!u.startsWith("http")) u = "https://" + u;
      frame.src = u;
    }

    createWindow({
      title: "Internet Explorer",
      icon: "https://win98icons.alexmeub.com/icons/png/internet-2.png",
      width: 750,
      height: 500,
      content: el,
    });
  };

  /* ============================================================
     SIMULATED FILE SYSTEM
     ============================================================ */
  const fs = {
    "/c/users/sid": {
      _items: [
        { name: "documents", dir: true },
        { name: "desktop", dir: true },
        { name: "noVMP_notes.txt", dir: false, size: "2.4 KB" },
      ]
    },
    "/c/users/sid/documents": {
      _items: [
        { name: "ctf-writeups", dir: true },
        { name: "llvm-notes.txt", dir: false, size: "8.1 KB" },
        { name: "rustlings", dir: true },
      ]
    },
    "/c/users/sid/desktop": {
      _items: []
    },
    "/c/users/sid/noVMP_notes.txt": {
      _content: "NoVMP Development Notes\n========================\n\nGoal: Replace VTIL-Core backend with LLVM IR\n\nArchitecture:\n- Frontend: can1357's handler emulation + IL lifting (keep intact)\n- Backend: llvm::Module + standard IR passes (new)\n- Output: working x86_64 binaries\n\nStatus: WIP, not yet functional\n\nAdjacent: MLIR dialects, VAST, SCEV, compiler/hardware boundary"
    },
    "/c/users/sid/documents/llvm-notes.txt": {
      _content: "LLVM IR Notes\n==============\n\n- Study opt -print-after-all for IR snapshots\n- mem2reg, SCCP, DCE, CFG canonicalization\n- Use for IRAnatomy project"
    },
  };

  let cwd = "/c/users/sid";

  /* ============================================================
     UTILS
     ============================================================ */
  function esc(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  /* ============================================================
     INIT
     ============================================================ */
  const startTime = Date.now();
  boot();

})();
