chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "fetch") return;

  fetch(request.url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  })
    .then((r) => r.text())
    .then((html) => sendResponse({ ok: true, html }))
    .catch((err) => sendResponse({ ok: false, error: err.message }));

  return true; // keep async channel open
});
