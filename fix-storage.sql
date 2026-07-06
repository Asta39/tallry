-- Create the "logos" bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files to "logos"
CREATE POLICY "Allow auth upload to logos" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos');

-- Allow authenticated users to update their files in "logos"
CREATE POLICY "Allow auth update to logos" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'logos');

-- Allow anyone to view logos
CREATE POLICY "Allow public read logos" ON storage.objects
FOR SELECT USING (bucket_id = 'logos');

-- Allow users to delete their own files
CREATE POLICY "Allow auth delete logos" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'logos');
