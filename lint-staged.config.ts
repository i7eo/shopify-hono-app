export default {
  "*.{js,jsx,ts,tsx,mjs,cjs}": [
    "eslint --fix --max-warnings=0 --report-unused-disable-directives --no-warn-ignored",
    "prettier --write --ignore-unknown",
  ],
  "*.{css,less,scss,sass,styl}": [
    "stylelint --fix --allow-empty-input",
    "prettier --write --ignore-unknown",
  ],
  "*.vue": [
    "eslint --fix --max-warnings=0 --report-unused-disable-directives",
    "prettier --write --ignore-unknown",
  ],
  "*": ["prettier --write --ignore-unknown"],
};
