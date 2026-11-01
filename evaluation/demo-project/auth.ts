// Synthetic public demo fixture; never use real project credentials in a demo.
export const sessionTTL = 300;
export function refreshSession() {
  return { expiresIn: sessionTTL };
}
