import json
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).parent
COMMENTS = ROOT / "comments"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        name = Path(self.path).name
        if Path(self.path).parent.as_posix() != "/comments" or not name.endswith(".json"):
            self.send_error(404)
            return
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        COMMENTS.mkdir(exist_ok=True)
        (COMMENTS / name).write_text(json.dumps(json.loads(body), indent=2, ensure_ascii=False))
        self.send_response(204)
        self.end_headers()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 8731), Handler).serve_forever()
