import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Proxy backend set to HTTPS so redirects are followed correctly
const DJANGO_BACKEND_URL = "https://dpe-men.mg";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const VERSION = "v46-20260531-redeploy-all-health";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "health") {
      return new Response(
        JSON.stringify({ ok: true, function: "django-proxy", version: VERSION, backend: DJANGO_BACKEND_URL }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-cache" } },
      );
    }
    const path = url.searchParams.get("path") || "";
    const djangoUrl = `${DJANGO_BACKEND_URL}${path}`;

    console.log(`Proxying request to: ${djangoUrl}`);

    // Follow redirects normally so HTTPS redirections are handled by fetch.
    const response = await fetch(djangoUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: req.method !== "GET" ? await req.text() : undefined,
      redirect: "follow",
    });

    const data = await response.text();
    
    return new Response(data, {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": response.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        hint: "Check if Django server is accessible and allows HTTP connections"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
