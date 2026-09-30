CREATE POLICY "lead photo upload" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'lead-photos');
CREATE POLICY "lead photo staff read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lead-photos' AND public.is_staff(auth.uid()));
CREATE POLICY "job photo staff write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'job-photos' AND public.is_staff(auth.uid()));
CREATE POLICY "job photo read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'job-photos' AND (public.is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.jobs j WHERE j.client_id = auth.uid() AND storage.objects.name LIKE j.id::text || '/%'
  )));
CREATE POLICY "job photo staff delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'job-photos' AND public.is_staff(auth.uid()));