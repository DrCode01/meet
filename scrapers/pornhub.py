import urllib.parse

from .base import BaseScraper, VideoResult, find_video_list, first_str


class PornHubScraper(BaseScraper):
    site_name = "PornHub"
    base_url = "https://www.pornhub.com"

    def search_urls(self, query: str) -> list[str]:
        encoded = urllib.parse.quote_plus(query)
        return [
            f"{self.base_url}/webmasters/search?search={encoded}"
            f"&per_page=20&page={page}&ordering=mostviewed"
            for page in (1, 2)
        ]

    def parse(self, body: str) -> list[VideoResult]:
        return [
            VideoResult(
                title=first_str(v, "title"),
                url=first_str(v, "url"),
                thumbnail=first_str(v, "thumb", "default_thumb"),
                duration=first_str(v, "duration"),
                site=self.site_name,
                views=first_str(v, "views"),
                rating=first_str(v, "rating"),
            )
            for v in find_video_list(self.load_json(body))
            if v.get("url")
        ]
