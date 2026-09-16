-- TRENT HQ marketplace schema
-- Mirrors shared/schema.ts and the session table used by connect-pg-simple.
-- This migration is intentionally idempotent so it can be safely re-applied.

CREATE TABLE IF NOT EXISTS public.users (
  id serial PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password text NOT NULL DEFAULT '',
  login_code text NOT NULL DEFAULT '',
  email text NOT NULL UNIQUE,
  telegram_username text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_banned boolean NOT NULL DEFAULT false,
  is_worker boolean NOT NULL DEFAULT false,
  balance integer NOT NULL DEFAULT 0,
  protected_balance integer NOT NULL DEFAULT 0,
  last_daily_spin timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.uploaded_images (
  id serial PRIMARY KEY,
  filename text NOT NULL,
  mime_type text NOT NULL,
  data text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  image text DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.variants (
  id serial PRIMARY KEY,
  product_id integer NOT NULL REFERENCES public.products(id),
  name text NOT NULL,
  price integer NOT NULL,
  compare_price integer,
  min_quantity integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.stock_items (
  id serial PRIMARY KEY,
  variant_id integer NOT NULL REFERENCES public.variants(id),
  seller_id integer REFERENCES public.users(id),
  content text NOT NULL,
  is_sold boolean NOT NULL DEFAULT false,
  is_reserved boolean NOT NULL DEFAULT false,
  order_id integer,
  replacement_for_id integer,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id serial PRIMARY KEY,
  order_id text NOT NULL UNIQUE,
  user_id integer NOT NULL REFERENCES public.users(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'waiting_payment', 'delivering', 'fulfilled', 'refunded', 'replaced')),
  total integer NOT NULL,
  paid_amount integer NOT NULL DEFAULT 0,
  delivery_content text NOT NULL DEFAULT '',
  payment_method text NOT NULL DEFAULT '',
  payment_note text NOT NULL DEFAULT '',
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.card_bases (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  refundable boolean NOT NULL DEFAULT false,
  hr_percent integer NOT NULL DEFAULT 80,
  owner_id integer REFERENCES public.users(id),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cards (
  id serial PRIMARY KEY,
  card_number text NOT NULL,
  masked_card text NOT NULL,
  expiry text NOT NULL,
  cvv text NOT NULL,
  country text NOT NULL,
  extras text DEFAULT '',
  price integer NOT NULL,
  hr_percent integer NOT NULL DEFAULT 80,
  is_first_hand boolean NOT NULL DEFAULT false,
  is_sold boolean NOT NULL DEFAULT false,
  user_id integer REFERENCES public.users(id),
  bin_data jsonb DEFAULT null,
  base_id integer REFERENCES public.card_bases(id),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES public.orders(id),
  variant_id integer,
  stock_item_id integer REFERENCES public.stock_items(id),
  card_id integer REFERENCES public.cards(id),
  item_type text NOT NULL DEFAULT 'product',
  price integer NOT NULL,
  quantity integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.users(id),
  amount integer NOT NULL,
  type text NOT NULL,
  description text NOT NULL,
  payment_method text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.redeem_codes (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  amount integer NOT NULL,
  is_used boolean NOT NULL DEFAULT false,
  used_by integer REFERENCES public.users(id),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.discount_codes (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  type text NOT NULL,
  value integer NOT NULL,
  min_order integer DEFAULT 0,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id serial PRIMARY KEY,
  content text NOT NULL,
  link text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.users(id),
  order_id text NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  image_url text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'refunded', 'replaced', 'resolved')),
  admin_message text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.verifications (
  id serial PRIMARY KEY,
  user_id integer NOT NULL UNIQUE REFERENCES public.users(id),
  telegram_username text NOT NULL,
  channel_link text NOT NULL,
  channel_name text NOT NULL,
  agreed_to_terms boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'termed')),
  admin_note text NOT NULL DEFAULT '',
  term_message text NOT NULL DEFAULT '',
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_ips (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.users(id),
  ip text NOT NULL,
  logged_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mails (
  id serial PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL,
  sender_id integer NOT NULL REFERENCES public.users(id),
  recipient_id integer,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mail_reads (
  id serial PRIMARY KEY,
  mail_id integer NOT NULL REFERENCES public.mails(id),
  user_id integer NOT NULL REFERENCES public.users(id),
  read_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crypto_payments (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.users(id),
  forebit_payment_id text NOT NULL UNIQUE,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'expired', 'underpaid')),
  purpose text NOT NULL DEFAULT 'deposit'
    CHECK (purpose IN ('deposit', 'order')),
  order_id integer REFERENCES public.orders(id),
  checkout_url text,
  metadata text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seller_applications (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.users(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  seller_code text NOT NULL UNIQUE,
  note text NOT NULL DEFAULT '',
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.achs (
  id serial PRIMARY KEY,
  bank_name text NOT NULL,
  balance text NOT NULL,
  full_item text NOT NULL,
  price integer NOT NULL,
  is_sold boolean NOT NULL DEFAULT false,
  seller_id integer REFERENCES public.users(id),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crypto_addresses (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.users(id),
  currency text NOT NULL,
  address text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.telegram_chat_members (
  chat_id text PRIMARY KEY,
  telegram_username text,
  name_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_chat_referrals (
  id bigserial PRIMARY KEY,
  referrer_chat_id text NOT NULL,
  referred_chat_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_chat_referral_bonuses (
  id bigserial PRIMARY KEY,
  referrer_chat_id text NOT NULL,
  referral_id bigint NOT NULL UNIQUE REFERENCES public.telegram_chat_referrals(id),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_license_drops (
  id bigserial PRIMARY KEY,
  license_key text NOT NULL UNIQUE,
  created_by integer REFERENCES public.users(id),
  created_by_chat_id text,
  claimed_by integer REFERENCES public.users(id),
  claimed_chat_id text,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_license_claims (
  id bigserial PRIMARY KEY,
  chat_id text NOT NULL,
  user_id integer REFERENCES public.users(id),
  drop_id bigint NOT NULL UNIQUE REFERENCES public.telegram_license_drops(id),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  chat_referral_bonus_id bigint REFERENCES public.telegram_chat_referral_bonuses(id)
);

CREATE TABLE IF NOT EXISTS public.telegram_suspensions (
  chat_id text PRIMARY KEY,
  suspended_until timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS public.session (
  sid varchar NOT NULL PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_variants_product_id ON public.variants(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_variant_available
  ON public.stock_items(variant_id, is_sold, is_reserved);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id_created_at
  ON public.transactions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_ips_user_id ON public.user_ips(user_id);
CREATE INDEX IF NOT EXISTS idx_mail_reads_mail_user ON public.mail_reads(mail_id, user_id);
CREATE INDEX IF NOT EXISTS idx_session_expire ON public.session(expire);
CREATE INDEX IF NOT EXISTS telegram_license_drops_available_idx
  ON public.telegram_license_drops(id) WHERE claimed_by IS NULL;
CREATE INDEX IF NOT EXISTS telegram_license_claims_user_hour_idx
  ON public.telegram_license_claims(user_id, claimed_at);
CREATE INDEX IF NOT EXISTS telegram_license_claims_chat_hour_idx
  ON public.telegram_license_claims(chat_id, claimed_at);

-- Nothing is exposed to anonymous Supabase API clients by default.
-- The server-side application connection can still access these tables.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users', 'uploaded_images', 'products', 'variants', 'stock_items',
    'orders', 'card_bases', 'cards', 'order_items', 'transactions',
    'redeem_codes', 'discount_codes', 'announcements', 'support_tickets',
    'verifications', 'user_ips', 'mails', 'mail_reads', 'crypto_payments',
    'seller_applications', 'achs', 'crypto_addresses', 'site_settings',
    'telegram_chat_members', 'telegram_chat_referrals',
    'telegram_chat_referral_bonuses', 'telegram_license_drops',
    'telegram_license_claims', 'telegram_suspensions',
    'session'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;