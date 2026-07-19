const TELEGRAM_CONFIG = {
  chatId: process.env.TELEGRAM_CHAT_ID || null,

  threads: {
    APPOINTMENTS: process.env.TELEGRAM_APPOINTMENTS_THREAD || null,
    CONTACTS: process.env.TELEGRAM_CONTACTS_THREAD || null,
    TESTIMONIALS: process.env.TELEGRAM_TESTIMONIALS_THREAD || null,
    USERS: process.env.TELEGRAM_USERS_THREAD || null,
    ORDERS: process.env.TELEGRAM_ORDERS_THREAD || null,
    PRODUCTS: process.env.TELEGRAM_PRODUCTS_THREAD || null,
    ERRORS: process.env.TELEGRAM_ERRORS_THREAD || null,
  },

  getThreadId(type) {
    const threadId = this.threads[type];
    return threadId ? Number(threadId) : null;
  },

  getChatId() {
    return this.chatId ? Number(this.chatId) : null;
  },

  isEnabled() {
    return !!this.chatId && !!process.env.TELEGRAM_BOT_TOKEN;
  },
};

export default TELEGRAM_CONFIG;