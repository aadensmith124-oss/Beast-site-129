import { db } from "./db.js";
import { 
  users, products, variants, stockItems, orders, orderItems, transactions, redeemCodes, announcements, uploadedImages, cards, cardBases, supportTickets, verifications, cryptoPayments, mails, mailReads, siteSettings, discountCodes, sellerApplications, achs, cryptoAddresses,
  type User, type InsertUser, type Product, type InsertProduct, type Variant, type InsertVariant,
  type StockItem, type Order, type OrderItem, type Transaction, type RedeemCode, type Announcement, type InsertAnnouncement, type UploadedImage,
  type Card, type InsertCard, type CardBase, type SellerApplication, type Ach, type InsertAch, type CryptoAddress
} from "../shared/schema.js";
import { eq, and, sql, desc, lt } from "drizzle-orm";
import { pool } from "./db.js";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(userId: number, amountCents: number): Promise<User>;
  updateProtectedBalance(userId: number, amountCents: number): Promise<User>;
  setProtectedBalance(userId: number, value: number): Promise<User>;
  updateLastDailySpin(userId: number): Promise<void>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: number, data: Partial<User>): Promise<User>;

  // Products & Variants
  getProducts(): Promise<(Product & { variants: (Variant & { stockCount: number })[] })[]>;
  getAllProducts(): Promise<(Product & { variants: (Variant & { stockCount: number })[] })[]>;
  getProduct(id: number): Promise<(Product & { variants: (Variant & { stockCount: number })[] }) | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, data: Partial<Product>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  createVariant(variant: InsertVariant): Promise<Variant>;
  updateVariant(id: number, data: Partial<Variant>): Promise<Variant>;
  deleteVariant(id: number): Promise<void>;
  
  // Stock
  addStockItems(variantId: number, content: string): Promise<{ added: number; skipped: number }>;
  addSingleStockItem(variantId: number, content: string): Promise<StockItem>;
  getStockItems(variantId: number): Promise<StockItem[]>;
  deleteStockItem(id: number): Promise<void>;
  reserveStockItem(variantId: number): Promise<StockItem | undefined>;
  holdStockItem(variantId: number, orderId: number): Promise<StockItem | undefined>;
  releaseHeldStock(orderId: number): Promise<void>;
  
  // Orders
  createOrder(userId: number, items: { variantId: number; quantity: number }[], cardIds?: number[]): Promise<Order>;
  getOrders(userId: number): Promise<(Order & { items: (OrderItem & { stockItem: StockItem | null, variant: Variant | null })[] })[]>;
  getOrder(id: number): Promise<(Order & { items: (OrderItem & { stockItem: StockItem | null, variant: Variant | null })[] }) | undefined>;
  getAllOrders(): Promise<any[]>;
  refundOrder(orderId: number): Promise<Order>;
  replaceOrder(orderId: number): Promise<Order>;
  
  // Wallet
  createTransaction(userId: number, amount: number, type: string, description: string): Promise<Transaction>;
  createTransactionWithMethod(userId: number, amount: number, type: string, description: string, paymentMethod: string): Promise<Transaction>;
  getTransactions(userId: number): Promise<Transaction[]>;
  getRedeemCode(code: string): Promise<RedeemCode | undefined>;
  markRedeemCodeUsed(id: number, userId: number): Promise<boolean>;
  createRedeemCode(code: string, amount: number): Promise<RedeemCode>;
  createRedeemCodes(codes: Array<{ code: string; amount: number }>): Promise<RedeemCode[]>;
  getAllRedeemCodes(): Promise<RedeemCode[]>;
  
  // Admin
  getDashboardStats(): Promise<{ totalUsers: number; totalSales: number; storeBalance: number; itemsInStock: number; itemsSold: number; totalOrders: number; pendingOrders: number; totalRevenue: number; stockWorth: number }>;
  getAdminLogs(): Promise<any[]>;
  updateOrderDelivery(orderId: number, deliveryContent: string): Promise<Order>;
  banUser(userId: number): Promise<User>;
  unbanUser(userId: number): Promise<User>;
  
  // Announcements
  getAnnouncements(): Promise<Announcement[]>;
  getAllAnnouncements(): Promise<Announcement[]>;
  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>;
  updateAnnouncement(id: number, data: Partial<Pick<Announcement, "content" | "link" | "active">>): Promise<Announcement | undefined>;
  deleteAnnouncement(id: number): Promise<void>;
  
  // Images
  uploadImage(filename: string, mimeType: string, data: string): Promise<UploadedImage>;
  getImage(id: number): Promise<UploadedImage | undefined>;

  // Support
  createSupportTicket(ticket: any): Promise<any>;
  getSupportTickets(userId?: number): Promise<any[]>;
  getSupportTicket(id: number): Promise<any>;
  updateSupportTicket(id: number, data: any): Promise<any>;

  // Cards
  getCards(): Promise<Card[]>;
  getCard(id: number): Promise<Card | undefined>;
  createCard(card: InsertCard): Promise<Card>;
  updateCard(id: number, data: Partial<Card>): Promise<Card>;
  purchaseCard(cardId: number, userId: number): Promise<Card>;

  // ACH
  getAchs(): Promise<Ach[]>;
  getAch(id: number): Promise<Ach | undefined>;
  createAch(ach: InsertAch & { sellerId?: number }): Promise<Ach>;
  purchaseAch(achId: number): Promise<Ach>;
  deleteAch(id: number): Promise<void>;
  getSellerAchs(sellerId: number): Promise<Ach[]>;

  // Settings
  getSetting(key: string, defaultValue?: string): Promise<string>;
  setSetting(key: string, value: string): Promise<void>;
  getPaymentMethodsConfig(): Promise<Record<string, boolean>>;
  getUserCards(userId: number): Promise<Card[]>;
  deleteCard(id: number): Promise<void>;

  // Card Bases
  getCardBasesWithCount(ownerId?: number): Promise<(CardBase & { count: number; soldCount: number; profit: number })[]>;
  createCardBase(name: string, refundable?: boolean, ownerId?: number): Promise<CardBase>;
  updateCardBase(id: number, name: string, refundable?: boolean, hrPercent?: number): Promise<CardBase>;
  deleteCardBase(id: number): Promise<void>;
  getCardsByBase(baseId: number): Promise<Card[]>;

  // Seller Applications
  createSellerApplication(userId: number, sellerCode: string): Promise<SellerApplication>;
  getSellerApplication(userId: number): Promise<SellerApplication | undefined>;
  getAllSellerApplications(): Promise<(SellerApplication & { username: string })[]>;
  approveSellerApplication(id: number): Promise<void>;
  rejectSellerApplication(id: number): Promise<void>;

  // CashApp (with optional paidAmount)
  fulfillCashappOrder(orderId: number, paidAmount?: number): Promise<Order>;

  // Crypto Addresses
  getCryptoAddresses(userId: number): Promise<CryptoAddress[]>;
  setCryptoAddress(userId: number, currency: string, address: string): Promise<CryptoAddress>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserBalance(userId: number, amountCents: number): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ balance: sql`${users.balance} + ${amountCents}` })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateProtectedBalance(userId: number, amountCents: number): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ protectedBalance: sql`GREATEST(0, ${users.protectedBalance} + ${amountCents})` })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async setProtectedBalance(userId: number, value: number): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ protectedBalance: Math.max(0, value) })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateLastDailySpin(userId: number): Promise<void> {
    await db.update(users).set({ lastDailySpin: new Date() }).where(eq(users.id, userId));
  }


  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async banUser(userId: number): Promise<User> {
    const [user] = await db.update(users).set({ isBanned: true }).where(eq(users.id, userId)).returning();
    return user;
  }

  async unbanUser(userId: number): Promise<User> {
    const [user] = await db.update(users).set({ isBanned: false }).where(eq(users.id, userId)).returning();
    return user;
  }

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async getProducts(): Promise<(Product & { variants: (Variant & { stockCount: number })[] })[]> {
    const allProducts = await db.select().from(products).where(eq(products.active, true));
    return this.enrichProductsWithVariants(allProducts);
  }

  async getAllProducts(): Promise<(Product & { variants: (Variant & { stockCount: number })[] })[]> {
    const allProducts = await db.select().from(products).orderBy(desc(products.createdAt));
    return this.enrichProductsWithVariants(allProducts);
  }

  private async enrichProductsWithVariants(allProducts: Product[]): Promise<(Product & { variants: (Variant & { stockCount: number })[] })[]> {
    const result = [];
    for (const prod of allProducts) {
      const prodVariants = await db.select().from(variants).where(eq(variants.productId, prod.id));
      const variantsWithStock = [];

      for (const v of prodVariants) {
        const [count] = await db
          .select({ count: sql<number>`count(*)` })
          .from(stockItems)
          .where(and(eq(stockItems.variantId, v.id), eq(stockItems.isSold, false), eq(stockItems.isReserved, false)));

        variantsWithStock.push({ ...v, stockCount: Number(count.count) });
      }
      result.push({ ...prod, variants: variantsWithStock });
    }
    return result;
  }

  async getProduct(id: number): Promise<(Product & { variants: (Variant & { stockCount: number })[] }) | undefined> {
    const [prod] = await db.select().from(products).where(eq(products.id, id));
    if (!prod) return undefined;

    const prodVariants = await db.select().from(variants).where(eq(variants.productId, prod.id));
    const variantsWithStock = [];
      
    for (const v of prodVariants) {
      const [count] = await db
        .select({ count: sql<number>`count(*)` })
        .from(stockItems)
        .where(and(eq(stockItems.variantId, v.id), eq(stockItems.isSold, false), eq(stockItems.isReserved, false)));
      
      variantsWithStock.push({ ...v, stockCount: Number(count.count) });
    }
    
    return { ...prod, variants: variantsWithStock };
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [prod] = await db.insert(products).values(insertProduct).returning();
    return prod;
  }

  async updateProduct(id: number, data: Partial<Product>): Promise<Product> {
    const [prod] = await db.update(products).set(data).where(eq(products.id, id)).returning();
    return prod;
  }

  async createVariant(insertVariant: InsertVariant): Promise<Variant> {
    const [variant] = await db.insert(variants).values(insertVariant).returning();
    return variant;
  }

  async updateVariant(id: number, data: Partial<Variant>): Promise<Variant> {
    const [variant] = await db.update(variants).set(data).where(eq(variants.id, id)).returning();
    return variant;
  }

  async deleteVariant(id: number): Promise<void> {
    await db.delete(stockItems).where(eq(stockItems.variantId, id));
    await db.delete(variants).where(eq(variants.id, id));
  }

  async deleteProduct(id: number): Promise<void> {
    const prodVariants = await db.select().from(variants).where(eq(variants.productId, id));
    for (const v of prodVariants) {
      await db.delete(orderItems).where(eq(orderItems.variantId, v.id));
      await db.delete(stockItems).where(eq(stockItems.variantId, v.id));
    }
    await db.delete(variants).where(eq(variants.productId, id));
    await db.delete(products).where(eq(products.id, id));
  }

  async addStockItems(variantId: number, content: string, sellerId?: number): Promise<{ added: number; skipped: number }> {
    const items = content.split(/\n\s*\n/).map(block => block.trim()).filter(block => block.length > 0);
    if (items.length === 0) return { added: 0, skipped: 0 };

    let added = 0;
    let skipped = 0;
    for (const itemContent of items) {
      const existing = await db.select({ id: stockItems.id }).from(stockItems)
        .where(and(eq(stockItems.variantId, variantId), eq(stockItems.content, itemContent))).limit(1);
      if (existing.length > 0) { skipped++; continue; }
      await db.insert(stockItems).values({ variantId, content: itemContent, isSold: false, sellerId: sellerId ?? null });
      added++;
    }
    return { added, skipped };
  }

  async addSingleStockItem(variantId: number, content: string): Promise<StockItem> {
    const existing = await db.select({ id: stockItems.id }).from(stockItems)
      .where(eq(stockItems.content, content)).limit(1);
    if (existing.length > 0) throw new Error("Duplicate: this item already exists in the database");
    const [item] = await db.insert(stockItems).values({
      variantId,
      content,
      isSold: false
    }).returning();
    return item;
  }

  async getStockItems(variantId: number): Promise<StockItem[]> {
    return db.select().from(stockItems)
      .where(and(eq(stockItems.variantId, variantId), eq(stockItems.isSold, false), eq(stockItems.isReserved, false)))
      .orderBy(desc(stockItems.createdAt));
  }

  async deleteStockItem(id: number): Promise<void> {
    await db.delete(stockItems).where(eq(stockItems.id, id));
  }

  // Reserve stock for immediate (wallet) purchase — marks as sold right away.
  // Uses a single atomic UPDATE with subquery to avoid race conditions.
  async reserveStockItem(variantId: number, sellerId?: number): Promise<StockItem | undefined> {
    let result;
    if (sellerId === -1) {
      // Admin-only stock (seller_id IS NULL)
      result = await db.execute(sql`
        UPDATE stock_items
        SET is_sold = true
        WHERE id = (
          SELECT id FROM stock_items
          WHERE variant_id = ${variantId}
            AND is_sold = false
            AND is_reserved = false
            AND seller_id IS NULL
          ORDER BY id
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *
      `);
    } else if (sellerId) {
      result = await db.execute(sql`
        UPDATE stock_items
        SET is_sold = true
        WHERE id = (
          SELECT id FROM stock_items
          WHERE variant_id = ${variantId}
            AND is_sold = false
            AND is_reserved = false
            AND seller_id = ${sellerId}
          ORDER BY id
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *
      `);
    } else {
      result = await db.execute(sql`
        UPDATE stock_items
        SET is_sold = true
        WHERE id = (
          SELECT id FROM stock_items
          WHERE variant_id = ${variantId}
            AND is_sold = false
            AND is_reserved = false
          ORDER BY id
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *
      `);
    }
    return result.rows[0] as StockItem | undefined;
  }

  // Hold stock for a pending order (CashApp/Crypto) — marks as reserved but not sold yet.
  // Uses a single atomic UPDATE with subquery to avoid race conditions.
  async holdStockItem(variantId: number, orderId: number): Promise<StockItem | undefined> {
    const result = await db.execute(sql`
      UPDATE stock_items
      SET is_reserved = true, order_id = ${orderId}
      WHERE id = (
        SELECT id FROM stock_items
        WHERE variant_id = ${variantId}
          AND is_sold = false
          AND is_reserved = false
        ORDER BY id
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `);
    return result.rows[0] as StockItem | undefined;
  }

  // Release held stock back to available (e.g. when order marked unpaid or cancelled)
  async releaseHeldStock(orderId: number): Promise<void> {
    await db
      .update(stockItems)
      .set({ isReserved: false, orderId: null })
      .where(and(eq(stockItems.orderId, orderId), eq(stockItems.isReserved, true), eq(stockItems.isSold, false)));
  }

  async createOrder(userId: number, items: { variantId: number; quantity: number; sellerId?: number }[], cardIds: number[] = [], discountCodeId?: number | null): Promise<Order> {
    // ── Step 1: Calculate totals and validate BEFORE touching any stock ──
    let rawTotal = 0;
    const variantMap: Record<number, typeof variants.$inferSelect> = {};

    for (const item of items) {
      const [variant] = await db.select().from(variants).where(eq(variants.id, item.variantId));
      if (!variant) throw new Error("Variant not found");
      variantMap[item.variantId] = variant;
      rawTotal += variant.price * item.quantity;
    }

    const cardMap: Record<number, typeof cards.$inferSelect> = {};
    const cardPurchases: { cardId: number; price: number }[] = [];
    for (const cardId of cardIds) {
      const [card] = await db.select().from(cards).where(eq(cards.id, cardId));
      if (!card) throw new Error("Card not found");
      if (card.isSold) throw new Error("Card already sold");
      cardMap[cardId] = card;
      rawTotal += card.price;
      cardPurchases.push({ cardId, price: card.price });
    }

    // Apply discount code
    let total = rawTotal;
    let discountApplied = false;
    let activeDiscount: typeof discountCodes.$inferSelect | null = null;
    if (discountCodeId) {
      const [dc] = await db.select().from(discountCodes).where(eq(discountCodes.id, discountCodeId));
      if (dc && dc.isActive && !(dc.maxUses !== null && dc.usedCount >= dc.maxUses) && !(dc.expiresAt && new Date(dc.expiresAt) < new Date())) {
        const discountAmount = dc.type === "percent"
          ? Math.round(rawTotal * dc.value / 100)
          : Math.min(dc.value, rawTotal);
        total = Math.max(0, rawTotal - discountAmount);
        activeDiscount = dc;
        discountApplied = true;
      }
    }

    // Apply rank discount automatically
    const rankResult = await db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), sql`amount > 0`, sql`type IN ('deposit', 'manual_deposit')`));
    const totalDeposited = Number(rankResult[0]?.total ?? 0);
    const rankDiscountPct = totalDeposited >= 100000 ? 10 : totalDeposited >= 50000 ? 5 : totalDeposited >= 10000 ? 2 : 0;
    if (rankDiscountPct > 0) {
      total = Math.max(0, Math.round(total * (1 - rankDiscountPct / 100)));
    }

    if (rawTotal < 100) throw new Error("Order total must be at least $1.00");

    // Check balance BEFORE consuming any stock
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || user.balance < total) throw new Error("Insufficient balance");

    // ── Step 2: Reserve stock atomically ──
    const reservedStockItems: { variantId: number, stockItemId: number, price: number, content: string }[] = [];

    try {
      for (const item of items) {
        const variant = variantMap[item.variantId];
        for (let i = 0; i < item.quantity; i++) {
          const stockItem = await this.reserveStockItem(item.variantId, (item as any).sellerId || undefined);
          if (!stockItem) {
            throw new Error(`Out of stock: ${variant.name}`);
          }
          reservedStockItems.push({
            variantId: item.variantId,
            stockItemId: stockItem.id,
            price: variant.price,
            content: (stockItem as any).content ?? "",
          });
        }
      }
    } catch (err) {
      // Release any stock we already reserved before re-throwing
      for (const res of reservedStockItems) {
        await db.update(stockItems)
          .set({ isSold: false })
          .where(eq(stockItems.id, res.stockItemId));
      }
      throw err;
    }

    // ── Step 3: Deduct balance and create the order ──
    await this.updateUserBalance(userId, -total);
    await this.createTransaction(userId, -total, "purchase", `Order purchase`);

    // Increment discount code usage
    if (discountApplied && activeDiscount) {
      await db.update(discountCodes).set({ usedCount: activeDiscount.usedCount + 1 }).where(eq(discountCodes.id, activeDiscount.id));
    }

    // Build delivery content from reserved stock
    const deliveryParts: Record<string, string[]> = {};
    for (const res of reservedStockItems) {
      const key = String(res.variantId);
      if (!deliveryParts[key]) deliveryParts[key] = [];
      deliveryParts[key].push(res.content);
    }
    const deliveryContent = JSON.stringify(
      Object.fromEntries(Object.entries(deliveryParts).map(([k, v]) => [k, v.join("\n\n")]))
    );
    const publicOrderId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const [order] = await db.insert(orders).values({
      userId,
      orderId: publicOrderId,
      total,
      paidAmount: total,
      status: "delivering",
      deliveryContent,
    }).returning();

    for (const res of reservedStockItems) {
      await db.insert(orderItems).values({
        orderId: order.id,
        variantId: res.variantId,
        stockItemId: res.stockItemId,
        cardId: null,
        itemType: "product",
        price: res.price,
        quantity: 1
      });
      await db.update(stockItems).set({ orderId: order.id }).where(eq(stockItems.id, res.stockItemId));
    }

    for (const cp of cardPurchases) {
      await db.insert(orderItems).values({
        orderId: order.id,
        variantId: null,
        cardId: cp.cardId,
        itemType: "card",
        price: cp.price,
        quantity: 1
      });
      const originalCard = cardMap[cp.cardId];
      const originalSellerId = originalCard?.userId;
      await db.update(cards).set({ isSold: true, userId }).where(eq(cards.id, cp.cardId));

    }

    return order;
  }

  async createPendingOrder(userId: number, items: { variantId: number; quantity: number }[], cardIds: number[] = [], discountCodeId?: number | null): Promise<Order> {
    let total = 0;
    const heldItems: { variantId: number; stockItemId: number; price: number; quantity: number }[] = [];

    // Calculate total and check stock availability first
    for (const item of items) {
      const [variant] = await db.select().from(variants).where(eq(variants.id, item.variantId));
      if (!variant) throw new Error("Variant not found");
      total += variant.price * item.quantity;

      // Check there is enough stock before creating the order
      const [avail] = await db.select({ count: sql<number>`count(*)` }).from(stockItems)
        .where(and(eq(stockItems.variantId, item.variantId), eq(stockItems.isSold, false), eq(stockItems.isReserved, false)));
      if (Number(avail.count) < item.quantity) {
        throw new Error(`Insufficient stock for ${variant.name}`);
      }
    }

    const rawTotal = total;
    let activeDiscount: typeof discountCodes.$inferSelect | null = null;
    if (discountCodeId) {
      const [dc] = await db.select().from(discountCodes).where(eq(discountCodes.id, discountCodeId));
      if (dc && dc.isActive && !(dc.maxUses !== null && dc.usedCount >= dc.maxUses) && !(dc.expiresAt && new Date(dc.expiresAt) < new Date())) {
        const discountAmount = dc.type === "percent"
          ? Math.round(rawTotal * dc.value / 100)
          : Math.min(dc.value, rawTotal);
        total = Math.max(0, rawTotal - discountAmount);
        activeDiscount = dc;
      }
    }

    // Apply rank discount automatically
    const rankResult = await db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), sql`amount > 0`, sql`type IN ('deposit', 'manual_deposit')`));
    const totalDeposited = Number(rankResult[0]?.total ?? 0);
    const rankDiscountPct = totalDeposited >= 100000 ? 10 : totalDeposited >= 50000 ? 5 : totalDeposited >= 10000 ? 2 : 0;
    if (rankDiscountPct > 0) {
      total = Math.max(0, Math.round(total * (1 - rankDiscountPct / 100)));
    }

    const publicOrderId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const [order] = await db.insert(orders).values({
      userId,
      orderId: publicOrderId,
      total,
      status: "pending"
    }).returning();

    // Hold one stock item per unit ordered — release everything and cancel the order if any hold fails
    const variantCache: Record<number, typeof variants.$inferSelect> = {};
    try {
      for (const item of items) {
        const [variant] = await db.select().from(variants).where(eq(variants.id, item.variantId));
        if (!variant) throw new Error("Variant not found");
        variantCache[item.variantId] = variant;

        for (let i = 0; i < item.quantity; i++) {
          const held = await this.holdStockItem(item.variantId, order.id);
          if (!held) throw new Error(`Out of stock: ${variant.name}`);
          heldItems.push({ variantId: item.variantId, stockItemId: held.id, price: variant.price, quantity: 1 });
        }
      }
    } catch (err) {
      // Release any stock we already held and delete the skeleton order
      await this.releaseHeldStock(order.id);
      await db.delete(orders).where(eq(orders.id, order.id));
      throw err;
    }

    // Only increment discount usage after stock holds succeed — prevents count leaking on failed orders
    if (activeDiscount) {
      await db.update(discountCodes).set({ usedCount: activeDiscount.usedCount + 1 }).where(eq(discountCodes.id, activeDiscount.id));
    }

    // Create one order item per held stock item (each unit gets its own row)
    for (const h of heldItems) {
      await db.insert(orderItems).values({
        orderId: order.id,
        variantId: h.variantId,
        stockItemId: h.stockItemId,
        cardId: null,
        itemType: "product",
        price: h.price,
        quantity: 1,
      });
    }

    return order;
  }

  async fulfillPendingOrder(orderId: number): Promise<void> {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!order) throw new Error("Order not found");
    if (order.status !== "pending") return; // Already handled

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const deliveryParts: Record<string, string[]> = {};

    for (const item of items) {
      if (!item.variantId) continue;
      const key = String(item.variantId);
      if (!deliveryParts[key]) deliveryParts[key] = [];

      if (item.stockItemId) {
        // Stock was held at order time — mark it sold now
        const [stock] = await db.select().from(stockItems).where(eq(stockItems.id, item.stockItemId));
        if (stock) {
          await db.update(stockItems)
            .set({ isSold: true, isReserved: false })
            .where(eq(stockItems.id, stock.id));
          deliveryParts[key].push(stock.content);
        }
      } else {
        // Fallback: grab from available stock
        for (let i = 0; i < (item.quantity ?? 1); i++) {
          const stock = await this.reserveStockItem(item.variantId);
          if (stock) {
            await db.update(orderItems).set({ stockItemId: stock.id }).where(eq(orderItems.id, item.id));
            deliveryParts[key].push(stock.content);
          }
        }
      }
    }

    const deliveryContent = JSON.stringify(
      Object.fromEntries(Object.entries(deliveryParts).map(([k, v]) => [k, v.join("\n\n")]))
    );
    await db.update(orders)
      .set({ status: "delivering", deliveryContent, paidAmount: order.total })
      .where(eq(orders.id, orderId));
  }

  async fulfillCashappOrder(orderId: number, paidAmount?: number): Promise<Order> {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!order) throw new Error("Order not found");
    if (order.status !== "pending") {
      throw new Error("Order is not in a payable state");
    }

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const deliveryParts: Record<string, string[]> = {};

    for (const item of items) {
      if (!item.variantId) continue;
      const key = String(item.variantId);
      if (!deliveryParts[key]) deliveryParts[key] = [];

      if (item.stockItemId) {
        const [stock] = await db.select().from(stockItems).where(eq(stockItems.id, item.stockItemId));
        if (!stock) throw new Error(`Reserved stock item missing for order item ${item.id}`);
        await db.update(stockItems)
          .set({ isSold: true, isReserved: false })
          .where(eq(stockItems.id, stock.id));
        deliveryParts[key].push(stock.content);
      } else {
        const [variant] = await db.select().from(variants).where(eq(variants.id, item.variantId));
        for (let i = 0; i < (item.quantity ?? 1); i++) {
          const stock = await this.reserveStockItem(item.variantId);
          if (!stock) throw new Error(`Insufficient stock for ${variant?.name ?? item.variantId}`);
          await db.update(orderItems).set({ stockItemId: stock.id }).where(eq(orderItems.id, item.id));
          deliveryParts[key].push(stock.content);
        }
      }
    }

    // Deposit-only order (no items) — credit user's wallet balance with paidAmount
    if (items.length === 0) {
      const grossAmount = paidAmount !== undefined ? paidAmount : order.total;
      // Apply configured fee for manual payment methods (CashApp, Venmo, Chime, Zelle)
      let feeRate = 0;
      const manualMethods = ["CashApp", "Venmo", "Chime", "Zelle"];
      if (manualMethods.includes(order.paymentMethod || "")) {
        const feeKey = order.paymentMethod === "CashApp" ? "cashapp_fee"
          : order.paymentMethod === "Venmo" ? "venmo_fee"
          : order.paymentMethod === "Chime" ? "chime_fee" : "zelle_fee";
        const feePct = parseFloat(await this.getSetting(feeKey, "0")) || 0;
        feeRate = feePct / 100;
      }
      const creditAmount = Math.round(grossAmount * (1 - feeRate));
      const feeAmount = grossAmount - creditAmount;
      await db.update(users)
        .set({ balance: sql`balance + ${creditAmount}` })
        .where(eq(users.id, order.userId));
      const feePct = Math.round(feeRate * 10000) / 100;
      const feeNote = feeAmount > 0 ? ` (${feePct}% fee: -$${(feeAmount/100).toFixed(2)})` : "";
      await db.insert(transactions).values({
        userId: order.userId,
        amount: creditAmount,
        type: "deposit",
        description: `${order.paymentMethod || "Manual"} deposit confirmed (${order.orderId})${feeNote}`,
        paymentMethod: order.paymentMethod || "CashApp",
      });
      const [updated] = await db.update(orders)
        .set({ status: "fulfilled", paidAmount: grossAmount, total: grossAmount })
        .where(eq(orders.id, orderId))
        .returning();
      return updated;
    }

    const deliveryContent = JSON.stringify(
      Object.fromEntries(Object.entries(deliveryParts).map(([k, v]) => [k, v.join("\n\n")]))
    );
    const [updated] = await db.update(orders)
      .set({ status: "delivering", deliveryContent, paidAmount: paidAmount ?? order.total })
      .where(eq(orders.id, orderId))
      .returning();
    return updated;
  }

  async getCryptoAddresses(userId: number): Promise<CryptoAddress[]> {
    return db.select().from(cryptoAddresses).where(eq(cryptoAddresses.userId, userId));
  }

  async setCryptoAddress(userId: number, currency: string, address: string): Promise<CryptoAddress> {
    const existing = await db.select().from(cryptoAddresses)
      .where(and(eq(cryptoAddresses.userId, userId), eq(cryptoAddresses.currency, currency)));
    if (existing.length > 0) {
      const [updated] = await db.update(cryptoAddresses)
        .set({ address })
        .where(and(eq(cryptoAddresses.userId, userId), eq(cryptoAddresses.currency, currency)))
        .returning();
      return updated;
    }
    const [created] = await db.insert(cryptoAddresses).values({ userId, currency, address }).returning();
    return created;
  }

  async replaceOrder(orderId: number): Promise<Order> {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!order) throw new Error("Order not found");
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const replacementParts: Record<string, string[]> = {};

    for (const item of items) {
      if (!item.variantId) continue;
      const [variant] = await db.select().from(variants).where(eq(variants.id, item.variantId));
      if (!variant) continue;
      const key = String(item.variantId);
      if (!replacementParts[key]) replacementParts[key] = [];
      for (let i = 0; i < (item.quantity ?? 1); i++) {
        const stock = await this.reserveStockItem(item.variantId);
        if (!stock) throw new Error(`No replacement stock available for ${variant.name}`);
        replacementParts[key].push(stock.content);
      }
    }

    // Append replacement content to existing delivery
    let existing: Record<string, string> = {};
    try { existing = JSON.parse(order.deliveryContent || "{}"); } catch {}
    const merged = { ...existing };
    for (const [k, v] of Object.entries(replacementParts)) {
      merged[k] = [merged[k], ...v].filter(Boolean).join("\n\n--- REPLACEMENT ---\n\n");
    }
    const [updated] = await db.update(orders)
      .set({ status: "replaced", deliveryContent: JSON.stringify(merged) })
      .where(eq(orders.id, orderId))
      .returning();
    return updated;
  }

  async markOrderUnpaid(orderId: number): Promise<Order> {
    // Release held stock back to available
    await this.releaseHeldStock(orderId);
    const [updated] = await db.update(orders)
      .set({ status: "waiting_payment" })
      .where(eq(orders.id, orderId))
      .returning();
    if (!updated) throw new Error("Order not found");
    return updated;
  }

  async cancelPendingOrder(orderId: number): Promise<void> {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!order || order.status !== "pending") return;
    // Release held stock before cancelling
    await this.releaseHeldStock(orderId);
    await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
    await db.update(orders).set({ status: "waiting_payment" as any }).where(eq(orders.id, orderId));
  }

  async cancelStalePendingOrders(maxAgeMs: number = 60 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMs);
    const staleOrders = await db.select().from(orders)
      .where(and(eq(orders.status, "pending"), lt(orders.createdAt, cutoff)));
    let cancelled = 0;
    for (const order of staleOrders) {
      // Never auto-cancel CashApp orders — they need up to 4 hours
      if (order.paymentMethod === "CashApp") continue;
      await this.cancelPendingOrder(order.id);
      cancelled++;
    }
    return cancelled;
  }

  async expireStaleCryptoPayments(maxAgeMs: number = 2 * 60 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMs);
    const stale = await db.select().from(cryptoPayments)
      .where(and(eq(cryptoPayments.status, "pending"), lt(cryptoPayments.createdAt, cutoff)));
    if (stale.length === 0) return 0;
    await db.update(cryptoPayments)
      .set({ status: "expired" })
      .where(and(eq(cryptoPayments.status, "pending"), lt(cryptoPayments.createdAt, cutoff)));
    return stale.length;
  }

  async getOrders(userId: number): Promise<(Order & { items: (OrderItem & { stockItem: StockItem | null, variant: Variant | null })[] })[]> {
    const userOrders = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
    
    const result = [];
    for (const o of userOrders) {
      const oItems = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
      const itemsWithDetails = [];
      for (const i of oItems) {
        const [stockItem] = i.stockItemId ? await db.select().from(stockItems).where(eq(stockItems.id, i.stockItemId)) : [undefined];
        const [variant] = i.variantId ? await db.select().from(variants).where(eq(variants.id, i.variantId)) : [undefined];
        const [product] = variant?.productId ? await db.select().from(products).where(eq(products.id, variant.productId)) : [undefined];
        const [card] = i.cardId ? await db.select().from(cards).where(eq(cards.id, i.cardId)) : [undefined];
        itemsWithDetails.push({ ...i, stockItem: stockItem || null, variant: variant || null, card: card || null, productName: product?.name || null });
      }
      result.push({ ...o, items: itemsWithDetails });
    }
    return result;
  }

  async getOrder(id: number) {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return undefined;

    const oItems = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    const itemsWithDetails = [];
    for (const i of oItems) {
      const [stockItem] = i.stockItemId ? await db.select().from(stockItems).where(eq(stockItems.id, i.stockItemId)) : [undefined];
      const [variant] = i.variantId ? await db.select().from(variants).where(eq(variants.id, i.variantId)) : [undefined];
      const [card] = i.cardId ? await db.select().from(cards).where(eq(cards.id, i.cardId)) : [undefined];
      itemsWithDetails.push({ ...i, stockItem: stockItem || null, variant: variant || null, card: card || null });
    }
    
    return { ...order, items: itemsWithDetails };
  }

  async getAllOrders(): Promise<any[]> {
    const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
    const result = [];
    for (const o of allOrders) {
      const [user] = await db.select().from(users).where(eq(users.id, o.userId));
      const oItems = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
      const itemsWithDetails = [];
      for (const i of oItems) {
        const [stockItem] = i.stockItemId ? await db.select().from(stockItems).where(eq(stockItems.id, i.stockItemId)) : [undefined];
        const [variant] = i.variantId ? await db.select().from(variants).where(eq(variants.id, i.variantId)) : [undefined];
        const [product] = variant?.productId ? await db.select().from(products).where(eq(products.id, variant.productId)) : [undefined];
        const [card] = i.cardId ? await db.select().from(cards).where(eq(cards.id, i.cardId)) : [undefined];
        itemsWithDetails.push({ ...i, stockItem: stockItem || null, variant: variant || null, card: card || null, productName: product?.name || null });
      }
      let paymentMethod = "Unknown";
      try {
        if (o.paymentMethod) {
          paymentMethod = o.paymentMethod;
        } else {
          const [cryptoPay] = await db.select().from(cryptoPayments).where(eq(cryptoPayments.orderId, o.id));
          if (cryptoPay) {
            paymentMethod = "Crypto";
          } else {
            const purchaseTxs = await db.select().from(transactions)
              .where(and(eq(transactions.userId, o.userId), eq(transactions.type, "purchase")))
              .orderBy(desc(transactions.createdAt));
            const purchaseTx = purchaseTxs.find(tx => {
              const txTime = new Date(tx.createdAt).getTime();
              const orderTime = new Date(o.createdAt).getTime();
              return Math.abs(txTime - orderTime) < 30000;
            });
            if (purchaseTx?.paymentMethod) paymentMethod = purchaseTx.paymentMethod;
            else paymentMethod = "Wallet";
          }
        }
      } catch (e) {}
      const [verif] = await db.select().from(verifications).where(eq(verifications.userId, o.userId)).catch(() => [undefined]);
      result.push({ ...o, user: { id: user?.id, username: user?.username, email: user?.email, telegramUsername: verif?.telegramUsername || null, channelName: verif?.channelName || null, channelLink: verif?.channelLink || null }, items: itemsWithDetails, paymentMethod });
    }
    return result;
  }

  async refundOrder(orderId: number): Promise<Order> {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!order || order.status === 'refunded') throw new Error("Invalid order or already refunded");

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    for (const item of items) {
      if (item.itemType === 'product' && item.stockItemId) {
        await db.update(orderItems).set({ stockItemId: null }).where(eq(orderItems.id, item.id));
        await db.delete(stockItems).where(eq(stockItems.id, item.stockItemId));
      }
      if (item.itemType === 'card' && item.cardId) {
        await db.update(orderItems).set({ cardId: null }).where(eq(orderItems.id, item.id));
        await db.delete(cards).where(eq(cards.id, item.cardId));
      }
    }

    await this.updateUserBalance(order.userId, order.total);
    await this.createTransaction(order.userId, order.total, "refund", `Refund for order #${order.orderId}`);
    
    const [updated] = await db.update(orders).set({ status: 'refunded' as const }).where(eq(orders.id, orderId)).returning();
    return updated;
  }

  async updateOrderDelivery(orderId: number, deliveryContent: string): Promise<Order> {
    const [order] = await db.update(orders).set({
      deliveryContent,
      status: "fulfilled" as any
    }).where(eq(orders.id, orderId)).returning();
    return order;
  }

  async createTransaction(userId: number, amount: number, type: string, description: string): Promise<Transaction> {
    const [tx] = await db.insert(transactions).values({
      userId,
      amount,
      type,
      description
    }).returning();
    return tx;
  }

  async createTransactionWithMethod(userId: number, amount: number, type: string, description: string, paymentMethod: string): Promise<Transaction> {
    const [tx] = await db.insert(transactions).values({
      userId,
      amount,
      type,
      description,
      paymentMethod
    }).returning();
    return tx;
  }

  async getTransactions(userId: number): Promise<Transaction[]> {
    return db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.createdAt));
  }

  async getRedeemCode(code: string): Promise<RedeemCode | undefined> {
    const [rc] = await db.select().from(redeemCodes).where(eq(redeemCodes.code, code));
    return rc;
  }

  async markRedeemCodeUsed(id: number, userId: number): Promise<boolean> {
    const claimed = await db
      .update(redeemCodes)
      .set({ isUsed: true, usedBy: userId })
      .where(and(eq(redeemCodes.id, id), eq(redeemCodes.isUsed, false)))
      .returning({ id: redeemCodes.id });
    return claimed.length === 1;
  }

  async createRedeemCode(code: string, amount: number): Promise<RedeemCode> {
    const [rc] = await db.insert(redeemCodes).values({ code, amount }).returning();
    return rc;
  }

  async createRedeemCodes(codes: Array<{ code: string; amount: number }>): Promise<RedeemCode[]> {
    if (codes.length === 0) return [];
    return db.insert(redeemCodes)
      .values(codes)
      .onConflictDoNothing({ target: redeemCodes.code })
      .returning();
  }

  async getAllRedeemCodes(): Promise<RedeemCode[]> {
    return db.select().from(redeemCodes).orderBy(desc(redeemCodes.createdAt));
  }

  async getDashboardStats() {
    const [usersCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [salesSum] = await db.select({ sum: sql<number>`sum(${orders.total})` }).from(orders).where(eq(orders.status, 'fulfilled'));
    const [stockCount] = await db.select({ count: sql<number>`count(*)` }).from(stockItems).where(and(eq(stockItems.isSold, false), eq(stockItems.isReserved, false)));
    const [soldCount] = await db.select({ count: sql<number>`count(*)` }).from(stockItems).where(eq(stockItems.isSold, true));
    const [ordersCount] = await db.select({ count: sql<number>`count(*)` }).from(orders);
    const [pendingCount] = await db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.status, 'waiting_payment'));
    const [stockWorthRow] = await db
      .select({ worth: sql<number>`coalesce(sum(${variants.price}), 0)` })
      .from(stockItems)
      .innerJoin(variants, eq(stockItems.variantId, variants.id))
      .where(and(eq(stockItems.isSold, false), eq(stockItems.isReserved, false)));

    return {
      totalUsers: Number(usersCount.count),
      totalSales: Number(salesSum.sum || 0),
      totalRevenue: Number(salesSum.sum || 0),
      storeBalance: 0,
      itemsInStock: Number(stockCount.count),
      itemsSold: Number(soldCount.count),
      totalOrders: Number(ordersCount.count),
      pendingOrders: Number(pendingCount.count),
      stockWorth: Number(stockWorthRow?.worth || 0),
    };
  }

  async getAdminLogs(): Promise<any[]> {
    return db.select().from(transactions).where(eq(transactions.type, "admin_adjustment")).orderBy(desc(transactions.createdAt)).limit(50);
  }

  async getAnnouncements(): Promise<Announcement[]> {
    return db.select().from(announcements).where(eq(announcements.active, true)).orderBy(desc(announcements.createdAt));
  }

  async getAllAnnouncements(): Promise<Announcement[]> {
    return db.select().from(announcements).orderBy(desc(announcements.createdAt));
  }

  async createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement> {
    const [ann] = await db.insert(announcements).values(announcement).returning();
    return ann;
  }

  async updateAnnouncement(id: number, data: Partial<Pick<Announcement, "content" | "link" | "active">>): Promise<Announcement | undefined> {
    const [ann] = await db.update(announcements).set(data).where(eq(announcements.id, id)).returning();
    return ann;
  }

  async deleteAnnouncement(id: number): Promise<void> {
    await db.delete(announcements).where(eq(announcements.id, id));
  }

  async uploadImage(filename: string, mimeType: string, data: string): Promise<UploadedImage> {
    const [img] = await db.insert(uploadedImages).values({ filename, mimeType, data }).returning();
    return img;
  }

  async getImage(id: number): Promise<UploadedImage | undefined> {
    const [img] = await db.select().from(uploadedImages).where(eq(uploadedImages.id, id));
    return img;
  }

  async createSupportTicket(ticket: any): Promise<any> {
    const [t] = await db.insert(supportTickets).values(ticket).returning();
    return t;
  }

  async getSupportTickets(userId?: number): Promise<any[]> {
    const q = db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt));
    if (userId) return q.where(eq(supportTickets.userId, userId));
    return q;
  }

  async getSupportTicket(id: number): Promise<any> {
    const [t] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
    return t;
  }

  async updateSupportTicket(id: number, data: any): Promise<any> {
    // Use raw SQL to avoid Drizzle's enum type-check on the status column
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(data)) {
      const col = key.replace(/([A-Z])/g, '_$1').toLowerCase(); // camelCase → snake_case
      setClauses.push(`${col} = $${idx++}`);
      values.push(value);
    }
    values.push(id);
    const result = await pool.query(
      `UPDATE support_tickets SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  async getCards(): Promise<Card[]> {
    return db.select().from(cards).where(eq(cards.isSold, false)).orderBy(desc(cards.createdAt));
  }

  async getCard(id: number): Promise<Card | undefined> {
    const [card] = await db.select().from(cards).where(eq(cards.id, id));
    return card;
  }

  async createCard(insertCard: InsertCard): Promise<Card> {
    const [card] = await db.insert(cards).values(insertCard as typeof cards.$inferInsert).returning();
    return card;
  }

  async updateCard(id: number, data: Partial<Card>): Promise<Card> {
    const [card] = await db.update(cards).set(data).where(eq(cards.id, id)).returning();
    return card;
  }

  async purchaseCard(cardId: number, userId: number, finalPrice?: number): Promise<Card> {
    const [card] = await db.select().from(cards).where(and(eq(cards.id, cardId), eq(cards.isSold, false)));
    if (!card) throw new Error("Card not found or already sold");
    
    const [updated] = await db.update(cards).set({ isSold: true, userId }).where(eq(cards.id, cardId)).returning();

    const paidTotal = finalPrice ?? card.price;

    // Compose full card content
    const deliveryContent = [card.cardNumber, card.expiry, card.cvv, card.country, card.extras]
      .filter(Boolean).join("|");

    // Create a matching order so it shows in "Orders"
    const publicOrderId = Math.random().toString(36).substring(2, 15);
    const [order] = await db.insert(orders).values({
      userId,
      orderId: `CARD-${publicOrderId}`,
      total: paidTotal,
      paidAmount: paidTotal,
      status: "fulfilled",
      deliveryContent,
      paymentMethod: "wallet",
    }).returning();

    // Insert order item so the products tab is populated
    await db.insert(orderItems).values({
      orderId: order.id,
      variantId: null,
      cardId: card.id,
      itemType: "card",
      price: card.price,
      quantity: 1,
    });

    return updated;
  }

  async getUserCards(userId: number): Promise<Card[]> {
    return db.select().from(cards).where(eq(cards.userId, userId)).orderBy(desc(cards.createdAt));
  }

  async deleteCard(id: number): Promise<void> {
    await db.delete(cards).where(eq(cards.id, id));
  }

  async getCardBasesWithCount(ownerId?: number): Promise<(CardBase & { count: number; soldCount: number; profit: number })[]> {
    const ownerFilter = ownerId === undefined ? sql`` : sql`WHERE cb.owner_id = ${ownerId}`;
    const result = await db.execute(sql`
      SELECT cb.id, cb.name, cb.refundable, cb.owner_id, cb.created_at,
             cb.hr_percent,
             COUNT(c.id) FILTER (WHERE c.is_sold = false) as count,
             COUNT(c.id) FILTER (WHERE c.is_sold = true) as sold_count,
             COALESCE(SUM(ROUND(c.price * cb.hr_percent / 100.0)), 0) as profit
      FROM card_bases cb
      LEFT JOIN cards c ON c.base_id = cb.id
      ${ownerFilter}
      GROUP BY cb.id, cb.name, cb.refundable, cb.hr_percent, cb.owner_id, cb.created_at
      ORDER BY cb.name
    `);
    return (result.rows as any[]).map((r: any) => ({
      id: r.id,
      name: r.name,
      refundable: Boolean(r.refundable),
      hrPercent: Number(r.hr_percent ?? 80),
      ownerId: r.owner_id == null ? null : Number(r.owner_id),
      createdAt: r.created_at,
      count: Number(r.count),
      soldCount: Number(r.sold_count),
      profit: Number(r.profit),
    }));
  }

  async createCardBase(name: string, refundable = false, ownerId?: number): Promise<CardBase> {
    const [base] = await db.insert(cardBases).values({ name, refundable, ownerId }).returning();
    return base;
  }

  async updateCardBase(id: number, name: string, refundable?: boolean, hrPercent?: number): Promise<CardBase> {
    const [base] = await db.update(cardBases)
      .set({
        name,
        ...(refundable === undefined ? {} : { refundable }),
        ...(hrPercent === undefined ? {} : { hrPercent }),
      })
      .where(eq(cardBases.id, id))
      .returning();
    return base;
  }

  async deleteCardBase(id: number): Promise<void> {
    const result = await db.execute(sql`SELECT COUNT(*) as n FROM cards WHERE base_id = ${id} AND is_sold = false`);
    const count = Number((result.rows[0] as any).n);
    if (count > 0) throw new Error("Cannot delete base with cards in stock");
    await db.delete(cardBases).where(eq(cardBases.id, id));
  }

  async getCardsByBase(baseId: number): Promise<Card[]> {
    return db.select().from(cards).where(and(eq(cards.baseId, baseId), eq(cards.isSold, false))).orderBy(desc(cards.createdAt));
  }

  async createSellerApplication(userId: number, sellerCode: string): Promise<SellerApplication> {
    const [app] = await db.insert(sellerApplications).values({ userId, sellerCode, status: "pending" }).returning();
    return app;
  }

  async getSellerApplication(userId: number): Promise<SellerApplication | undefined> {
    const [app] = await db.select().from(sellerApplications).where(eq(sellerApplications.userId, userId));
    return app;
  }

  async getAllSellerApplications(): Promise<(SellerApplication & { username: string })[]> {
    const rows = await db
      .select({ app: sellerApplications, username: users.username })
      .from(sellerApplications)
      .leftJoin(users, eq(sellerApplications.userId, users.id))
      .orderBy(desc(sellerApplications.createdAt));
    return rows.map(r => ({ ...r.app, username: r.username ?? "" }));
  }

  async approveSellerApplication(id: number): Promise<void> {
    const [app] = await db.select().from(sellerApplications).where(eq(sellerApplications.id, id));
    if (!app) return;
    await db.update(sellerApplications).set({ status: "approved" }).where(eq(sellerApplications.id, id));
    await db.update(users).set({ isWorker: true }).where(eq(users.id, app.userId));
  }

  async rejectSellerApplication(id: number): Promise<void> {
    await db.update(sellerApplications).set({ status: "rejected" }).where(eq(sellerApplications.id, id));
  }

  async getAchs(): Promise<Ach[]> {
    return db.select().from(achs).where(eq(achs.isSold, false)).orderBy(desc(achs.createdAt));
  }

  async getAch(id: number): Promise<Ach | undefined> {
    const [ach] = await db.select().from(achs).where(eq(achs.id, id));
    return ach;
  }

  async createAch(data: InsertAch & { sellerId?: number }): Promise<Ach> {
    const [ach] = await db.insert(achs).values({ ...data, sellerId: data.sellerId ?? null } as any).returning();
    return ach;
  }

  async purchaseAch(achId: number): Promise<Ach> {
    const [updated] = await db.update(achs).set({ isSold: true }).where(eq(achs.id, achId)).returning();
    return updated;
  }

  async deleteAch(id: number): Promise<void> {
    await db.delete(achs).where(eq(achs.id, id));
  }

  async getSellerAchs(sellerId: number): Promise<Ach[]> {
    return db.select().from(achs).where(eq(achs.sellerId, sellerId)).orderBy(desc(achs.createdAt));
  }

  async getSetting(key: string, defaultValue: string = ""): Promise<string> {
    const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, key));
    return row?.value ?? defaultValue;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await db
      .insert(siteSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value } });
  }

  async getPaymentMethodsConfig(): Promise<Record<string, boolean>> {
    const rows = await db.select().from(siteSettings)
      .where(sql`key LIKE 'payment_method_%'`);
    const defaults: Record<string, boolean> = {
      wallet: true,
      cashapp: true,
      crypto: true,
      stars: true,
      venmo: true,
      zelle: true,
      chime: true,
    };
    for (const row of rows) {
      const method = row.key.replace("payment_method_", "");
      defaults[method] = row.value === "true";
    }
    return defaults;
  }

}

export const storage = new DatabaseStorage();
