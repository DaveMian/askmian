import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

export const env = {
  appId: required("APP_ID"),
  appSecret: required("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  adminPassword: process.env.ADMIN_PASSWORD || "admin123",
  resendApiKey: process.env.RESEND_API_KEY || "",
  fromEmail: process.env.FROM_EMAIL || "noreply@askmian.com",
  adminEmail: process.env.ADMIN_EMAIL || "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripePublicKey: process.env.VITE_STRIPE_PUBLIC_KEY || "",
};
