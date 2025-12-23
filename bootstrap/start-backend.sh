set -e
cd "$HOME/Projects/Loyalty-Demo"
PID4001=$(lsof -ti tcp:4001 2>/dev/null || true)
if [ -n "$PID4001" ]; then kill "$PID4001" || true; fi
chmod +x start.sh
nohup bash start.sh >/tmp/loyalty-api.log 2>&1 &
echo "Backend started using start.sh on port 4001"
