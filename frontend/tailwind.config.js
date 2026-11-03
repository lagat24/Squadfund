/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F2F5F4",
        ink: {
          50: "#EBF2F3", 100: "#D9E6E8", 200: "#B7CFD3", 300: "#8DB0B7", 400: "#5E8A94",
          500: "#3F7080", 600: "#2A5C6C", 700: "#1B4A58", 800: "#0F3A45", 900: "#0A2A32",
        },
        gold: { 300: "#E3C46F", 400: "#D2A63A", 500: "#B88A1E", 600: "#8E6812", 700: "#6E500E" },
        line: "#D3DDDE",
        body: "#15272C",
        muted: "#4F656B",
        danger: { DEFAULT: "#A5392A", soft: "#F8ECE9" },
        ok: { DEFAULT: "#2F6F4F", soft: "#E8F2EC" },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', "system-ui", "sans-serif"],
        sans: ['"Public Sans Variable"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      borderRadius: { DEFAULT: "4px", md: "6px" },
    },
  },
  plugins: [],
};
