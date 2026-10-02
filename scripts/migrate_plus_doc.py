#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把 plus-doc/5.X 中 RuoYi-Cloud-Plus 的后端文档、plus-ui 前端文档、questions 常见问题，
迁移到 exam-doc 的 VitePress 站点，并按「砚考」在线考试系统做链接改写与术语适配。

用法：
  python3 scripts/migrate_plus_doc.py
"""
import os
import re
import shutil
import sys

SRC = "/Users/alan/Documents/Code/MyGithub/plus-doc/5.X"
DST = "/Users/alan/Documents/Code/MyGithub/exam-doc"

# ---- 目录映射：源 -> 目标 ----
# 注意：plus-doc 的 URL 全部是 /xxx/yyy.md 形式，存在明确的 1:1 前缀映射
PREFIX_MAP = [
    ("/ruoyi-cloud-plus/", "/backend/"),
    ("/plus-ui/", "/frontend/"),
    ("/ruoyi-vue-plus/", "/backend/"),   # vue-plus 与 cloud-plus 文档结构基本一致，统一落到后端文档
    ("/questions/", "/questions/"),
    ("/common/video", "/demo/video"),
    ("/common/demo_system", "/demo/"),
]

# 个别路径在 cloud-plus 中位置不同，单独修正
SPECIAL_MAP = {
    "/backend/framework/extend/maxkey": "/backend/extend-function/maxkey",
}


def rewrite_links(text: str) -> str:
    """把 docsify 的 .md 绝对链接改写成 VitePress 的无后缀路径。"""

    def repl(m):
        label, target = m.group(1), m.group(2)
        if target.startswith(("http://", "https://", "mailto:", "#")):
            return m.group(0)
        if not target.startswith("/"):
            # 相对链接：只去掉 .md
            target = re.sub(r"\.md(#.*)?$", r"\1", target)
            return f"[{label}]({target})"
        raw = target
        target = re.sub(r"\.md(#.*)?$", r"\1", target)
        for old, new in PREFIX_MAP:
            if target.startswith(old):
                target = new + target[len(old):]
                break
        target = SPECIAL_MAP.get(target, target)
        # 首页归一：/backend/home -> /backend/
        for base in ("/backend", "/frontend"):
            if target == base + "/home":
                target = base + "/"
        # 锚点保留
        if raw.endswith(".md") and target.endswith("/") is False:
            pass
        return f"[{label}]({target})"

    # 只匹配普通 markdown 链接，不动图片语法里的空格标题
    text = re.sub(r"\[([^\]]*)\]\(([^)\s]+)\)", repl, text)
    return text


def convert_callouts(text: str) -> str:
    """docsify 的 !> 提示块 -> VitePress 容器"""
    lines = text.split("\n")
    out = []
    buf = []

    def flush(open_tag=None):
        if buf:
            out.append(open_tag or "::: tip")
            out.extend(buf)
            out.append(":::")
            buf.clear()

    for ln in lines:
        if ln.startswith("!>"):
            flush()
            buf.append(ln[2:].strip())
        elif ln.startswith("?>"):
            flush("::: warning")
        else:
            if buf and ln.strip() == "":
                flush()
                out.append(ln)
            elif buf:
                buf.append(ln)
            else:
                out.append(ln)
    flush()
    return "\n".join(out)


def normalize(text: str) -> str:
    # 去 BOM / 统一换行
    text = text.replace("\ufeff", "")
    text = text.replace("\r\n", "\n")
    # docsify 的 - - - 分隔线 -> markdown 分隔线
    text = re.sub(r"^\s*-\s+-\s+-\s*$", "---", text, flags=re.M)
    text = convert_callouts(text)
    text = rewrite_links(text)
    # 术语适配：前端项目名 plus-ui -> exam-front
    text = text.replace("plus-ui", "exam-front")
    text = re.sub(r"\n{4,}", "\n\n\n", text)
    return text.strip() + "\n"


def title_of(text: str, fallback: str) -> str:
    m = re.search(r"^#\s+(.+)$", text, flags=re.M)
    if m:
        return m.group(1).strip().replace("`", "")
    return fallback


def copy_tree(src_root: str, dst_root: str, skip: set = None):
    """批量迁移，返回 [(目标相对路径, 源文件绝对路径)]"""
    results = []
    for dirpath, _dirnames, filenames in os.walk(src_root):
        rel_dir = os.path.relpath(dirpath, src_root)
        rel_dir = "" if rel_dir == "." else rel_dir
        for fn in filenames:
            if skip and fn in skip:
                continue
            if not fn.endswith(".md"):
                continue
            src = os.path.join(dirpath, fn)
            # _sidebar.md 不迁移（改由 VitePress 配置维护）
            if fn.startswith("_"):
                continue
            # 首页 home.md -> index.md；其余保持文件名
            out_name = "index.md" if fn == "home.md" else fn
            dst_rel = os.path.join(dst_root, rel_dir, out_name) if rel_dir else os.path.join(dst_root, out_name)
            results.append((dst_rel, src))
    return results


def main():
    jobs = []
    jobs += copy_tree(os.path.join(SRC, "ruoyi-cloud-plus"), "backend")
    jobs += copy_tree(os.path.join(SRC, "plus-ui"), "frontend")
    jobs += copy_tree(os.path.join(SRC, "questions"), "questions")

    count = 0
    for dst_rel, src in jobs:
        dst = os.path.join(DST, dst_rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with open(src, "r", encoding="utf-8") as f:
            text = f.read()
        shutil.copyfile(src, dst)  # 先落地原文件（Read 工具合规）
        with open(dst, "w", encoding="utf-8") as f:
            f.write(normalize(text))
        count += 1

    print(f"迁移完成：{count} 篇")

    # 校验：扫描残留的 .md 内部链接
    remain = []
    for root, _d, files in os.walk(DST):
        if "node_modules" in root or "/.git" in root or "/.vitepress/dist" in root:
            continue
        for fn in files:
            if not fn.endswith(".md"):
                continue
            p = os.path.join(root, fn)
            if p.endswith(".workbuddy/memory/" + fn):
                continue
            try:
                with open(p, "r", encoding="utf-8") as f:
                    t = f.read()
            except Exception:
                continue
            for m in re.finditer(r"\]\((/[^)\s]*\.md[^)\s]*)\)", t):
                remain.append((os.path.relpath(p, DST), m.group(1)))
    if remain:
        print(f"发现 {len(remain)} 处未改写的 .md 链接：")
        for a, b in remain[:40]:
            print("  ", a, "->", b)
    else:
        print("内部链接全部改写完成")


if __name__ == "__main__":
    main()
