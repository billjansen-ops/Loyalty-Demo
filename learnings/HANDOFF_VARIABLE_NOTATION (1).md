# HANDOFF NOTE - Variable Notation Convention

## IMPORTANT: {Variable} Notation

**When you see text like `{Miles}` or `{Points}` in user messages:**

- The curly braces `{}` indicate this is a **label/variable**, NOT hardcoded text
- This means the value should be dynamic or configurable
- Do NOT literally use "{Miles}" as display text
- Instead, use the appropriate variable or label system

**Examples:**

User says: "Show {Miles} in the header"
- ❌ Wrong: Display literal text "{Miles}"
- ✅ Right: Use `pointLabel` or dynamic label system

User says: "Total {Points} earned"
- ❌ Wrong: `"Total {Points} earned"`
- ✅ Right: `"Total " + pointLabel + " earned"` or template variable

**This convention appears in:**
- UI mockups
- Design specifications
- Feature descriptions

**Remember:** Curly braces = placeholder for dynamic content
