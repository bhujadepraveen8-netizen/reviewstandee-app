export const SUPABASE_SQL_SCHEMA = `-- ==============================================================================
-- HeReview SaaS Database Schema & Row Level Security (RLS) Setup
-- Run this in your Supabase Dashboard -> SQL Editor
-- Tables: businesses, reviews_and_feedback (Verified actual schema)
-- ==============================================================================

-- 1. Create or update businesses table
CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    address TEXT,
    phone TEXT,
    logo_url TEXT,
    google_review_url TEXT NOT NULL,
    accent_color TEXT DEFAULT '#2563EB',
    active BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all compatible columns exist in existing tables
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Restaurant';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#2563EB';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS place_id TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
UPDATE public.businesses SET business_name = name WHERE business_name IS NULL AND name IS NOT NULL;
UPDATE public.businesses SET name = business_name WHERE name IS NULL AND business_name IS NOT NULL;

-- Safe migration for businesses category constraint (preserves existing records & allows new client categories)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.businesses'::regclass 
    AND contype = 'c' 
    AND conname LIKE '%category%'
  ) THEN
    ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_category_check;
  END IF;
END $$;

-- 2. Create or update reviews_and_feedback table (verified actual schema)
CREATE TABLE IF NOT EXISTS public.reviews_and_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    comment TEXT,
    customer_name TEXT,
    customer_contact TEXT,
    table_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create or update qr_events table (tracks table standee scans & page visits)
CREATE TABLE IF NOT EXISTS public.qr_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL DEFAULT 'scan' CHECK (event_type IN ('scan', 'view')),
    table_number TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.qr_events ADD COLUMN IF NOT EXISTS table_number TEXT;
ALTER TABLE public.qr_events ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- 4. Create or update feedback table (ratings 1-5 + customer sentiment)
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    customer_name TEXT,
    customer_contact TEXT,
    table_number TEXT,
    is_positive BOOLEAN GENERATED ALWAYS AS (rating >= 4) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS customer_contact TEXT;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS table_number TEXT;

-- 5. Create or update complaints table (private issues intercepted away from Google)
CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT 'Service',
    message TEXT NOT NULL DEFAULT '',
    customer_name TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    table_number TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'resolved')),
    manager_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS issue TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Service';
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS message TEXT DEFAULT '';
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS table_number TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS manager_notes TEXT;

-- 6. Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'canceled')),
    period_start TIMESTAMPTZ DEFAULT NOW(),
    period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    monthly_price NUMERIC(10, 2) DEFAULT 49.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial restaurant if table is empty
INSERT INTO public.businesses (id, name, slug, google_review_url)
VALUES (
    'b1111111-1111-1111-1111-111111111111',
    'Bella Vista Bistro',
    'bella-vista',
    'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4'
)
ON CONFLICT (slug) DO NOTHING;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_businesses_slug ON public.businesses(slug);
CREATE INDEX IF NOT EXISTS idx_qr_events_business ON public.qr_events(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_business ON public.feedback(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_business ON public.complaints(business_id, created_at DESC);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES & PERMISSIONS
-- ==============================================================================

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews_and_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Grant schema access to anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT SELECT ON public.businesses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews_and_feedback TO authenticated;
GRANT INSERT ON public.reviews_and_feedback TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_events TO authenticated;
GRANT SELECT, INSERT ON public.qr_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback TO authenticated;
GRANT SELECT, INSERT ON public.feedback TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaints TO authenticated;
GRANT SELECT, INSERT ON public.complaints TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;

-- Helper function to check if current user is platform founder
CREATE OR REPLACE FUNCTION public.is_founder()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    (auth.jwt() ->> 'email' = 'kumarharishbhai34@gmail.com')
    OR ((auth.jwt() -> 'user_metadata' ->> 'role') = 'founder')
    OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'founder')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------
-- 1. Businesses Policies
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view active businesses" ON public.businesses;
CREATE POLICY "Public can view active businesses"
ON public.businesses FOR SELECT TO anon, authenticated
USING (COALESCE(is_active, active, true) = true);

DROP POLICY IF EXISTS "Owners manage their own business" ON public.businesses;
CREATE POLICY "Owners manage their own business"
ON public.businesses FOR ALL TO authenticated
USING (
  owner_id = auth.uid() 
  OR public.is_founder()
  OR (owner_id IS NULL AND auth.role() = 'authenticated')
);

DROP POLICY IF EXISTS "Allow authenticated to insert businesses" ON public.businesses;
CREATE POLICY "Allow authenticated to insert businesses"
ON public.businesses FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Founders and owners can delete businesses" ON public.businesses;
CREATE POLICY "Founders and owners can delete businesses"
ON public.businesses FOR DELETE TO authenticated
USING (
  owner_id = auth.uid()
  OR public.is_founder()
  OR (owner_id IS NULL AND auth.role() = 'authenticated')
);

-- -------------------------------------------------------------
-- 2. Reviews & Feedback Policies (Verified Schema)
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "Public can submit reviews_and_feedback" ON public.reviews_and_feedback;
CREATE POLICY "Public can submit reviews_and_feedback"
ON public.reviews_and_feedback FOR INSERT TO anon, authenticated
WITH CHECK (business_id IS NOT NULL);

DROP POLICY IF EXISTS "Founders and owners can select reviews_and_feedback" ON public.reviews_and_feedback;
CREATE POLICY "Founders and owners can select reviews_and_feedback"
ON public.reviews_and_feedback FOR SELECT TO authenticated
USING (
  public.is_founder()
  OR EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = reviews_and_feedback.business_id
    AND (b.owner_id = auth.uid() OR b.owner_id IS NULL)
  )
);

-- -------------------------------------------------------------
-- 3. QR Events Policies (Public Diners insert scans, Owners view)
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "Public can record QR scans" ON public.qr_events;
CREATE POLICY "Public can record QR scans"
ON public.qr_events FOR INSERT TO anon, authenticated
WITH CHECK (
    event_type IN ('scan', 'view')
    AND business_id IS NOT NULL
);

DROP POLICY IF EXISTS "Owners view their business qr events" ON public.qr_events;
CREATE POLICY "Owners view their business qr events"
ON public.qr_events FOR SELECT TO authenticated
USING (business_id = public.get_user_business_id() OR public.is_founder());

-- -------------------------------------------------------------
-- 4. Feedback Policies (Public Diners insert ratings, Owners view)
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "Public can submit feedback" ON public.feedback;
CREATE POLICY "Public can submit feedback"
ON public.feedback FOR INSERT TO anon, authenticated
WITH CHECK (
    rating >= 1 AND rating <= 5
    AND business_id IS NOT NULL
);

DROP POLICY IF EXISTS "Owners view own business feedback" ON public.feedback;
CREATE POLICY "Owners view own business feedback"
ON public.feedback FOR SELECT TO authenticated
USING (business_id = public.get_user_business_id() OR public.is_founder());

-- -------------------------------------------------------------
-- 5. Complaints Policies (Public Diners insert complaints, Owners view)
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "Public can submit complaints" ON public.complaints;
CREATE POLICY "Public can submit complaints"
ON public.complaints FOR INSERT TO anon, authenticated
WITH CHECK (
    status = 'new'
    AND business_id IS NOT NULL
);

DROP POLICY IF EXISTS "Owners view and manage own complaints" ON public.complaints;
CREATE POLICY "Owners view and manage own complaints"
ON public.complaints FOR ALL TO authenticated
USING (business_id = public.get_user_business_id() OR public.is_founder());

-- -------------------------------------------------------------
-- 6. Subscriptions Policies
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "Owners view their own subscriptions" ON public.subscriptions;
CREATE POLICY "Owners view their own subscriptions"
ON public.subscriptions FOR SELECT TO authenticated
USING (business_id = public.get_user_business_id() OR public.is_founder());

DROP POLICY IF EXISTS "Founders manage subscriptions" ON public.subscriptions;
CREATE POLICY "Founders manage subscriptions"
ON public.subscriptions FOR ALL TO authenticated
USING (public.is_founder());

-- -------------------------------------------------------------
-- 7. Transactional Business Deletion Function
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_business_permanently(p_business_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_founder BOOLEAN;
  v_biz_name TEXT;
  v_feedback_count INT := 0;
  v_complaints_count INT := 0;
  v_scans_count INT := 0;
  v_subs_count INT := 0;
BEGIN
  -- 1. Authorization check: user must be founder or owner
  SELECT (
    (auth.jwt() ->> 'email' = 'kumarharishbhai34@gmail.com')
    OR ((auth.jwt() -> 'user_metadata' ->> 'role') = 'founder')
    OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'founder')
    OR EXISTS (SELECT 1 FROM public.businesses WHERE id = p_business_id AND (owner_id = auth.uid() OR owner_id IS NULL))
  ) INTO v_is_founder;

  IF NOT v_is_founder THEN
    RAISE EXCEPTION 'Unauthorized: Only platform founders or business owners can permanently delete this business.';
  END IF;

  -- 2. Verify business exists
  SELECT name INTO v_biz_name FROM public.businesses WHERE id = p_business_id;
  IF v_biz_name IS NULL THEN
    RAISE EXCEPTION 'Business not found with ID %', p_business_id;
  END IF;

  -- 4. Count and delete exclusive dependent records belonging solely to this business
  SELECT count(*) INTO v_feedback_count FROM public.feedback WHERE business_id = p_business_id;
  DELETE FROM public.feedback WHERE business_id = p_business_id;

  SELECT count(*) INTO v_complaints_count FROM public.complaints WHERE business_id = p_business_id;
  DELETE FROM public.complaints WHERE business_id = p_business_id;

  SELECT count(*) INTO v_scans_count FROM public.qr_events WHERE business_id = p_business_id;
  DELETE FROM public.qr_events WHERE business_id = p_business_id;

  SELECT count(*) INTO v_subs_count FROM public.subscriptions WHERE business_id = p_business_id;
  DELETE FROM public.subscriptions WHERE business_id = p_business_id;

  -- 5. Delete the business row
  DELETE FROM public.businesses WHERE id = p_business_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_id', p_business_id,
    'deleted_name', v_biz_name,
    'feedback_deleted', v_feedback_count,
    'complaints_deleted', v_complaints_count,
    'scans_deleted', v_scans_count,
    'subscriptions_deleted', v_subs_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_business_permanently(UUID) TO authenticated;
`;

export const GUEST_QR_FIX_SQL = `-- ==============================================================================
-- HeReview: Guest QR & Feedback RLS Fix Script
-- Run this in your Supabase Dashboard -> SQL Editor to resolve:
-- "new row violates row-level security policy for table 'qr_events'"
-- ==============================================================================

-- 1. Ensure the default restaurant exists in businesses table so foreign keys work
INSERT INTO public.businesses (id, name, slug, google_review_url)
VALUES (
    'b1111111-1111-1111-1111-111111111111',
    'Bella Vista Bistro',
    'bella-vista',
    'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4'
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Grant table schema permissions to anon (guest diners) and authenticated users
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT ON public.qr_events TO anon, authenticated;
GRANT SELECT, INSERT ON public.feedback TO anon, authenticated;
GRANT SELECT, INSERT ON public.complaints TO anon, authenticated;
GRANT SELECT ON public.businesses TO anon, authenticated;

-- 3. Enable RLS on the tables
ALTER TABLE public.qr_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- 4. Safe INSERT policy for QR scan events (adhering to event_type check constraint)
DROP POLICY IF EXISTS "Public can record QR scans" ON public.qr_events;
CREATE POLICY "Public can record QR scans"
ON public.qr_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
    event_type IN ('scan', 'view')
    AND business_id IS NOT NULL
);

-- 5. Safe INSERT policy for Diner Feedback (rating 1-5 constraint)
DROP POLICY IF EXISTS "Public can submit feedback" ON public.feedback;
CREATE POLICY "Public can submit feedback"
ON public.feedback
FOR INSERT
TO anon, authenticated
WITH CHECK (
    rating >= 1 AND rating <= 5
    AND business_id IS NOT NULL
);

-- 6. Safe INSERT policy for Diner Private Complaints
DROP POLICY IF EXISTS "Public can submit complaints" ON public.complaints;
CREATE POLICY "Public can submit complaints"
ON public.complaints
FOR INSERT
TO anon, authenticated
WITH CHECK (
    status = 'new'
    AND business_id IS NOT NULL
);

-- 7. Public SELECT policy for active businesses
DROP POLICY IF EXISTS "Public can view active businesses" ON public.businesses;
CREATE POLICY "Public can view active businesses"
ON public.businesses
FOR SELECT
TO anon, authenticated
USING (active = true OR active IS NULL);
`;

export const FOUNDER_DELETE_RLS_FIX_SQL = `-- ==============================================================================
-- HeReview: Founder Admin Access & RLS Fix Script (Verified Schema)
-- Run this in your Supabase Dashboard -> SQL Editor
-- Tables: public.businesses & public.reviews_and_feedback ONLY
-- Authorized Founder Admin Account: kumarharishbhai34@gmail.com
-- (Strictly removes all references to nonexistent public.profiles table)
-- ==============================================================================

-- 1. Grant table schema permissions to authenticated and anon users
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT SELECT ON public.businesses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews_and_feedback TO authenticated;
GRANT INSERT ON public.reviews_and_feedback TO anon;

-- 2. Ensure Row Level Security remains strictly ENABLED (anti-bypass)
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews_and_feedback ENABLE ROW LEVEL SECURITY;

-- 3. Replace is_founder() helper function using auth.jwt() directly (zero tables required)
CREATE OR REPLACE FUNCTION public.is_founder()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    (auth.jwt() ->> 'email' = 'kumarharishbhai34@gmail.com')
    OR ((auth.jwt() -> 'user_metadata' ->> 'role') = 'founder')
    OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'founder')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Clean up any obsolete functions that might query the nonexistent public.profiles table
DROP FUNCTION IF EXISTS public.get_user_business_id();

-- 5. Drop previous conflicting policies on public.businesses
DROP POLICY IF EXISTS "Public can view active businesses" ON public.businesses;
DROP POLICY IF EXISTS "Public can view active businesses anon" ON public.businesses;
DROP POLICY IF EXISTS "Owners manage their own business" ON public.businesses;
DROP POLICY IF EXISTS "Allow authenticated to insert businesses" ON public.businesses;
DROP POLICY IF EXISTS "Founders and owners can insert businesses" ON public.businesses;
DROP POLICY IF EXISTS "Founders and owners can update businesses" ON public.businesses;
DROP POLICY IF EXISTS "Founders and owners can delete businesses" ON public.businesses;
DROP POLICY IF EXISTS "Founders and owners can view businesses" ON public.businesses;
DROP POLICY IF EXISTS "Founders and owners can select businesses" ON public.businesses;
DROP POLICY IF EXISTS "Allow authenticated to select businesses" ON public.businesses;

-- 6. Configure Strict RLS Policies on public.businesses
-- 6a. Anonymous Diners: Can only view active businesses on review landing pages
CREATE POLICY "Public can view active businesses"
ON public.businesses
FOR SELECT
TO anon
USING (COALESCE(is_active, active, true) = true);

-- 6b. Authenticated Users SELECT:
-- Strictly restricted to Founder Admin (kumarharishbhai34@gmail.com / founder role in JWT),
-- or business owners for their own business (owner_id = auth.uid()),
-- or unassigned businesses (owner_id IS NULL)
CREATE POLICY "Founders and owners can select businesses"
ON public.businesses
FOR SELECT
TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'kumarharishbhai34@gmail.com')
  OR ((auth.jwt() -> 'user_metadata' ->> 'role') = 'founder')
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'founder')
  OR (owner_id IS NOT NULL AND owner_id = auth.uid())
  OR (owner_id IS NULL)
);

-- 6c. Authenticated Users INSERT:
CREATE POLICY "Founders and owners can insert businesses"
ON public.businesses
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt() ->> 'email' = 'kumarharishbhai34@gmail.com')
  OR ((auth.jwt() -> 'user_metadata' ->> 'role') = 'founder')
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'founder')
  OR (owner_id IS NOT NULL AND owner_id = auth.uid())
  OR (owner_id IS NULL)
);

-- 6d. Authenticated Users UPDATE:
CREATE POLICY "Founders and owners can update businesses"
ON public.businesses
FOR UPDATE
TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'kumarharishbhai34@gmail.com')
  OR ((auth.jwt() -> 'user_metadata' ->> 'role') = 'founder')
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'founder')
  OR (owner_id IS NOT NULL AND owner_id = auth.uid())
  OR (owner_id IS NULL)
);

-- 6e. Authenticated Users DELETE:
CREATE POLICY "Founders and owners can delete businesses"
ON public.businesses
FOR DELETE
TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'kumarharishbhai34@gmail.com')
  OR ((auth.jwt() -> 'user_metadata' ->> 'role') = 'founder')
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'founder')
  OR (owner_id IS NOT NULL AND owner_id = auth.uid())
  OR (owner_id IS NULL)
);

-- 7. Configure Strict RLS Policies on public.reviews_and_feedback
DROP POLICY IF EXISTS "Public can submit reviews_and_feedback" ON public.reviews_and_feedback;
DROP POLICY IF EXISTS "Allow authenticated to select reviews_and_feedback" ON public.reviews_and_feedback;
DROP POLICY IF EXISTS "Founders and owners can select reviews_and_feedback" ON public.reviews_and_feedback;
DROP POLICY IF EXISTS "Founders and owners can delete reviews_and_feedback" ON public.reviews_and_feedback;

-- 7a. Anonymous Diners: Can insert review feedback
CREATE POLICY "Public can submit reviews_and_feedback"
ON public.reviews_and_feedback
FOR INSERT
TO anon, authenticated
WITH CHECK (business_id IS NOT NULL);

-- 7b. Authenticated Users SELECT: Founder Admin or business owner
CREATE POLICY "Founders and owners can select reviews_and_feedback"
ON public.reviews_and_feedback
FOR SELECT
TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'kumarharishbhai34@gmail.com')
  OR ((auth.jwt() -> 'user_metadata' ->> 'role') = 'founder')
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'founder')
  OR EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = reviews_and_feedback.business_id
    AND (b.owner_id = auth.uid() OR b.owner_id IS NULL)
  )
);

-- 7c. Authenticated Users DELETE: Founder Admin or business owner
CREATE POLICY "Founders and owners can delete reviews_and_feedback"
ON public.reviews_and_feedback
FOR DELETE
TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'kumarharishbhai34@gmail.com')
  OR ((auth.jwt() -> 'user_metadata' ->> 'role') = 'founder')
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'founder')
  OR EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = reviews_and_feedback.business_id
    AND (b.owner_id = auth.uid() OR b.owner_id IS NULL)
  )
);

-- 8. Safe Foreign Key Cascade from reviews_and_feedback to businesses
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT tc.constraint_name INTO v_constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'reviews_and_feedback'
    AND kcu.column_name = 'business_id'
    AND ccu.table_name = 'businesses';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.reviews_and_feedback DROP CONSTRAINT ' || quote_ident(v_constraint_name);
    EXECUTE 'ALTER TABLE public.reviews_and_feedback ADD CONSTRAINT ' || quote_ident(v_constraint_name) ||
            ' FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Foreign key check notice: %', SQLERRM;
END $$;

-- 9. Transactional Deletion RPC function (compatible strictly with actual schema)
CREATE OR REPLACE FUNCTION public.delete_business_permanently(p_business_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_authorized BOOLEAN;
  v_biz_name TEXT;
  v_reviews_count INT := 0;
BEGIN
  -- Authorization check: Founder Admin or Business Owner
  SELECT (
    (auth.jwt() ->> 'email' = 'kumarharishbhai34@gmail.com')
    OR ((auth.jwt() -> 'user_metadata' ->> 'role') = 'founder')
    OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'founder')
    OR EXISTS (
      SELECT 1 FROM public.businesses 
      WHERE id = p_business_id 
      AND (owner_id = auth.uid() OR owner_id IS NULL)
    )
  ) INTO v_is_authorized;

  IF NOT COALESCE(v_is_authorized, false) THEN
    RAISE EXCEPTION 'Unauthorized: Caller (%) is not authorized as Founder Admin or business owner.', 
      COALESCE(auth.jwt() ->> 'email', 'anonymous');
  END IF;

  -- Verify business exists
  SELECT COALESCE(name, business_name, 'Unknown Business') INTO v_biz_name 
  FROM public.businesses 
  WHERE id = p_business_id;

  IF v_biz_name IS NULL THEN
    RAISE EXCEPTION 'Business not found with ID %', p_business_id;
  END IF;

  -- Delete dependent records belonging exclusively to this business in reviews_and_feedback
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'reviews_and_feedback' 
      AND column_name = 'business_id'
  ) THEN
    DELETE FROM public.reviews_and_feedback WHERE business_id = p_business_id;
    GET DIAGNOSTICS v_reviews_count = ROW_COUNT;
  END IF;

  -- Delete the business row permanently (all unrelated businesses and records preserved)
  DELETE FROM public.businesses WHERE id = p_business_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_id', p_business_id,
    'deleted_name', v_biz_name,
    'reviews_and_feedback_deleted', v_reviews_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_business_permanently(UUID) TO authenticated;
`;

export const FOUNDER_ADMIN_RLS_FIX_SQL = FOUNDER_DELETE_RLS_FIX_SQL;


