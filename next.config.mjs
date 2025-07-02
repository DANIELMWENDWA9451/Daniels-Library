/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ["images.unsplash.com"],
  },
  webpack: (config, context) => {
    config.optimization.minimize = process.env.NODE_ENV === "production";
    return config;
  }
};

export default nextConfig;
