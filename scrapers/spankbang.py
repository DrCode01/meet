import urllib.parse
import aiohttp
from bs4 import BeautifulSoup
from .base import BaseScraper, VideoResult


class SpankBangScraper(BaseScraper):
    site_name = "SpankBang"
    base_url = "https://spankbang.com"

    async def search(self, session: aiohttp.ClientSession, query: str) -> list[VideoResult]:
        encoded = urllib.parse.quote_plus(query)
        url = f"{self.base_url}/s/{encoded}/"
        html = await self.fetch(session, url)
        if not html:
            return []
        return self.parse(html)

    def parse(self, html: str) -> list[VideoResult]:
        soup = BeautifulSoup(html, "lxml")
        results = []
        for item in soup.select("div.video-item")[:20]:
            a = item.select_one("a")
            title_el = item.select_one("p.n")
            img = item.select_one("img")
            duration_el = item.select_one("span.l")
            views_el = item.select_one("span.v")
            if not a or not title_el:
                continue
            href = a.get("href", "")
            if href and not href.startswith("http"):
                href = self.base_url + href
            thumbnail = ""
            if img:
                thumbnail = img.get("data-src") or img.get("src", "")
            results.append(VideoResult(
                title=title_el.get_text(strip=True),
                url=href,
                thumbnail=thumbnail,
                duration=duration_el.get_text(strip=True) if duration_el else "",
                site=self.site_name,
                views=views_el.get_text(strip=True) if views_el else "",
            ))
        return results
