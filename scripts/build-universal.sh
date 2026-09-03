#!/usr/bin/env bash
#
# Swift 실행 파일을 arm64 + x86_64 유니버설 바이너리로 빌드해 npm 패키지에 동봉한다.
#
#   scripts/build-universal.sh <swift-package-dir> <binary-name> <output-dir>
#   scripts/build-universal.sh swift/pdf pdf-cli packages/pdf-cli/bin
#
# 소비자 쪽에 Swift 툴체인을 요구하지 않기 위해, 배포 tarball에는 소스가 아니라
# 이 스크립트가 만든 바이너리가 들어간다.
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "build-universal.sh: macOS에서만 실행할 수 있습니다 (현재: $(uname -s))" >&2
  exit 1
fi

if [[ $# -ne 3 ]]; then
  echo "usage: $0 <swift-package-dir> <binary-name> <output-dir>" >&2
  exit 1
fi

package_dir="$1"
binary_name="$2"
output_dir="$3"

slices=()
for arch in arm64 x86_64; do
  echo "==> building ${binary_name} (${arch})"
  swift build -c release --package-path "$package_dir" --arch "$arch"

  slice="${package_dir}/.build/${arch}-apple-macosx/release/${binary_name}"
  if [[ ! -f "$slice" ]]; then
    echo "build-universal.sh: 빌드 산출물을 찾지 못했습니다: ${slice}" >&2
    exit 1
  fi
  slices+=("$slice")
done

mkdir -p "$output_dir"
output="${output_dir}/${binary_name}"

echo "==> lipo -> ${output}"
lipo -create -output "$output" "${slices[@]}"

# lipo로 합치면 각 슬라이스의 서명이 무효화된다. Apple Silicon은 서명 없는 바이너리를
# 실행하지 않으므로 ad-hoc 서명을 다시 붙인다. npm이 푼 파일에는 quarantine 속성이
# 붙지 않으므로 이 정도면 Gatekeeper를 통과한다.
echo "==> codesign (ad-hoc)"
codesign --force --sign - --timestamp=none "$output"

chmod +x "$output"

echo "==> verify"
lipo -archs "$output"
codesign --verify --verbose=1 "$output"
"$output" --help >/dev/null 2>&1 || true

echo "==> done: ${output} ($(du -h "$output" | cut -f1))"
