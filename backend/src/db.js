import { MongoClient, ObjectId } from "mongodb";

let client;
let database;

export async function connectDatabase() {
  if (database) return database;

  const mongoUrl = process.env.MONGO_URL;
  const dbName = process.env.DB_NAME || "barangay_db";

  if (!mongoUrl) {
    throw new Error("MONGO_URL is required");
  }

  client = new MongoClient(mongoUrl, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
  } catch (error) {
    if (error?.code === "ECONNREFUSED" && mongoUrl.startsWith("mongodb+srv://")) {
      throw new Error("MongoDB SRV DNS lookup failed. Use the non-SRV Atlas seed-list URI in MONGO_URL.");
    }
    throw error;
  }
  database = client.db(dbName);

  await database.collection("users").createIndex({ email: 1 }, { unique: true });
  await database.collection("users").createIndex({ deleted_at: 1 });
  await database.collection("users").createIndex({ email: 1, deleted_at: 1 });
  await database.collection("residents").createIndex({ full_name: 1 });
  await database.collection("residents").createIndex({ full_name: 1, birthdate: 1, deleted_at: 1 });
  await database.collection("document_requests").createIndex({ resident_id: 1, created_at: -1 });
  await database.collection("portal_requests").createIndex({ tracking_number: 1 }, { unique: true });
  await database.collection("barangay_ids").createIndex({ resident_id: 1, status: 1, deleted_at: 1 });
  await database.collection("password_reset_tokens").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
  await database.collection("login_attempts").createIndex({ identifier: 1 });
  await database.collection("audit_logs").createIndex({ created_at: -1 });
  await database.collection("system_settings").createIndex({ key: 1 }, { unique: true });
  for (const name of [
    "residents",
    "households",
    "document_requests",
    "businesses",
    "blotters",
    "health_records",
    "welfare_records",
    "medicine_inventory",
    "appointments",
    "payments",
    "barangay_ids"
  ]) {
    await database.collection(name).createIndex({ id: 1 });
    await database.collection(name).createIndex({ deleted_at: 1 });
  }

  return database;
}

export function getDb() {
  if (!database) throw new Error("Database has not been connected yet");
  return database;
}

export async function closeDatabase() {
  if (client) await client.close();
}

export function toObjectId(id) {
  return ObjectId.isValid(id) ? new ObjectId(id) : id;
}
