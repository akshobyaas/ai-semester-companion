/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Baloo 2'", "sans-serif"],
        sans: ["Inter", "sans-serif"],
      },
      colors: {
        // Deliberately not Duolingo's own green (#58CC02) or Claude's
        // terracotta (#D97757) — a deeper teal-green reads as "growth/focus"
        // without being a direct clone, per the frontend-design skill's
        // guidance to avoid the common AI-generated-palette tells.
        primary: {
          50: "#EAF5F1",
          100: "#CBE7DD",
          300: "#6FBBA0",
          500: "#0F6B5C",
          600: "#0C5449",
          700: "#093F37",
          900: "#062822",
        },
        accent: {
          400: "#F5B15C",
          500: "#F2994A",
          600: "#D97F30",
        },
        ink: {
          900: "#1A1A1A",
          600: "#4A4A4A",
          400: "#8A8A8A",
        },
        cream: "#FBF7EF",
      },
      borderRadius: {
        "3xl": "1.75rem",
      },
    },
  },
  plugins: [],
};
