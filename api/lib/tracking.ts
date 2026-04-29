// Generate a random tracking code like "AM-X7K9P2M3"
// 2 letters + hyphen + 6 alphanumeric characters
export function generateTrackingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Omit 0, O, I, 1 to avoid confusion
  let code = 'AM-'
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
