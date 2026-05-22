import urllib.parse
import aiohttp
from bs4 import BeautifulSoup
from .base import BaseScraper, VideoResult


class XnxxScraper(BaseScraper):
    site_name = "XNXX"
    base_url = "https://www.xnxx.com"

    async def search(self, session: aiohttp.ClientSession, query: str) -> list[VideoResult]:
        encoded = urllib.parse.quote_plus(query)
        pages = [
            f"{self.base_url}/search/{encoded}/0",
            f"{self.base_url}/search/{encoded}/1",
        ]
        results = []
        for url in pages:
            html = await self.fetch(session, url)
            if html:
                results.extend(self.parse(html))
        return results

    def parse(self, html: str) -> list[VideoResult]:
        soup = BeautifulSoup(html, "html.parser")
        results = []
        for thumb in soup.select("div.thumb-block"):
            a = thumb.select_one("p.title a")
            img = thumb.select_one("img")
            duration_el = thumb.select_one("span.duration")
            if not a or not img:
                continue
            href = a.get("href", "")
            if href and not href.startswith("http"):
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
