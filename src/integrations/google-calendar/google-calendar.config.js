const GOOGLE_CALENDAR_CONFIG = {
  clientEmail: process.env.GOOGLE_CALENDAR_CLIENT_EMAIL || null,

  // .env can't hold real newlines cleanly, so the private key is stored with
  // literal "\n" text sequences (as it appears inside the source JSON key file)
  // and un-escaped back into real newlines here, once, at read time - every
  // caller downstream gets a ready-to-use PEM string.
  getPrivateKey() {
    const raw = process.env.GOOGLE_CALENDAR_PRIVATE_KEY || null;
    return raw ? raw.replace(/\\n/g, "\n") : null;
  },

  isEnabled() {
    return !!this.clientEmail && !!this.getPrivateKey();
  },
};

export default GOOGLE_CALENDAR_CONFIG;