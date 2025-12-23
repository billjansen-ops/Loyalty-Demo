#!/bin/bash
#
# Package HTML/JS files for Claude analysis
# Usage: ./package_for_analysis.sh
#

set -e

PROJECT_DIR="$HOME/Projects/Loyalty-Demo"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$PROJECT_DIR/uploads/files_for_analysis_${TIMESTAMP}.txt"

echo "Packaging files for analysis..."
echo ""

# Create header
cat > "$OUTPUT_FILE" << 'EOF'
================================================================================
LOYALTY PLATFORM FILES FOR ANALYSIS
================================================================================

This file contains all HTML and JS files from the project for Claude to analyze.

EOF

echo "Generated: $(date)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "================================================================================)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

cd "$PROJECT_DIR"

# Process HTML files
for file in *.html; do
    if [ -f "$file" ]; then
        echo "Including: $file"
        echo "" >> "$OUTPUT_FILE"
        echo "################################################################################" >> "$OUTPUT_FILE"
        echo "# FILE: $file" >> "$OUTPUT_FILE"
        echo "################################################################################" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        cat "$file" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
    fi
done

# Process JS files
for file in *.js; do
    if [ -f "$file" ]; then
        echo "Including: $file"
        echo "" >> "$OUTPUT_FILE"
        echo "################################################################################" >> "$OUTPUT_FILE"
        echo "# FILE: $file" >> "$OUTPUT_FILE"
        echo "################################################################################" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        cat "$file" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
    fi
done

# Get file size
FILE_SIZE=$(ls -lh "$OUTPUT_FILE" | awk '{print $5}')

echo ""
echo "✅ Package created successfully!"
echo ""
echo "File: $OUTPUT_FILE"
echo "Size: $FILE_SIZE"
echo ""
echo "📤 Upload this file to Claude and ask:"
echo '   "Analyze these files and tell me if there is a tenant configuration page"'
echo ""
