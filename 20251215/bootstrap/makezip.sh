cd "$HOME/Projects/Loyalty-Demo" || exit 1
timestamp=$(date +"%Y%m%d-%H%M%S")
out="Loyalty-Demo-${timestamp}.zip"
summary="_snapshot_summary.txt"
schema_sql="docs/schema_snapshot.sql"
schema_txt="_schema_snapshot.txt"
upload_dir="$HOME/Projects/Loyalty-Demo/uploads"

mkdir -p "$upload_dir" "docs"

echo "Snapshot created at: $(date)" > "$summary"
echo "-------------------------------------------------" >> "$summary"
find . -type f ! -path "./node_modules/*" -exec stat -f "%Sm %z %N" {} \; >> "$summary" 2>/dev/null
echo "-------------------------------------------------" >> "$summary"
echo "Total files: $(grep -c '' "$summary")" >> "$summary"

pg_dump -U billjansen -d loyalty --schema-only > "$schema_sql" 2>/dev/null || echo "Warning: schema dump failed" >> "$summary"

: > "$schema_txt"
echo "DATABASE SCHEMA SNAPSHOT  (generated: $(date))" >> "$schema_txt"
echo "" >> "$schema_txt"
psql -U billjansen -d loyalty -c "\dt+" >> "$schema_txt" 2>/dev/null || echo "Warning: \dt+ failed" >> "$schema_txt"
echo "" >> "$schema_txt"
tables=$(psql -U billjansen -d loyalty -Atc "select schemaname||'.'||tablename from pg_tables where schemaname='public' order by 1;" 2>/dev/null)
for t in $tables; do
  echo "-------------------------------------------------" >> "$schema_txt"
  echo "\d+ $t" >> "$schema_txt"
  psql -U billjansen -d loyalty -c "\d+ $t" >> "$schema_txt" 2>/dev/null
done
echo "-------------------------------------------------" >> "$schema_txt"

zip -r "$out" . -x "*/node_modules/*" >/dev/null
zip -u "$out" "$summary" "$schema_txt" >/dev/null

cp "$summary" "$upload_dir/_snapshot_summary-${timestamp}.txt"
cp "$schema_txt" "$upload_dir/_schema_snapshot-${timestamp}.txt"

rm "$summary" "$schema_txt"

mv "$out" "$upload_dir"

echo "✅ Project snapshot complete:"
echo "   ZIP: $upload_dir/${out}"
echo "   TXT: $upload_dir/_schema_snapshot-${timestamp}.txt"
echo "   TXT: $upload_dir/_snapshot_summary-${timestamp}.txt"
