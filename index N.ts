import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Standard CORS headers for Supabase Edge Functions
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let placeId: string | null = null;
    let businessId: string | null = null;

    // Parse input from JSON body or URL search params
    if (req.method === "POST") {
      try {
        const body = await req.json();
        placeId = body.placeId || body.place_id || null;
        businessId = body.businessId || body.business_id || null;
      } catch {
        // Body might be empty
      }
    } else if (req.method === "GET") {
      const url = new URL(req.url);
      placeId = url.searchParams.get("placeId") || url.searchParams.get("place_id");
      businessId = url.searchParams.get("businessId") || url.searchParams.get("business_id");
    }

    // If businessId is provided without placeId, look up the business in Supabase
    if (!placeId && businessId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

      if (supabaseUrl && supabaseAnonKey) {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const { data: business, error: dbErr } = await supabase
          .from("businesses")
          .select("id, name, place_id, google_review_url")
          .eq("id", businessId)
          .maybeSingle();

        if (!dbErr && business) {
          if (business.place_id) {
            placeId = business.place_id;
          } else if (business.google_review_url) {
            // Auto-extract place ID if present in google_review_url parameter
            const match = business.google_review_url.match(/placeid=([A-Za-z0-9_-]+)/i);
            if (match && match[1]) {
              placeId = match[1];
            }
          }
        }
      }
    }

    // Validate that we have a Place ID
    if (!placeId || typeof placeId !== "string" || placeId.trim() === "") {
      return new Response(
        JSON.stringify({
          error: "Missing Google Place ID. Please ensure the business has 'place_id' saved in Supabase or pass 'placeId' in the request.",
          code: "MISSING_PLACE_ID",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const cleanPlaceId = placeId.trim();

    // Verify Google Places API Secret is configured
    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "GOOGLE_PLACES_API_KEY secret is not configured in Supabase Edge Functions. Please set it using: supabase secrets set GOOGLE_PLACES_API_KEY='your_api_key'",
          code: "MISSING_SERVER_SECRET",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Call Google Places API (New) Place Details endpoint
    // Documented URL: https://places.googleapis.com/v1/places/{PLACE_ID}
    const googlePlacesUrl = `https://places.googleapis.com/v1/places/${encodeURIComponent(cleanPlaceId)}`;
    const googleResponse = await fetch(googlePlacesUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        // Request only the requested fields: name, rating, count, reviews
        "X-Goog-FieldMask": "id,displayName,rating,userRatingCount,reviews",
      },
    });

    if (!googleResponse.ok) {
      const errorText = await googleResponse.text();
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorText;
      } catch {
        // Fallback to raw text
      }

      return new Response(
        JSON.stringify({
          error: `Google Places API returned status ${googleResponse.status}: ${errorMessage}`,
          code: `GOOGLE_API_${googleResponse.status}`,
        }),
        {
          status: googleResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const placeData = await googleResponse.json();

    // Sanitize and normalize reviews data returned by Google
    const rawReviews = Array.isArray(placeData.reviews) ? placeData.reviews : [];
    const reviews = rawReviews.map((r: any, idx: number) => ({
      id: r.name || `review_${idx}`,
      authorName: r.authorAttribution?.displayName || "Google Reviewer",
      authorPhotoUrl: r.authorAttribution?.photoUri || null,
      authorUri: r.authorAttribution?.uri || null,
      rating: typeof r.rating === "number" ? r.rating : 5,
      text: r.text?.text || r.originalText?.text || "",
      publishTime: r.publishTime || null,
      relativePublishTimeDescription: r.relativePublishTimeDescription || "",
    }));

    const responsePayload = {
      placeId: cleanPlaceId,
      displayName: placeData.displayName?.text || placeData.displayName || "",
      rating: typeof placeData.rating === "number" ? placeData.rating : null,
      userRatingCount: typeof placeData.userRatingCount === "number" ? placeData.userRatingCount : 0,
      reviews,
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({
        error: `Unexpected error in get-google-reviews function: ${message}`,
        code: "SERVER_ERROR",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
