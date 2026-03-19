import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";

// ============================================
// Auth.js Tables (required for D1 adapter)
// ============================================

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp" }),
  image: text("image"),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  sessionToken: text("sessionToken").unique().notNull(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verificationTokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    compositePk: primaryKey({ columns: [table.identifier, table.token] }),
  })
);

// ============================================
// Application Tables
// ============================================

export const secrets = sqliteTable("secrets", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  account: text("account"),
  secret: text("secret").notNull(),
  type: text("type").notNull().default("totp"),
  digits: integer("digits").notNull().default(6),
  period: integer("period").notNull().default(30),
  algorithm: text("algorithm").notNull().default("SHA-1"),
  counter: integer("counter").notNull().default(0),
  color: text("color"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const backups = sqliteTable("backups", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  data: text("data").notNull(),
  secretCount: integer("secret_count").notNull(),
  encrypted: integer("encrypted").notNull().default(0),
  reason: text("reason").notNull(),
  hash: text("hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  encryptionKeyHash: text("encryption_key_hash"),
  theme: text("theme").notNull().default("system"),
  language: text("language").notNull().default("en"),
});

// ============================================
// Type exports
// ============================================

export type User = typeof users.$inferSelect;
export type Secret = typeof secrets.$inferSelect;
export type NewSecret = typeof secrets.$inferInsert;
export type BackupRow = typeof backups.$inferSelect;
export type NewBackup = typeof backups.$inferInsert;
export type UserSettingsRow = typeof userSettings.$inferSelect;
