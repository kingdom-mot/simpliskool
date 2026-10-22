import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#173B70",
          "navy-dark": "#0F2A52",
          teal: "#0F9D84",
          "teal-dark": "#0B7E6A",
          mist: "#EEF3F9",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
