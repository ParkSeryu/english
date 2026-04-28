import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        paper: "#f8fafc",
        mint: "#2dd4bf"
      },
      boxShadow: {
        card: "0 18px 55px rgba(15, 23, 42, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
