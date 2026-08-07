import urllib.parse

from .base import BaseScraper, VideoResult, find_video_list, first_str

# Undocumented JSON index endpoint — payload shape is not guaranteed stable,
# so parsing goes through find_video_list/first_str rather than fixed keys.
_API = "https://beeg.com/api/v6/index"


class BeegScraper(BaseScraper):
    site_name = "Beeg"
    base_url = "https://beeg.com"

    def search_urls(self, query: str) -> list[str]:
        return [
            _API + "?" + urllib.parse.urlencode({
                "q": query,
                "offset": str(offset),
                "step": "30",
                "order": "top_rated",
            })
            for offset in (0, 30)
        ]

    def parse(self, body: str) -> list[VideoResult]:
        results = []
        for v in find_video_list(self.load_json(body)):
            video_id = first_str(v, "id", "video_id")
            title = first_str(v, "title", "name")
            if not video_id or not title:
                continue
            url = first_str(v, "url") or f"{self.base_url}/{video_id}"
            results.append(VideoResult(
                title=title,
                url=url if url.startswith("http") else f"{self.base_url}{url}",
                thumbnail=first_str(
                    v, "image", "thumb", "thumbnail",
                    default=f"https://img.beeg.com/236x177/{video_id}.jpg",
                ),
                duration=first_str(v, "duration", "length"),
                site=self.site_name,
                views=first_str(v, "views"),
                rating=first_str(v, "rate", "rating"),
            ))
        return results
