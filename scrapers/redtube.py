import urllib.parse
import aiohttp
from bs4 import BeautifulSoup
from .base import BaseScraper, VideoResult


class RedTubeScraper(BaseScraper):
    site_name = "RedTube"
    base_url = "https://www.redtube.com"

    async def search(self, session: aiohttp.ClientSession, query: str) -> list[VideoResult]:
        encoded = urllib.parse.quote_plus(query)
        url = f"{self.base_url}/?search={encoded}"
        html = await self.fetch(session, url)
        if not html:
            return []
        return self.parse(html)

    def parse(self, html: str) -> list[VideoResult]:
        soup = BeautifulSoup(html, "lxml")
        results = []
        for item in soup.select("li.video_item")[:20]:
            a = item.select_one("a.video_link")
            title_el = item.select_one("div.video_title")
            img = item.select_one("img")
            duration_el = item.select_one("span.video_duration")
            views_el = item.select_one("span.videoViews")
            if not a:
                continue
            href = a.get("href", "")
            if href and not href.startswith("http"):
                href = self.base_url + href
            title = title_el.get_text(strip=True) if title_el else a.get("title", "")
            thumbnail = ""
            if img:
                thumbnail = img.get("data-src") or img.get("src", "")
            results.append(VideoResult(
                title=title,
                url=href,
                thumbnail=thumbnail,
                duration=duration_el.get_text(strip=True) if duration_el else "",
                site=self.site_name,
                views=views_el.get_text(strip=True) if views_el else "",
            ))
        return results
