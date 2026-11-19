"""从仓库源码生成 Loon 安装文件。首次构建先运行 npm ci --prefix src/youtube。"""
import hashlib
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent
YOUTUBE = ROOT / "src/youtube"
RELEASE_URL = "https://raw.githubusercontent.com/Norvon/LGLoon/main"


def main():
    for task in ("build:proto", "typecheck", "build"):
        subprocess.run(["npm", "run", task], cwd=YOUTUBE, check=True)

    youtube_script = Path("scripts/LGLoon-YouTube.js")
    spotify_script = Path("scripts/LGLoon-Spotify.js")
    template = (ROOT / "src/media/LGLoon.lpx.in").read_text(encoding="utf-8")
    plugin = template.replace("@YOUTUBE_SCRIPT@", f"{RELEASE_URL}/{youtube_script.as_posix()}")
    plugin = plugin.replace("@SPOTIFY_SCRIPT@", f"{RELEASE_URL}/{spotify_script.as_posix()}")
    spotify_bundle = subprocess.check_output(
        [YOUTUBE / "node_modules/.bin/esbuild", "src/spotify/index.js", "--bundle", "--minify", "--format=iife"],
        cwd=ROOT,
    )
    outputs = {
        Path("plugins/LGLoon.lpx"): plugin.encode("utf-8"),
        youtube_script: (YOUTUBE / "dist/youtube.response.preview.js").read_bytes(),
        spotify_script: spotify_bundle,
    }
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
