"""从仓库源码生成 Loon 安装文件。首次构建先运行 npm ci --prefix src/youtube。"""
import hashlib
import os
import re
import subprocess
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent
YOUTUBE = ROOT / "src/youtube"
RELEASE_URL = "https://raw.githubusercontent.com/Norvon/LGLoon/main"
PLUGIN = Path("plugins/LGLoon.lpx")
YOUTUBE_SCRIPT = Path("scripts/LGLoon-YouTube.js")
SPOTIFY_SCRIPT = Path("scripts/LGLoon-Spotify.js")
# Loon 会原样显示 #!date，统一用北京时间
BEIJING = timezone(timedelta(hours=8))
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def render_plugin(template, date):
    plugin = template.replace("@VERSION_DATE@", date.strftime(DATE_FORMAT))
    plugin = plugin.replace("@YOUTUBE_SCRIPT@", f"{RELEASE_URL}/{YOUTUBE_SCRIPT.as_posix()}")
    return plugin.replace("@SPOTIFY_SCRIPT@", f"{RELEASE_URL}/{SPOTIFY_SCRIPT.as_posix()}")


def version_date(template, scripts):
    """产物内容没变时沿用上一版日期，避免重复构建制造新版本。"""
    previous = ROOT / PLUGIN
    if previous.exists():
        text = previous.read_text(encoding="utf-8")
        match = re.search(r"^#!date = (.+)$", text, re.M)
        try:
            old = datetime.strptime(match.group(1), DATE_FORMAT).replace(tzinfo=BEIJING) if match else None
        except ValueError:
            old = None
        if old and render_plugin(template, old) == text and all(
                (ROOT / path).is_file() and (ROOT / path).read_bytes() == data for path, data in scripts.items()):
            return old
    return datetime.now(BEIJING).replace(microsecond=0)


def main():
    for task in ("build:proto", "typecheck", "build"):
        subprocess.run(["npm", "run", task], cwd=YOUTUBE, check=True)

    template = (ROOT / "src/media/LGLoon.lpx.in").read_text(encoding="utf-8")
    spotify_bundle = subprocess.check_output(
        [YOUTUBE / "node_modules/.bin/esbuild", "src/spotify/index.js", "--bundle", "--minify", "--format=iife",
         "--inject:src/youtube/lib/text-polyfill.mjs"],
        cwd=ROOT,
        env={**os.environ, "NODE_PATH": str(YOUTUBE / "node_modules")},
    )
    scripts = {
        YOUTUBE_SCRIPT: (YOUTUBE / "dist/youtube.response.preview.js").read_bytes(),
        SPOTIFY_SCRIPT: spotify_bundle,
    }
    plugin = render_plugin(template, version_date(template, scripts))
    outputs = {PLUGIN: plugin.encode("utf-8"), **scripts}
    checksums = "".join(f"{hashlib.sha256(data).hexdigest()}  {path}\n"
                        for path, data in sorted(outputs.items()))
    outputs[Path("checksums.sha256")] = checksums.encode("ascii")
    # 所有产物就绪后再更新安装文件，最后写入本次构建的校验清单。
    with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
        for path, data in outputs.items():
            staged = Path(temporary) / path
            staged.parent.mkdir(parents=True, exist_ok=True)
            staged.write_bytes(data)
        for path in outputs:
            target = ROOT / path
            target.parent.mkdir(parents=True, exist_ok=True)
            (Path(temporary) / path).replace(target)
    print(checksums, end="")


if __name__ == "__main__":
    main()
