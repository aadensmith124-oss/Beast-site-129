ALTER TABLE public.card_bases
  ADD COLUMN IF NOT EXISTS hr_percent integer NOT NULL DEFAULT 80;