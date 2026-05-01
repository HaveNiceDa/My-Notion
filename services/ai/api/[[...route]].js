const { handle } = require("@hono/node-server/vercel");
const app = require("../dist/services/ai/src/index.js").default;

module.exports = handle(app);
