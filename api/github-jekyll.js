require("dotenv").config();
var fs = require("fs-extra");
const path = require("path");

module.exports = function(app) {
  app.get("/api/github-jekyll/fixunhiddendate", (req, res) => {
    const localPath = path.join(__dirname, "tmp");

    if (fs.existsSync(localPath)) {
      fs.removeSync(localPath);
    }
    fs.ensureDirSync(localPath);
    const simpleGit = require("simple-git")(localPath);
    console.log("Cloning...");
    simpleGit.clone(process.env.JEKYLL_GIT_REPO, localPath, (err, info) => {
      if (!err) {
        console.log("Cloned");
        res.write("cloned.");
        console.log("Getting last commit ID");
        simpleGit.revparse(["--short", "HEAD"], (err, info) => {
          if (!err) {
            console.log("latest commit ID: " + info);
            res.write("latest commit ID: " + info);
            res.end();
            /*
            console.log("Getting changed files list");
            //git log --name-status
            simpleGit.log(["--name-status"], (err, info) => {
              console.log(info);
              res.write(info);
              res.end();
              if (!err) {
              } else {
                res.write("Failed to get files list for commit");
                res.end();
              }
            });*/
          } else {
            res.write("Failed to get latest commit ID: " + err);
            res.end();
          }
        });
      } else {
        res.write("Failed to clone: " + err);
        res.end();
      }
    });
  });
};
