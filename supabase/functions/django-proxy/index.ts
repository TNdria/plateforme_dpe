import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Use HTTP to avoid SSL certificate issues
const DJANGO_BACKEND_URL = "http://102.16.234.114";

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

    // Create a custom fetch that doesn't follow redirects
    const response = await fetch(djangoUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: req.method !== "GET" ? await req.text() : undefined,
      redirect: "manual", // Don't follow redirects to HTTPS
    });

    // If we get a redirect, try to extract data anyway or return error
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      console.log(`Redirect detected to: ${location}`);
      
      // If redirecting to HTTPS, we can't follow due to invalid cert
      // Return a meaningful error
      return new Response(
        JSON.stringify({ 
          error: "Server redirects to HTTPS but has invalid SSL certificate",
          suggestion: "Configure Django to allow HTTP for API endpoints or install valid SSL certificate",
          redirectTo: location
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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
