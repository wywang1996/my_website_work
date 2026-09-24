(function () {
  "use strict";

  const K = { theme: "qz_theme_v1" };

  const LS = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v == null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {}
    },
  };

  const viewEl = document.getElementById("view");
  const topbarEl = document.getElementById("topbar");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }

  function getTheme() {
    return LS.get(K.theme, "light");
  }
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", getTheme());
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta)
      meta.setAttribute(
        "content",
        getTheme() === "dark" ? "#0f172a" : "#2563eb",
      );
  }
  function toggleTheme() {
    LS.set(K.theme, getTheme() === "dark" ? "light" : "dark");
    applyTheme();
    render();
  }

  function highlight(text, kw) {
    if (!kw) return esc(text);
    const safe = esc(text);
    const re = new RegExp(
      "(" + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")",
      "gi",
    );
    return safe.replace(re, "<mark>$1</mark>");
  }

  /* ---------- 首页 ---------- */
  function renderHome() {
    topbarEl.innerHTML =
      '<div class="tb-title">📖 知识点速查</div>' +
      '<a class="tb-btn" href="../quiz_app/index.html">去刷题</a>' +
      '<button class="tb-icon" data-act="theme">' +
      (getTheme() === "dark" ? "☀️" : "🌙") +
      "</button>";

    const cards = window.NOTES.map(function (m) {
      const cnt = m.sections.reduce(function (s, sec) {
        return s + sec.items.length;
      }, 0);
      return (
        '<button class="card" data-act="open" data-id="' +
        m.id +
        '">' +
        '<span class="card-name">' +
        esc(m.title) +
        "</span>" +
        '<span class="card-sub">' +
        cnt +
        " 个知识点 · " +
        esc(m.sub) +
        "</span>" +
        "</button>"
      );
    }).join("");

    viewEl.innerHTML =
      '<div class="search-wrap">' +
      '<input id="search" class="search-input" type="search" placeholder="搜索知识点（如：光年、增长率、三大法宝）">' +
      "</div>" +
      '<div class="view">' +
      '<div class="grid">' +
      cards +
      "</div>" +
      '<p style="font-size:12px;color:var(--sub);text-align:center;margin-top:20px;">点击模块展开知识点 · 支持全文搜索</p>' +
      "</div>";

    const input = document.getElementById("search");
    input.addEventListener("input", function () {
      const kw = this.value.trim();
      if (kw) renderSearch(kw);
      else render();
    });
  }

  /* ---------- 搜索结果 ---------- */
  function renderSearch(kw) {
    const results = [];
    window.NOTES.forEach(function (m) {
      m.sections.forEach(function (sec) {
        sec.items.forEach(function (it) {
          if (
            (it.t + " " + it.d).toLowerCase().indexOf(kw.toLowerCase()) >= 0
          ) {
            results.push({ mod: m.title, sec: sec.title, item: it });
          }
        });
      });
    });

    const header =
      '<div class="search-wrap"><input id="search" class="search-input" type="search" value="' +
      esc(kw) +
      '"></div>';

    if (!results.length) {
      viewEl.innerHTML =
        header +
        '<div class="empty">没有找到包含“' +
        esc(kw) +
        "”的知识点</div>";
      bindSearchInput();
      return;
    }

    const html = results
      .map(function (r) {
        const type = r.item.type || "normal";
        return (
          '<div class="kp ' +
          (type === "normal" ? "" : type) +
          '">' +
          '<div class="kp-t">' +
          highlight(r.item.t, kw) +
          "</div>" +
          '<div class="kp-d">' +
          highlight(r.item.d, kw) +
          "</div>" +
          '<div style="font-size:12px;color:var(--sub);margin-top:4px;">' +
          esc(r.mod) +
          " · " +
          esc(r.sec) +
          "</div>" +
          "</div>"
        );
      })
      .join("");

    viewEl.innerHTML =
      header +
      '<div class="view">' +
      '<p style="font-size:13px;color:var(--sub);margin:0 0 10px;">共找到 ' +
      results.length +
      " 条结果</p>" +
      html +
      "</div>";
    bindSearchInput();
  }

  function bindSearchInput() {
    const input = document.getElementById("search");
    if (!input) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    input.addEventListener("input", function () {
      const kw = this.value.trim();
      if (kw) renderSearch(kw);
      else render();
    });
  }

  /* ---------- 模块详情 ---------- */
  function renderModule(id) {
    const m = window.NOTES.find(function (x) {
      return x.id === id;
    });
    if (!m) {
      renderHome();
      return;
    }

    topbarEl.innerHTML =
      '<button class="tb-btn" data-act="back">‹ 返回</button>' +
      '<div class="tb-title">' +
      esc(m.title) +
      "</div>" +
      '<button class="tb-icon" data-act="theme">' +
      (getTheme() === "dark" ? "☀️" : "🌙") +
      "</button>";

    const sectionsHtml = m.sections
      .map(function (sec, si) {
        const itemsHtml = sec.items
          .map(function (it) {
            const type = it.type || "normal";
            return (
              '<div class="kp ' +
              (type === "normal" ? "" : type) +
              '">' +
              '<div class="kp-t">' +
              esc(it.t) +
              "</div>" +
              '<div class="kp-d">' +
              esc(it.d) +
              "</div>" +
              "</div>"
            );
          })
          .join("");

        return (
          '<div class="fold' +
          (si === 0 ? " open" : "") +
          '" data-fold>' +
          '<div class="fold-head" data-act="fold">' +
          "<span>" +
          esc(sec.title) +
          "</span>" +
          '<span class="arrow">▶</span>' +
          "</div>" +
          '<div class="fold-body">' +
          itemsHtml +
          "</div>" +
          "</div>"
        );
      })
      .join("");

    viewEl.innerHTML =
      '<div class="search-wrap">' +
      '<input id="search" class="search-input" type="search" placeholder="搜索本模块知识点">' +
      "</div>" +
      '<div class="view">' +
      sectionsHtml +
      "</div>";

    const input = document.getElementById("search");
    input.addEventListener("input", function () {
      const kw = this.value.trim().toLowerCase();
      const folds = viewEl.querySelectorAll("[data-fold]");
      folds.forEach(function (f) {
        let hasMatch = false;
        f.querySelectorAll(".kp").forEach(function (kp) {
          const match = !kw || kp.textContent.toLowerCase().indexOf(kw) >= 0;
          kp.style.display = match ? "" : "none";
          if (match) hasMatch = true;
        });
        f.style.display = hasMatch ? "" : "none";
        if (kw && hasMatch) f.classList.add("open");
      });
    });
  }

  /* ---------- 路由 ---------- */
  function getHash() {
    return window.location.hash.replace(/^#\/?/, "") || "";
  }
  function render() {
    const id = getHash();
    if (id) renderModule(id);
    else renderHome();
    window.scrollTo(0, 0);
  }

  /* ---------- 事件 ---------- */
  document.addEventListener("click", function (e) {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;
    if (act === "theme") {
      toggleTheme();
      return;
    }
    if (act === "back") {
      window.location.hash = "";
      return;
    }
    if (act === "open") {
      window.location.hash = el.dataset.id;
      return;
    }
    if (act === "fold") {
      const fold = el.closest("[data-fold]");
      if (fold) fold.classList.toggle("open");
    }
  });

  window.addEventListener("hashchange", render);

  applyTheme();
  render();
})();
