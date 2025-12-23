#!/bin/bash
API_PORT=4001
WEB_PORT=4000
node server.js &
API_PID=$!
sleep 1
python3 -m http.server $WEB_PORT &
WEB_PID=$!
echo "Frontend: http://127.0.0.1:$WEB_PORT/csr.html"
echo "API:      http://127.0.0.1:$API_PORT/v1/member/search?q=1001"
trap "kill $API_PID $WEB_PID 2>/dev/null" SIGINT
wait
