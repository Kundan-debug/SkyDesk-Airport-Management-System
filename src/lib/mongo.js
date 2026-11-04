import { MongoClient } from 'mongodb';

const g = globalThis;

export async function mongoDb() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  g.__skydeskMongo ??= new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 }).connect();
  const client = await g.__skydeskMongo;
  return client.db(process.env.MONGODB_DB || 'skydesk');
}

// Event logging must never break the main (SQL) transaction that already succeeded.
export async function logEvents(collection, docs) {
  try {
    const db = await mongoDb();
    const list = (Array.isArray(docs) ? docs : [docs]).map((d) => ({ ts: new Date(), ...d }));
    if (list.length) await db.collection(collection).insertMany(list);
  } catch (e) {
    console.error(`[mongo] could not write to ${collection}:`, e.message);
  }
}
