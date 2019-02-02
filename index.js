require("dotenv").config({ silent: true });
const express = require("express");
const oauth_provider = process.env.OAUTH_PROVIDER || "github";
const port = process.env.PORT || 5000;

const app = express();

app.get("/", (req, res) => {
  res.send(
    'Hello<br><a href="/auth" target="' +
      login_auth_target +
      '">Log in with ' +
      oauth_provider.toUpperCase() +
      "</a>"
  );
});

require("./api/githublogin")(app);
require("./api/jekyll-archives")(app);

app.listen(port, () => {
  console.log("gandalf is walkin' on port " + port);
});
