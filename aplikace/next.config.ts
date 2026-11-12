import type { NextConfig } from "next";

// Data se čtou z Postgresu při každém požadavku (pohled se liší podle přihlášeného), stránky jsou dynamické.
const nextConfig: NextConfig = {
  trailingSlash: true, // odkazy v příbězích používají /osoba/<id>/
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
