#!/bin/sh
# Packages extension/ into dist/datawriter-<version>.zip, the file uploaded to the Chrome Web Store
# or handed out for "Load unpacked". Run from anywhere: sh tools/build-zip.sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
version=$(node -p "require('$root/extension/manifest.json').version")
out="$root/dist/datawriter-$version.zip"
mkdir -p "$root/dist"
rm -f "$out"
# -X drops OS metadata; the zip root is the extension folder itself, as the store expects.
(cd "$root/extension" && zip -q -r -X "$out" . -x '.DS_Store' '*/.DS_Store' 'Thumbs.db')
ls -l "$out"
