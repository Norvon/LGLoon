"""Build a small Host-only Loon plugin for the VPN startup test.

No credentials, application configuration, or third-party Python packages needed.
Unknown syntax or an unexpectedly small list fails before replacing any output.
"""
import hashlib
import json
import os
import re
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UPSTREAM = "MetaCubeX/meta-rules-dat"
SOURCE_PATH = "geo/geosite/cn.list"
ALI = "https://223.5.5.5/dns-query"
STARTUP_TEST_DOMAINS = {"163.com", "alipay.com", "baidu.com", "bilibili.com", "douyin.com",
                        "gov.cn", "jd.com", "qq.com", "taobao.com", "weibo.com"}


def parse(data):
    domains = set()
    for line in data.decode("utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if not line.startswith("+."):
            raise ValueError("Unsupported upstream matcher; keeping previous plugin")
        domain = line[2:].lower()
        if not re.fullmatch(r"[a-z0-9_-]+(?:\.[a-z0-9_-]+)*", domain):
            raise ValueError("Invalid domain in source")
        domains.add(domain)
    if not 50_000 <= len(domains) <= 300_000:
        raise ValueError("CN domain count outside expected range")
    return domains


def covered(domain, suffixes):
    parts = domain.split(".")
    return any(".".join(parts[i:]) in suffixes for i in range(len(parts)))


def atomic_write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False, mode="w", encoding="utf-8", newline="\n") as handle:
        temporary = Path(handle.name)
        handle.write(content)
    os.replace(temporary, path)


def build(data, snapshot):
    revision = snapshot["upstream_revision"]
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise ValueError("Invalid upstream revision")
    domains = parse(data)
    source_count = len(domains)
    exceptions = {line.strip() for line in (ROOT / 'foreign-dns-exceptions.txt').read_text().splitlines()
                  if line.strip() and not line.startswith('#')}
    # Explicit foreign DNS exceptions are independent of upstream CN changes.
    domains = {d for d in domains if not covered(d, exceptions)}
    if any(covered(d, domains) for d in exceptions):
        raise ValueError('A broader CN suffix conflicts with a foreign DNS exception')
    if source_count < snapshot["source_cn_suffix_count"] * 0.9:
        raise ValueError("Source shrank by more than 10%; manual investigation required")
    excluded_count = source_count - len(domains)
    if not all(covered(d, domains) for d in STARTUP_TEST_DOMAINS):
        raise ValueError("A startup test domain is outside the CN list")
    domains = STARTUP_TEST_DOMAINS
    samples_cn = ["baidu.com", "www.baidu.com", "qq.com", "www.taobao.com",
                  "www.bilibili.com", "www.jd.com", "www.douyin.com", "www.gov.cn"]
    samples_foreign = ["chatgpt.com", "api.openai.com", "claude.ai", "claude.com",
                       "gemini.google.com", "generativelanguage.googleapis.com",
                       "www.google.com", "browserleaks.com", "api4.ipify.org"]
    if not all(covered(d, domains) for d in samples_cn):
        raise ValueError("Domestic classification regression")
    if any(covered(d, domains) for d in samples_foreign):
        raise ValueError("Foreign/AI domain unexpectedly classified as domestic")
    lines = ["#!name = 国内域名 AliDNS 加密解析（启动测试版）",
             f"#!desc = 启动测试：{len(domains)} 个域名及其子域名使用阿里 DoH，共 {len(domains) * 2} 条映射。其他域名沿用主配置 DNS。",
             "#!author = ccc592",
             "#!homepage = https://github.com/ccc592/loon-dns-rules",
             "#!date = " + snapshot["plugin_date"],
             "# Source: https://github.com/" + UPSTREAM,
             "# Source revision: " + revision,
             "# License: GPL-3.0; see LICENSE and README.md for attribution.",
             "", "[Host]"]
    for domain in sorted(domains):
        lines.extend([domain + " = server:" + ALI, "*." + domain + " = server:" + ALI])
    plugin = "\n".join(lines) + "\n"
    if re.findall(r"^\[([^\]]+)\]$", plugin, re.M) != ["Host"]:
        raise ValueError("Unexpected plugin section")
    manifest = {"plugin_date": snapshot["plugin_date"],
                "upstream_repository": UPSTREAM, "upstream_revision": revision,
                "upstream_path": SOURCE_PATH,
                "source_sha256": hashlib.sha256(data).hexdigest(),
                "source_cn_suffix_count": source_count,
                "excluded_cn_suffix_count": excluded_count,
                "cn_suffix_count": len(domains), "host_mapping_count": len(domains) * 2,
                "plugin_sha256": hashlib.sha256(plugin.encode()).hexdigest(),
                "plugin_size_bytes": len(plugin.encode()),
                "domestic_samples_checked": samples_cn,
                "foreign_samples_checked": samples_foreign}
    atomic_write(ROOT / "dist/China-DNS.lpx", plugin)
    atomic_write(ROOT / "dist/manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({k: manifest[k] for k in ["upstream_revision", "cn_suffix_count", "host_mapping_count", "plugin_sha256"]}))


if __name__ == "__main__":
    build((ROOT / "cn.list").read_bytes(), json.loads((ROOT / "manifest.json").read_text()))
