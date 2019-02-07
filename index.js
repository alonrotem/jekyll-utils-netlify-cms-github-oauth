console.clear();
const express = require("express");
const login_auth_target = process.env.AUTH_TARGET || "_self";
const oauth_provider = process.env.OAUTH_PROVIDER || "github";
const port = process.env.PORT || 5000;
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});
app.options("*", cors());

app.use(
  bodyParser.urlencoded({
    extended: true
  })
);

/**bodyParser.json(options)
 * Parses the text as JSON and exposes the resulting object on req.body.
 */
app.use(bodyParser.json());

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
//require("./api/jekyll-archives")(app);
require("./api/analytics")(app);

app.listen(port, () => {
  console.log("gandalf is walkin' on port " + port);
});
