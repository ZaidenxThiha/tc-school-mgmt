import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f5f7ff",
          100: "#ebf0fe",
          500: "#4f6df5",
          600: "#3956e0",
          700: "#2d44b8"
        }
      }
    }
  },
  plugins: []
};
export default config;
