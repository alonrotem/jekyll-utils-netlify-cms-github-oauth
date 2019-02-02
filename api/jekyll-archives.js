var fs = require("fs-extra");
var NodeGit = require("nodegit");
var path = require("path");
var frontmatter = require("front-matter");

// TODO: Make this configurable through vars
var cloneURL =
  "https://github.com/literaturnirazgovori/literaturnirazgovori.github.io.git";
var localPath = require("path").join(__dirname, "tmp");
var cloneOptions = {};

// TODO: change the method to POST
module.exports = function(app) {
  app.get("/api/jekyll-archives", function(req, res) {
    // TODO: check the secret from GitHub. otherwise, do nothing.
    // TODO: add the secret key to vars
    if (fs.existsSync(localPath)) {
      fs.removeSync(localPath);
    }
    var cloneRepository = NodeGit.Clone(cloneURL, localPath, cloneOptions).then(
      function() {
        var msg = "";
        var alltags = [];
        NodeGit.Repository.open(path.resolve(localPath, ".git"))
          .then(function(repo) {
            return repo.getMasterCommit();
          })
          .then(function(lastCommitOnMaster) {
            // TODO: add a predefined message as vars
            // TODO: check the message, to make sure no endless commits happen.
            let commitdate = lastCommitOnMaster.date();
            let commitmessage = lastCommitOnMaster.message();
            msg += commitdate + "::" + commitmessage;

            let files = fs.readdirSync(path.resolve(localPath, "_posts"));
            files.forEach(function(filename) {
              let content = fs.readFileSync(
                path.resolve(localPath, "_posts", filename)
              );
              let fm = frontmatter(content.toString());
              let tags = Array.from(fm.attributes.tags);
              // TODO: make the collection configurable. tags, categories etc.
              for (let i = 0; i < tags.length; i++) {
                if (!alltags.includes(tags[i])) {
                  alltags.push(tags[i]);
                  msg += " [" + tags[i] + "] ";

                  fs.ensureDirSync(path.resolve(localPath, "tag", tags[i]));
                  fs.copyFileSync(
                    // TODO: Make the base layout to be copied configurable through vars
                    path.resolve(localPath, "_layouts", "archive.html"),
                    path.resolve(localPath, "tag", tags[i], "index.html")
                  );
                  // TODO: add, commit, with the predefined message, and push.
                  // TODO: cleanup the tmp folder
                }
              }
            });

            // TODO: add some informative messages here
            res.header("Content-Type", "application/json; charset=utf-8");
            res.write("Latest commit: " + msg);
            res.end(" :: " + alltags.length + " tags");
          })
          .done();
      }
    );
  });
};
