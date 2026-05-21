import urllib.parse
import aiohttp
from bs4 import BeautifulSoup
from .base import BaseScraper, VideoResult


class XHamsterScraper(BaseScraper):
    site_name = "xHamster"
    base_url = "https://xhamster.com"

    async def search(self, session: aiohttp.ClientSession, query: str) -> list[VideoResult]:
        encoded = urllib.parse.quote_plus(query)
        url = f"{self.base_url}/search/{encoded}"
        html = await self.fetch(session, url)
        if not html:
            return []
        return self.parse(html)

    def parse(self, html: str) -> list[VideoResult]:
        soup = BeautifulSoup(html, "lxml")
        results = []
        for card in soup.select("div.thumb-list__item")[:20]:
            a = card.select_one("a.thumb-image-container")
            title_el = card.select_one("a.video-thumb-info__name")
            img = card.select_one("img")
            duration_el = card.select_one("div.thumb-image-container__duration")
            views_el = card.select_one("div.video-thumb-views")
            if not a or not title_el:
                continue
            href = a.get("href", "")
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
