import urllib.parse

from bs4 import BeautifulSoup

from .base import BaseScraper, VideoResult


class XVideosScraper(BaseScraper):
    site_name = "xVideos"
    base_url = "https://www.xvideos.com"
    json_api = False

    def search_urls(self, query: str) -> list[str]:
        encoded = urllib.parse.quote_plus(query)
        return [f"{self.base_url}/?k={encoded}&p={page}" for page in (1, 2)]

    def parse(self, body: str) -> list[VideoResult]:
        soup = BeautifulSoup(body, "html.parser")
        results = []
        for thumb in soup.select("div.thumb-block"):
            a = thumb.select_one("p.title a") or thumb.select_one("a[href*='/video']")
            img = thumb.select_one("img")
            dur = thumb.select_one("span.duration")
            href = a.get("href", "") if a else ""
            if not a or not img or not href:
                continue
            results.append(VideoResult(
                title=a.get_text(strip=True),
                url=href if href.startswith("http") else self.base_url + href,
                thumbnail=img.get("data-src") or img.get("src", ""),
                duration=dur.get_text(strip=True) if dur else "",
                site=self.site_name,
            ))
        return results
