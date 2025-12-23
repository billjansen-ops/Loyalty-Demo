set -e
p="$HOME/Projects/Loyalty-Demo"
out="$p/uploads"
mkdir -p "$out"
stamp=$(date +%Y%m%d-%H%M%S)
zipname="Loyalty-Demo-$stamp.zip"
cd "$p"

# Zip the working tree while excluding recursion and junk
zip -rq "$out/$zipname" . \
  -x "uploads/*" -x "$out/*" \
  -x "Loyalty-Demo-*.zip" \
  -x "Loyalty-Demo-20*/**" \
  -x "backups/*" -x ".backup/*" \
  -x "node_modules/*" -x ".git/*" \
  -x ".DS_Store"

# File list and manifest
find . -type f | sed 's|^\./||' | sort > "$out/Loyalty-Demo-$stamp.txt"
{ echo "created: $(date)"; echo "zip: $zipname"; echo "sha256: $(shasum -a 256 "$out/$zipname" | cut -d" " -f1)"; } > "$out/Loyalty-Demo-$stamp.manifest"

echo "$out/$zipname"
