// @ts-check
import withPWA from "next-pwa";

const pwaConfig = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  customWorkerSrc: "src/worker",
  customWorkerDest: "public",
  customWorkerPrefix: "push-handler",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {},
  serverExternalPackages: ['@supabase/supabase-js'],
};

export default pwaConfig(nextConfig);
