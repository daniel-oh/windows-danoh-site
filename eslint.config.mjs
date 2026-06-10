import coreWebVitals from "eslint-config-next/core-web-vitals";

// Next 16 removed `next lint`; ESLint 10 only reads flat config, so the
// old .eslintrc.json was dead weight. Same ruleset, new format.
export default [
  ...coreWebVitals,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      // Built artifacts, not source: public/api.js comes from `npm run
      // build-iframe`, generated/ from codegen.
      "public/**",
      "generated/**",
    ],
  },
];
