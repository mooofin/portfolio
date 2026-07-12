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
  local.href = base + "latex-mode.css";

  function isOn() {
    return localStorage.getItem(KEY) === "1";
  }

  function apply(on) {
    document.documentElement.classList.toggle("latex-mode", on);
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
        ".latex-author, .latex-colophon, .latex-toc, .latex-pagenum, .latex-arxiv, .latex-marginnote, .latex-qed, .latex-vimline"
      )
      .forEach(function (el) {
        el.style.display = on ? "" : "none";
      });
    var btn = document.getElementById("latex-toggle");
    if (btn) btn.textContent = on ? "\\end{document}" : "TeX";
  }

  // \author{} \date{} block under the title + colophon at page end
  function decorate() {
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

    // \marginpar reviewer-2 notes on random paragraphs
    if (content && !document.querySelector(".latex-marginnote")) {
      var notes = [
        "citation needed",
        "why?",
        "is this rigorous?",
        "left as an exercise to the reader",
        "[reviewer 2: unclear]",
        "TODO: verify",
        "cf. Knuth, vol. 3",
        "nice.",
        "see Appendix B",
        "trivially follows",
      ];
      var paras = Array.prototype.slice.call(content.querySelectorAll("p"));
      paras = paras.filter(function (p) {
        return p.textContent.trim().length > 120;
      });
      var count = Math.min(3, paras.length);
      var used = {};
      for (var k = 0; k < count; k++) {
        var idx;
        do {
          idx = Math.floor(Math.random() * paras.length);
        } while (used[idx]);
        used[idx] = true;
        var note = document.createElement("span");
        note.className = "latex-marginnote";
        note.textContent = notes[Math.floor(Math.random() * notes.length)];
        paras[idx].style.position = "relative";
        note.style.top = "0";
        paras[idx].appendChild(note);
      }
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
      qed.title = "q.e.d. (click to decompile)";
      qed.onclick = function () {
        localStorage.setItem(KEY, "0");
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
    });

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
      c.textContent =
        "Compiled with pdfTeX on " +
        months[now.getMonth()] + " " + now.getDate() + ", " + now.getFullYear() +
        " · latex.css";
      document.body.appendChild(c);
    }
  }

  document.head.appendChild(cdn);
  document.head.appendChild(local);

  // toggle button: goes in the taskbar tray if there is one, else fixed
  var btn = document.createElement("button");
  btn.id = "latex-toggle";
  btn.title = "Toggle LaTeX mode";
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
        }, 350);
      }
    }, 90);
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
    localStorage.setItem(KEY, on ? "1" : "0");
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

  document
    .querySelectorAll(".blog-content img, .img-container img")
    .forEach(function (img) {
      img.style.cursor = "zoom-in";
      img.addEventListener("click", function () {
        zoomed.src = img.src;
        overlay.style.display = "flex";
      });
    });
})();
