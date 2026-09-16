ALTER TABLE public.card_bases
  ADD COLUMN IF NOT EXISTS refundable boolean NOT NULL DEFAULT false;