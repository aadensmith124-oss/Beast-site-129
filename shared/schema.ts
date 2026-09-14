import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// === USERS ===
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").default("").notNull(),
  loginCode: text("login_code").default("").notNull(),
  email: text("email").notNull().unique(),
  telegramUsername: text("telegram_username").default("").notNull(),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  isBanned: boolean("is_banned").default(false).notNull(),
  isWorker: boolean("is_worker").default(false).notNull(),
  balance: integer("balance").default(0).notNull(),
  protectedBalance: integer("protected_balance").default(0).notNull(),
  lastDailySpin: timestamp("last_daily_spin"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  role: true, 
  isBanned: true, 
  createdAt: true,
  telegramUsername: true,
  balance: true,
  protectedBalance: true,
  lastDailySpin: true,
  password: true,
  loginCode: true,
}).extend({
  email: z.string().email("Valid email required"),
});

// === UPLOADED IMAGES ===
export const uploadedImages = pgTable("uploaded_images", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  data: text("data").notNull(), // base64 encoded
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// === PRODUCTS ===
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").default("").notNull(),
  image: text("image").default(""),
  active: boolean("active").default(true).notNull(),
  pinned: boolean("pinned").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true }).extend({
  description: z.string().optional().default(""),
  image: z.string().optional().default(""),
});

// === VARIANTS (OPTIONS) ===
export const variants = pgTable("variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id),
  name: text("name").notNull(),
  price: integer("price").notNull(), // in cents
  comparePrice: integer("compare_price"), // original/crossed-out price in cents (optional)
  minQuantity: integer("min_quantity").default(1).notNull(),
});

export const insertVariantSchema = createInsertSchema(variants).omit({ id: true });

// === STOCK ITEMS ===
// 1 Item = 3 lines. We store the full content.
export const stockItems = pgTable("stock_items", {
  id: serial("id").primaryKey(),
  variantId: integer("variant_id").notNull().references(() => variants.id),
  sellerId: integer("seller_id").references(() => users.id), // NULL = admin/NYCHQ (top tier)
  content: text("content").notNull(),
  isSold: boolean("is_sold").default(false).notNull(),
  isReserved: boolean("is_reserved").default(false).notNull(),
  orderId: integer("order_id"), // Filled when reserved or sold
  replacementForId: integer("replacement_for_id"), // If this is a replacement
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStockItemSchema = createInsertSchema(stockItems).omit({ 
  id: true, 
  isSold: true, 
  orderId: true, 
  replacementForId: true, 
  createdAt: true 
});

// === ORDERS ===
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderId: text("order_id").notNull().unique(),
  userId: integer("user_id").notNull().references(() => users.id),
  status: text("status", { enum: ["pending", "waiting_payment", "delivering", "fulfilled", "refunded", "replaced"] }).default("pending").notNull(),
  total: integer("total").notNull(),
  paidAmount: integer("paid_amount").default(0).notNull(),
  deliveryContent: text("delivery_content").default("").notNull(),
  paymentMethod: text("payment_method").default("").notNull(),
  paymentNote: text("payment_note").default("").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// === ORDER ITEMS ===
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  variantId: integer("variant_id"),
  stockItemId: integer("stock_item_id").references(() => stockItems.id),
  cardId: integer("card_id").references(() => cards.id),
  itemType: text("item_type").default("product").notNull(),
  price: integer("price").notNull(),
  quantity: integer("quantity").default(1).notNull(),
});

// === TRANSACTIONS ===
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: integer("amount").notNull(), // + for deposit/win, - for purchase/loss
  type: text("type").notNull(), // deposit, purchase, refund, win, loss, daily_spin, manual_deposit
  description: text("description").notNull(),
  paymentMethod: text("payment_method"), // e.g., "Cash", "Card", "Crypto"
  vouchId: integer("vouch_id"),
  orderId: integer("order_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// === TELEGRAM VOUCH REWARDS ===
export const vouchTokens = pgTable("vouch_tokens", {
  id: serial("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  userId: integer("user_id").notNull().references(() => users.id),
  telegramChatId: text("telegram_chat_id"),
  telegramUserId: text("telegram_user_id"),
  telegramUsername: text("telegram_username"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("vouch_tokens_order_idx").on(table.orderId),
  index("vouch_tokens_chat_idx").on(table.telegramChatId),
]);

export const vouches = pgTable("vouches", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  userId: integer("user_id").notNull().references(() => users.id),
  telegramChatId: text("telegram_chat_id").notNull(),
  telegramUserId: text("telegram_user_id").notNull(),
  telegramUsername: text("telegram_username"),
  telegramFileId: text("telegram_file_id").notNull(),
  imageHash: text("image_hash").notNull().unique(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).default("pending").notNull(),
  rewardAmount: integer("reward_amount").default(50).notNull(),
  creditTransactionId: integer("credit_transaction_id").references(() => transactions.id),
  adminChatId: text("admin_chat_id"),
  adminMessageId: integer("admin_message_id"),
  reviewedBy: text("reviewed_by"),
  rejectionReason: text("rejection_reason"),
  balanceBefore: integer("balance_before"),
  balanceAfter: integer("balance_after"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
}, (table) => [
  index("vouches_order_idx").on(table.orderId),
  index("vouches_chat_idx").on(table.telegramChatId),
  uniqueIndex("vouches_credit_transaction_idx").on(table.creditTransactionId),
]);

// === REDEEM CODES ===
export const redeemCodes = pgTable("redeem_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  amount: integer("amount").notNull(),
  isUsed: boolean("is_used").default(false).notNull(),
  usedBy: integer("used_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRedeemCodeSchema = createInsertSchema(redeemCodes).omit({ 
  id: true, 
  isUsed: true, 
  usedBy: true, 
  createdAt: true 
});

// === DISCOUNT CODES ===
export const discountCodes = pgTable("discount_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  type: text("type").notNull(), // 'percent' | 'fixed'
  value: integer("value").notNull(), // percent: 1-100, fixed: cents
  minOrder: integer("min_order").default(0), // minimum cart total in cents
  maxUses: integer("max_uses"), // null = unlimited
  usedCount: integer("used_count").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// === ANNOUNCEMENTS ===
export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  link: text("link"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({ id: true, createdAt: true });

// === CARDS ===
// === CARD BASES ===
export const cardBases = pgTable("card_bases", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CardBase = typeof cardBases.$inferSelect;

export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  cardNumber: text("card_number").notNull(),
  maskedCard: text("masked_card").notNull(),
  expiry: text("expiry").notNull(),
  cvv: text("cvv").notNull(),
  country: text("country").notNull(),
  extras: text("extras").default(""),
  price: integer("price").notNull(),
  hrPercent: integer("hr_percent").default(80).notNull(),
  isFirstHand: boolean("is_first_hand").default(false).notNull(),
  isSold: boolean("is_sold").default(false).notNull(),
  userId: integer("user_id").references(() => users.id),
  binData: jsonb("bin_data").$type<{ bin: string; bank: string | null; scheme: string | null; type: string | null; brand: string | null; country: string | null; countryCode: string | null } | null>().default(null),
  baseId: integer("base_id").references(() => cardBases.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCardSchema = createInsertSchema(cards).omit({ 
  id: true, 
  isSold: true, 
  userId: true, 
  createdAt: true 
});

// === SUPPORT TICKETS ===
export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  orderId: text("order_id").notNull(),
  subject: text("subject").notNull(), // Refund, Replace, Question, etc.
  description: text("description").notNull(),
  imageUrl: text("image_url").notNull(),
  status: text("status", { enum: ["open", "refunded", "replaced", "resolved"] }).default("open").notNull(),
  adminMessage: text("admin_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({ 
  id: true, 
  status: true, 
  adminMessage: true,
  createdAt: true 
});

// === VERIFICATIONS ===
export const verifications = pgTable("verifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  telegramUsername: text("telegram_username").notNull(),
  channelLink: text("channel_link").notNull(),
  channelName: text("channel_name").notNull(),
  agreedToTerms: boolean("agreed_to_terms").default(false).notNull(),
  status: text("status", { enum: ["pending", "approved", "denied", "termed"] }).default("pending").notNull(),
  adminNote: text("admin_note").default(""),
  termMessage: text("term_message").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// === USER IPS ===
export const userIps = pgTable("user_ips", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  ip: text("ip").notNull(),
  loggedAt: timestamp("logged_at").defaultNow().notNull(),
});

export const insertVerificationSchema = createInsertSchema(verifications).omit({ id: true, status: true, adminNote: true, createdAt: true });
export type Verification = typeof verifications.$inferSelect;

// === RELATIONS ===
export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  user: one(users, {
    fields: [supportTickets.userId],
    references: [users.id],
  }),
}));

export const cardsRelations = relations(cards, ({ one }) => ({
  user: one(users, {
    fields: [cards.userId],
    references: [users.id],
  }),
}));

export const productsRelations = relations(products, ({ many }) => ({
  variants: many(variants),
}));

export const variantsRelations = relations(variants, ({ one, many }) => ({
  product: one(products, {
    fields: [variants.productId],
    references: [products.id],
  }),
  stockItems: many(stockItems),
}));

export const stockItemsRelations = relations(stockItems, ({ one }) => ({
  variant: one(variants, {
    fields: [stockItems.variantId],
    references: [variants.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  variant: one(variants, {
    fields: [orderItems.variantId],
    references: [variants.id],
  }),
  stockItem: one(stockItems, {
    fields: [orderItems.stockItemId],
    references: [stockItems.id],
  }),
  card: one(cards, {
    fields: [orderItems.cardId],
    references: [cards.id],
  }),
}));


// === MAILS ===
export const mails = pgTable("mails", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  senderId: integer("sender_id").notNull().references(() => users.id),
  recipientId: integer("recipient_id"), // null = all sellers
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mailReads = pgTable("mail_reads", {
  id: serial("id").primaryKey(),
  mailId: integer("mail_id").notNull().references(() => mails.id),
  userId: integer("user_id").notNull().references(() => users.id),
  readAt: timestamp("read_at").defaultNow().notNull(),
});

export type Mail = typeof mails.$inferSelect;

// === CRYPTO PAYMENTS ===
export const cryptoPayments = pgTable("crypto_payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  forebitPaymentId: text("forebit_payment_id").notNull().unique(),
  amount: integer("amount").notNull(),
  currency: text("currency").default("USD").notNull(),
  status: text("status", { enum: ["pending", "completed", "failed", "expired", "underpaid"] }).default("pending").notNull(),
  purpose: text("purpose", { enum: ["deposit", "order"] }).default("deposit").notNull(),
  orderId: integer("order_id").references(() => orders.id),
  checkoutUrl: text("checkout_url"),
  metadata: text("metadata"),
  settledAt: timestamp("settled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// === TYPES ===
export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Variant = typeof variants.$inferSelect;
export type StockItem = typeof stockItems.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type RedeemCode = typeof redeemCodes.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type UploadedImage = typeof uploadedImages.$inferSelect;
export type Card = typeof cards.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertVariant = z.infer<typeof insertVariantSchema>;
export type InsertStockItem = z.infer<typeof insertStockItemSchema>;
export type InsertRedeemCode = z.infer<typeof insertRedeemCodeSchema>;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type InsertCard = z.infer<typeof insertCardSchema>;
export type CryptoPayment = typeof cryptoPayments.$inferSelect;

// === SELLER APPLICATIONS ===
export const sellerApplications = pgTable("seller_applications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).default("pending").notNull(),
  sellerCode: text("seller_code").notNull().unique(),
  note: text("note").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSellerApplicationSchema = createInsertSchema(sellerApplications).omit({ id: true, status: true, createdAt: true });
export type SellerApplication = typeof sellerApplications.$inferSelect;

// === ACH ACCOUNTS ===
export const achs = pgTable("achs", {
  id: serial("id").primaryKey(),
  bankName: text("bank_name").notNull(),
  balance: text("balance").notNull(),
  fullItem: text("full_item").notNull(),
  price: integer("price").notNull(),
  isSold: boolean("is_sold").default(false).notNull(),
  sellerId: integer("seller_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAchSchema = createInsertSchema(achs).omit({ id: true, isSold: true, sellerId: true, createdAt: true });
export type Ach = typeof achs.$inferSelect;
export type InsertAch = z.infer<typeof insertAchSchema>;

// === CRYPTO ADDRESSES ===
export const cryptoAddresses = pgTable("crypto_addresses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  currency: text("currency").notNull(),
  address: text("address").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CryptoAddress = typeof cryptoAddresses.$inferSelect;

// === SITE SETTINGS ===
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
