-- Agents count as staff
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','owner','supervisor','agent'));
$$;

CREATE OR REPLACE FUNCTION public.is_agent(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','owner','agent'));
$$;

-- LISTINGS
CREATE TABLE public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL DEFAULT ('LST-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  title text NOT NULL,
  address text NOT NULL,
  suburb text,
  city text,
  latitude double precision,
  longitude double precision,
  property_type text NOT NULL DEFAULT 'house',
  condition text NOT NULL DEFAULT 'fair',
  bedrooms integer,
  bathrooms integer,
  erf_size text,
  price numeric NOT NULL DEFAULT 0,
  description text,
  photo_paths text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'published',
  agent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  agent_name text NOT NULL DEFAULT 'Prop3000 Investments',
  agent_phone text NOT NULL DEFAULT '081 253 4300',
  agent_email text NOT NULL DEFAULT 'info@prop3000.co.za',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public listings read" ON public.listings FOR SELECT TO anon, authenticated USING (status <> 'draft');
CREATE POLICY "agents read all listings" ON public.listings FOR SELECT TO authenticated USING (public.is_agent(auth.uid()));
CREATE POLICY "agents insert listings" ON public.listings FOR INSERT TO authenticated WITH CHECK (public.is_agent(auth.uid()));
CREATE POLICY "agents update listings" ON public.listings FOR UPDATE TO authenticated USING (public.is_agent(auth.uid())) WITH CHECK (public.is_agent(auth.uid()));
CREATE POLICY "office delete listings" ON public.listings FOR DELETE TO authenticated USING (public.is_office(auth.uid()));
CREATE TRIGGER listings_updated BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- OFFERS
CREATE TABLE public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL DEFAULT ('OF-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  client_email text NOT NULL,
  client_phone text,
  amount numeric NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending',
  counter_amount numeric,
  agent_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offers read" ON public.offers FOR SELECT TO authenticated USING (client_id = auth.uid() OR public.is_agent(auth.uid()));
CREATE POLICY "offers insert own" ON public.offers FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid());
CREATE POLICY "offers update" ON public.offers FOR UPDATE TO authenticated USING (client_id = auth.uid() OR public.is_agent(auth.uid())) WITH CHECK (client_id = auth.uid() OR public.is_agent(auth.uid()));
CREATE TRIGGER offers_updated BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- OFFER EVENTS
CREATE TABLE public.offer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  amount numeric,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.offer_events TO authenticated;
GRANT ALL ON public.offer_events TO service_role;
ALTER TABLE public.offer_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offer events read" ON public.offer_events FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_events.offer_id AND (o.client_id = auth.uid() OR public.is_agent(auth.uid())))
);
CREATE POLICY "offer events insert" ON public.offer_events FOR INSERT TO authenticated WITH CHECK (
  actor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_events.offer_id AND (o.client_id = auth.uid() OR public.is_agent(auth.uid())))
);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  link text,
  offer_id uuid REFERENCES public.offers(id) ON DELETE CASCADE,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Auto-notify buyer on offer status change
CREATE OR REPLACE FUNCTION public.notify_offer_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t text; b text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    t := 'Offer ' || NEW.reference || ' submitted';
    b := 'We received your offer. An agent will review it shortly.';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    t := 'Offer ' || NEW.reference || ' is now ' || NEW.status;
    b := CASE NEW.status
      WHEN 'approved' THEN 'Your offer was approved. The agent''s contact details are now available on your offer.'
      WHEN 'countered' THEN 'The agent countered your offer. Open your offer to respond.'
      WHEN 'declined' THEN 'Unfortunately your offer was declined.'
      ELSE 'Your offer status changed to ' || NEW.status || '.' END;
  ELSE
    RETURN NEW;
  END IF;
  INSERT INTO public.notifications (user_id, title, body, link, offer_id)
  VALUES (NEW.client_id, t, b, '/offers', NEW.id);
  RETURN NEW;
END; $$;
CREATE TRIGGER offers_notify AFTER INSERT OR UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.notify_offer_status();

-- Sample listings
INSERT INTO public.listings (title, address, suburb, city, latitude, longitude, property_type, condition, bedrooms, bathrooms, erf_size, price, description, status) VALUES
('3-bed fixer-upper with big erf', '14 Protea Street, Kuils River', 'Kuils River', 'Cape Town', -33.9270, 18.6800, 'house', 'poor', 3, 1, '620 m²', 895000, 'Solid structure needing a full interior renovation. Roof and plumbing already assessed.', 'published'),
('Incomplete double-storey build', '8 Kruispad, Brackenfell', 'Brackenfell', 'Cape Town', -33.8710, 18.6960, 'house', 'incomplete', 4, 3, '740 m²', 1650000, 'Construction stopped at second-floor slab. Plans approved and included in the sale.', 'published'),
('Late estate cottage, sold as-is', '22 Vygie Road, Bellville', 'Bellville', 'Cape Town', -33.8985, 18.6292, 'house', 'fair', 2, 1, '480 m²', 720000, 'Deceased estate. Cosmetic work only — great first renovation flip.', 'published'),
('Fire-damaged townhouse', 'Unit 6, Aloe Mews, Durbanville', 'Durbanville', 'Cape Town', -33.8330, 18.6500, 'townhouse', 'poor', 3, 2, '210 m²', 640000, 'Kitchen and one bedroom fire damaged. Body corporate approved rebuild.', 'published'),
('Vacant flat needing full strip-out', '3rd Floor, Marine Court, Goodwood', 'Goodwood', 'Cape Town', -33.9060, 18.5560, 'apartment', 'poor', 2, 1, 'Sectional title', 495000, 'Vandalised and stripped. Priced for a quick cash sale.', 'published'),
('Large corner plot with old dwelling', '1 Nooiensfontein Road, Blue Downs', 'Blue Downs', 'Cape Town', -34.0000, 18.6740, 'land', 'poor', 2, 1, '1 100 m²', 1250000, 'Rezoning potential. Existing dwelling is habitable but dated.', 'published');