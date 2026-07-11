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
  // Native addons: keep them out of the bundler (they load .node binaries).
  serverExternalPackages: ["@napi-rs/canvas", "sharp", "pdf-lib"],
  // The flyer renderer (@napi-rs/canvas) reads the bundled brand font at
  // runtime; ship fonts/ with the brochure-rendering server functions.
  outputFileTracingIncludes: {
    "/brochures": ["./fonts/**"],
  },
};

export default nextConfig;
