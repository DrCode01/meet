import json
import urllib.parse
import aiohttp
from bs4 import BeautifulSoup
from .base import BaseScraper, VideoResult


class XHamsterScraper(BaseScraper):
    site_name = "xHamster"
    base_url = "https://xhamster.com"

    async def search(self, session: aiohttp.ClientSession, query: str) -> list[VideoResult]:
        encoded = urllib.parse.quote_plus(query)
        results = []
        for page in [1, 2]:
            url = f"{self.base_url}/search/{encoded}?page={page}"
            status, html = await self.fetch(session, url)
            if status == 200 and html:
                results.extend(self.parse(html))
        return results

    def parse(self, html: str) -> list[VideoResult]:
        # xHamster embeds page data as JSON — much more reliable than CSS selectors
        results = self._parse_json(html)
        if results:
            return results
        return self._parse_html(html)

    def _parse_json(self, html: str) -> list[VideoResult]:
        import re
        results = []
        # xHamster stores page data in a script tag
        matches = re.findall(r'window\.initials\s*=\s*(\{.+?\});\s*\n', html, re.DOTALL)
        if not matches:
            matches = re.findall(r'"videos"\s*:\s*(\[.+?\])\s*[,}]', html, re.DOTALL)
        for raw in matches:
            try:
                data = json.loads(raw)
                videos = data if isinstance(data, list) else data.get("videoSearchResult", {}).get("models", [])
                for v in videos:
                    url = v.get("pageURL") or v.get("url", "")
                    title = v.get("title", "")
                    thumb = v.get("thumbURL") or v.get("thumbnail", "")
                    dur = str(v.get("duration", ""))
                    views = str(v.get("views", ""))
                    if url and title:
                        results.append(VideoResult(
                            title=title, url=url, thumbnail=thumb,
                            duration=dur, site=self.site_name, views=views,
                        ))
            except Exception:
                continue
        return results

    def _parse_html(self, html: str) -> list[VideoResult]:
        soup = BeautifulSoup(html, "html.parser")
        results = []
        cards = (
            soup.select("div.thumb-list__item")
            or soup.select("article.video-thumb")
            or soup.select("[class*='videoThumb']")
        )
        for card in cards:
            a = card.select_one("a[href*='/videos/']") or card.select_one("a")
            title_el = card.select_one("[class*='title']") or card.select_one("[class*='name']")
            img = card.select_one("img")
            dur = card.select_one("[class*='duration']")
            views = card.select_one("[class*='views']")
            if not a or not title_el:
                continue
            href = a.get("href", "")
            if href and not href.startswith("http"):
                href = self.base_url + href
            results.append(VideoResult(
                title=title_el.get_text(strip=True),
                url=href,
                thumbnail=img.get("data-src") or img.get("src", "") if img else "",
                duration=dur.get_text(strip=True) if dur else "",
                site=self.site_name,
                views=views.get_text(strip=True) if views else "",
            ))
        return results
