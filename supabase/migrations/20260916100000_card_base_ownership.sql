ALTER TABLE public.card_bases
  ADD COLUMN IF NOT EXISTS owner_id integer REFERENCES public.users(id);

CREATE UNIQUE INDEX IF NOT EXISTS card_bases_owner_id_unique
  ON public.card_bases(owner_id);