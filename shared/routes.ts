import { z } from 'zod';
import { 
  insertUserSchema, 
  insertProductSchema, 
  insertVariantSchema, 
  insertAnnouncementSchema,
  insertRedeemCodeSchema,
  users, products, variants, orders, transactions, announcements
} from './schema.js';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/register',
      input: z.object({
        email: z.string().email(),
        password: z.string().min(12),
      }),
      responses: {
        201: z.custom<typeof users.$inferSelect & { loginCode: string }>(),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/login',
      input: z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout',
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/user',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  products: {
    list: {
      method: 'GET' as const,
      path: '/api/products',
      responses: {
        200: z.array(z.custom<typeof products.$inferSelect & { variants: (typeof variants.$inferSelect & { stockCount: number })[] }>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/products/:id',
      responses: {
        200: z.custom<typeof products.$inferSelect & { variants: (typeof variants.$inferSelect & { stockCount: number })[] }>(),
        404: errorSchemas.notFound,
      },
    },
    create: { // Admin only
      method: 'POST' as const,
      path: '/api/products',
      input: insertProductSchema,
      responses: {
        201: z.custom<typeof products.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  variants: {
    create: { // Admin only
      method: 'POST' as const,
      path: '/api/variants',
      input: insertVariantSchema,
      responses: {
        201: z.custom<typeof variants.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  stock: {
    add: { // Admin only
      method: 'POST' as const,
      path: '/api/stock',
      input: z.object({
        variantId: z.number(),
        rawContent: z.string(), // "3 lines = 1 item" logic handled on backend
      }),
      responses: {
        200: z.object({ addedCount: z.number() }),
        401: errorSchemas.unauthorized,
      },
    },
  },
  orders: {
    create: {
      method: 'POST' as const,
      path: '/api/orders',
      input: z.object({
        items: z.array(z.object({
          variantId: z.number(),
          quantity: z.number().min(1),
        })),
      }),
      responses: {
        201: z.custom<typeof orders.$inferSelect>(),
        400: errorSchemas.validation, // Insufficient balance or stock
        401: errorSchemas.unauthorized,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/orders',
      responses: {
        200: z.array(z.custom<typeof orders.$inferSelect & { items: any[] }>()),
        401: errorSchemas.unauthorized,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/orders/:id',
      responses: {
        200: z.custom<typeof orders.$inferSelect & { items: any[] }>(),
        404: errorSchemas.notFound,
      },
    },
  },
  wallet: {
    redeem: {
      method: 'POST' as const,
      path: '/api/wallet/redeem',
      input: z.object({
        code: z.string(),
      }),
      responses: {
        200: z.object({ newBalance: z.number(), amountAdded: z.number() }),
        400: z.object({ message: z.string() }), // Invalid code
      },
    },
    transactions: {
      method: 'GET' as const,
      path: '/api/wallet/transactions',
      responses: {
        200: z.array(z.custom<typeof transactions.$inferSelect>()),
      },
    },
  },
  games: {
    dice: {
      method: 'POST' as const,
      path: '/api/games/dice',
      input: z.object({
        betAmount: z.number().min(1), // in cents
      }),
      responses: {
        200: z.object({
          won: z.boolean(),
          roll: z.array(z.number()), // [3, 4]
          payout: z.number(),
          newBalance: z.number(),
        }),
        400: errorSchemas.validation,
      },
    },
    mines: {
      method: 'POST' as const,
      path: '/api/games/mines',
      input: z.object({
        betAmount: z.number().min(1),
        difficulty: z.enum(["simple", "extreme", "impossible"]),
      }),
      responses: {
        200: z.object({
          gameId: z.string(), // or session ID
          won: z.boolean(),
          payout: z.number(),
          newBalance: z.number(),
          grid: z.array(z.number()), // revealed grid (0=safe, 1=mine)
        }),
      },
    },
    plinko: {
      method: 'POST' as const,
      path: '/api/games/plinko',
      input: z.object({
        betAmount: z.number().int().min(1),
      }),
      responses: {
        200: z.object({
          path: z.array(z.number().int().min(0).max(1)),
          slot: z.number().int().min(0).max(8),
          multiplier: z.number(),
          payout: z.number(),
          profit: z.number(),
          newBalance: z.number(),
        }),
        400: errorSchemas.validation,
      },
    },
    spin: {
      method: 'POST' as const,
      path: '/api/games/spin',
      responses: {
        200: z.object({
          reward: z.number(),
          newBalance: z.number(),
        }),
        400: z.object({ message: z.string() }), // Already spun today
      },
    },
  },
  admin: {
    dashboard: {
      method: 'GET' as const,
      path: '/api/admin/dashboard',
      responses: {
        200: z.object({
          totalUsers: z.number(),
          totalSales: z.number(),
          storeBalance: z.number(),
          itemsInStock: z.number(),
          itemsSold: z.number(),
          stockWorth: z.number(),
        }),
        401: errorSchemas.unauthorized,
      },
    },
    deliverOrder: {
      method: 'POST' as const,
      path: '/api/admin/orders/:id/deliver',
      input: z.object({
        deliveryContent: z.string().min(1),
      }),
      responses: {
        200: z.custom<typeof orders.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    banUser: {
      method: 'POST' as const,
      path: '/api/admin/users/:id/ban',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    unbanUser: {
      method: 'POST' as const,
      path: '/api/admin/users/:id/unban',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    generateCodes: {
      method: 'POST' as const,
      path: '/api/admin/codes',
      input: z.object({
        amount: z.number().min(1),
        count: z.number().min(1).max(100),
      }),
      responses: {
        200: z.object({
          codes: z.array(z.string()),
        }),
      },
    },
    announcements: {
      create: {
        method: 'POST' as const,
        path: '/api/admin/announcements',
        input: insertAnnouncementSchema,
        responses: {
          201: z.custom<typeof announcements.$inferSelect>(),
        },
      },
      toggle: {
        method: 'PATCH' as const,
        path: '/api/admin/announcements/:id',
        input: z.object({ active: z.boolean() }),
        responses: {
          200: z.custom<typeof announcements.$inferSelect>(),
        },
      },
      delete: {
        method: 'DELETE' as const,
        path: '/api/admin/announcements/:id',
        responses: {
          200: z.object({ success: z.boolean() }),
        },
      },
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
