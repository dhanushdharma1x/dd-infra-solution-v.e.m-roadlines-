Patch contents for MachineMitra changes

This folder contains the updated files you can copy into your repository to apply the MachineMitra changes made by the assistant.

Files included:
- src/components/Login.tsx
- src/components/Profile.tsx
- src/types.ts

How to apply locally:
1. From your project root (where package.json lives) make a backup branch:

   git checkout -b apply/machine-mitra-patch

2. Copy files from this folder into your project (overwrite existing files):

   On Windows (PowerShell):
   Copy-Item -Path .\machine_mitra_patch\src\components\Login.tsx -Destination .\src\components\Login.tsx -Force
   Copy-Item -Path .\machine_mitra_patch\src\components\Profile.tsx -Destination .\src\components\Profile.tsx -Force
   Copy-Item -Path .\machine_mitra_patch\src\types.ts -Destination .\src\types.ts -Force

   On macOS / Linux:
   cp machine_mitra_patch/src/components/Login.tsx src/components/Login.tsx
   cp machine_mitra_patch/src/components/Profile.tsx src/components/Profile.tsx
   cp machine_mitra_patch/src/types.ts src/types.ts

3. Install missing dev types and restart dev server:

   npm install --save-dev @types/react @types/react-dom
   npm run dev

4. Verify in browser at http://localhost:3000 — use Phone OTP (dev) to sign in and test Add Machine and Profile edit.

If you want, I can now create a compressed ZIP of this folder for download; tell me if you prefer a ZIP.
