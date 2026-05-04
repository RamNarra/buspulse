const fs = require('fs');
let code = fs.readFileSync('components/auth/auth-provider.tsx', 'utf8');

// Replace the kickSelf implementation
const newKickSelf = `
  const kickSelf = useCallback(
    async (auth: ReturnType<typeof getAuth>) => {
      console.warn("[AuthProvider] Session invalidated by another device. Signing out.");
      try {
        await signOut(auth);
      } catch (e) {
        console.error("Sign out failed", e);
      }
      setTimeout(() => {
        window.location.href = "/login";
      }, 100);
    },
    [],
  );
`;

code = code.replace(
  /const kickSelf\s*=\s*useCallback\([\s\S]*?\[\],\s*\);/,
  newKickSelf.trim()
);

fs.writeFileSync('components/auth/auth-provider.tsx', code);
