(function () {
  "use strict";

  const K = {
    theme: "qz_theme_v1",
    fontSize: "qz_font_size_v1",
    tab: "qz_notes_tab_v1",
  };

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
  const tabsEl = document.getElementById("tabs");

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

  /* ---------- 内联标记 ---------- */
  function inlineFmt(s) {
    let out = esc(s);
    out = out.replace(/==([^=]+)==/g, '<span class="kw-hl">$1</span>');
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong class="kw">$1</strong>');
    return out;
  }

  /* ---------- 主题 ---------- */
  function getTheme() {
    return LS.get(K.theme, "light");
  }
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", getTheme());
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta)
      meta.setAttribute(
        "content",
        getTheme() === "dark" ? "#0f172a" : "#fbfbfd",
      );
  }
  function toggleTheme() {
    LS.set(K.theme, getTheme() === "dark" ? "light" : "dark");
    applyTheme();
    render();
  }

  /* ---------- 字号 ---------- */
  const FS = ["14px", "15px", "16px", "17px", "18px"];
  function getFsIdx() {
    const v = LS.get(K.fontSize, 1);
    return Math.max(0, Math.min(FS.length - 1, v));
  }
  function applyFs() {
    document.documentElement.style.setProperty("--font-size", FS[getFsIdx()]);
  }
  function changeFs(delta) {
    const next = getFsIdx() + delta;
    if (next < 0 || next >= FS.length) return;
    LS.set(K.fontSize, next);
    applyFs();
  }

  function updateReadProgress() {
    const bar = document.querySelector(".read-progress-bar");
    if (!bar) return;
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const p = h <= 0 ? 0 : (window.scrollY / h) * 100;
    bar.style.width = Math.max(0, Math.min(100, p)) + "%";
  }
  function updateBackTop() {
    const btn = document.querySelector(".back-top");
    if (!btn) return;
    if (window.scrollY > 400) btn.classList.add("show");
    else btn.classList.remove("show");
  }

  function getAll() {
    return window.ALL_NOTES || [];
  }

  /* ---------- 当前 Tab（支持 URL ?tab=xxx） ---------- */
  function getTabId() {
    const all = getAll();

    // 1. 优先读 URL 参数 ?tab=xxx
    let urlTab = null;
    try {
      urlTab = new URLSearchParams(window.location.search).get("tab");
    } catch (e) {}

    if (
      urlTab &&
      all.some(function (m) {
        return m.id === urlTab;
      })
    ) {
      LS.set(K.tab, urlTab);
      return urlTab;
    }

    // 2. 其次读 localStorage
    const saved = LS.get(K.tab, null);
    if (
      saved &&
      all.some(function (m) {
        return m.id === saved;
      })
    )
      return saved;

    // 3. 默认第一个
    return all[0] ? all[0].id : null;
  }

  function setTabId(id) {
    LS.set(K.tab, id);
    activeIdx = -1;
    render();
  }

  function renderTabs() {
    const all = getAll();
    const cur = getTabId();
    tabsEl.innerHTML = all
      .map(function (m) {
        const cnt = m.sections.reduce(function (s, sec) {
          return (
            s +
            sec.groups.reduce(function (ss, g) {
              return ss + g.items.length;
            }, 0)
          );
        }, 0);
        return (
          '<button class="tab' +
          (m.id === cur ? " active" : "") +
          '" data-act="tab" data-id="' +
          m.id +
          '">' +
          esc(m.title) +
          '<span class="tab-cnt">' +
          cnt +
          "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  let activeIdx = -1;
  function updateCrumbAndActive() {
    const sections = document.querySelectorAll(".chapter");
    const idxItems = document.querySelectorAll(".idx-item");
    if (!sections.length) return;

    const scrollY = window.scrollY + 200;
    let active = 0;
    sections.forEach(function (sec, i) {
      if (sec.offsetTop <= scrollY) active = i;
    });

    if (active === activeIdx) return;
    activeIdx = active;

    const curEl = document.querySelector(".crumb-item.current");
    if (curEl && sections[active]) {
      const titleEl = sections[active].querySelector(".chapter-title");
      if (titleEl) curEl.textContent = titleEl.textContent;
    }
    idxItems.forEach(function (item, i) {
      item.classList.toggle("current", i === active);
    });
  }

  function renderModule() {
    const all = getAll();
    const cur = getTabId();
    const m = all.find(function (x) {
      return x.id === cur;
    });

    if (!m) {
      viewEl.innerHTML =
        '<div class="view"><p class="empty">暂无数据</p></div>';
      return;
    }

    topbarEl.innerHTML =
      '<a class="tb-btn" href="../quiz.html">‹ 刷题</a>' +
      '<div class="tb-title">知识点速查</div>' +
      '<button class="tb-icon" data-act="theme">' +
      (getTheme() === "dark" ? "☀️" : "🌙") +
      "</button>";

    let totalItems = 0;
    const sectionsHtml = m.sections
      .map(function (sec, si) {
        const groupsHtml = sec.groups
          .map(function (g) {
            const itemsHtml = g.items
              .map(function (it) {
                totalItems++;
                const type = it.type || "normal";
                const cls =
                  type === "normal" ? "note-item" : "note-item " + type;
                return (
                  '<li class="' +
                  cls +
                  '">' +
                  "<b>" +
                  esc(it.t) +
                  "</b>" +
                  inlineFmt(it.d) +
                  "</li>"
                );
              })
              .join("");
            return (
              '<h3 class="group-title">' +
              esc(g.title) +
              "</h3>" +
              '<ul class="note-list">' +
              itemsHtml +
              "</ul>"
            );
          })
          .join("");

        return (
          '<section class="chapter" id="sec-' +
          si +
          '">' +
          '<h2 class="chapter-title">' +
          esc(sec.title) +
          "</h2>" +
          groupsHtml +
          "</section>"
        );
      })
      .join("");

    const idxItemsHtml = m.sections
      .map(function (sec, i) {
        const cnt = sec.groups.reduce(function (s, g) {
          return s + g.items.length;
        }, 0);
        return (
          '<a class="idx-item" data-idx="' +
          i +
          '" data-act="idx-jump">' +
          '<span class="num">' +
          (i + 1) +
          "</span>" +
          '<span class="title">' +
          esc(sec.title) +
          "</span>" +
          '<span class="cnt">' +
          cnt +
          "</span>" +
          "</a>"
        );
      })
      .join("");

    const firstTitle = m.sections[0] ? m.sections[0].title : "";

    viewEl.innerHTML =
      '<div class="read-progress"><div class="read-progress-bar"></div></div>' +
      '<div class="crumb-bar">' +
      '<div class="crumb-list">' +
      '<span class="crumb-item">' +
      esc(m.title) +
      "</span>" +
      '<span class="crumb-sep">/</span>' +
      '<span class="crumb-item current">' +
      esc(firstTitle) +
      "</span>" +
      "</div>" +
      '<button class="crumb-toggle" data-act="idx-open">📑 目录</button>' +
      "</div>" +
      '<div class="search-wrap">' +
      '<input id="search" class="search-input" type="search" placeholder="搜索本模块知识点…">' +
      "</div>" +
      '<div class="view">' +
      '<h1 class="book-title">' +
      esc(m.title) +
      "</h1>" +
      '<p class="book-sub">' +
      esc(m.sub) +
      " · 共 " +
      totalItems +
      " 条</p>" +
      sectionsHtml +
      '<p class="footer-tip">右下角 A+ / A− 调节字号 · 左下角 ↑ 回到顶部</p>' +
      "</div>" +
      '<div class="fs-panel">' +
      '<button class="fs-btn" data-act="fs-plus">A+</button>' +
      '<button class="fs-btn" data-act="fs-minus">A−</button>' +
      "</div>" +
      '<button class="back-top" data-act="back-top">↑</button>' +
      '<div class="idx-panel" id="idx-panel">' +
      '<div class="idx-mask" data-act="idx-close"></div>' +
      '<div class="idx-panel-body">' +
      '<div class="idx-panel-head">索 引</div>' +
      '<div class="idx-panel-list">' +
      idxItemsHtml +
      "</div>" +
      "</div>" +
      "</div>";

    const input = document.getElementById("search");
    input.addEventListener("input", function () {
      const kw = this.value.trim();
      if (kw) renderSearch(kw, m);
      else render();
    });

    window.scrollTo(0, 0);
    updateReadProgress();
    updateBackTop();
    activeIdx = -1;
    updateCrumbAndActive();
  }

  function openIdxPanel() {
    const panel = document.getElementById("idx-panel");
    if (panel) panel.classList.add("show");
  }
  function closeIdxPanel() {
    const panel = document.getElementById("idx-panel");
    if (panel) panel.classList.remove("show");
  }
  function jumpToSection(i) {
    const el = document.getElementById("sec-" + i);
    if (el) window.scrollTo({ top: el.offsetTop - 180, behavior: "smooth" });
    closeIdxPanel();
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

  function renderSearch(kw, m) {
    const results = [];
    m.sections.forEach(function (sec) {
      sec.groups.forEach(function (g) {
        g.items.forEach(function (it) {
          if (
            (it.t + " " + it.d).toLowerCase().indexOf(kw.toLowerCase()) >= 0
          ) {
            results.push({ sec: sec.title, group: g.title, item: it });
          }
        });
      });
    });

    const header =
      '<div class="read-progress"><div class="read-progress-bar"></div></div>' +
      '<div class="crumb-bar">' +
      '<div class="crumb-list">' +
      '<span class="crumb-item">' +
      esc(m.title) +
      "</span>" +
      '<span class="crumb-sep">/</span>' +
      '<span class="crumb-item current">搜索结果</span>' +
      "</div>" +
      "</div>" +
      '<div class="search-wrap">' +
      '<input id="search" class="search-input" type="search" value="' +
      esc(kw) +
      '">' +
      "</div>";

    if (!results.length) {
      viewEl.innerHTML =
        header +
        '<div class="view"><div class="empty">没有找到包含“' +
        esc(kw) +
        "”的知识点</div></div>";
      bindSearchInput(m);
      return;
    }

    const itemsHtml = results
      .map(function (r) {
        return (
          "<li>" +
          "<b>" +
          highlight(r.item.t, kw) +
          "</b>" +
          highlight(r.item.d, kw) +
          '<span class="r-path">' +
          esc(r.sec) +
          " · " +
          esc(r.group) +
          "</span>" +
          "</li>"
        );
      })
      .join("");

    viewEl.innerHTML =
      header +
      '<div class="view">' +
      '<p class="result-head">共 ' +
      results.length +
      " 条结果</p>" +
      '<ul class="result-list">' +
      itemsHtml +
      "</ul>" +
      "</div>";
    bindSearchInput(m);
  }

  function bindSearchInput(m) {
    const input = document.getElementById("search");
    if (!input) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    input.addEventListener("input", function () {
      const kw = this.value.trim();
      if (kw) renderSearch(kw, m);
      else render();
    });
  }

  function render() {
    renderTabs();
    renderModule();
  }

  document.addEventListener("click", function (e) {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;
    if (act === "theme") {
      toggleTheme();
      return;
    }
    if (act === "fs-plus") {
      changeFs(1);
      return;
    }
    if (act === "fs-minus") {
      changeFs(-1);
      return;
    }
    if (act === "back-top") window.scrollTo({ top: 0, behavior: "smooth" });
    if (act === "tab") {
      setTabId(el.dataset.id);
      return;
    }
    if (act === "idx-open") {
      openIdxPanel();
      return;
    }
    if (act === "idx-close") {
      closeIdxPanel();
      return;
    }
    if (act === "idx-jump") {
      jumpToSection(Number(el.dataset.idx));
      return;
    }
  });

  window.addEventListener(
    "scroll",
    function () {
      updateReadProgress();
      updateBackTop();
      updateCrumbAndActive();
    },
    { passive: true },
  );

  window.addEventListener("resize", updateReadProgress);

  applyTheme();
  applyFs();
  render();
})();
