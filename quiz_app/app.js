(function () {
  "use strict";

  /* ============================================================
     一、常量与工具
     ============================================================ */
  const K = {
    wrong: "qz_wrong_v1",
    fav: "qz_fav_v1",
    stats: "qz_stats_v1",
    progress: "qz_progress_v1",
    theme: "qz_theme_v1",
    session: "qz_session_v1",
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
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

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

  function cleanOpt(s) {
    return String(s).replace(/^\s*[A-Za-z][\.、．)）]\s*/, "");
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    const x = a.slice().sort().join(",");
    const y = b.slice().sort().join(",");
    return x === y;
  }

  /* ============================================================
     二、主题
     ============================================================ */
  function getTheme() {
    return LS.get(K.theme, "light");
  }
  function applyTheme() {
    const theme = getTheme();
    document.documentElement.setAttribute("data-theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta)
      meta.setAttribute("content", theme === "dark" ? "#0f172a" : "#2563eb");
  }
  function toggleTheme() {
    LS.set(K.theme, getTheme() === "dark" ? "light" : "dark");
    applyTheme();
    if (session) renderQuestion();
    else renderHome();
  }

  /* ============================================================
     三、题库读取
     ============================================================ */
  function getAllQuestions() {
    const all = [];
    const data = window.ModuleData || {};
    Object.keys(data).forEach(function (mod) {
      (data[mod] || []).forEach(function (q) {
        all.push(Object.assign({}, q, { module: mod }));
      });
    });
    return all;
  }

  function getModules() {
    return Object.keys(window.ModuleData || {});
  }

  /* ============================================================
     四、本地存储：错题、收藏、统计、进度
     ============================================================ */
  function getWrong() {
    return LS.get(K.wrong, []);
  }
  function addWrong(id) {
    const w = getWrong();
    if (w.indexOf(id) < 0) {
      w.push(id);
      LS.set(K.wrong, w);
    }
  }
  function removeWrong(id) {
    const w = getWrong();
    const i = w.indexOf(id);
    if (i >= 0) {
      w.splice(i, 1);
      LS.set(K.wrong, w);
    }
  }

  function getFav() {
    return LS.get(K.fav, []);
  }
  function toggleFav(id) {
    const f = getFav();
    const i = f.indexOf(id);
    if (i >= 0) f.splice(i, 1);
    else f.push(id);
    LS.set(K.fav, f);
    return i < 0;
  }

  function getStats() {
    return LS.get(K.stats, { total: 0, correct: 0 });
  }
  function bumpStats(ok) {
    const s = getStats();
    s.total = (s.total || 0) + 1;
    if (ok) s.correct = (s.correct || 0) + 1;
    LS.set(K.stats, s);
  }

  /* ============================================================
     五、会话状态
     ============================================================ */
  let session = null;

  function currentQuestion() {
    return session ? session.list[session.index] : null;
  }
  function getUserAnswer(q) {
    return (session && session.userAnswers[q.id]) || [];
  }
  function setUserAnswer(q, arr) {
    if (!session) return;
    session.userAnswers[q.id] = arr.slice();
  }
  function isQuestionSubmitted(q) {
    if (!session) return false;
    if (session.reviewMode) return true;
    if (session.mode === "exam") return session.examSubmitted;
    return !!session.submittedMap[q.id];
  }

  /* ============================================================
     六、会话快照（刷新恢复）
     ============================================================ */
  function saveSessionSnapshot() {
    if (!session) {
      LS.set(K.session, null);
      return;
    }
    const snapshot = {
      mode: session.mode,
      module: session.module,
      title: session.title,
      questionIds: session.list.map(function (q) {
        return q.id;
      }),
      index: session.index,
      userAnswers: session.userAnswers,
      submittedMap: session.submittedMap,
      examSubmitted: session.examSubmitted,
      reviewMode: session.reviewMode,
      correctCount: session.correctCount,
      wrongCount: session.wrongCount,
      counted: session.counted,
      savedAt: Date.now(),
    };
    LS.set(K.session, snapshot);
  }
  function clearSessionSnapshot() {
    LS.set(K.session, null);
  }
  function restoreSession() {
    const snap = LS.get(K.session, null);
    if (!snap || !snap.questionIds || !snap.questionIds.length) return false;

    const all = getAllQuestions();
    const byId = {};
    all.forEach(function (q) {
      byId[q.id] = q;
    });
    const list = snap.questionIds
      .map(function (id) {
        return byId[id];
      })
      .filter(Boolean);

    if (list.length !== snap.questionIds.length) {
      clearSessionSnapshot();
      return false;
    }

    session = {
      mode: snap.mode,
      module: snap.module || "",
      title: snap.title,
      list: list,
      index: Math.min(snap.index || 0, list.length - 1),
      userAnswers: snap.userAnswers || {},
      submittedMap: snap.submittedMap || {},
      examSubmitted: !!snap.examSubmitted,
      reviewMode: !!snap.reviewMode,
      correctCount: snap.correctCount || 0,
      wrongCount: snap.wrongCount || 0,
      counted: snap.counted || {},
    };
    return true;
  }
  function getSavedSessionSummary() {
    const snap = LS.get(K.session, null);
    if (!snap || !snap.questionIds || !snap.questionIds.length) return null;
    return {
      title: snap.title || "未命名练习",
      index: (snap.index || 0) + 1,
      total: snap.questionIds.length,
      mode: snap.mode,
      module: snap.module || "",
    };
  }

  /* ============================================================
     七、首页
     ============================================================ */
  function renderHome() {
    session = null;

    const stats = getStats();
    const rate = stats.total
      ? Math.round((stats.correct / stats.total) * 100)
      : 0;
    const modules = getModules();
    const wrongN = getWrong().length;
    const favN = getFav().length;
    const progress = LS.get(K.progress, {});
    const saved = getSavedSessionSummary();

    topbarEl.innerHTML =
      '<button class="tb-back" data-act="portal">‹ 主页</button>' +
      '<div class="tb-title">📚 智能刷题</div>' +
      '<button class="tb-icon-btn" data-act="theme">' +
      (getTheme() === "dark" ? "☀️" : "🌙") +
      "</button>";

    const resumeBanner = saved
      ? '<button class="card wide resume" data-act="resume">' +
        '<span class="card-name">▶️ 继续上次练习</span>' +
        '<span class="card-sub">' +
        esc(saved.title) +
        " · 第 " +
        saved.index +
        " / " +
        saved.total +
        " 题</span>" +
        "</button>"
      : "";

    const moduleCards = modules
      .map(function (m, i) {
        const n = (window.ModuleData[m] || []).length;
        let sub = n + " 题 · 逐题解析";
        if (progress[m] != null && progress[m] > 0 && progress[m] < n) {
          sub += " · 上次做到第 " + (progress[m] + 1) + " 题";
        }
        return (
          '<button class="card" data-act="start" data-mode="module" data-mi="' +
          i +
          '">' +
          '<span class="card-name">' +
          esc(m) +
          "</span>" +
          '<span class="card-sub">' +
          sub +
          "</span>" +
          "</button>"
        );
      })
      .join("");

    viewEl.innerHTML =
      '<section class="stat-card">' +
      '<div class="stat-item"><b>' +
      stats.total +
      "</b><span>累计答题</span></div>" +
      '<div class="stat-item"><b>' +
      stats.correct +
      "</b><span>答对</span></div>" +
      '<div class="stat-item"><b>' +
      rate +
      '<i style="font-size:13px;font-style:normal;">%</i></b><span>正确率</span></div>' +
      "</section>" +
      (resumeBanner
        ? '<div class="grid" style="margin-bottom:20px;">' +
          resumeBanner +
          "</div>"
        : "") +
      '<h2 class="sec-title">📝 全题库模拟（交卷后看答案）</h2>' +
      '<div class="grid">' +
      '<button class="card wide" data-act="start" data-mode="exam">' +
      '<span class="card-name">🎯 开始全题库模拟</span>' +
      '<span class="card-sub">随机抽取 20 题 · 交卷后统一评分与解析</span>' +
      "</button>" +
      "</div>" +
      '<h2 class="sec-title">📖 单项刷题（做完立即看解析）</h2>' +
      '<div class="grid">' +
      moduleCards +
      "</div>" +
      '<h2 class="sec-title">📂 我的题库</h2>' +
      '<div class="grid">' +
      '<button class="card" data-act="start" data-mode="wrong">' +
      '<span class="card-name">📕 错题本</span>' +
      '<span class="card-sub">' +
      wrongN +
      " 题</span>" +
      "</button>" +
      '<button class="card" data-act="start" data-mode="fav">' +
      '<span class="card-name">⭐ 我的收藏</span>' +
      '<span class="card-sub">' +
      favN +
      " 题</span>" +
      "</button>" +
      "</div>" +
      '<div class="foot">' +
      '<button class="btn ghost small" data-act="reset-stats">清空统计数据</button>' +
      "</div>" +
      '<p class="tip">数据仅保存在本机浏览器 · 电脑端 A/B/C/D 选择、← → 翻页、S 收藏、M 答题卡</p>';

    window.scrollTo(0, 0);
  }

  /* ============================================================
     八、开始练习
     ============================================================ */
  function startPractice(mode, moduleName) {
    let list = [];
    let title = "";

    if (mode === "module") {
      list = (window.ModuleData[moduleName] || []).map(function (q) {
        return Object.assign({}, q, { module: moduleName });
      });
      title = moduleName;
    } else if (mode === "exam") {
      const all = getAllQuestions();
      if (!all.length) {
        alert("题库为空");
        return;
      }
      list = shuffle(all.slice()).slice(0, Math.min(20, all.length));
      title = "全题库模拟";
    } else if (mode === "wrong") {
      const ids = getWrong();
      list = getAllQuestions().filter(function (q) {
        return ids.indexOf(q.id) >= 0;
      });
      title = "错题本";
    } else if (mode === "fav") {
      const ids = getFav();
      list = getAllQuestions().filter(function (q) {
        return ids.indexOf(q.id) >= 0;
      });
      title = "我的收藏";
    }

    if (!list.length) {
      alert("这里还没有题目。");
      return;
    }

    let startIndex = 0;
    if (mode === "module" && moduleName) {
      const progress = LS.get(K.progress, {});
      if (
        progress[moduleName] != null &&
        progress[moduleName] >= 0 &&
        progress[moduleName] < list.length
      ) {
        startIndex = progress[moduleName];
      }
    }

    session = {
      mode: mode,
      module: moduleName || "",
      title: title,
      list: list,
      index: startIndex,
      userAnswers: {},
      submittedMap: {},
      examSubmitted: false,
      reviewMode: false,
      correctCount: 0,
      wrongCount: 0,
      counted: {},
    };

    renderQuestion();
    window.scrollTo(0, 0);
  }

  /* ============================================================
     九、答题页
     ============================================================ */
  function renderQuestion() {
    if (!session) return;

    if (session.mode === "module" && session.module) {
      const progress = LS.get(K.progress, {});
      progress[session.module] = session.index;
      LS.set(K.progress, progress);
    }

    saveSessionSnapshot();

    const q = currentQuestion();
    if (!q) {
      renderResult();
      return;
    }

    const total = session.list.length;
    const index = session.index;
    const submitted = isQuestionSubmitted(q);
    const userAns = getUserAnswer(q);
    const isFav = getFav().indexOf(q.id) >= 0;

    topbarEl.innerHTML =
      '<button class="tb-back" data-act="home">‹ 返回</button>' +
      '<div class="tb-title">' +
      esc(session.title) +
      "</div>" +
      '<button class="tb-card-btn" data-act="ac-open">📋 ' +
      (index + 1) +
      "/" +
      total +
      "</button>" +
      '<button class="tb-icon-btn" data-act="theme">' +
      (getTheme() === "dark" ? "☀️" : "🌙") +
      "</button>";

    const typeLabel =
      { single: "单选题", multi: "多选题", judge: "判断题" }[q.type] ||
      "单选题";

    const pct = Math.round(((index + (submitted ? 1 : 0)) / total) * 100);

    const optionsHtml = q.options
      .map(function (opt, i) {
        let cls = "option";
        const isSelected = userAns.indexOf(i) >= 0;
        const isCorrect = q.answer.indexOf(i) >= 0;

        if (submitted) {
          cls += " locked";
          if (isCorrect) cls += " correct";
          else if (isSelected) cls += " wrong";
        } else {
          if (isSelected) cls += " selected";
        }

        return (
          '<div class="' +
          cls +
          '" data-act="option" data-i="' +
          i +
          '">' +
          '<span class="badge">' +
          (LETTERS[i] || i + 1) +
          "</span>" +
          '<span class="opt-text">' +
          esc(cleanOpt(opt)) +
          "</span>" +
          "</div>"
        );
      })
      .join("");

    let analysisHtml = "";
    if (submitted) {
      const ok = sameSet(userAns, q.answer);
      analysisHtml =
        '<div class="analysis show ' +
        (ok ? "ok" : "no") +
        '">' +
        '<div class="an-head">' +
        (ok ? "✅ 回答正确" : "❌ 回答错误") +
        "</div>" +
        '<div class="an-row"><b>正确答案：</b>' +
        q.answer
          .map(function (i) {
            return LETTERS[i];
          })
          .join("") +
        "</div>" +
        (q.analysis
          ? '<div class="an-row"><b>解析：</b>' + esc(q.analysis) + "</div>"
          : "") +
        (!ok
          ? '<div class="an-row"><b>你的答案：</b>' +
            (userAns.length
              ? userAns
                  .map(function (i) {
                    return LETTERS[i];
                  })
                  .join("")
              : "未作答") +
            "</div>"
          : "") +
        "</div>";
    }

    let buttons = "";
    const isExam = session.mode === "exam";
    const isReview = session.reviewMode;

    if (isReview) {
      buttons =
        '<button class="btn ghost" data-act="prev" ' +
        (index === 0 ? "disabled" : "") +
        ">上一题</button>" +
        '<button class="btn primary" data-act="next">' +
        (index === total - 1 ? "返回结果" : "下一题") +
        "</button>";
    } else if (isExam) {
      const isLast = index === total - 1;
      buttons =
        '<button class="btn ghost" data-act="prev" ' +
        (index === 0 ? "disabled" : "") +
        ">上一题</button>" +
        '<button class="btn primary" data-act="next">' +
        (isLast ? "交卷" : "下一题") +
        "</button>";
    } else {
      const isLast = index === total - 1;
      if (!submitted) {
        if (q.type === "multi") {
          buttons =
            '<button class="btn ghost" data-act="prev" ' +
            (index === 0 ? "disabled" : "") +
            ">上一题</button>" +
            '<button class="btn primary" data-act="submit">提交答案</button>' +
            '<button class="btn primary" data-act="next">下一题</button>';
        } else {
          buttons =
            '<button class="btn ghost" data-act="prev" ' +
            (index === 0 ? "disabled" : "") +
            ">上一题</button>" +
            '<button class="btn primary" data-act="next">下一题</button>';
        }
      } else {
        buttons =
          '<button class="btn ghost" data-act="prev" ' +
          (index === 0 ? "disabled" : "") +
          ">上一题</button>" +
          '<button class="btn primary" data-act="next">' +
          (isLast ? "完成" : "下一题") +
          "</button>";
      }
    }

    viewEl.innerHTML =
      '<div class="progress"><div class="progress-bar" style="width:' +
      pct +
      '%"></div></div>' +
      '<div class="q-head">' +
      '<span class="tag">' +
      typeLabel +
      "</span>" +
      '<span class="tag ghost">' +
      esc(q.module) +
      "</span>" +
      '<button class="fav-btn ' +
      (isFav ? "on" : "") +
      '" data-act="fav">' +
      (isFav ? "★ 已收藏" : "☆ 收藏") +
      "</button>" +
      "</div>" +
      '<div class="stem">' +
      (index + 1) +
      ". " +
      esc(q.stem) +
      "</div>" +
      (q.type === "multi" && !submitted && !isExam && !isReview
        ? '<div class="hint">多选题：选好后点击「提交答案」</div>'
        : "") +
      '<div class="options">' +
      optionsHtml +
      "</div>" +
      analysisHtml +
      '<div class="actions">' +
      buttons +
      "</div>";
  }

  /* ============================================================
     十、答题卡
     ============================================================ */
  function openAnswerCard() {
    if (!session) return;
    const total = session.list.length;
    const cur = session.index;

    let cells = "";
    for (let i = 0; i < total; i++) {
      const q = session.list[i];
      const submitted = isQuestionSubmitted(q);
      const ans = session.userAnswers[q.id] || [];
      let cls = "ac-cell";
      if (i === cur) cls += " current";
      if (submitted) {
        cls += sameSet(ans, q.answer) ? " ok" : " bad";
      } else if (ans.length) {
        cls += " selected";
      }
      cells +=
        '<button class="' +
        cls +
        '" data-act="ac-jump" data-i="' +
        i +
        '">' +
        (i + 1) +
        "</button>";
    }

    let overlay = document.getElementById("ac-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "ac-overlay";
      overlay.className = "ac-overlay";
      document.body.appendChild(overlay);
    }

    overlay.innerHTML =
      '<div class="ac-mask" data-act="ac-close"></div>' +
      '<div class="ac-panel">' +
      '<div class="ac-head">' +
      '<span class="ac-title">答题卡</span>' +
      '<div class="ac-legend">' +
      '<span><i class="lg ok"></i>对</span>' +
      '<span><i class="lg bad"></i>错</span>' +
      '<span><i class="lg selected"></i>已选</span>' +
      '<span><i class="lg"></i>未答</span>' +
      "</div>" +
      '<button class="ac-close-btn" data-act="ac-close">✕</button>' +
      "</div>" +
      '<div class="ac-jump-row">' +
      '<input id="ac-jump-input" type="number" min="1" max="' +
      total +
      '" placeholder="输入题号 1-' +
      total +
      '，回车跳转">' +
      '<button data-act="ac-jump-input">跳转</button>' +
      "</div>" +
      '<div class="ac-body">' +
      '<div class="ac-grid">' +
      cells +
      "</div>" +
      "</div>" +
      "</div>";

    overlay.classList.add("show");

    setTimeout(function () {
      const curCell = overlay.querySelector(".ac-cell.current");
      if (curCell) curCell.scrollIntoView({ block: "center" });
    }, 60);
  }

  function closeAnswerCard() {
    const overlay = document.getElementById("ac-overlay");
    if (overlay) overlay.classList.remove("show");
  }

  function jumpTo(index) {
    if (!session) return;
    const total = session.list.length;
    if (isNaN(index) || index < 0 || index >= total) return;
    session.index = index;
    closeAnswerCard();
    renderQuestion();
    window.scrollTo(0, 0);
  }

  function handleAcJumpInput() {
    const input = document.getElementById("ac-jump-input");
    if (!input) return;
    const num = parseInt(input.value, 10);
    if (isNaN(num) || num < 1 || num > session.list.length) {
      alert("请输入 1 到 " + session.list.length + " 之间的题号");
      return;
    }
    jumpTo(num - 1);
  }

  /* ============================================================
     十一、操作处理
     ============================================================ */
  function handleOption(i) {
    if (!session) return;
    const q = currentQuestion();
    if (!q) return;
    if (isQuestionSubmitted(q)) return;

    let ans = getUserAnswer(q).slice();

    if (q.type === "multi") {
      const p = ans.indexOf(i);
      if (p >= 0) ans.splice(p, 1);
      else ans.push(i);
      setUserAnswer(q, ans);
      renderQuestion();
    } else {
      ans = [i];
      setUserAnswer(q, ans);
      if (session.mode === "exam") {
        renderQuestion();
      } else {
        submitSingle(q);
      }
    }
  }

  function submitSingle(q) {
    if (!session || !q) return;
    if (session.submittedMap[q.id]) return;

    const ans = getUserAnswer(q);
    if (!ans.length) {
      alert("请先选择答案");
      return;
    }

    session.submittedMap[q.id] = true;
    const ok = sameSet(ans, q.answer);

    if (!session.counted[q.id]) {
      session.counted[q.id] = true;
      bumpStats(ok);
      if (ok) {
        session.correctCount++;
        removeWrong(q.id);
      } else {
        session.wrongCount++;
        addWrong(q.id);
      }
    }

    renderQuestion();
  }

  function handleSubmit() {
    const q = currentQuestion();
    if (!q) return;
    if (isQuestionSubmitted(q)) return;
    if (session.mode === "exam") return;
    submitSingle(q);
  }

  function submitExam() {
    if (!session || session.examSubmitted) return;

    let correct = 0;
    let wrong = 0;

    session.list.forEach(function (q) {
      const ans = session.userAnswers[q.id] || [];
      const ok = sameSet(ans, q.answer);

      bumpStats(ok);

      if (ok) {
        correct++;
        removeWrong(q.id);
      } else {
        wrong++;
        addWrong(q.id);
      }
    });

    session.correctCount = correct;
    session.wrongCount = wrong;
    session.examSubmitted = true;

    renderResult();
  }

  function handleNext() {
    if (!session) return;
    const q = currentQuestion();
    const total = session.list.length;
    const isExam = session.mode === "exam";
    const isReview = session.reviewMode;

    if (isReview) {
      if (session.index < total - 1) {
        session.index++;
        renderQuestion();
        window.scrollTo(0, 0);
      } else {
        session.reviewMode = false;
        renderResult();
      }
      return;
    }

    if (isExam) {
      if (session.index < total - 1) {
        session.index++;
        renderQuestion();
        window.scrollTo(0, 0);
      } else {
        if (confirm("确定交卷吗？交卷后将无法修改答案。")) {
          submitExam();
        }
      }
      return;
    }

    if (!isQuestionSubmitted(q)) {
      if (q.type === "multi") {
        alert("请先选择答案并点击「提交答案」");
        return;
      } else {
        if (!getUserAnswer(q).length) {
          alert("请先选择答案");
          return;
        }
        submitSingle(q);
        return;
      }
    }

    if (session.index < total - 1) {
      session.index++;
      renderQuestion();
      window.scrollTo(0, 0);
    } else {
      renderResult();
    }
  }

  function handlePrev() {
    if (!session || session.index === 0) return;
    session.index--;
    renderQuestion();
    window.scrollTo(0, 0);
  }

  function handleFav() {
    const q = currentQuestion();
    if (!q) return;
    toggleFav(q.id);
    renderQuestion();
  }

  /* ============================================================
     十二、结果页
     ============================================================ */
  function renderResult() {
    if (!session) return;

    const total = session.list.length;
    const done = session.correctCount + session.wrongCount;
    const rate = done ? Math.round((session.correctCount / done) * 100) : 0;
    const emoji = rate >= 80 ? "🎉" : rate >= 60 ? "👍" : "💪";

    topbarEl.innerHTML =
      '<button class="tb-back" data-act="home" data-clear="1">‹ 返回</button>' +
      '<div class="tb-title">练习结果</div>' +
      '<button class="tb-icon-btn" data-act="theme">' +
      (getTheme() === "dark" ? "☀️" : "🌙") +
      "</button>";

    const isExam = session.mode === "exam";
    const reviewBtn =
      isExam && session.examSubmitted
        ? '<button class="btn primary" data-act="review">查看解析</button>'
        : "";

    viewEl.innerHTML =
      '<div class="result-card">' +
      '<div class="result-emoji">' +
      emoji +
      "</div>" +
      '<div class="result-title">' +
      (isExam ? "模拟考试完成" : "本组练习完成") +
      "</div>" +
      '<div class="result-grid">' +
      "<div><b>" +
      total +
      "</b><span>题目总数</span></div>" +
      "<div><b>" +
      session.correctCount +
      "</b><span>答对</span></div>" +
      "<div><b>" +
      session.wrongCount +
      "</b><span>答错</span></div>" +
      "<div><b>" +
      rate +
      "%</b><span>正确率</span></div>" +
      "</div>" +
      "</div>" +
      '<div class="actions" style="flex-direction:column; gap:10px;">' +
      reviewBtn +
      '<button class="btn ghost" data-act="start" data-mode="wrong">去错题本</button>' +
      '<button class="btn primary" data-act="restart">再练一组</button>' +
      '<button class="btn ghost" data-act="home" data-clear="1">返回首页</button>' +
      "</div>";

    window.scrollTo(0, 0);
  }

  /* ============================================================
     十三、事件委托
     ============================================================ */
  document.addEventListener("click", function (e) {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;

    if (act === "start") {
      const mode = el.dataset.mode;
      if (mode === "module") {
        const modules = getModules();
        startPractice("module", modules[Number(el.dataset.mi)]);
      } else {
        startPractice(mode);
      }
    } else if (act === "option") {
      handleOption(Number(el.dataset.i));
    } else if (act === "submit") {
      handleSubmit();
    } else if (act === "next") {
      handleNext();
    } else if (act === "prev") {
      handlePrev();
    } else if (act === "fav") {
      handleFav();
    } else if (act === "home") {
      if (el.dataset.clear === "1") clearSessionSnapshot();
      renderHome();
    } else if (act === "portal") {
      // 同目录的门户页 index.html
      window.location.href = "index.html";
    } else if (act === "restart") {
      const m = session.mode;
      const mod = session.module;
      startPractice(m, mod);
    } else if (act === "reset-stats") {
      if (confirm("确定清空累计答题统计吗？（错题本和收藏不受影响）")) {
        LS.set(K.stats, { total: 0, correct: 0 });
        renderHome();
      }
    } else if (act === "review") {
      session.reviewMode = true;
      session.index = 0;
      renderQuestion();
    } else if (act === "theme") {
      toggleTheme();
    } else if (act === "resume") {
      if (restoreSession()) {
        renderQuestion();
        window.scrollTo(0, 0);
      } else {
        alert("无法恢复上次练习");
        clearSessionSnapshot();
        renderHome();
      }
    } else if (act === "ac-open") {
      openAnswerCard();
    } else if (act === "ac-close") {
      closeAnswerCard();
    } else if (act === "ac-jump") {
      jumpTo(Number(el.dataset.i));
    } else if (act === "ac-jump-input") {
      handleAcJumpInput();
    }
  });

  /* ============================================================
     十四、键盘快捷键（电脑端）
     ============================================================ */
  document.addEventListener("keydown", function (e) {
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") {
      if (e.target.id === "ac-jump-input" && e.key === "Enter") {
        e.preventDefault();
        handleAcJumpInput();
      }
      return;
    }

    if (e.key === "Escape") {
      closeAnswerCard();
      return;
    }

    const overlay = document.getElementById("ac-overlay");
    if (overlay && overlay.classList.contains("show")) return;

    if (!session) return;
    const q = currentQuestion();
    if (!q) return;

    const key = e.key.toUpperCase();

    const letterIndex = LETTERS.indexOf(key);
    if (letterIndex >= 0 && letterIndex < q.options.length) {
      e.preventDefault();
      handleOption(letterIndex);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (session.reviewMode) {
        handleNext();
      } else if (session.mode === "exam") {
        handleNext();
      } else if (!isQuestionSubmitted(q)) {
        if (q.type === "multi") handleSubmit();
        else if (getUserAnswer(q).length) submitSingle(q);
        else handleNext();
      } else {
        handleNext();
      }
      return;
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      handlePrev();
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      handleNext();
      return;
    }

    if (key === "S") {
      e.preventDefault();
      handleFav();
      return;
    }
    if (key === "M") {
      e.preventDefault();
      openAnswerCard();
      return;
    }
  });

  /* ============================================================
     十五、启动
     ============================================================ */
  function getUrlParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (e) {
      return null;
    }
  }

  applyTheme();

  if (Object.keys(window.ModuleData || {}).length === 0) {
    viewEl.innerHTML =
      '<p style="text-align:center;color:var(--sub);padding:40px 0;">题库为空，请在 data 文件夹添加题库文件。</p>';
  } else {
    const mode = getUrlParam("mode");
    const moduleName = getUrlParam("module");

    if (moduleName) {
      const modules = getModules();
      if (modules.indexOf(moduleName) >= 0) {
        startPractice("module", moduleName);
      } else {
        alert("找不到模块：" + moduleName);
        renderHome();
      }
    } else if (mode === "wrong" || mode === "fav" || mode === "exam") {
      startPractice(mode);
    } else {
      renderHome();
    }
  }
})();
