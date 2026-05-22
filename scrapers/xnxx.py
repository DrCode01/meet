import urllib.parse
import aiohttp
from bs4 import BeautifulSoup
from .base import BaseScraper, VideoResult


class XnxxScraper(BaseScraper):
    site_name = "XNXX"
    base_url = "https://www.xnxx.com"

    async def search(self, session: aiohttp.ClientSession, query: str) -> list[VideoResult]:
        # XNXX uses underscores in search URLs, not + or %20
        slug = query.strip().replace(" ", "+")
        results = []
        for page in [0, 1]:
            url = f"{self.base_url}/search/{slug}/{page}"
            status, html = await self.fetch(session, url)
            if status == 200 and html:
                results.extend(self.parse(html))
        return results

    def parse(self, html: str) -> list[VideoResult]:
        soup = BeautifulSoup(html, "html.parser")
        results = []
        for thumb in soup.select("div.thumb-block"):
            a = thumb.select_one("p.title a")
            img = thumb.select_one("img")
            dur = thumb.select_one("span.duration")
            if not a or not img:
                continue
            href = a.get("href", "")
            if href and not href.startswith("http"):
                href = self.base_url + href
            results.append(VideoResult(
                title=a.get_text(strip=True),
                url=href,
                thumbnail=img.get("data-src") or img.get("src", ""),
                duration=dur.get_text(strip=True) if dur else "",
                site=self.site_name,
            ))
        return results
