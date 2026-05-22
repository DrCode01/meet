import urllib.parse
import aiohttp
from bs4 import BeautifulSoup
from .base import BaseScraper, VideoResult


class XHamsterScraper(BaseScraper):
    site_name = "xHamster"
    base_url = "https://xhamster.com"

    async def search(self, session: aiohttp.ClientSession, query: str) -> list[VideoResult]:
        encoded = urllib.parse.quote_plus(query)
        pages = [
            f"{self.base_url}/search/{encoded}",
            f"{self.base_url}/search/{encoded}?page=2",
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
        # Try multiple selector patterns (site updates its HTML periodically)
        cards = (
            soup.select("div.thumb-list__item")
            or soup.select("article.video-thumb")
            or soup.select("[class*='videoThumb']")
            or soup.select("div[class*='thumb-item']")
        )
        for card in cards:
            a = (
                card.select_one("a.thumb-image-container")
                or card.select_one("a[href*='/videos/']")
                or card.select_one("a")
            )
            title_el = (
                card.select_one("a.video-thumb-info__name")
                or card.select_one("[class*='title']")
                or card.select_one("[class*='name']")
            )
            img = card.select_one("img")
            duration_el = (
                card.select_one("div.thumb-image-container__duration")
                or card.select_one("[class*='duration']")
            )
            views_el = (
                card.select_one("div.video-thumb-views")
                or card.select_one("[class*='views']")
            )
            if not a or not title_el:
                continue
            href = a.get("href", "")
            if href and not href.startswith("http"):
                href = self.base_url + href
            if not href or "/videos/" not in href:
                continue
            thumbnail = img.get("data-src") or img.get("src", "") if img else ""
            results.append(VideoResult(
                title=title_el.get_text(strip=True),
                url=href,
                thumbnail=thumbnail,
                duration=duration_el.get_text(strip=True) if duration_el else "",
                site=self.site_name,
                views=views_el.get_text(strip=True) if views_el else "",
            ))
        return results
