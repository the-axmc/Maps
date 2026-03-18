import { Db, MongoClient } from "mongodb";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const getClientPromise = () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable");
  }

  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri, {
      appName: "borderless-citizen-maps",
    }).connect();
  }

  return global._mongoClientPromise;
};

export async function getDb(): Promise<Db> {
  const dbName = process.env.MONGODB_DB_NAME ?? "borderlesscitizen";
  const clientPromise = getClientPromise();
  const client = await clientPromise;
  return client.db(dbName);
}
