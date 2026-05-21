function openSearch(q) {
  if (!q.trim()) return;
  const url = chrome.runtime.getURL("results.html") + "?q=" + encodeURIComponent(q.trim());
  chrome.tabs.create({ url });
  window.close();
}

document.getElementById("btn").addEventListener("click", () => {
  openSearch(document.getElementById("q").value);
});

document.getElementById("q").addEventListener("keydown", (e) => {
  if (e.key === "Enter") openSearch(e.target.value);
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => openSearch(chip.dataset.q));
});
