let customConfig = [];
let hasIgnoresFile = false;
try {
  require.resolve("./eslint.ignores.js");
  hasIgnoresFile = true;
} catch {}

if (hasIgnoresFile) {
  const ignores = require("./eslint.ignores.js");
  customConfig = [{ ignores }];
}

module.exports = [...customConfig, ...require("gts")];
