import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#173B70",
          "navy-dark": "#0F2A52",
          teal: "#0F9D8A",
          "teal-dark": "#0B7D6E",
          mist: "#EEF3F9",
          cloud: "#F5F8FC",
          slate: "#263449",
        },
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans Variable'", "Arial", "sans-serif"],
        heading: ["'Nunito Sans Variable'", "'Plus Jakarta Sans Variable'", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
