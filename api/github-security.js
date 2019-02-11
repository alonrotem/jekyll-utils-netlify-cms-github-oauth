require("dotenv").config();

module.exports = function() {
  verifyPostData: (req, res, next) => {
    const payload = JSON.stringify(req.body);
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
  };
};
