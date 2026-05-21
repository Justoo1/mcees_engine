import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FAFAFA",
        synced: "#10B981",
        failed: "#EF4444",
      },
    },
  },
  plugins: [],
};

export default config;
