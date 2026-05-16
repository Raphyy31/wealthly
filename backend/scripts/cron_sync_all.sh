#!/usr/bin/env bash
# Script de cron Railway — sync GoCardless nightly de toutes les connexions
# autorisées. À schedulé via Railway "Scheduled Tasks" (par défaut 04:00 UTC).
#
# Variables requises :
#   BACKEND_URL    URL publique du backend (ex: https://wealthly-production-45aa.up.railway.app)
#   CRON_SECRET    Doit matcher la valeur côté backend Settings.CRON_SECRET
#
# Le script :
#   - POST /banking/cron/sync-all avec le header X-Cron-Secret
#   - Affiche le résumé (imported/updated/failures)
#   - Exit 1 si HTTP != 200 pour que Railway notifie l'échec
set -euo pipefail

: "${BACKEND_URL:?BACKEND_URL doit être défini}"
: "${CRON_SECRET:?CRON_SECRET doit être défini}"

DAYS_BACK="${DAYS_BACK:-7}"

echo "[cron-sync] $(date -u +%FT%TZ) — POST ${BACKEND_URL}/banking/cron/sync-all?days_back=${DAYS_BACK}"

response=$(curl -sS -w '\n%{http_code}' -X POST \
  "${BACKEND_URL}/banking/cron/sync-all?days_back=${DAYS_BACK}" \
  -H "X-Cron-Secret: ${CRON_SECRET}" \
  -H "Content-Type: application/json")

http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | sed '$d')

echo "[cron-sync] HTTP ${http_code}"
echo "$body"

if [[ "$http_code" != "200" ]]; then
  echo "[cron-sync] ÉCHEC — code ${http_code}" >&2
  exit 1
fi

echo "[cron-sync] OK"
