const params = new URLSearchParams(location.search);
let currentQuery = params.get("q") || "";
let allResults = [];
let activeSite = "all";

const grid = document.getElementById("grid");
const statusEl = document.getElementById("status");
const countEl = document.getElementById("result-count");
const emptyEl = document.getElementById("empty");
const qInput = document.getElementById("q");
const filterBar = document.getElementById("filter-bar");

qInput.value = currentQuery;
document.title = `${currentQuery} — Adult Search`;

// Build site filter buttons
SITES.forEach((site) => {
  const btn = document.createElement("button");
  btn.className = "filter-btn";
  btn.dataset.site = site.name;
  btn.textContent = site.name;
  filterBar.appendChild(btn);
});

filterBar.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-btn");
  if (!btn) return;
  activeSite = btn.dataset.site;
  document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  renderGrid();
});

document.getElementById("search-btn").addEventListener("click", () => runSearch(qInput.value));
qInput.addEventListener("keydown", (e) => { if (e.key === "Enter") runSearch(qInput.value); });
document.getElementById("home-link").addEventListener("click", (e) => {
  e.preventDefault();
  history.back();
});

function renderGrid() {
  const filtered = activeSite === "all"
    ? allResults
    : allResults.filter((r) => r.site === activeSite);

  grid.innerHTML = "";
  emptyEl.style.display = filtered.length === 0 ? "block" : "none";
  countEl.textContent = filtered.length > 0
    ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""}`
    : "";

  filtered.forEach((v) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <a href="${v.url}" target="_blank" rel="noopener noreferrer">
        <div class="thumb-wrap">
          ${v.thumbnail
            ? `<img src="${v.thumbnail}" alt="" loading="lazy" onerror="this.style.display='none'" />`
            : `<div class="thumb-placeholder">▶</div>`}
          <span class="site-badge" style="background:${v.color}">${v.site}</span>
          ${v.duration ? `<span class="duration-badge">${v.duration}</span>` : ""}
        </div>
        <div class="card-body">
          <div class="card-title">${escHtml(v.title)}</div>
          <div class="card-meta">
            ${v.views ? `<span>👁 ${escHtml(v.views)}</span>` : ""}
          </div>
        </div>
      </a>`;
    grid.appendChild(card);
  });
}

function escHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildStatusDots() {
  statusEl.innerHTML = SITES.map(
    (s) => `<div class="site-status" id="dot-${s.name.replace(/\s/g, "_")}">
      <div class="dot loading"></div><span>${s.name}</span>
    </div>`
  ).join("");
}

function setDot(siteName, state) {
  const wrap = document.getElementById(`dot-${siteName.replace(/\s/g, "_")}`);
  if (wrap) wrap.querySelector(".dot").className = `dot ${state}`;
}

async function fetchSite(site, query) {
  const url = site.searchUrl(query);
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "fetch", url }, (resp) => {
      if (chrome.runtime.lastError || !resp?.ok) {
        resolve([]);
        return;
      }
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(resp.html, "text/html");
        resolve(site.parse(doc, site.base));
      } catch {
        resolve([]);
      }
    });
  });
}

async function runSearch(rawQuery) {
  const q = rawQuery.trim();
  if (!q) return;
  currentQuery = q;
  document.title = `${q} — Adult Search`;
  history.replaceState(null, "", `?q=${encodeURIComponent(q)}`);
  qInput.value = q;

  allResults = [];
  activeSite = "all";
  document.querySelectorAll(".filter-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.site === "all")
  );
  grid.innerHTML = "";
  emptyEl.style.display = "none";
  countEl.textContent = "Searching…";
  buildStatusDots();

  const seen = new Set();

  await Promise.all(
    SITES.map(async (site) => {
      const videos = await fetchSite(site, q);
      setDot(site.name, videos.length > 0 ? "done" : "error");
      videos.forEach((v) => {
        if (!seen.has(v.url)) {
          seen.add(v.url);
          allResults.push(v);
        }
      });
      renderGrid();
    })
  );

  if (allResults.length === 0) {
    emptyEl.style.display = "block";
    countEl.textContent = "";
  }
}

if (currentQuery) runSearch(currentQuery);
