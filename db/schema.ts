import {
  mysqlTable,
  serial,
  varchar,
  text,
  timestamp,
  int,
} from "drizzle-orm/mysql-core";

// Visa applications submitted through the website
export const applications = mysqlTable("applications", {
  id: serial("id").primaryKey(),
  trackingCode: varchar("tracking_code", { length: 20 }).unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  nationality: varchar("nationality", { length: 255 }).notNull(),
  currentLocation: varchar("current_location", { length: 255 }),
  phone: varchar("phone", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }),
  visaType: varchar("visa_type", { length: 255 }).notNull(),
  travelDate: varchar("travel_date", { length: 100 }),
  notes: text("notes"),
  paymentMethod: varchar("payment_method", { length: 100 }),
  paymentStatus: varchar("payment_status", { length: 50 }).notNull().default("pending"),
  paymentProofUrl: varchar("payment_proof_url", { length: 500 }),
  stripePaymentIntentId: varchar("stripe_pi_id", { length: 255 }),
  stripeClientSecret: varchar("stripe_client_secret", { length: 255 }),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  passportUrl: varchar("passport_url", { length: 500 }),
  photoUrl: varchar("photo_url", { length: 500 }),
  bankStatementUrl: varchar("bank_statement_url", { length: 500 }),
  amountPaid: int("amount_paid"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Admin users (simple password-based auth for dashboard)
export const adminUsers = mysqlTable("admin_users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
