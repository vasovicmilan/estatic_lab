import session from "express-session";
import MongoStore from "connect-mongo";

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET must be set and at least 32 characters long");
}

export function setupSession(app) {
  app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : 0);

  // MongoStore opens its OWN native MongoClient - entirely separate from the
  // app's mongoose connection - and keeps it open (driver heartbeats/keepalive)
  // for as long as the process lives. That's fine in production (the process
  // is meant to stay up), but in tests it's an open handle nothing else knows
  // about: closing mongoose's own connection and stopping the in-memory replset
  // does NOT touch this client, which is exactly what was keeping the test
  // process alive after switching away from a hard process.exit(0) (see
  // test-app.js's closeTestApp). Returning the store lets test teardown close
  // it explicitly instead.
  const store = MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: "sessions",
    ttl: 14 * 24 * 60 * 60, // 14 days
  });

  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 14 * 24 * 60 * 60 * 1000,
      },
    })
  );

  return store;
}