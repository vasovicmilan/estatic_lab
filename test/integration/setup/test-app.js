import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { clear } from "node:console";

let mongoServer;

export async function createTestApp() {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGO_URI = mongoServer.getUri();

  const { default: app } = await import("../../../src/app.js");

  await mongoose.connect(mongoServer.getUri());
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));

  return app;
}

export async function closeTestApp() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongoServer) await mongoServer.stop();
  process.exit(0);
}

export async function clearTestDatabase() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

export default { createTestApp, closeTestApp, clearTestDatabase };