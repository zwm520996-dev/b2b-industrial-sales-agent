/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "@tailwindcss/postcss": {}, /* 这里改成了 v4 的新包名 */
    autoprefixer: {},
  },
};
export default config;