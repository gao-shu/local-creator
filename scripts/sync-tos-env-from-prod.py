"""从生产 backend.env 同步 TOS 配置到 .env.production（本地脚本，不提交）。"""
from __future__ import annotations

import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env.production"
KEY_PATH = pathlib.Path.home() / ".ssh" / "haode_gitee_ci"
REMOTE_ENV = "/www/wwwroot/haode-ai-admin/deploy/docker/backend.env"
KEYS = (
    "TOS_BUCKET",
    "TOS_REGION",
    "TOS_ENDPOINT",
    "TOS_ACCESS_KEY",
    "TOS_SECRET_KEY",
    "TOS_PUBLIC_BASE_URL",
)


def main() -> None:
    out = subprocess.check_output(
        [
            "ssh",
            "-i",
            str(KEY_PATH),
            "-o",
            "StrictHostKeyChecking=no",
            "root@115.191.9.56",
            f"grep -E '^({'|'.join(KEYS)})=' {REMOTE_ENV}",
        ],
        text=True,
    )
    vals: dict[str, str] = {}
    for line in out.strip().splitlines():
        key, _, value = line.partition("=")
        vals[key.strip()] = value.strip()

    text = ENV_PATH.read_text(encoding="utf-8") if ENV_PATH.is_file() else ""
    lines = [
        line
        for line in text.splitlines()
        if not re.match(r"^(RELEASE_STORAGE|TOS_|VITE_UPDATE_PUBLISH_URL|VITE_TOS_PUBLIC_ORIGIN)=", line.strip())
    ]
    public_base = vals.get("TOS_PUBLIC_BASE_URL", "https://haode-ai.tos-cn-beijing.volces.com")
    block = [
        "",
        "# ---------- 安装包分发：火山 TOS（不走 5M 服务器带宽）----------",
        "RELEASE_STORAGE=tos",
        f"TOS_BUCKET={vals.get('TOS_BUCKET', 'haode-ai')}",
        f"TOS_ENDPOINT={vals.get('TOS_ENDPOINT', 'tos-cn-beijing.volces.com')}",
        f"TOS_REGION={vals.get('TOS_REGION', 'cn-beijing')}",
        f"TOS_ACCESS_KEY={vals.get('TOS_ACCESS_KEY', '')}",
        f"TOS_SECRET_KEY={vals.get('TOS_SECRET_KEY', '')}",
        f"TOS_PUBLIC_BASE_URL={public_base}",
        "TOS_RELEASE_PREFIX=releases/client/download",
        f"VITE_TOS_PUBLIC_ORIGIN={public_base}",
        f"VITE_UPDATE_PUBLISH_URL={public_base.rstrip('/')}/releases/client/download",
    ]
    ENV_PATH.write_text("\n".join(lines).rstrip() + "\n" + "\n".join(block) + "\n", encoding="utf-8")
    print(f"[sync-tos-env] 已更新 {ENV_PATH}")


if __name__ == "__main__":
    main()
