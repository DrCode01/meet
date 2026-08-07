import urllib.parse

from .base import BaseScraper, VideoResult, find_video_list, first_str

# RedTube's public JSON API lives on a separate host to www.redtube.com.
_API = "https://api.redtube.com/"


class RedTubeApiScraper(BaseScraper):
    site_name = "RedTube"
    base_url = "https://www.redtube.com"

    def search_urls(self, query: str) -> list[str]:
        return [
            _API + "?" + urllib.parse.urlencode({
                "data": "redtube.Videos.searchVideos",
                "search": query,
                "output": "json",
                "thumbsize": "medium",
                "page": str(page),
            })
            for page in (1, 2)
        ]

    def parse(self, body: str) -> list[VideoResult]:
        results = []
        for item in find_video_list(self.load_json(body)):
            # Payload nests each entry under a "video" key.
            v = item.get("video") if isinstance(item.get("video"), dict) else item
            video_id = first_str(v, "video_id")
            url = first_str(v, "url") or (f"{self.base_url}/{video_id}" if video_id else "")
            if not url:
                continue
            thumbs = v.get("thumbs")
            thumb = first_str(v, "thumb", "default_thumb")
            if isinstance(thumbs, list) and thumbs and isinstance(thumbs[-1], dict):
                thumb = thumbs[-1].get("src", thumb)
            results.append(VideoResult(
                title=first_str(v, "title"),
                url=url,
                thumbnail=thumb,
                duration=first_str(v, "duration"),
                site=self.site_name,
                views=first_str(v, "views"),
                rating=first_str(v, "rating"),
            ))
        return results
