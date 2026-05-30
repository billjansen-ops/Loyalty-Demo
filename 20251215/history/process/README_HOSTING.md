# Loyalty Demo Site — v0.9

Changes:
1) Removed visible demo creds from Login (still bill/billy under the hood).
2) Added Menu page with four tiles: CSR (active), Client Admin, Admin, Member (coming soon).
3) CSR page now starts with **Search-only**. After Search:
   - 1 match → CSR Control screen (header + action buttons)
   - many → results table
   - none → "No member found" message

How to deploy:
- Upload `index.html`, `menu.html`, `csr.html` to your GitHub repo root and let Pages redeploy.
