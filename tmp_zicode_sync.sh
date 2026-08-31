#!/bin/bash
set -e
SRC_MD="/mnt/c/Users/ax2/WorkBuddy/work/harpscore/tmp_zicode_harpscore.md"
SRC_IMG="/mnt/c/Users/ax2/Documents/技术博客/20260830-harpscore/images"
SITE="/home/alex/work/www.zicode.com/astro-site"

mkdir -p "$SITE/public/images/harpscore"
rm -f "$SITE/public/images/harpscore"/*.png
mkdir -p "$SITE/public/heroes"

cp "$SRC_IMG"/*.png "$SITE/public/images/harpscore/"
cp "$SRC_MD" "$SITE/src/content/blog/harpscore.md"

echo "copied images: $(ls "$SITE/public/images/harpscore" | wc -l)"
ls "$SITE/public/heroes" | grep harpscore || echo "hero missing"
ls -la "$SITE/src/content/blog/harpscore.md"
