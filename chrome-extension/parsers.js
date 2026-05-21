const SITES = [
  {
    name: "xVideos",
    color: "#d92f2f",
    searchUrl: (q) => `https://www.xvideos.com/?k=${encodeURIComponent(q)}`,
    base: "https://www.xvideos.com",
    parse(doc, base) {
      return [...doc.querySelectorAll("div.thumb-block")]
        .slice(0, 20)
        .map((el) => {
          const a = el.querySelector("p.title a");
          const img = el.querySelector("img");
          const dur = el.querySelector("span.duration");
          if (!a) return null;
          const href = a.getAttribute("href") || "";
          return {
            title: a.textContent.trim(),
            url: href.startsWith("http") ? href : base + href,
            thumbnail: img?.dataset.src || img?.getAttribute("src") || "",
            duration: dur?.textContent.trim() || "",
            views: "",
            site: this.name,
            color: this.color,
          };
        })
        .filter(Boolean);
    },
  },
  {
    name: "xHamster",
    color: "#f47f2a",
    searchUrl: (q) => `https://xhamster.com/search/${encodeURIComponent(q)}`,
    base: "https://xhamster.com",
    parse(doc, base) {
      return [...doc.querySelectorAll("div.thumb-list__item")]
        .slice(0, 20)
        .map((el) => {
          const a = el.querySelector("a.thumb-image-container");
          const title = el.querySelector("a.video-thumb-info__name");
          const img = el.querySelector("img");
          const dur = el.querySelector("div.thumb-image-container__duration");
          const views = el.querySelector("div.video-thumb-views");
          if (!a || !title) return null;
          const href = a.getAttribute("href") || "";
          return {
            title: title.textContent.trim(),
            url: href.startsWith("http") ? href : base + href,
            thumbnail: img?.dataset.src || img?.getAttribute("src") || "",
            duration: dur?.textContent.trim() || "",
            views: views?.textContent.trim() || "",
            site: this.name,
            color: this.color,
          };
        })
        .filter(Boolean);
    },
  },
  {
    name: "SpankBang",
    color: "#e8642b",
    searchUrl: (q) =>
      `https://spankbang.com/s/${encodeURIComponent(q)}/`,
    base: "https://spankbang.com",
    parse(doc, base) {
      return [...doc.querySelectorAll("div.video-item")]
        .slice(0, 20)
        .map((el) => {
          const a = el.querySelector("a");
          const title = el.querySelector("p.n");
          const img = el.querySelector("img");
          const dur = el.querySelector("span.l");
          const views = el.querySelector("span.v");
          if (!a || !title) return null;
          const href = a.getAttribute("href") || "";
          return {
            title: title.textContent.trim(),
            url: href.startsWith("http") ? href : base + href,
            thumbnail:
              img?.dataset.src ||
              img?.dataset.srcset?.split(" ")[0] ||
              img?.getAttribute("src") ||
              "",
            duration: dur?.textContent.trim() || "",
            views: views?.textContent.trim() || "",
            site: this.name,
            color: this.color,
          };
        })
        .filter(Boolean);
    },
  },
  {
    name: "Eporner",
    color: "#cc2222",
    searchUrl: (q) =>
      `https://www.eporner.com/search/${encodeURIComponent(q)}/`,
    base: "https://www.eporner.com",
    parse(doc, base) {
      return [...doc.querySelectorAll("#videos .mb")]
        .slice(0, 20)
        .map((el) => {
          const a = el.querySelector("a");
          const title =
            el.querySelector("strong.mbtit") || el.querySelector("a");
          const img = el.querySelector("img");
          const dur = el.querySelector("span.mbtim");
          const views = el.querySelector("span.mbvw");
          if (!a) return null;
          const href = a.getAttribute("href") || "";
          return {
            title: (title?.getAttribute("title") || title?.textContent || "").trim(),
            url: href.startsWith("http") ? href : base + href,
            thumbnail: img?.dataset.src || img?.getAttribute("src") || "",
            duration: dur?.textContent.trim() || "",
            views: views?.textContent.trim() || "",
            site: this.name,
            color: this.color,
          };
        })
        .filter(Boolean);
    },
  },
  {
    name: "XNXX",
    color: "#1a7cd9",
    searchUrl: (q) =>
      `https://www.xnxx.com/search/${encodeURIComponent(q)}/0`,
    base: "https://www.xnxx.com",
    parse(doc, base) {
      return [...doc.querySelectorAll("div.thumb-block")]
        .slice(0, 20)
        .map((el) => {
          const a = el.querySelector("p.title a");
          const img = el.querySelector("img");
          const dur = el.querySelector("span.duration");
          if (!a) return null;
          const href = a.getAttribute("href") || "";
          return {
            title: a.textContent.trim(),
            url: href.startsWith("http") ? href : base + href,
            thumbnail: img?.dataset.src || img?.getAttribute("src") || "",
            duration: dur?.textContent.trim() || "",
            views: "",
            site: this.name,
            color: this.color,
          };
        })
        .filter(Boolean);
    },
  },
  {
    name: "RedTube",
    color: "#d62020",
    searchUrl: (q) =>
      `https://www.redtube.com/?search=${encodeURIComponent(q)}`,
    base: "https://www.redtube.com",
    parse(doc, base) {
      return [...doc.querySelectorAll("li.video_item")]
        .slice(0, 20)
        .map((el) => {
          const a = el.querySelector("a.video_link");
          const title = el.querySelector("div.video_title") || a;
          const img = el.querySelector("img");
          const dur = el.querySelector("span.video_duration");
          const views = el.querySelector("span.videoViews");
          if (!a) return null;
          const href = a.getAttribute("href") || "";
          return {
            title: (title?.getAttribute("title") || title?.textContent || "").trim(),
            url: href.startsWith("http") ? href : base + href,
            thumbnail: img?.dataset.src || img?.getAttribute("src") || "",
            duration: dur?.textContent.trim() || "",
            views: views?.textContent.trim() || "",
            site: this.name,
            color: this.color,
          };
        })
        .filter(Boolean);
    },
  },
];
