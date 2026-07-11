import type { NextConfig } from "next";
import path from "path";

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/photo-**",
      },
      ...(supabaseHostname
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHostname,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
    ],
  },
  turbopack: {
    root: path.join(__dirname),
  },
  // Flyer text is rasterized from SVG; the bundled font must ship with the
  // serverless functions that render brochures (see src/lib/brochures/flyer.ts).
  outputFileTracingIncludes: {
    "/brochures": ["./fonts/**"],
    "/properties/[id]": ["./fonts/**"],
  },
};

export default nextConfig;
