import { getDb } from "@/lib/mongodb";
import type { SavedMapDocument, UserDocument } from "@/lib/models";

let indexBootstrapPromise: Promise<void> | null = null;

export const getUsersCollection = async () => {
  const db = await getDb();
  return db.collection<UserDocument>("users");
};

export const getSavedMapsCollection = async () => {
  const db = await getDb();
  return db.collection<SavedMapDocument>("saved_maps");
};

export const ensureCollections = async () => {
  if (indexBootstrapPromise) return indexBootstrapPromise;

  indexBootstrapPromise = (async () => {
    const users = await getUsersCollection();
    const savedMaps = await getSavedMapsCollection();

    await users.createIndex({ email: 1 }, { unique: true });
    await savedMaps.createIndex({ userId: 1, createdAt: -1 });
  })();

  return indexBootstrapPromise;
};
