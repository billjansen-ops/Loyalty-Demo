set -e
PROJECT_DIR="${1:-$HOME/Projects/Loyalty-Demo}"
cd "$PROJECT_DIR"
PID4000=$(lsof -ti tcp:4000 2>/dev/null || true)
if [ -n "$PID4000" ]; then kill "$PID4000" || true; fi
nohup python3 -m http.server 4000 --bind 127.0.0.1 --directory "$PROJECT_DIR" >/tmp/loyalty-web.log 2>&1 &
sleep 1
if [ -d api ]; then
  if [ -f api/start.sh ]; then
    chmod +x api/start.sh
    nohup bash api/start.sh >/tmp/loyalty-api.log 2>&1 &
  else
    if command -v uvicorn >/dev/null 2>&1 && [ -f api/main.py ]; then
      nohup uvicorn api.main:app --host 127.0.0.1 --port 4001 >/tmp/loyalty-api.log 2>&1 &
    elif command -v node >/dev/null 2>&1 && [ -f api/server.js ]; then
      nohup node api/server.js >/tmp/loyalty-api.log 2>&1 &
    fi
  fi
fi
sleep 1
open "http://127.0.0.1:4000/login.html"
