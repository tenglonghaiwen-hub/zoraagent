"""Zora compatibility hooks; keep the upstream engine checkout unmodified."""
from urllib.parse import urlsplit

def configure_stock_sources():
    from tools.video.stock_sources import pexels, unsplash
    pexels._VIDEO_SEARCH_URL = "https://api.pexels.com/v1/videos/search"
    pexels._PEXELS_LICENSE = "Pexels License; API attribution required; retain creator and source URL"
    original = unsplash.UnsplashSource.download

    def download(self, candidate, out_path):
        import requests
        location = (candidate.extra or {}).get("download_location")
        parsed = urlsplit(location or "")
        if parsed.scheme != "https" or parsed.netloc != "api.unsplash.com" or not parsed.path.startswith('/photos/') or parsed.username:
            raise ValueError("Unsplash download tracking URL missing or invalid")
        response = requests.get(location, headers=self._headers(), timeout=30, allow_redirects=False)
        if response.status_code != 200:
            raise RuntimeError("Unsplash download tracking failed (%s)" % response.status_code)
        return original(self, candidate, out_path)

    unsplash.UnsplashSource.download = download
