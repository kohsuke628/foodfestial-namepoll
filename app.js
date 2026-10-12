import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, runTransaction, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Firebase 初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// デフォルト時間割データ
const DEFAULT_PERIODS = [
  { id: "p1", label: "1限", start: "08:10", end: "09:00", enabled: true },
  { id: "p2", label: "2限", start: "09:10", end: "10:00", enabled: true },
  { id: "p3", label: "3限", start: "10:10", end: "11:00", enabled: true },
  { id: "p4", label: "4限", start: "11:10", end: "12:00", enabled: true },
  { id: "p5", label: "5限", start: "12:10", end: "13:00", enabled: true },
  { id: "p6", label: "6限", start: "13:10", end: "14:00", enabled: true },
  { id: "p7", label: "7限", start: "14:10", end: "15:00", enabled: true },
  { id: "p8", label: "8限", start: "15:10", end: "16:00", enabled: true },
  { id: "p9", label: "9限", start: "16:10", end: "17:00", enabled: true },
  { id: "p10", label: "10限", start: "17:10", end: "18:00", enabled: true },
];

let currentUser = null;

// ルーター
window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    renderAuthNav();
    route();
  });
  
  document.getElementById("modal-close-btn").addEventListener("click", closeModal);
});

function renderAuthNav() {
  const nav = document.getElementById("auth-nav");
  if (currentUser) {
    nav.innerHTML = `
      <span style="font-size:0.85rem; margin-right:0.5rem;">${escapeHTML(currentUser.email)}</span>
      <button id="logout-btn" class="btn btn-secondary btn-sm">ログアウト</button>
    `;
    document.getElementById("logout-btn").onclick = () => signOut(auth);
  } else {
    nav.innerHTML = `<a href="#/admin" class="btn btn-secondary btn-sm">管理者ログイン</a>`;
  }
}

async function route() {
  const hash = window.location.hash || "#/";
  const appEl = document.getElementById("app");

  if (hash === "#/" || hash === "#/admin") {
    if (currentUser) {
      renderAdminDashboard(appEl);
    } else {
      renderAdminLogin(appEl);
    }
  } else if (hash.startsWith("#/s/")) {
    const surveyId = hash.replace("#/s/", "");
    renderSurveyRespondent(appEl, surveyId);
  } else {
    appEl.innerHTML = `<div class="card"><h2>404 Not Found</h2><p>ページが見つかりません。</p></div>`;
  }
  if (window.lucide) window.lucide.createIcons();
}

// ==================== 管理者機能 ====================

function renderAdminLogin(container) {
  container.innerHTML = `
    <div class="card" style="max-width:400px; margin: 2rem auto;">
      <h2>管理者ログイン</h2>
      <form id="login-form">
        <div class="form-group">
          <label>メールアドレス</label>
          <input type="email" id="login-email" required>
        </div>
        <div class="form-group">
          <label>パスワード</label>
          <input type="password" id="login-password" required>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%;">ログイン</button>
      </form>
    </div>
  `;
  document.getElementById("login-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, document.getElementById("login-email").value, document.getElementById("login-password").value);
    } catch (err) {
      alert("ログイン失敗: " + err.message);
    }
  };
}

async function renderAdminDashboard(container) {
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
      <h2>アンケート管理</h2>
      <button id="btn-show-create" class="btn btn-primary">+ 新規作成</button>
    </div>
    <div id="admin-content"></div>
  `;

  document.getElementById("btn-show-create").onclick = () => renderSurveyCreateForm(document.getElementById("admin-content"));
  loadAdminSurveyList(document.getElementById("admin-content"));
}

async function loadAdminSurveyList(container) {
  container.innerHTML = "<p>読み込み中...</p>";
  try {
    const snap = await getDocs(collection(db, "surveys"));
    const surveys = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.ownerUid === currentUser.uid) surveys.push({ id: d.id, ...data });
    });

    if (surveys.length === 0) {
      container.innerHTML = `<div class="card"><p>作成済みのアンケートはありません。</p></div>`;
      return;
    }

    let html = `<div class="card"><h3>作成済みアンケート一覧</h3><ul style="list-style:none;">`;
    surveys.forEach(s => {
      const url = `${window.location.origin}${window.location.pathname}#/s/${s.id}`;
      html += `
        <li style="border-bottom:1px solid #e2e8f0; padding:1rem 0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
          <div>
            <strong>${escapeHTML(s.title)}</strong>
            <div style="font-size:0.85rem; color:var(--text-muted);">期限: ${new Date(s.deadline).toLocaleString("ja-JP")} | 回答数: ${s.currentRespondents || 0}/${s.maxRespondents || "無制限"}</div>
          </div>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn btn-secondary btn-sm copy-btn" data-url="${url}">回答URLコピー</button>
            <button class="btn btn-primary btn-sm view-btn" data-id="${s.id}">回答確認</button>
            <button class="btn btn-danger btn-sm del-btn" data-id="${s.id}">削除</button>
          </div>
        </li>
      `;
    });
    html += `</ul></div>`;
    container.innerHTML = html;

    container.querySelectorAll(".copy-btn").forEach(b => b.onclick = (e) => {
      navigator.clipboard.writeText(e.target.dataset.url);
      alert("URLをコピーしました！");
    });
    container.querySelectorAll(".view-btn").forEach(b => b.onclick = (e) => renderSurveyDetail(container, e.target.dataset.id));
    container.querySelectorAll(".del-btn").forEach(b => b.onclick = async (e) => {
      if (confirm("本当に削除しますか？")) {
        await deleteDoc(doc(db, "surveys", e.target.dataset.id));
        loadAdminSurveyList(container);
      }
    });

  } catch (err) {
    container.innerHTML = `<p style="color:var(--danger)">エラー: ${err.message}</p>`;
  }
}

function renderSurveyCreateForm(container) {
  let periods = [...DEFAULT_PERIODS];

  const renderPeriodsTable = () => {
    const tbody = document.getElementById("periods-tbody");
    if (!tbody) return;
    tbody.innerHTML = periods.map((p, idx) => `
      <tr>
        <td><input type="checkbox" ${p.enabled ? "checked" : ""} data-idx="${idx}" class="p-enabled"></td>
        <td><input type="text" value="${escapeHTML(p.label)}" data-idx="${idx}" class="p-label" style="width:70px;"></td>
        <td><input type="time" value="${p.start}" data-idx="${idx}" class="p-start"></td>
        <td><input type="time" value="${p.end}" data-idx="${idx}" class="p-end"></td>
        <td><button type="button" class="btn btn-danger btn-sm p-del" data-idx="${idx}">&times;</button></td>
      </tr>
    `).join("");

    tbody.querySelectorAll(".p-enabled").forEach(i => i.onchange = (e) => periods[e.target.dataset.idx].enabled = e.target.checked);
    tbody.querySelectorAll(".p-label").forEach(i => i.onchange = (e) => periods[e.target.dataset.idx].label = e.target.value);
    tbody.querySelectorAll(".p-start").forEach(i => i.onchange = (e) => periods[e.target.dataset.idx].start = e.target.value);
    tbody.querySelectorAll(".p-end").forEach(i => i.onchange = (e) => periods[e.target.dataset.idx].end = e.target.value);
    tbody.querySelectorAll(".p-del").forEach(b => b.onclick = (e) => {
      periods.splice(e.target.dataset.idx, 1);
      renderPeriodsTable();
    });
  };

  container.innerHTML = `
    <div class="card">
      <h3>新規アンケート作成</h3>
      <form id="create-survey-form">
        <div class="form-group">
          <label>タイトル *</label>
          <input type="text" id="s-title" required placeholder="例: サークル次回ミーティング日程調整">
        </div>
        <div class="form-group">
          <label>説明文</label>
          <textarea id="s-desc" rows="2" placeholder="都合の良いコマをすべて選んでください。"></textarea>
        </div>
        <div style="display:flex; gap:1rem; flex-wrap:wrap;">
          <div class="form-group" style="flex:1; min-width:140px;">
            <label>開始日 *</label>
            <input type="date" id="s-start-date" required>
          </div>
          <div class="form-group" style="flex:1; min-width:140px;">
            <label>終了日 *</label>
            <input type="date" id="s-end-date" required>
          </div>
        </div>
        <div class="form-group">
          <label>除外する日付 (カンマ区切り YYYY-MM-DD)</label>
          <input type="text" id="s-exclude-dates" placeholder="例: 2026-04-29, 2026-05-03">
        </div>

        <div class="form-group">
          <label>時間割設定</label>
          <table class="period-table">
            <thead><tr><th>対象</th><th>コマ名</th><th>開始</th><th>終了</th><th>削除</th></tr></thead>
            <tbody id="periods-tbody"></tbody>
          </table>
          <button type="button" id="add-period-btn" class="btn btn-secondary btn-sm">+ コマを追加</button>
        </div>

        <div style="display:flex; gap:1rem; flex-wrap:wrap;">
          <div class="form-group" style="flex:1; min-width:140px;">
            <label>回答期限 *</label>
            <input type="datetime-local" id="s-deadline" required>
          </div>
          <div class="form-group" style="flex:1; min-width:140px;">
            <label>上限人数 (0で無制限)</label>
            <input type="number" id="s-max" value="0" min="0">
          </div>
        </div>

        <div style="display:flex; gap:0.5rem; margin-top:1rem;">
          <button type="submit" class="btn btn-primary">作成して回答URLを取得</button>
          <button type="button" id="cancel-create" class="btn btn-secondary">キャンセル</button>
        </div>
      </form>
    </div>
  `;

  renderPeriodsTable();

  document.getElementById("add-period-btn").onclick = () => {
    const nextNum = periods.length + 1;
    periods.push({ id: "p" + Date.now(), label: `${nextNum}限`, start: "18:00", end: "19:00", enabled: true });
    renderPeriodsTable();
  };

  document.getElementById("cancel-create").onclick = () => loadAdminSurveyList(container);

  document.getElementById("create-survey-form").onsubmit = async (e) => {
    e.preventDefault();
    const startDate = new Date(document.getElementById("s-start-date").value);
    const endDate = new Date(document.getElementById("s-end-date").value);
    
    if (startDate > endDate) {
      alert("開始日は終了日より前に設定してください。");
      return;
    }

    const excludes = document.getElementById("s-exclude-dates").value.split(",").map(s => s.trim()).filter(Boolean);
    const dates = [];
    let cur = new Date(startDate);
    while (cur <= endDate) {
      const ymd = cur.toISOString().split("T")[0];
      if (!excludes.includes(ymd)) dates.push(ymd);
      cur.setDate(cur.getDate() + 1);
    }

    const surveyId = "s_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const surveyData = {
      title: document.getElementById("s-title").value,
      description: document.getElementById("s-desc").value,
      ownerUid: currentUser.uid,
      dates: dates,
      periods: periods,
      deadline: new Date(document.getElementById("s-deadline").value).toISOString(),
      maxRespondents: parseInt(document.getElementById("s-max").value) || 0,
      currentRespondents: 0,
      status: "active",
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "surveys", surveyId), surveyData);
      const shareUrl = `${window.location.origin}${window.location.pathname}#/s/${surveyId}`;
      container.innerHTML = `
        <div class="card">
          <h3 style="color:var(--perfect-bg)">アンケートを作成しました！</h3>
          <p style="margin:1rem 0;">以下のURLを回答者に共有してください。</p>
          <input type="text" value="${shareUrl}" id="share-url-input" readonly style="margin-bottom:1rem;">
          <button class="btn btn-primary" id="copy-created-url">URLをコピー</button>
          <button class="btn btn-secondary" id="back-to-list">一覧へ戻る</button>
        </div>
      `;
      document.getElementById("copy-created-url").onclick = () => {
        navigator.clipboard.writeText(shareUrl);
        alert("コピーしました！");
      };
      document.getElementById("back-to-list").onclick = () => loadAdminSurveyList(container);
    } catch (err) {
      alert("作成失敗: " + err.message);
    }
  };
}

// 回答状況確認ダッシュボード
async function renderSurveyDetail(container, surveyId) {
  container.innerHTML = "<p>データ読み込み中...</p>";
  try {
    const surveySnap = await getDoc(doc(db, "surveys", surveyId));
    if (!surveySnap.exists()) return container.innerHTML = "<p>アンケートが存在しません。</p>";
    const survey = surveySnap.data();

    const respSnap = await getDocs(collection(db, "surveys", surveyId, "responses"));
    const responses = [];
    respSnap.forEach(d => responses.push(d.data()));

    const activePeriods = survey.periods.filter(p => p.enabled);

    container.innerHTML = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap;">
          <div>
            <h2>${escapeHTML(survey.title)}</h2>
            <p style="color:var(--text-muted);">${escapeHTML(survey.description || "")}</p>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-back-list">← 一覧に戻る</button>
        </div>
        <hr style="margin:1rem 0; border:none; border-top:1px solid var(--border-color);">
        <div style="display:flex; gap:1.5rem; flex-wrap:wrap; margin-bottom:1rem; font-size:0.9rem;">
          <div><strong>回答数:</strong> ${responses.length} / ${survey.maxRespondents || "無制限"}</div>
          <div><strong>期限:</strong> ${new Date(survey.deadline).toLocaleString("ja-JP")}</div>
          <div><button class="btn btn-secondary btn-sm" id="btn-download-csv">CSVダウンロード</button></div>
        </div>

        <div class="tab-container">
          <button class="tab-btn active" id="tab-btn-a">ビューA (人 × 時間割)</button>
          <button class="tab-btn" id="tab-btn-b">ビューB (連続可能時間)</button>
        </div>

        <div id="view-content"></div>
      </div>
    `;

    document.getElementById("btn-back-list").onclick = () => loadAdminSurveyList(container);
    document.getElementById("btn-download-csv").onclick = () => exportToCSV(survey, responses);

    const renderViewA = () => {
      let html = `
        <div class="legend">
          <span><span class="legend-box" style="background:var(--available-bg)"></span>空きあり</span>
          <span><span class="legend-box" style="background:var(--perfect-bg)"></span>全員空き</span>
        </div>
      `;

      survey.dates.forEach(date => {
        html += `<h4 style="margin:1rem 0 0.5rem 0;">📅 ${date}</h4><div class="table-wrapper"><table class="admin-grid"><thead><tr><th>回答者</th>`;
        activePeriods.forEach(p => html += `<th>${escapeHTML(p.label)}<br><small>${p.start}</small></th>`);
        html += `<th>備考</th><th>操作</th></tr></thead><tbody>`;

        const counts = {};
        activePeriods.forEach(p => counts[p.id] = 0);

        responses.forEach(r => {
          const avail = (r.availability && r.availability[date]) || [];
          const userNotes = (r.notes || []).filter(n => n.date === date);
          
          html += `<tr><strong><td>${escapeHTML(r.name)} (${escapeHTML(r.studentId)})</td></strong>`;
          activePeriods.forEach(p => {
            const isOk = avail.includes(p.id);
            if (isOk) counts[p.id]++;
            html += `<td class="${isOk ? 'cell-available' : ''}" style="cursor:pointer;" onclick="window.showSlotModal('${surveyId}', '${date}', '${p.id}')">${isOk ? '◯' : '-'}</td>`;
          });
          
          html += `<td>${userNotes.length > 0 ? `<span style="cursor:pointer; color:var(--primary)" onclick="alert('${escapeHTML(userNotes.map(n=>n.text).join('\\n'))}')">💬 (${userNotes.length})</span>` : '-'}</td>`;
          html += `<td><button class="btn btn-danger btn-sm" onclick="window.deleteResponse('${surveyId}', '${r.studentId}')">削除</button></td></tr>`;
        });

        // 最下行 (合計 & ヒートマップ)
        const total = responses.length;
        html += `<tr style="font-weight:bold; background:#f8fafc;"><td>空き人数合計</td>`;
        activePeriods.forEach(p => {
          const cnt = counts[p.id];
          const isPerfect = total > 0 && cnt === total;
          const ratio = total > 0 ? cnt / total : 0;
          const bgStyle = isPerfect ? '' : `background-color: rgba(59, 130, 246, ${Math.max(0.1, ratio)})`;
          const cls = isPerfect ? 'heatmap-perfect' : 'heatmap-cell';
          html += `<td class="${cls}" style="${bgStyle}; cursor:pointer;" onclick="window.showSlotModal('${surveyId}', '${date}', '${p.id}')">${cnt}名</td>`;
        });
        html += `<td>-</td><td>-</td></tr></tbody></table></div>`;
      });

      document.getElementById("view-content").innerHTML = html;
    };

    const renderViewB = () => {
      let html = "";
      survey.dates.forEach(date => {
        html += `<h4 style="margin:1.5rem 0 0.5rem 0;">📅 ${date}</h4><ul style="list-style:none; padding-left:0;">`;
        responses.forEach(r => {
          const avail = (r.availability && r.availability[date]) || [];
          const ranges = getContinuousRanges(avail, activePeriods);
          html += `
            <li class="note-item">
              <div>
                <strong>${escapeHTML(r.name)}</strong>: 
                ${ranges.length > 0 ? ranges.map(rg => `${rg.start}〜${rg.end}`).join("、") : "<span style='color:var(--text-muted)'>空きなし</span>"}
              </div>
            </li>
          `;
        });
        html += `</ul>`;
      });
      document.getElementById("view-content").innerHTML = html;
    };

    // タブ切替
    document.getElementById("tab-btn-a").onclick = (e) => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      renderViewA();
    };
    document.getElementById("tab-btn-b").onclick = (e) => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      renderViewB();
    };

    renderViewA(); // デフォルト表示

    // 全局フック関数（セルクリック等）
    window.showSlotModal = (sId, date, periodId) => {
      const p = activePeriods.find(item => item.id === periodId);
      const okUsers = responses.filter(r => (r.availability && r.availability[date] || []).includes(periodId));
      const slotNotes = [];
      responses.forEach(r => {
        (r.notes || []).forEach(n => {
          if (n.date === date && n.periodId === periodId) {
            slotNotes.push({ name: r.name, text: n.text });
          }
        });
      });

      let content = `<h3>${date} ${escapeHTML(p.label)} (${p.start}-${p.end}) の空き状況</h3>`;
      content += `<h4 style="margin-top:1rem;">空いている人 (${okUsers.length}名)</h4>`;
      if (okUsers.length === 0) {
        content += `<p style="color:var(--text-muted)">該当者なし</p>`;
      } else {
        content += `<ul>${okUsers.map(u => `<li>${escapeHTML(u.name)} (${escapeHTML(u.studentId)})</li>`).join("")}</ul>`;
      }

      content += `<h4 style="margin-top:1rem;">備考・メモ</h4>`;
      if (slotNotes.length === 0) {
        content += `<p style="color:var(--text-muted)">なし</p>`;
      } else {
        content += `<ul>${slotNotes.map(n => `<li><strong>${escapeHTML(n.name)}:</strong>${escapeHTML(n.text)}</li>`).join("")}</ul>`;
      }

      openModal(content);
    };

    window.deleteResponse = async (sId, studentId) => {
      if (confirm("この回答を削除してもよろしいですか？")) {
        await deleteDoc(doc(db, "surveys", sId, "responses", studentId));
        await updateDoc(doc(db, "surveys", sId), {
          currentRespondents: Math.max(0, responses.length - 1)
        });
        renderSurveyDetail(container, sId);
      }
    };

  } catch (err) {
    container.innerHTML = `<p style="color:var(--danger)">エラー: ${err.message}</p>`;
  }
}

// 連続時間帯の結合ユーティリティ
function getContinuousRanges(availIds, activePeriods) {
  if (!availIds || availIds.length === 0) return [];
  const sortedPeriods = activePeriods.filter(p => availIds.includes(p.id));
  if (sortedPeriods.length === 0) return [];

  const ranges = [];
  let curStart = sortedPeriods[0].start;
  let curEnd = sortedPeriods[0].end;

  for (let i = 1; i < sortedPeriods.length; i++) {
    if (sortedPeriods[i].start === curEnd || sortedPeriods[i].start.localeCompare(curEnd) >= 0) {
      const prevIdx = activePeriods.findIndex(p => p.end === curEnd);
      const curIdx = activePeriods.findIndex(p => p.id === sortedPeriods[i].id);
      if (curIdx === prevIdx + 1) {
        curEnd = sortedPeriods[i].end;
        continue;
      }
    }
    ranges.push({ start: curStart, end: curEnd });
    curStart = sortedPeriods[i].start;
    curEnd = sortedPeriods[i].end;
  }
  ranges.push({ start: curStart, end: curEnd });
  return ranges;
}

// CSV出力
function exportToCSV(survey, responses) {
  const activePeriods = survey.periods.filter(p => p.enabled);
  let csv = "\uFEFF"; // BOM for Excel UTF-8
  csv += "日付,コマ名,開始,終了,名前,学生番号,備考\n";

  survey.dates.forEach(date => {
    activePeriods.forEach(p => {
      responses.forEach(r => {
        const isOk = (r.availability && r.availability[date] || []).includes(p.id);
        if (isOk) {
          const notes = (r.notes || []).filter(n => n.date === date && n.periodId === p.id).map(n => n.text).join(" / ");
          csv += `"${date}","${p.label}","${p.start}","${p.end}","${r.name}","${r.studentId}","${notes}"\n`;
        }
      });
    });
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${survey.title}_回答集計.csv`;
  a.click();
}

// ==================== 回答者機能 ====================

async function renderSurveyRespondent(container, surveyId) {
  container.innerHTML = "<p>アンケート読み込み中...</p>";
  try {
    const surveySnap = await getDoc(doc(db, "surveys", surveyId));
    if (!surveySnap.exists()) {
      return container.innerHTML = `<div class="card"><h2>エラー</h2><p>指定されたアンケートは見つかりません。</p></div>`;
    }
    const survey = surveySnap.data();
    const isExpired = new Date() > new Date(survey.deadline);
    const isFull = survey.maxRespondents > 0 && survey.currentRespondents >= survey.maxRespondents;

    // localStorage から前回回答IDの復元
    const localSavedId = localStorage.getItem(`survey_response_${surveyId}`);

    container.innerHTML = `
      <div class="card">
        <h2>${escapeHTML(survey.title)}</h2>
        <p style="color:var(--text-muted); margin-bottom:1rem;">${escapeHTML(survey.description || "")}</p>
        
        <div style="background:#f1f5f9; padding:0.75rem; border-radius:6px; font-size:0.85rem; margin-bottom:1.5rem;">
          <div>📅 <strong>回答期限:</strong> ${new Date(survey.deadline).toLocaleString("ja-JP")} ${isExpired ? '<span style="color:var(--danger)">(受付終了)</span>' : ''}</div>
          <div>👥 <strong>回答枠:</strong> ${survey.currentRespondents || 0} / ${survey.maxRespondents || "無制限"} ${isFull ? '<span style="color:var(--danger)">(定員到達)</span>' : ''}</div>
        </div>

        <form id="respond-form">
          <div style="display:flex; gap:1rem; flex-wrap:wrap;">
            <div class="form-group" style="flex:1; min-width:140px;">
              <label>お名前 *</label>
              <input type="text" id="r-name" required placeholder="田中 太郎">
            </div>
            <div class="form-group" style="flex:1; min-width:140px;">
              <label>学生番号 *</label>
              <input type="text" id="r-student-id" required placeholder="12345678">
            </div>
          </div>

          <p style="font-weight:600; margin-bottom:0.5rem;">空いている時間割をタップして選択してください：</p>
          <div class="legend">
            <span><span class="legend-box" style="background:var(--available-bg)"></span>選択中 (空き)</span>
            <span><span class="legend-box" style="background:#fff; border:1px solid #ccc;"></span>未選択</span>
          </div>

          <div id="respond-grid-container"></div>

          <div class="form-group" style="margin-top:1.5rem;">
            <label>備考・連絡事項 (任意)</label>
            <div id="notes-container"></div>
            <button type="button" id="add-note-btn" class="btn btn-secondary btn-sm" style="margin-top:0.5rem;">+ 備考を追加</button>
          </div>

          <button type="submit" id="submit-resp-btn" class="btn btn-primary" style="width:100%; margin-top:1rem;">
            ${isExpired ? "期限切れのため送信不可" : "回答を送信する"}
          </button>
        </form>
      </div>
    `;

    const activePeriods = survey.periods.filter(p => p.enabled);
    const selectedState = {}; // { "YYYY-MM-DD": [periodId,...] }
    survey.dates.forEach(d => selectedState[d] = []);
    let notesState = []; // [{ date, periodId, text }]

    // 時間割グリッド描画
    const renderGrid = () => {
      let html = `<div class="table-wrapper"><table class="schedule-grid"><thead><tr><th>コマ / 日付</th>`;
      survey.dates.forEach(d => html += `<th class="toggle-date" data-date="${d}">${d}<br><small>(一括選択)</small></th>`);
      html += `</tr></thead><tbody>`;

      activePeriods.forEach(p => {
        html += `<tr><th class="toggle-period" data-period="${p.id}">${escapeHTML(p.label)}<br><small>${p.start}-${p.end}</small></th>`;
        survey.dates.forEach(d => {
          const isSelected = selectedState[d].includes(p.id);
          html += `<td class="cell-selectable ${isSelected ? 'selected' : ''}" data-date="${d}" data-period="${p.id}">${isSelected ? '◯' : ''}</td>`;
        });
        html += `</tr>`;
      });

      html += `</tbody></table></div>`;
      document.getElementById("respond-grid-container").innerHTML = html;

      // セルクリックイベント
      document.querySelectorAll(".cell-selectable").forEach(td => {
        td.onclick = () => {
          if (isExpired) return;
          const date = td.dataset.date;
          const periodId = td.dataset.period;
          const idx = selectedState[date].indexOf(periodId);
          if (idx >= 0) selectedState[date].splice(idx, 1);
          else selectedState[date].push(periodId);
          renderGrid();
        };
      });

      // 日付一括選択
      document.querySelectorAll(".toggle-date").forEach(th => {
        th.onclick = () => {
          if (isExpired) return;
          const date = th.dataset.date;
          if (selectedState[date].length === activePeriods.length) {
            selectedState[date] = [];
          } else {
            selectedState[date] = activePeriods.map(p => p.id);
          }
          renderGrid();
        };
      });

      // コマ一括選択
      document.querySelectorAll(".toggle-period").forEach(th => {
        th.onclick = () => {
          if (isExpired) return;
          const periodId = th.dataset.period;
          const allSelected = survey.dates.every(d => selectedState[d].includes(periodId));
          survey.dates.forEach(d => {
            const idx = selectedState[d].indexOf(periodId);
            if (allSelected) {
              if (idx >= 0) selectedState[d].splice(idx, 1);
            } else {
              if (idx < 0) selectedState[d].push(periodId);
            }
          });
          renderGrid();
        };
      });
    };

    const renderNotesUI = () => {
      const container = document.getElementById("notes-container");
      container.innerHTML = notesState.map((n, idx) => `
        <div class="note-item">
          <select class="note-date" data-idx="${idx}">
            ${survey.dates.map(d => `<option value="${d}" ${n.date === d ? 'selected' : ''}>${d}</option>`).join("")}
          </select>
          <select class="note-period" data-idx="${idx}">
            ${activePeriods.map(p => `<option value="${p.id}" ${n.periodId === p.id ? 'selected' : ''}>${escapeHTML(p.label)}</option>`).join("")}
          </select>
          <input type="text" class="note-text" data-idx="${idx}" value="${escapeHTML(n.text)}" placeholder="遅れるかもしれません等" style="flex:1; margin:0 0.5rem;">
          <button type="button" class="btn btn-danger btn-sm note-del" data-idx="${idx}">&times;</button>
        </div>
      `).join("");

      container.querySelectorAll(".note-date").forEach(s => s.onchange = e => notesState[e.target.dataset.idx].date = e.target.value);
      container.querySelectorAll(".note-period").forEach(s => s.onchange = e => notesState[e.target.dataset.idx].periodId = e.target.value);
      container.querySelectorAll(".note-text").forEach(i => i.onchange = e => notesState[e.target.dataset.idx].text = e.target.value);
      container.querySelectorAll(".note-del").forEach(b => b.onclick = e => {
        notesState.splice(e.target.dataset.idx, 1);
        renderNotesUI();
      });
    };

    document.getElementById("add-note-btn").onclick = () => {
      notesState.push({ date: survey.dates[0], periodId: activePeriods[0].id, text: "" });
      renderNotesUI();
    };

    // 既存回答の復元処理
    const loadExistingResponse = async (studentId) => {
      const docRef = doc(db, "surveys", surveyId, "responses", studentId);
      const resSnap = await getDoc(docRef);
      if (resSnap.exists()) {
        const data = resSnap.data();
        document.getElementById("r-name").value = data.name || "";
        if (data.availability) {
          Object.keys(data.availability).forEach(d => {
            if (selectedState[d]) selectedState[d] = data.availability[d];
          });
        }
        if (data.notes) notesState = data.notes;
        renderGrid();
        renderNotesUI();
        return true;
      }
      return false;
    };

    if (localSavedId) {
      document.getElementById("r-student-id").value = localSavedId;
      await loadExistingResponse(localSavedId);
    }

    document.getElementById("r-student-id").onblur = async (e) => {
      const val = e.target.value.trim();
      if (val) await loadExistingResponse(val);
    };

    renderGrid();
    renderNotesUI();

    if (isExpired) {
      document.getElementById("submit-resp-btn").disabled = true;
    }

    // 回答の送信(トランザクション対応)
    document.getElementById("respond-form").onsubmit = async (e) => {
      e.preventDefault();
      if (isExpired) return alert("回答期限を過ぎています。");

      const name = document.getElementById("r-name").value.trim();
      const studentId = document.getElementById("r-student-id").value.trim();

      try {
        await runTransaction(db, async (transaction) => {
          const sRef = doc(db, "surveys", surveyId);
          const rRef = doc(db, "surveys", surveyId, "responses", studentId);

          const sDoc = await transaction.get(sRef);
          if (!sDoc.exists()) throw new Error("アンケートが存在しません。");
          
          const sData = sDoc.data();
          if (new Date() > new Date(sData.deadline)) throw new Error("期限を過ぎています。");

          const rDoc = await transaction.get(rRef);
          const isNew = !rDoc.exists();

          if (isNew && sData.maxRespondents > 0 && sData.currentRespondents >= sData.maxRespondents) {
            throw new Error("回答人数が上限に達したため、新規送信できません。");
          }

          transaction.set(rRef, {
            name: name,
            studentId: studentId,
            availability: selectedState,
            notes: notesState,
            updatedAt: new Date().toISOString()
          });

          if (isNew) {
            transaction.update(sRef, {
              currentRespondents: (sData.currentRespondents || 0) + 1
            });
          }
        });

        localStorage.setItem(`survey_response_${surveyId}`, studentId);

        container.innerHTML = `
          <div class="card" style="text-align:center; padding:3rem 1rem;">
            <h2 style="color:var(--perfect-bg)">回答を送信しました！</h2>
            <p style="margin:1rem 0;">ご協力ありがとうございました。</p>
            <p style="font-size:0.85rem; color:var(--text-muted)">期限内であれば、同じリンクから何度でも修正できます。</p>
          </div>
        `;
      } catch (err) {
        alert("送信失敗: " + err.message);
      }
    };

  } catch (err) {
    container.innerHTML = `<p style="color:var(--danger)">エラー: ${err.message}</p>`;
  }
}

// モーダル表示ヘルパー
function openModal(contentHtml) {
  document.getElementById("modal-body").innerHTML = contentHtml;
  document.getElementById("modal-container").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-container").classList.add("hidden");
}

function escapeHTML(str) {
  return String(str || "").replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}