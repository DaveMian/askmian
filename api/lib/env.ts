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
  adminPassword: process.env.ADMIN_PASSWORD || "admin123", // Set strong password in production
  backendUrl: process.env.BACKEND_URL || "https://askmian-production-792b.up.railway.app",
  // RAKBANK Details
  bankName: process.env.BANK_NAME || "RAKBANK",
  bankAccountName: process.env.BANK_ACCOUNT_NAME || "ASK MIAN LLC",
  bankAccountNumber: process.env.BANK_ACCOUNT_NUMBER || "0303698014001",
  bankIban: process.env.BANK_IBAN || "AE77 0400 0003 0369 8014 001",
  bankSwift: process.env.BANK_SWIFT || "NRAKAEAK",
};
