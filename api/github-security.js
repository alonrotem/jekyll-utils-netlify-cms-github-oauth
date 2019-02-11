require("dotenv").config();
const crypto = require("crypto");

module.exports = {
  //This middleware checks GitHub's "x-hub-signature" header, to see if it matches the secret key
  verifyPostData: (req, res, next) => {
    const payload = JSON.stringify(req.body);
    const headerKey = "x-hub-signature";
    if (!payload) {
      return next("Request body empty");
    }

    const hmac = crypto.createHmac(
      "sha1",
      process.env.JEKYLL_GITHUB_WEBHOOK_SECRET
    );
    const digest = "sha1=" + hmac.update(payload).digest("hex");
    const checksum = req.headers[headerKey];
    if (!checksum || !digest || checksum !== digest) {
      return next(
        `Request body digest (${digest}) did not match ${headerKey} (${checksum})`
      );
    }
    return next();
  }
};
