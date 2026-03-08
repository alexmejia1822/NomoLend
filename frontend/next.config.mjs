/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["firebase-admin"],
  },
  async redirects() {
    return [
      {
        source: "/docs",
        destination: "https://github.com/alexmejia1822/NomoLend/tree/main/docs",
        permanent: false,
      },
    ];
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
    };
    return config;
  },
};

export default nextConfig;
