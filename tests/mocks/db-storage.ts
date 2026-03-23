/**
 * Mock D1 database storage for tests.
 *
 * In-memory SQL interpreter for the neo schema tables:
 * users, accounts, sessions, verificationTokens, secrets, backups, user_settings
 */

// In-memory storage
interface MockSecret {
  id: string;
  user_id: string;
  name: string;
  account: string | null;
  secret: string;
  type: string;
  digits: number;
  period: number;
  algorithm: string;
  counter: number;
  created_at: number;
  updated_at: number;
}

interface MockBackup {
  id: string;
  user_id: string;
  filename: string;
  data: string;
  secret_count: number;
  encrypted: number;
  reason: string;
  hash: string;
  created_at: number;
}

interface MockUserSettings {
  user_id: string;
  encryption_key_hash: string | null;
  encryption_key: string | null;
  backy_webhook_url: string | null;
  backy_api_key: string | null;
  backy_pull_key: string | null;
  theme: string;
  language: string;
}

interface MockUser {
  id: string;
  name: string | null;
  email: string;
  emailVerified: number | null;
  image: string | null;
}

let mockSecrets: MockSecret[] = [];
let mockBackups: MockBackup[] = [];
let mockUserSettings: MockUserSettings[] = [];
let mockUsers: MockUser[] = [];

export function getMockSecrets() {
  return mockSecrets;
}
export function getMockBackups() {
  return mockBackups;
}
export function getMockUserSettings() {
  return mockUserSettings;
}
export function getMockUsers() {
  return mockUsers;
}

export function clearMockStorage() {
  mockSecrets = [];
  mockBackups = [];
  mockUserSettings = [];
  mockUsers = [];
}
