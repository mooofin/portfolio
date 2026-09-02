

// LaTeX mode toggle
(function () {
  var KEY = "latexMode";
  // the 404 BSOD stays a BSOD
  if (document.querySelector(".bsod")) return;
  var base = "";
  var script = document.currentScript;
  if (script && script.src) {
    base = script.src.replace(/site\.js.*$/, "");
  }

  // stylesheets (created once, toggled via .disabled)
  var cdn = document.createElement("link");
  cdn.rel = "stylesheet";
  cdn.id = "latex-css-cdn";
  cdn.href = "https://cdn.jsdelivr.net/npm/latex.css@1.10.0/style.min.css";

  var local = document.createElement("link");
  local.rel = "stylesheet";
  local.id = "latex-css-local";
  local.href = base + "latex-mode.css?v=20260827-no-dupe-small-code";

  function isOn() {
    return sessionStorage.getItem(KEY) === "1";
  }

  // shareable link: ?latex / ?latex=1 forces LaTeX mode on load.
  // ?latex=0 forces it off. persists to sessionStorage so in-site nav keeps it.
  (function () {
    var m = /[?&]latex(?:=([^&]*))?/.exec(location.search);
    if (!m) return;
    var on = !(m[1] === "0" || m[1] === "false");
    sessionStorage.setItem(KEY, on ? "1" : "0");
  })();

  function apply(on) {
    document.documentElement.classList.toggle("latex-mode", on);
    document.body.classList.toggle(
      "latex-blog-post",
      on && !!document.querySelector(".blog-content")
    );
    try {
      var u = new URL(location.href);
      if (on) { u.searchParams.set("latex", "1"); } else { u.searchParams.delete("latex"); }
      history.replaceState(null, "", u.toString());
    } catch (e) {}
    cdn.disabled = !on;
    local.disabled = !on;
    if (on) decorate();
    var dk = document.getElementById("latex-dark-toggle");
    if (dk) dk.style.display = on ? "" : "none";
    // taskbar is hidden in latex mode, so re-home the button
    var b = document.getElementById("latex-toggle");
    if (b) {
      var tray = document.querySelector(".tray");
      if (on || !tray) {
        b.style.cssText =
          "position:fixed;bottom:16px;right:16px;z-index:9999;font-size:12px;padding:3px 10px;cursor:pointer;";
        document.body.appendChild(b);
      } else {
        b.style.cssText = "font-size:11px;padding:1px 6px;cursor:pointer;";
        tray.insertBefore(b, tray.firstChild);
      }
    }
    document
      .querySelectorAll(
        ".latex-author, .latex-colophon, .latex-toc, .latex-pagenum, .latex-arxiv, .latex-marginnote, .latex-qed, .latex-vimline, .latex-draft, .latex-overfull"
      )
      .forEach(function (el) {
        el.style.display = on ? "" : "none";
      });
    var btn = document.getElementById("latex-toggle");
    if (btn) btn.textContent = on ? "\\end{document}" : "TeX";
    var pfp = document.getElementById("pfp");
    if (pfp) pfp.src = on ? base + "images/pfp1.jpg" : base + "images/pfp.jpg";
    if (on) renderLatexMath();
  }

  var katexLoadPromise = null;
  var mathJaxLoadPromise = null;

  function loadScriptOnce(id, src) {
    return new Promise(function (resolve, reject) {
      var existing = document.getElementById(id);
      if (existing) {
        if (existing.dataset.loaded === "1") return resolve();
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      var s = document.createElement("script");
      s.id = id;
      s.src = src;
      s.defer = true;
      s.onload = function () {
        s.dataset.loaded = "1";
        resolve();
      };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function ensureKatex() {
    if (typeof window.renderMathInElement === "function") return Promise.resolve();
    if (katexLoadPromise) return katexLoadPromise;
    if (!document.getElementById("katex-css-cdn")) {
      var css = document.createElement("link");
      css.id = "katex-css-cdn";
      css.rel = "stylesheet";
      css.href = "https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css";
      document.head.appendChild(css);
    }
    katexLoadPromise = loadScriptOnce("katex-js-cdn", "https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.js")
      .then(function () {
        return loadScriptOnce("katex-auto-render-cdn", "https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/contrib/auto-render.min.js");
      })
      .catch(function () {});
    return katexLoadPromise;
  }

  function ensureMathJax() {
    if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
      return Promise.resolve();
    }
    if (mathJaxLoadPromise) return mathJaxLoadPromise;

    window.MathJax = window.MathJax || {};
    window.MathJax.tex = window.MathJax.tex || {
      inlineMath: [["$", "$"]],
      displayMath: [["$$", "$$"]],
    };

    var existing = document.querySelector('script[src*="mathjax"]');
    if (existing) {
      mathJaxLoadPromise = new Promise(function (resolve) {
        if (window.MathJax && typeof window.MathJax.typesetPromise === "function") return resolve();
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", resolve, { once: true });
      }).then(function () {
        if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
          return window.MathJax.startup.promise.catch(function () {});
        }
      });
      return mathJaxLoadPromise;
    }

    mathJaxLoadPromise = loadScriptOnce("mathjax-js-cdn", "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js")
      .then(function () {
        if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
          return window.MathJax.startup.promise.catch(function () {});
        }
      })
      .catch(function () {});
    return mathJaxLoadPromise;
  }

  function renderLatexMath(root) {
    root = root || document.querySelector(".blog-content") || document.body;
    if (!root || root.dataset.mathRendered === "1") return;
    ensureMathJax().then(function () {
      if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
        try {
          if (typeof window.MathJax.typesetClear === "function") {
            window.MathJax.typesetClear([root]);
          }
          window.MathJax.typesetPromise([root]).then(function () {
            root.dataset.mathRendered = "1";
          }).catch(function () {});
        } catch (e) {}
      } else {
        ensureKatex().then(function () {
          if (typeof window.renderMathInElement === "function") {
            try {
              window.renderMathInElement(root, {
                delimiters: [
                  { left: "$$", right: "$$", display: true },
                  { left: "$", right: "$", display: false },
                ],
                ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
                throwOnError: false,
              });
              root.dataset.mathRendered = "1";
            } catch (e) {}
          }
        });
      }
    });
  }

  // \author{} \date{} block under the title + colophon at page end
  function decorate() {
    // classify table-95: blog-list vs projects-list
    document.querySelectorAll(".table-95").forEach(function (t) {
      var headers = t.querySelectorAll("thead th");
      if (headers.length >= 1) {
        var first = headers[0].textContent.trim().toLowerCase();
        if (first === "date") t.classList.add("blog-list-table");
        else if (first === "project") t.classList.add("projects-list-table");
      }
    });

    // blog list: move date td to end so CSS can flex title | date without order tricks
    document.querySelectorAll(".blog-list-table tbody tr").forEach(function (tr) {
      var tds = tr.querySelectorAll("td");
      if (tds.length >= 2) tr.appendChild(tds[0]); // date was first child → move to last
    });

    // reflow table-95 into a vertical dl-style list in latex mode
    document.querySelectorAll(".table-95 tbody tr").forEach(function (tr) {
      var cells = tr.querySelectorAll("td");
      if (cells.length < 2) return;
      var nameTd = cells[0];
      var linkTd = cells[cells.length - 1];
      var a = linkTd.querySelector("a");
      if (a && a.href && !nameTd.querySelector("a")) {
        var nameEl = nameTd.querySelector("strong") || nameTd;
        var nameText = nameEl.textContent.trim();
        var link = document.createElement("a");
        link.href = a.href;
        link.target = "_blank";
        link.textContent = nameText;
        nameEl.textContent = "";
        nameEl.appendChild(link);
      }
      // mark link column for hiding
      if (linkTd !== cells[1]) linkTd.classList.add("latex-hide-cell");
    });
    // hide header link column too
    document.querySelectorAll(".table-95 thead th:last-child").forEach(function(th) {
      if (document.querySelectorAll(".table-95 thead th").length > 2)
        th.classList.add("latex-hide-cell");
    });
    var h1 = document.querySelector(".blog-content h1, .content-95 h1, h1");
    if (h1 && !document.querySelector(".latex-author")) {
      var meta = document.querySelector(".blog-meta");
      var d = document.createElement("div");
      d.className = "latex-author";
      d.appendChild(document.createTextNode("mooofin"));
      d.appendChild(document.createElement("br"));
      var affil = document.createElement("span");
      affil.className = "affil";
      affil.textContent = meta
        ? meta.textContent.trim()
        : "Department of Reverse Engineering";
      d.appendChild(affil);
      h1.parentNode.insertBefore(d, h1.nextSibling);
    }
    // table of contents from h2 headings (blog posts only, 3+ sections)
    var content = document.querySelector(".blog-content");
    if (content && !document.querySelector(".latex-toc")) {
      var heads = content.querySelectorAll("h2");
      if (heads.length >= 3) {
        var toc = document.createElement("nav");
        toc.className = "latex-toc";
        var tt = document.createElement("div");
        tt.className = "latex-toc-title";
        tt.textContent = "Contents";
        toc.appendChild(tt);
        var ol = document.createElement("ol");
        heads.forEach(function (h, i) {
          if (!h.id) h.id = "sec-" + (i + 1);
          var li = document.createElement("li");
          var a = document.createElement("a");
          a.href = "#" + h.id;
          a.textContent = h.textContent;
          var dots = document.createElement("span");
          dots.className = "toc-dots";
          var pg = document.createElement("span");
          pg.textContent = i + 1;
          li.appendChild(a);
          li.appendChild(dots);
          li.appendChild(pg);
          ol.appendChild(li);
        });
        toc.appendChild(ol);
        var firstH2 = heads[0];
        firstH2.parentNode.insertBefore(toc, firstH2);
      }
    }
    // arXiv stamp on the left edge
    if (!document.querySelector(".latex-arxiv")) {
      var months3 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      var nw = new Date();
      var arxiv = document.createElement("div");
      arxiv.className = "latex-arxiv";
      arxiv.textContent =
        "arXiv:" +
        String(nw.getFullYear()).slice(2) +
        "0" + (nw.getMonth() + 1) +
        ".13370v1 [cs.CR] " +
        nw.getDate() + " " + months3[nw.getMonth()] + " " + nw.getFullYear();
      document.body.appendChild(arxiv);
    }

    // bibliography [n] style for the References section
    document.querySelectorAll("h2").forEach(function (h) {
      if (/references/i.test(h.textContent)) {
        var el = h.nextElementSibling;
        while (el && el.tagName !== "UL" && el.tagName !== "H2") {
          el = el.nextElementSibling;
        }
        if (el && el.tagName === "UL") el.classList.add("latex-bib");
      }
    });

    // clickable QED tombstone - decompiles back to win95
    if (content && !document.querySelector(".latex-qed")) {
      var qed = document.createElement("span");
      qed.className = "latex-qed";
      qed.textContent = "∎";
      qed.title = "q.e.d. (double-click to decompile)";
      qed.ondblclick = function () {
        sessionStorage.setItem(KEY, "0");
        decompileAnim(function () {
          apply(false);
        });
      };
      content.appendChild(qed);
    }

    // vim statusline with real counts
    if (!document.querySelector(".latex-vimline")) {
      var texName = (location.pathname.split("/").pop() || "index.html").replace(
        /\.html?$/,
        ".tex"
      );
      var txt = document.body.innerText || "";
      var lineCount = txt.split("\n").length;
      var charCount = txt.length;
      var vim = document.createElement("div");
      vim.className = "latex-vimline";
      var left = document.createElement("span");
      left.textContent = "-- INSERT --";
      var mid = document.createElement("span");
      mid.textContent = '"' + texName + '" ' + lineCount + "L, " + charCount + "C written";
      var right = document.createElement("span");
      right.textContent = "All";
      vim.appendChild(left);
      vim.appendChild(mid);
      vim.appendChild(right);
      vim.style.overflow = "hidden";
      vim.style.whiteSpace = "nowrap";
      document.body.appendChild(vim);
    }

    // bibtex hover cards on [n] references
    document.querySelectorAll(".latex-bib li").forEach(function (li) {
      if (li.querySelector(".latex-bibcard")) return;
      var a = li.querySelector("a");
      var title = (a ? a.textContent : li.textContent).trim();
      var url = a ? a.href : "";
      var keyword = title.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12) || "misc";
      var card = document.createElement("span");
      card.className = "latex-bibcard";
      card.textContent =
        "@misc{mooofin2026" + keyword + ",\n" +
        '  title  = {' + title + '},\n' +
        "  author = {mooofin and others},\n" +
        "  year   = {2026},\n" +
        (url ? '  url    = {' + url + '},\n' : "") +
        '  note   = {accessed: while procrastinating}\n' +
        "}";
      li.appendChild(card);
      // tap support for mobile (hover doesn't fire on touch)
      li.addEventListener("click", function (e) {
        e.stopPropagation();
        var visible = card.style.display === "block";
        document.querySelectorAll(".latex-bibcard").forEach(function (c) { c.style.display = "none"; });
        card.style.display = visible ? "none" : "block";
      });
    });
    document.addEventListener("click", function () {
      document.querySelectorAll(".latex-bibcard").forEach(function (c) { c.style.display = "none"; });
    }, { capture: false });

    if (!document.querySelector(".latex-pagenum")) {
      var pn = document.createElement("div");
      pn.className = "latex-pagenum";
      pn.textContent = "1";
      document.body.appendChild(pn);
    }
    if (!document.querySelector(".latex-colophon")) {
      var c = document.createElement("div");
      c.className = "latex-colophon";
      var months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      var now = new Date();
      c.appendChild(
        document.createTextNode(
          "Compiled with pdfTeX on " +
            months[now.getMonth()] + " " + now.getDate() + ", " + now.getFullYear() + " · "
        )
      );
      var logName = (location.pathname.split("/").pop() || "index.html").replace(/\.html?$/, ".log");
      var logLink = document.createElement("a");
      logLink.href = "#";
      logLink.textContent = logName;
      logLink.onclick = function (e) {
        e.preventDefault();
        showFakeLog(logName);
      };
      c.appendChild(logLink);
      // social links row under colophon (index only)
      var isIndex = location.pathname === "/" || location.pathname.endsWith("/portfolio/") || location.pathname.endsWith("index.html");
      var isContact = location.pathname.endsWith("contact.html");
      var socials = isIndex ? [
        { label: "Email", href: "mailto:siddharthqln@gmail.com" },
        { label: "GitHub", href: "https://github.com/mooofin" }
      ] : isContact ? [
        { label: "Last.fm", href: "https://www.last.fm/user/kxllswxch" },
        { label: "MyAnimeList", href: "https://myanimelist.net/profile/kurapika_99" },
        { label: "Letterboxd", href: "https://letterboxd.com/ptolemeaa4u/" }
      ] : [];
      var socialDiv = document.createElement("div");
      if (socials.length) {
        socialDiv.className = "latex-colophon latex-social-links";
        socials.forEach(function (s, i) {
          var a = document.createElement("a");
          a.href = s.href;
          a.textContent = s.label;
          if (s.href.startsWith("http")) a.target = "_blank";
          socialDiv.appendChild(a);
          if (i < socials.length - 1) socialDiv.appendChild(document.createTextNode(" · "));
        });
        document.body.appendChild(socialDiv);
      }
      document.body.appendChild(c);
    }

    // overfull \hbox black boxes on 1-2 random paragraphs
    if (content && !document.querySelector(".latex-overfull")) {
      var op = Array.prototype.slice.call(content.querySelectorAll("p"));
      op = op.filter(function (p) { return p.textContent.trim().length > 200; });
      for (var b = 0; b < Math.min(2, op.length); b++) {
        var pick = op[Math.floor(Math.random() * op.length)];
        if (pick.querySelector(".latex-overfull")) continue;
        var box = document.createElement("span");
        box.className = "latex-overfull";
        box.title = "Overfull \\hbox (" + (Math.random() * 20 + 1).toFixed(5) + "pt too wide)";
        pick.style.position = "relative";
        pick.appendChild(box);
      }
    }
  }

  // fake pdfTeX .log transcript overlay
  function showFakeLog(logName) {
    var page = logName.replace(/\.log$/, "");
    var log = [
      "This is pdfTeX, Version 3.141592653-2.6-1.40.25 (TeX Live 2023) (preloaded format=pdflatex)",
      " restricted \\write18 enabled.",
      "entering extended mode",
      "**" + page + ".tex",
      "(./" + page + ".tex",
      "LaTeX2e <2023-11-01>",
      "L3 programming layer <2024-01-04>",
      "(/usr/share/texlive/texmf-dist/tex/latex/base/article.cls",
      "Document Class: article 2023/05/17 v1.4n Standard LaTeX document class",
      "(/usr/share/texlive/texmf-dist/tex/latex/base/size10.clo))",
      "(./mooofin.sty",
      "Package: mooofin 2026/07/13 v1.0 personal site macros",
      ")",
      "(./win95-compat.sty",
      "Package: win95-compat 1995/08/24 v4.00.950 backwards compatibility layer",
      "",
      "Package win95-compat Warning: GIFs are not allowed in this mode.",
      "(win95-compat)                All 47 butterflies have been suppressed.",
      "",
      ")",
      "No file " + page + ".aux.",
      "*geometry* driver: auto-detecting",
      "*geometry* detected driver: pdftex",
      "LaTeX Font Info:    Trying to load font information for OT1+lmr",
      "[1{/var/lib/texmf/fonts/map/pdftex/updmap/pdftex.map}]",
      "",
      "Overfull \\hbox (3.14159pt too wide) in paragraph at lines 42--69",
      "\\OT1/lmr/m/n/10 the fit-ness land-scape is es-sen-tially ran-dom at small scales",
      "",
      "Underfull \\vbox (badness 10000) has occurred while \\output is active",
      "",
      "LaTeX Warning: Reference `fig:win95' on page 1 undefined on input line 404.",
      "",
      "[2] [3] (./" + page + ".aux)",
      "",
      "LaTeX Warning: There were undefined references. (there always are)",
      "",
      " )",
      "Output written on " + page + ".pdf (3 pages, 133,700 bytes).",
      "Transcript written on " + page + ".log.",
    ].join("\n");
    var ov = document.createElement("div");
    ov.style.cssText =
      "position:fixed;inset:0;z-index:10001;background:#1c1c1e;color:#d4d4d4;" +
      "font-family:'Courier New',monospace;font-size:12px;line-height:1.5;" +
      "padding:32px;overflow:auto;white-space:pre-wrap;cursor:pointer;";
    ov.textContent = log + "\n\n(click anywhere to close)";
    ov.onclick = function () { ov.remove(); };
    document.body.appendChild(ov);
  }

  document.head.appendChild(cdn);
  document.head.appendChild(local);

  // toggle button: goes in the taskbar tray if there is one, else fixed
  var btn = document.createElement("button");
  btn.id = "latex-toggle";
  btn.title = "Toggle LaTeX mode";
  // \usepackage{gifs} - type it anywhere to smuggle the GIFs back in
  var keyBuf = "";
  document.addEventListener("keydown", function (e) {
    if (e.key.length === 1) keyBuf = (keyBuf + e.key).slice(-20);
    if (keyBuf.endsWith("\\usepackage{gifs}") && isOn()) {
      document.documentElement.classList.add("latex-gifs");
      keyBuf = "";
      var toast = document.querySelector(".latex-gif-toast");
      if (!toast) {
        toast = document.createElement("div");
        toast.className = "latex-gif-toast";
        document.body.appendChild(toast);
      }
      toast.textContent = "Package gifs loaded. (this violates the style guide)";
      toast.style.display = "block";
      setTimeout(function () {
        toast.style.display = "none";
      }, 4000);
    }
  });

  // fake pdflatex compile animation on toggle-on
  function compileAnim(done) {
    var page = (location.pathname.split("/").pop() || "index.html").replace(
      /\.html?$/,
      ""
    );
    var lines = [
      "$ pdflatex " + page + ".tex",
      "This is pdfTeX, Version 3.141592653-2.6-1.40.25 (TeX Live 2023)",
      "entering extended mode",
      "(./" + page + ".tex",
      "LaTeX2e <2023-11-01>",
      "(/usr/share/texlive/texmf-dist/tex/latex/base/article.cls",
      "Document Class: article 2023/05/17 v1.4n Standard LaTeX document class)",
      "(./mooofin.sty) (./win95-compat.sty",
      "Package win95-compat Warning: GIFs are not allowed in this mode.",
      ")",
      "No file " + page + ".aux.",
      "[1{/var/lib/texmf/fonts/map/pdftex/updmap/pdftex.map}]",
      "Overfull \\hbox (3.14159pt too wide) in paragraph at lines 42--69",
      "(./" + page + ".aux) )",
      "Output written on " + page + ".pdf (1 page, 133,700 bytes).",
      "Transcript written on " + page + ".log.",
    ];
    var ov = document.createElement("div");
    ov.style.cssText =
      "position:fixed;inset:0;z-index:10001;background:#1c1c1e;color:#d4d4d4;" +
      "font-family:'Courier New',monospace;font-size:13px;line-height:1.5;" +
      "padding:32px;overflow:hidden;white-space:pre-wrap;";
    document.body.appendChild(ov);
    // 7% of compiles hit an error and wait for Enter, as is tradition
    var failAt = Math.random() < 0.07 ? 8 : -1;
    var i = 0;
    var iv;
    function tick() {
      if (i === failAt) {
        clearInterval(iv);
        ov.textContent +=
          "! Undefined control sequence.\n" +
          "l.404 \\begin{win95}\n" +
          "?\n" +
          "(press Enter to continue, like you always do)\n";
        var onKey = function (e) {
          if (e.key === "Enter") resume();
        };
        var resume = function () {
          document.removeEventListener("keydown", onKey);
          ov.removeEventListener("click", resume);
          ov.textContent += "\n";
          failAt = -1;
          iv = setInterval(tick, 90);
        };
        document.addEventListener("keydown", onKey);
        ov.addEventListener("click", resume);
        return;
      }
      if (i < lines.length) {
        ov.textContent += lines[i] + "\n";
        i++;
      } else {
        clearInterval(iv);
        setTimeout(function () {
          ov.remove();
          done();
        }, 350);
      }
    }
    iv = setInterval(tick, 90);
  }

  // reverse of compileAnim - "decompiles" the pdf back to win95
  function decompileAnim(done) {
    var page = (location.pathname.split("/").pop() || "index.html").replace(
      /\.html?$/,
      ""
    );
    var lines = [
      "$ un-pdflatex " + page + ".pdf",
      "This is un-pdfTeX, Version 1.000000000-0.0-0.01 (TeX Dead 1995)",
      "leaving extended mode",
      "Transcript unwritten from " + page + ".log.",
      "Output unwritten on " + page + ".pdf (0 pages, 0 bytes reclaimed).",
      "Underfull \\hbox (badness 0) restored to original chaos",
      "Package win95-compat Info: re-enabling GIFs. welcome back.",
      "(/usr/share/texlive/texmf-dist/tex/latex/base/article.cls unloaded)",
      "un-entering extended mode",
      "(./" + page + ".tex deleted)",
      "$ start C:\\WINDOWS\\explorer.exe",
      "",
      "        Windows 95 is restarting...",
    ];
    var ov = document.createElement("div");
    ov.style.cssText =
      "position:fixed;inset:0;z-index:10001;background:#1c1c1e;color:#d4d4d4;" +
      "font-family:'Courier New',monospace;font-size:13px;line-height:1.5;" +
      "padding:32px;overflow:hidden;white-space:pre-wrap;";
    document.body.appendChild(ov);
    var i = 0;
    var iv = setInterval(function () {
      if (i < lines.length) {
        ov.textContent += lines[i] + "\n";
        i++;
      } else {
        clearInterval(iv);
        setTimeout(function () {
          ov.remove();
          done();
        }, 400);
      }
    }, 90);
  }

  btn.onclick = function () {
    var on = !isOn();
    sessionStorage.setItem(KEY, on ? "1" : "0");
    if (on) {
      compileAnim(function () {
        apply(true);
      });
    } else {
      decompileAnim(function () {
        apply(false);
      });
    }
  };

  var tray = document.querySelector(".tray");
  if (tray) {
    btn.className = "btn";
    btn.style.cssText = "font-size:11px;padding:1px 6px;cursor:pointer;";
    tray.insertBefore(btn, tray.firstChild);
  } else {
    btn.style.cssText =
      "position:fixed;bottom:16px;right:16px;z-index:9999;font-size:11px;padding:2px 8px;cursor:pointer;";
    document.body.appendChild(btn);
  }

  // dark mode toggle (latex mode only)
  var DKEY = "latexDark";
  var darkBtn = document.createElement("button");
  darkBtn.id = "latex-dark-toggle";
  darkBtn.title = "Toggle dark mode";
  function applyDark(dark) {
    document.documentElement.classList.toggle("latex-dark", dark);
    darkBtn.textContent = dark ? "\\pagecolor{white}" : "\\pagecolor{black}";
  }
  darkBtn.onclick = function () {
    var dark = !(localStorage.getItem(DKEY) === "1");
    localStorage.setItem(DKEY, dark ? "1" : "0");
    applyDark(dark);
  };
  document.body.appendChild(darkBtn);
  applyDark(localStorage.getItem(DKEY) === "1");

  apply(isOn());

  // click-to-zoom for content images (both modes)
  if (!document.getElementById("img-zoom-overlay")) {
    var overlay = document.createElement("div");
    overlay.id = "img-zoom-overlay";
    overlay.style.cssText =
      "display:none;position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.85);cursor:zoom-out;align-items:center;justify-content:center;padding:24px;";
    var zoomed = document.createElement("img");
    zoomed.style.cssText =
      "max-width:100%;max-height:100%;box-shadow:0 0 24px rgba(0,0,0,0.6);";
    overlay.appendChild(zoomed);
    overlay.onclick = function () {
      overlay.style.display = "none";
    };
    document.body.appendChild(overlay);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") overlay.style.display = "none";
    });
  }

  function responsiveVariantUrl(src, width) {
    var clean = src.split("#")[0].split("?")[0];
    return clean.replace(/\.(png|jpe?g|webp)$/i, "-w" + width + ".webp");
  }

  function isResponsiveImageCandidate(img) {
    var src = img.getAttribute("src") || "";
    var style = (img.getAttribute("style") || "").toLowerCase();
    if (!/\.(png|jpe?g|webp)(\?|#)?$/i.test(src)) return false;
    if (/^(https?:|data:)/i.test(src)) return false;
    if (img.classList.contains("icon-16") || img.classList.contains("icon-32")) return false;
    if (style.indexOf("image-rendering: pixelated") !== -1) return false;
    if (/\/?(geocities|icons)\//i.test(src) || /webring|sprite16/i.test(src)) return false;
    if (/havok-engine-reverse-engineering\/image-16\.png$/i.test(src)) return false;
    return /(^|\/|\.\.\/)images\/(posts|vercel)\//i.test(src) || /(^|\/|\.\.\/)images\/gentoo2\.png$/i.test(src);
  }

  function enhanceResponsiveImages(root) {
    (root || document).querySelectorAll(".content-95 img, .blog-content img, .img-container img").forEach(function (img) {
      if (!isResponsiveImageCandidate(img)) return;
      var src = img.getAttribute("src");
      if (!img.dataset.fullsrc) img.dataset.fullsrc = src;
      if (!img.getAttribute("srcset")) {
        img.setAttribute("srcset", [480, 800, 1200, 1600].map(function (w) {
          return responsiveVariantUrl(src, w) + " " + w + "w";
        }).join(", "));
      }
      if (!img.getAttribute("sizes")) {
        img.setAttribute("sizes", "(max-width: 768px) calc(100vw - 24px), 860px");
      }
      if (!img.getAttribute("loading")) img.setAttribute("loading", "lazy");
      if (!img.getAttribute("decoding")) img.setAttribute("decoding", "async");
    });
  }

  enhanceResponsiveImages(document);

  // Bind zoom on initial page load
  document.querySelectorAll(".blog-content img, .img-container img").forEach(function (img) {
    if (img._zoomBound) return;
    img._zoomBound = true;
    var _overlay = document.getElementById("img-zoom-overlay");
    var _zoomed = _overlay ? _overlay.querySelector("img") : null;
    if (!_overlay || !_zoomed) return;
    img.style.cursor = "zoom-in";
    img.addEventListener("click", function () {
      _zoomed.src = img.dataset.fullsrc || img.src;
      _overlay.style.display = "flex";
    });
  });

  // --- PJAX Navigation & Global Audio ---
  // Resolve the site root so audio paths work from any sub-page depth
  var _siteRoot = (function() {
    var s = document.currentScript;
    if (s && s.src) {
      // e.g. http://localhost:8000/site.js  ->  http://localhost:8000/
      return s.src.replace(/\/site\.js[^/]*$/, '/').replace(/\/[^/]*\.html\//, '/');
    }
    return '/';
  })();

  const playlist = [
    { title: "ruby", src: _siteRoot + "public/ruby_beat.mp3" },
    { title: "lemon tea", src: _siteRoot + "public/lemon_tea.mp3" }
  ];
  let currentTrackIdx = 0;
  var _clockInterval = null;

  if (!document.getElementById("bg-music")) {
    var audio = document.createElement("audio");
    audio.id = "bg-music";
    audio.src = playlist[currentTrackIdx].src;
    audio.loop = true;
    document.body.appendChild(audio);
  }
  
  function updateMediaUI() {
    var m = document.getElementById("bg-music");
    var toggle = document.getElementById("music-toggle");
    if (toggle) toggle.textContent = m.paused ? "►" : "||";
    var marquee = document.getElementById("now-playing-marquee");
    if (marquee) marquee.textContent = "🎵 now playing: " + playlist[currentTrackIdx].title;
  }

  function setupGlobalAudio() {
    var m = document.getElementById("bg-music");
    
    // Bind toggle button
    var toggleBtn = document.getElementById("music-toggle");
    if (toggleBtn) {
      var newToggleBtn = toggleBtn.cloneNode(true);
      toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);
      newToggleBtn.addEventListener("click", function() {
        if (m.paused) { m.play(); sessionStorage.setItem("mplay", "1"); }
        else { m.pause(); sessionStorage.setItem("mplay", "0"); }
        updateMediaUI();
      });
    }

    // Bind prev button
    var prevBtn = document.getElementById("music-prev");
    if (prevBtn) {
      var newPrevBtn = prevBtn.cloneNode(true);
      prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
      newPrevBtn.addEventListener("click", function() {
        currentTrackIdx = (currentTrackIdx - 1 + playlist.length) % playlist.length;
        m.src = playlist[currentTrackIdx].src;
        m.play();
        sessionStorage.setItem("mplay", "1");
        updateMediaUI();
      });
    }

    // Bind next button
    var nextBtn = document.getElementById("music-next");
    if (nextBtn) {
      var newNextBtn = nextBtn.cloneNode(true);
      nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
      newNextBtn.addEventListener("click", function() {
        currentTrackIdx = (currentTrackIdx + 1) % playlist.length;
        m.src = playlist[currentTrackIdx].src;
        m.play();
        sessionStorage.setItem("mplay", "1");
        updateMediaUI();
      });
    }

    // Also update taskbar active window title on first load
    var taskbarTitle = document.getElementById("taskbar-title");
    if (taskbarTitle) {
      var shortTitle = document.title.split('-')[0].trim();
      if (!shortTitle.toLowerCase().endsWith('.exe')) shortTitle += '.exe';
      taskbarTitle.textContent = shortTitle;
    }

    updateMediaUI();
  }

  setupGlobalAudio();
  _startClock();
  if (sessionStorage.getItem("mplay") === "1") {
    var m = document.getElementById("bg-music");
    var p = m.play();
    if (p !== undefined) p.then(() => updateMediaUI()).catch(function(){});
  }

  function _updateClock() {
    var clock = document.getElementById("clock");
    if (!clock) return;
    var now = new Date();
    var hours = now.getHours();
    var minutes = now.getMinutes().toString().padStart(2, "0");
    var ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    clock.textContent = hours + ":" + minutes + " " + ampm;
  }

  function _startClock() {
    if (_clockInterval) clearInterval(_clockInterval);
    _updateClock();
    _clockInterval = setInterval(_updateClock, 1000);
  }

  function _bindZoom() {
    var overlay = document.getElementById("img-zoom-overlay");
    var zoomed = overlay ? overlay.querySelector("img") : null;
    if (!overlay || !zoomed) return;
    enhanceResponsiveImages(document);
    document.querySelectorAll(".blog-content img, .img-container img").forEach(function(img) {
      if (img._zoomBound) return;
      img._zoomBound = true;
      img.style.cursor = "zoom-in";
      img.addEventListener("click", function() {
        zoomed.src = img.dataset.fullsrc || img.src;
        overlay.style.display = "flex";
      });
    });
  }

  var highlightLoadPromise = null;

  function installSharedCodeStyles() {
    if (document.getElementById("shared-blog-code-style")) return;
    var style = document.createElement("style");
    style.id = "shared-blog-code-style";
    style.textContent = [
      ".blog-content pre, .window-body .blog-content pre {",
      "  background:#eee;",
      "  border:1px inset #ccc;",
      "  padding:10px;",
      "  overflow-x:auto;",
      "  font-family:\"Courier New\",monospace;",
      "  max-width:100%;",
      "}",
      ".blog-content pre code, .window-body .blog-content pre code {",
      "  background:none !important;",
      "  padding:0 !important;",
      "  border:none !important;",
      "  font-family:\"Courier New\",monospace;",
      "}",
      ".blog-content .hljs, .window-body .blog-content .hljs { background:#fafaf8; color:#212529; }",
      ".blog-content .hljs-keyword, .blog-content .hljs-selector-tag, .blog-content .hljs-section { color:#b0306a; }",
      ".blog-content .hljs-string, .blog-content .hljs-symbol, .blog-content .hljs-addition { color:#2d6a2d; }",
      ".blog-content .hljs-comment { color:#808080; font-style:italic; }",
      ".blog-content .hljs-number, .blog-content .hljs-built_in { color:#7a2d8a; }",
      ".blog-content .hljs-type, .blog-content .hljs-meta, .blog-content .hljs-meta .hljs-keyword { color:#c06030; }",
      ".blog-content .hljs-literal { color:#d49080; }",
      ".blog-content .hljs-title.class_, .blog-content .hljs-title.function_ { color:#212529; }",
      ".blog-content .hljs-attr { color:#b0306a; }",
      ".blog-content .hljs-params { color:#424242; }",
      ".blog-content .hljs-deletion { color:#a04040; }"
    ].join("\n");
    document.head.appendChild(style);
  }

  function ensureHighlightJs() {
    if (window.hljs && typeof window.hljs.highlightElement === "function") return Promise.resolve();
    if (highlightLoadPromise) return highlightLoadPromise;
    if (!document.getElementById("highlight-css-cdn")) {
      var css = document.createElement("link");
      css.id = "highlight-css-cdn";
      css.rel = "stylesheet";
      css.href = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-light.min.css";
      document.head.appendChild(css);
    }
    highlightLoadPromise = loadScriptOnce("highlight-js-cdn", "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js")
      .catch(function () {});
    return highlightLoadPromise;
  }

  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function highlightSolidity(code) {
    var KEYWORDS = ["pragma","solidity","contract","interface","library","function","external","public","private","internal","view","pure","payable","returns","return","memory","storage","calldata","constructor","modifier","require","revert","assert","if","else","for","while","do","break","continue","new","delete","import","is","abstract","virtual","override","event","emit","indexed","struct","enum","mapping","using","assembly","let","this","super"];
    var TYPES = ["uint256","uint","uint8","uint16","uint32","uint64","uint128","int256","int","int8","address","bool","bytes","bytes4","bytes32","string"];
    var LITERALS = ["true","false","msg","block","tx","wei","ether","gwei"];
    var WORD_RE = new RegExp(
      "(\\/\\/[^\\n]*)" +
      '|("(?:[^"\\\\]|\\\\.)*")' +
      "|\\b(" + KEYWORDS.join("|") + ")\\b" +
      "|\\b(" + TYPES.join("|") + ")\\b" +
      "|\\b(" + LITERALS.join("|") + ")\\b" +
      "|\\b(\\d+)\\b",
      "g"
    );

    return escapeHtml(code).replace(WORD_RE, function (m, comment, str, kw, ty, lit, num) {
      if (comment) return '<span class="hljs-comment">' + comment + "</span>";
      if (str) return '<span class="hljs-string">' + str + "</span>";
      if (kw) return '<span class="hljs-keyword">' + kw + "</span>";
      if (ty) return '<span class="hljs-type">' + ty + "</span>";
      if (lit) return '<span class="hljs-literal">' + lit + "</span>";
      if (num) return '<span class="hljs-number">' + num + "</span>";
      return m;
    });
  }

  function highlightRust(code) {
    var KEYWORDS = ["as","async","await","break","const","continue","crate","else","enum","extern","false","fn","for","if","impl","in","let","loop","match","mod","move","mut","pub","ref","return","self","Self","static","struct","super","trait","true","type","unsafe","use","where","while"];
    var TYPES = ["Address","Arc","Http","LocalWallet","Provider","Result","SignerMiddleware","String","Vec","bool","str","u8","u16","u32","u64","u128","usize","i8","i16","i32","i64","i128","isize"];
    var WORD_RE = new RegExp(
      "(\\/\\/[^\\n]*)" +
      '|("(?:[^"\\\\]|\\\\.)*")' +
      "|\\b(" + KEYWORDS.join("|") + ")\\b" +
      "|\\b(" + TYPES.join("|") + ")\\b" +
      "|\\b([A-Za-z_][A-Za-z0-9_]*!)" +
      "|\\b(\\d+(?:u64|usize)?)\\b",
      "g"
    );

    return escapeHtml(code).replace(WORD_RE, function (m, comment, str, kw, ty, macroName, num) {
      if (comment) return '<span class="hljs-comment">' + comment + "</span>";
      if (str) return '<span class="hljs-string">' + str + "</span>";
      if (kw) return '<span class="hljs-keyword">' + kw + "</span>";
      if (ty) return '<span class="hljs-type">' + ty + "</span>";
      if (macroName) return '<span class="hljs-built_in">' + macroName + "</span>";
      if (num) return '<span class="hljs-number">' + num + "</span>";
      return m;
    });
  }

  function highlightAsm(code) {
    var INSTRUCTIONS = ["add","and","b","bl","call","cmp","db","dd","dq","dw","int","ja","jae","jb","jbe","jc","je","jg","jge","jl","jle","jmp","jne","jnz","jz","lea","mov","movabs","nop","or","pop","push","ret","sub","test","xor"];
    var REGISTERS = ["ah","al","ax","bh","bl","bp","bpl","bx","ch","cl","cx","dh","di","dil","dl","dx","eax","ebp","ebx","ecx","edi","edx","eip","esi","esp","ip","r8","r9","r10","r11","r12","r13","r14","r15","rax","rbp","rbx","rcx","rdi","rdx","rip","rsi","rsp","si","sil","sp","spl"];
    var WORD_RE = new RegExp(
      "(;[^\\n]*|//[^\\n]*)" +
      "|\\b(" + INSTRUCTIONS.join("|") + ")\\b" +
      "|\\b(" + REGISTERS.join("|") + ")\\b" +
      "|\\b(0x[0-9a-fA-F]+|\\d+)\\b",
      "gi"
    );

    return escapeHtml(code).replace(WORD_RE, function (m, comment, op, reg, num) {
      if (comment) return '<span class="hljs-comment">' + comment + "</span>";
      if (op) return '<span class="hljs-keyword">' + op + "</span>";
      if (reg) return '<span class="hljs-built_in">' + reg + "</span>";
      if (num) return '<span class="hljs-number">' + num + "</span>";
      return m;
    });
  }

  function highlightAppleScript(code) {
    var KEYWORDS = ["activate","application","as","beep","delay","display","do","else","end","error","if","in","is","not","of","on","open","osascript","repeat","return","set","shell","tell","then","to","try"];
    var WORD_RE = new RegExp(
      "(--[^\\n]*)" +
      '|("(?:[^"\\\\]|\\\\.)*")' +
      "|\\b(" + KEYWORDS.join("|") + ")\\b" +
      "|\\b(\\d+)\\b",
      "gi"
    );

    return escapeHtml(code).replace(WORD_RE, function (m, comment, str, kw, num) {
      if (comment) return '<span class="hljs-comment">' + comment + "</span>";
      if (str) return '<span class="hljs-string">' + str + "</span>";
      if (kw) return '<span class="hljs-keyword">' + kw + "</span>";
      if (num) return '<span class="hljs-number">' + num + "</span>";
      return m;
    });
  }

  function highlightCode(root) {
    root = root || document;
    installSharedCodeStyles();
    root.querySelectorAll("code.language-solidity").forEach(function (block) {
      if (block.dataset.sharedHighlighted === "1") return;
      block.innerHTML = highlightSolidity(block.textContent);
      block.classList.add("hljs");
      block.dataset.sharedHighlighted = "1";
    });
    root.querySelectorAll("code.language-rust").forEach(function (block) {
      if (block.dataset.sharedHighlighted === "1") return;
      block.innerHTML = highlightRust(block.textContent);
      block.classList.add("hljs");
      block.dataset.sharedHighlighted = "1";
    });
    root.querySelectorAll("code.language-asm").forEach(function (block) {
      if (block.dataset.sharedHighlighted === "1") return;
      block.innerHTML = highlightAsm(block.textContent);
      block.classList.add("hljs");
      block.dataset.sharedHighlighted = "1";
    });
    root.querySelectorAll("code.language-applescript").forEach(function (block) {
      if (block.dataset.sharedHighlighted === "1") return;
      block.innerHTML = highlightAppleScript(block.textContent);
      block.classList.add("hljs");
      block.dataset.sharedHighlighted = "1";
    });

    ensureHighlightJs().then(function () {
      if (!window.hljs || typeof window.hljs.highlightElement !== "function") return;
      root.querySelectorAll("pre code").forEach(function (block) {
        if (block.dataset.sharedHighlighted === "1") return;
        try {
          window.hljs.highlightElement(block);
          block.dataset.sharedHighlighted = "1";
        } catch (e) {}
      });
    });
  }

  function bindHandouts(root) {
    root = root || document;
    root.querySelectorAll(".handout-box").forEach(function (box) {
      box.querySelectorAll(".handout-tab").forEach(function (tab) {
        if (tab.dataset.handoutBound === "1") return;
        tab.dataset.handoutBound = "1";
        tab.addEventListener("click", function () {
          var file = tab.getAttribute("data-file");
          box.querySelectorAll(".handout-tab").forEach(function (t) {
            t.classList.toggle("active", t === tab);
          });
          box.querySelectorAll(".handout-pane").forEach(function (p) {
            p.classList.toggle("active", p.getAttribute("data-file") === file);
          });
        });
      });
    });
  }

  function handlePjax(html) {
    var dp = new DOMParser();
    var doc = dp.parseFromString(html, "text/html");
    
    var curDesk = document.querySelector(".desktop");
    var newDesk = doc.querySelector(".desktop");
    if (curDesk && newDesk) curDesk.innerHTML = newDesk.innerHTML;
    
    var curLh = document.querySelector("body > .latex-hide");
    var newLh = doc.querySelector("body > .latex-hide");
    if (curLh && newLh) curLh.innerHTML = newLh.innerHTML;
    
    // Do NOT replace the taskbar (keeps audio playing & events bound)
    document.title = doc.title;
    
    // Update the active window title in taskbar
    var taskbarTitle = document.getElementById("taskbar-title");
    if (taskbarTitle) {
      var shortTitle = document.title.split('-')[0].trim();
      if (!shortTitle.toLowerCase().endsWith('.exe')) shortTitle += '.exe';
      taskbarTitle.textContent = shortTitle;
    }
    
    var content = document.querySelector(".blog-content");
    document.body.classList.toggle("latex-blog-post", isOn() && !!content);
    if (content) delete content.dataset.mathRendered;
    if (isOn()) decorate();
    bindHandouts(document);
    highlightCode(document);
    renderLatexMath(content);
    
    // Clock: update immediately (interval already running from _startClock)
    _updateClock();

    // Re-bind zoom on newly injected blog images
    _bindZoom();

    // Execute inline scripts from the loaded page so they initialize properly
    doc.querySelectorAll("script").forEach(function(s) {
      if (!s.src && s.textContent) {
        try {
          var execScript = document.createElement("script");
          execScript.textContent = s.textContent;
          document.body.appendChild(execScript).parentNode.removeChild(execScript);
        } catch(err) {
          console.error("Error executing PJAX page script:", err);
        }
      }
    });
  }

  bindHandouts(document);
  highlightCode(document);

  document.addEventListener("click", function(e) {
    var a = e.target.closest("a");
    if (!a || !a.href || a.target === "_blank") return;
    if (a.hasAttribute("download")) return;
    try {
      var u = new URL(a.href);
      if (u.origin !== location.origin) return;
      if (!/\.html?$|\/$/.test(u.pathname)) return;
      if (u.pathname === location.pathname && u.hash) return;
      
      e.preventDefault();
      fetch(u.href).then(function(res) {
        if (!res.ok) throw new Error("Navigation failed: " + res.status);
        var type = res.headers.get("content-type") || "";
        if (!type.includes("text/html")) throw new Error("Not an HTML page");
        return res.text();
      }).then(function(html) {
        history.pushState(null, "", u.href);
        handlePjax(html);
        window.scrollTo(0, 0);
      }).catch(function(err) {
        location.href = a.href;
      });
    } catch(err) {
      location.href = a.href;
    }
  });

  window.addEventListener("popstate", function(e) {
    fetch(location.href).then(function(res) { return res.text(); }).then(function(html) {
      handlePjax(html);
    });
  });

})();
