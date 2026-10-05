-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin','owner','supervisor','client');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','owner','supervisor'));
$$;

CREATE OR REPLACE FUNCTION public.is_office(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','owner'));
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone', NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "own profile write" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_office(auth.uid()));

-- SERVICE TYPES
CREATE TABLE public.service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'developers',
  description TEXT,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.service_types TO anon, authenticated;
GRANT ALL ON public.service_types TO service_role;
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service types public read" ON public.service_types FOR SELECT USING (true);
CREATE POLICY "office manage service types" ON public.service_types FOR ALL TO authenticated USING (public.is_office(auth.uid())) WITH CHECK (public.is_office(auth.uid()));

INSERT INTO public.service_types (name, description, icon, sort_order) VALUES
('Renovations','Full home and commercial renovations','Hammer',1),
('Building','New builds and extensions','Building2',2),
('Scheming','Plans, drawings and municipal scheming','Ruler',3),
('Plastering','Interior and exterior plastering','Layers',4),
('Plumbing','Installations, leaks and geysers','Droplets',5),
('Electrical','Certified electrical work and COCs','Zap',6),
('Electrical Gates','Sliding and swing gate installs','DoorOpen',7),
('Gate Motors','Supply, install and repair of gate motors','Cog',8),
('Paving','Driveways, walkways and patios','Grid3x3',9),
('Painting','Interior and exterior painting','Paintbrush',10),
('Waterproofing','Roofs, balconies and basements','Umbrella',11),
('Cabinet Making','Custom kitchens and vanities','Wrench',12),
('Built-In Cupboards','Bedroom and storage cupboards','Package',13);

-- SERVICE REQUESTS
CREATE TABLE public.service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE DEFAULT ('SR-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  service_types TEXT[] NOT NULL DEFAULT '{}',
  description TEXT NOT NULL,
  budget_range TEXT,
  preferred_start_date DATE,
  photo_paths TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','quoted','approved','converted','declined')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_requests TO authenticated;
GRANT INSERT ON public.service_requests TO anon;
GRANT ALL ON public.service_requests TO service_role;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can submit request" ON public.service_requests FOR INSERT TO anon, authenticated WITH CHECK (client_id IS NULL OR client_id = auth.uid());
CREATE POLICY "read own or staff" ON public.service_requests FOR SELECT TO authenticated USING (client_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "office update requests" ON public.service_requests FOR UPDATE TO authenticated USING (public.is_office(auth.uid())) WITH CHECK (public.is_office(auth.uid()));
CREATE POLICY "office delete requests" ON public.service_requests FOR DELETE TO authenticated USING (public.is_office(auth.uid()));
CREATE TRIGGER sr_updated BEFORE UPDATE ON public.service_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PROPERTY SUBMISSIONS
CREATE TABLE public.property_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE DEFAULT ('PS-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  property_type TEXT NOT NULL DEFAULT 'house' CHECK (property_type IN ('house','flat','vacant_land','incomplete_build','estate_property','commercial','other')),
  condition TEXT NOT NULL DEFAULT 'fair' CHECK (condition IN ('good','fair','poor','derelict')),
  bedrooms INT,
  bathrooms INT,
  erf_size TEXT,
  asking_price NUMERIC(14,2),
  description TEXT,
  reason_for_selling TEXT,
  photo_paths TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','viewing_booked','offer_made','accepted','declined','purchased')),
  offer_amount NUMERIC(14,2),
  offer_notes TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_submissions TO authenticated;
GRANT INSERT ON public.property_submissions TO anon;
GRANT ALL ON public.property_submissions TO service_role;
ALTER TABLE public.property_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can submit property" ON public.property_submissions FOR INSERT TO anon, authenticated WITH CHECK (client_id IS NULL OR client_id = auth.uid());
CREATE POLICY "read own or staff props" ON public.property_submissions FOR SELECT TO authenticated USING (client_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "office update props" ON public.property_submissions FOR UPDATE TO authenticated USING (public.is_office(auth.uid())) WITH CHECK (public.is_office(auth.uid()));
CREATE POLICY "office delete props" ON public.property_submissions FOR DELETE TO authenticated USING (public.is_office(auth.uid()));
CREATE TRIGGER ps_updated BEFORE UPDATE ON public.property_submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- JOBS
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE DEFAULT ('JOB-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  service_request_id UUID REFERENCES public.service_requests(id) ON DELETE SET NULL,
  client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  title TEXT NOT NULL,
  description TEXT,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  service_types TEXT[] NOT NULL DEFAULT '{}',
  supervisor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'quoted' CHECK (status IN ('quoted','approved','in_progress','on_hold','complete','cancelled')),
  progress INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  quote_amount NUMERIC(14,2),
  start_date DATE,
  target_end_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs read" ON public.jobs FOR SELECT TO authenticated USING (client_id = auth.uid() OR supervisor_id = auth.uid() OR public.is_office(auth.uid()));
CREATE POLICY "office insert jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (public.is_office(auth.uid()));
CREATE POLICY "jobs update" ON public.jobs FOR UPDATE TO authenticated USING (public.is_office(auth.uid()) OR supervisor_id = auth.uid()) WITH CHECK (public.is_office(auth.uid()) OR supervisor_id = auth.uid());
CREATE POLICY "office delete jobs" ON public.jobs FOR DELETE TO authenticated USING (public.is_office(auth.uid()));
CREATE TRIGGER jobs_updated BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- JOB STATUS HISTORY
CREATE TABLE public.job_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.job_status_history TO authenticated;
GRANT ALL ON public.job_status_history TO service_role;
ALTER TABLE public.job_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "history read" ON public.job_status_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND (j.client_id = auth.uid() OR j.supervisor_id = auth.uid() OR public.is_office(auth.uid()))));
CREATE POLICY "history insert" ON public.job_status_history FOR INSERT TO authenticated WITH CHECK (changed_by = auth.uid() AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND (j.supervisor_id = auth.uid() OR public.is_office(auth.uid()))));

-- JOB PHOTOS
CREATE TABLE public.job_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  stage TEXT NOT NULL DEFAULT 'progress' CHECK (stage IN ('before','progress','after')),
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.job_photos TO authenticated;
GRANT ALL ON public.job_photos TO service_role;
ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photos read" ON public.job_photos FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND (j.client_id = auth.uid() OR j.supervisor_id = auth.uid() OR public.is_office(auth.uid()))));
CREATE POLICY "photos insert" ON public.job_photos FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid() AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND (j.supervisor_id = auth.uid() OR public.is_office(auth.uid()))));
CREATE POLICY "photos delete" ON public.job_photos FOR DELETE TO authenticated USING (public.is_office(auth.uid()) OR uploaded_by = auth.uid());

-- QUOTES
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT NOT NULL UNIQUE DEFAULT ('Q-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  service_request_id UUID REFERENCES public.service_requests(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  vat NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  valid_until DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','approved','declined','expired')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quotes read" ON public.quotes FOR SELECT TO authenticated USING (client_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "office insert quotes" ON public.quotes FOR INSERT TO authenticated WITH CHECK (public.is_office(auth.uid()));
CREATE POLICY "quotes update" ON public.quotes FOR UPDATE TO authenticated USING (public.is_office(auth.uid()) OR client_id = auth.uid()) WITH CHECK (public.is_office(auth.uid()) OR client_id = auth.uid());
CREATE POLICY "office delete quotes" ON public.quotes FOR DELETE TO authenticated USING (public.is_office(auth.uid()));
CREATE TRIGGER quotes_updated BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BOOKINGS
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE DEFAULT ('BK-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  booking_type TEXT NOT NULL DEFAULT 'site_visit' CHECK (booking_type IN ('site_visit','renovation_start','property_viewing','consultation')),
  client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  scheduled_date DATE NOT NULL,
  scheduled_time TEXT NOT NULL DEFAULT '09:00',
  notes TEXT,
  service_request_id UUID REFERENCES public.service_requests(id) ON DELETE SET NULL,
  property_submission_id UUID REFERENCES public.property_submissions(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','confirmed','completed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT INSERT ON public.bookings TO anon;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can book" ON public.bookings FOR INSERT TO anon, authenticated WITH CHECK (client_id IS NULL OR client_id = auth.uid());
CREATE POLICY "bookings read" ON public.bookings FOR SELECT TO authenticated USING (client_id = auth.uid() OR assigned_to = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "bookings update" ON public.bookings FOR UPDATE TO authenticated USING (public.is_office(auth.uid()) OR assigned_to = auth.uid()) WITH CHECK (public.is_office(auth.uid()) OR assigned_to = auth.uid());
CREATE POLICY "office delete bookings" ON public.bookings FOR DELETE TO authenticated USING (public.is_office(auth.uid()));
CREATE TRIGGER bookings_updated BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_jobs_supervisor ON public.jobs(supervisor_id);
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_sr_status ON public.service_requests(status);
CREATE INDEX idx_ps_status ON public.property_submissions(status);
CREATE INDEX idx_bookings_date ON public.bookings(scheduled_date);