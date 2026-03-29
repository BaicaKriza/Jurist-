#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  Jurist Pro – Paketim për USB / Desktop Download
#
#  Krijon një ZIP portabël të app-it pa node_modules/.venv.
#  Personi tjetër shpaketëzon dhe klikon Jurist-Start.sh/.bat
#
#  Përdorim:
#    bash scripts/package-usb.sh
#    bash scripts/package-usb.sh --output /path/to/output.zip
#    bash scripts/package-usb.sh --version 1.2.0
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

# ── Parametra ────────────────────────────────────────────────
VERSION="${VERSION:-$(date +%Y%m%d)}"
OUTPUT_ZIP=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output) OUTPUT_ZIP="$2"; shift 2 ;;
    --version) VERSION="$2"; shift 2 ;;
    *) shift ;;
  esac
done

PKG_NAME="Jurist-Pro-v${VERSION}"
if [ -z "$OUTPUT_ZIP" ]; then
  OUTPUT_ZIP="${SCRIPT_DIR}/${PKG_NAME}.zip"
fi

# ── Ngjyra ────────────────────────────────────────────────────
G='\033[1;32m'; Y='\033[1;33m'; C='\033[1;36m'; NC='\033[0m'
ok()   { echo -e "${G}  ✔  $1${NC}"; }
info() { echo -e "${C}  ›  $1${NC}"; }

echo ""
info "Duke paketuar Jurist Pro v${VERSION}..."
info "Output: ${OUTPUT_ZIP}"
echo ""

# ── Pastro output të vjetër ───────────────────────────────────
rm -f "$OUTPUT_ZIP"

# ── Krijo ZIP duke përjashtuar gjërat e mëdha/të panevojshme ──
zip -r "$OUTPUT_ZIP" . \
  --exclude "*.git*" \
  --exclude "*/.git/*" \
  --exclude "*/node_modules/*" \
  --exclude "*/frontend/node_modules/*" \
  --exclude "*/backend/.venv/*" \
  --exclude "*/__pycache__/*" \
  --exclude "*/*.pyc" \
  --exclude "*/backend/uploads/*" \
  --exclude "*/.env" \
  --exclude "*backend/.env" \
  --exclude "*.Jurist-Pro-*.zip" \
  --exclude "*/.dev_pids" \
  --exclude "*/.jurist_pids" \
  --exclude "*/dist/*" \
  --exclude "*/.DS_Store" \
  2>/dev/null

# ── Madhësia ─────────────────────────────────────────────────
SIZE=$(du -sh "$OUTPUT_ZIP" | cut -f1)
ok "Paketa u krijua: ${OUTPUT_ZIP} (${SIZE})"

echo ""
echo -e "${G}═══════════════════════════════════════════════════${NC}"
echo -e "${G}  Jurist Pro ${VERSION} – Paketa gati!${NC}"
echo -e "${G}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${C}Skedari:${NC}  ${OUTPUT_ZIP}"
echo -e "  ${C}Madhësia:${NC}  ${SIZE}"
echo ""
echo -e "  ${Y}Si e përdor personi tjetër:${NC}"
echo "  1. Shpaketëzo ZIP-in kudo (Desktop, USB, etj.)"
echo "  2. Linux/Mac: bash Jurist-Start.sh"
echo "     Windows  : klikim i dyfishtë mbi Jurist-Start.bat"
echo "  3. Hap shfletuesin: http://localhost:5173"
echo "  4. Login: admin@jurist.al / Admin123!"
echo ""
echo -e "  ${Y}Pre-requisitet (duhen instaluar njëherë):${NC}"
echo "  • Node.js 18+   → https://nodejs.org"
echo "  • Python 3.10+  → https://python.org"
echo "  • Docker        → https://docs.docker.com/get-docker/"
echo ""
