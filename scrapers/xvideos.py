import urllib.parse
import aiohttp
from bs4 import BeautifulSoup
from .base import BaseScraper, VideoResult


class XVideosScraper(BaseScraper):
    site_name = "xVideos"
    base_url = "https://www.xvideos.com"

    async def search(self, session: aiohttp.ClientSession, query: str) -> list[VideoResult]:
        encoded = urllib.parse.quote_plus(query)
        url = f"{self.base_url}/?k={encoded}"
        html = await self.fetch(session, url)
        if not html:
            return []
        return self.parse(html)

    def parse(self, html: str) -> list[VideoResult]:
        soup = BeautifulSoup(html, "lxml")
        results = []
        for thumb in soup.select("div.thumb-block")[:20]:
            a = thumb.select_one("p.title a")
            img = thumb.select_one("img")
            duration_el = thumb.select_one("span.duration")
            if not a or not img:
                continue
            href = a.get("href", "")
            if not href.startswith("http"):
                href = self.base_url + href
            thumbnail = img.get("data-src") or img.get("src", "")
            results.append(VideoResult(
                title=a.get_text(strip=True),
                url=href,
                thumbnail=thumbnail,
                duration=duration_el.get_text(strip=True) if duration_el else "",
                site=self.site_name,
            ))
        return results
