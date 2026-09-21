#!/bin/bash
# Empaqueta FORJA IA v4.68.0 — código fuente listo para subir.
set -e
cd /home/z/forja
OUT=/home/z/my-project/download/FORJA-IA-v4.68.1.zip
rm -f "$OUT"
zip -r -q "$OUT" . \
  -x "node_modules/*" \
  -x ".next/*" \
  -x ".git/*" \
  -x "workspace/*" \
  -x "download/*" \
  -x "*.log" \
  -x ".DS_Store"
echo "== ZIP creado =="
unzip -l "$OUT" | tail -2
unzip -l "$OUT" | grep -c "docs/MEJORAS-APLICADAS.md\|tests/unit/chat-client-stream-tools" || true
