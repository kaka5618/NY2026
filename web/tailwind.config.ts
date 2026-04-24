import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "PingFang SC",
          "Microsoft YaHei",
          "sans-serif",
        ],
        /** 首页标题区：依赖 globals.css 中的 Noto Serif SC（含中文） */
        home: ['"Noto Serif SC"', "STSong", "Songti SC", "ui-serif", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
