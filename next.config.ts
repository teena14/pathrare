import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages use Node.js APIs and must not be bundled by webpack
  serverExternalPackages: [
    "pdf-parse",
    "google-auth-library",
    "firebase-admin",
    "googleapis",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
