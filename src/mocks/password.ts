const encoder = new TextEncoder();

export async function hashPassword(password: string, salt: string) {
  const input = encoder.encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function newPasswordSalt() {
  return crypto.randomUUID();
}
