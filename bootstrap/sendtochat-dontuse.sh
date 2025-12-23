#!/bin/zsh
# ~/Projects/Loyalty-Demo/bootstrap/makezip.sh
# Creates a complete repository ZIP of the entire project
# Excludes node_modules, .git, .DS_Store, and uploads (to avoid nesting old ZIPs)

set -e

proj="$HOME/Projects/Loyalty-Demo"
uploads="$proj/uploads"
mkdir -p "$uploads"
cd "$proj" || exit 1
pg_dump -U billjansen -d loyalty --schema-only > schema.sql

timestamp=$(date +%Y%m%d-%H%M%S)
zip_name="Loyalty-Demo-Repo-$timestamp.zip"
zip_path="$uploads/$zip_name"

echo "📦 Creating full repository snapshot..."
echo "Destination: $zip_path"
echo
echo "Including all project files except:"
echo "  - node_modules/"
echo "  - .git/"
echo "  - uploads/ (previous ZIPs)"
echo "  - .DS_Store"
echo

# Zip everything except the excluded paths, showing progress
zip -r "$zip_path" . \
  -x "node_modules/*" "*/node_modules/*" \
     ".git/*" "*/.git/*" \
     "uploads/*" "*/uploads/*" \
     ".DS_Store"

echo
echo "✅ Repository ZIP created successfully:"
echo "   $zip_path"
echo
echo "🧾 File count inside ZIP:"
unzip -Z1 "$zip_path" | wc -l | tr -d ' '
echo
echo "Done."