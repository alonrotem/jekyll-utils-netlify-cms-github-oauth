const utf8 = require("utf8");
var fs = require("fs-extra");
var NodeGit = require("nodegit");
var path = require("path");
var frontmatter = require("front-matter");

// TODO: Make this configurable through vars
var cloneURL =
  "https://alonrotem:r0t3mPa$$@github.com/literaturnirazgovori/literaturnirazgovori.github.io.git";
var localPath = require("path").join(__dirname, "tmp");
var cloneOptions = {};

// TODO: change the method to POST
module.exports = function(app) {
  //1
  app.get("/api/jekyll-archives", (req, res) => {
    console.log("Received call to /api/jekyll-archives");
    var filesToAdd = [];
    var pushpromises = [];
    var commitindex = null;
    var oid = null;
    var repo = null;
    var msg = "";
    var alltags = [];
    // TODO: check the secret from GitHub. otherwise, do nothing.
    // TODO: add the secret key to vars
    if (fs.existsSync(localPath)) {
      fs.removeSync(localPath);
    }
    console.log("Cloning...");
    var cloneRepository = NodeGit.Clone(cloneURL, localPath, cloneOptions).then(
      repository => {
        NodeGit.Repository.open(path.resolve(localPath, ".git"))
          .then(repository => {
            repo = repository;
            return repo.getMasterCommit();
          })
          .then(lastCommitOnMaster => {
            // TODO: add a predefined message as vars
            // TODO: check the message, to make sure no endless commits happen.
            let commitdate = lastCommitOnMaster.date();
            let commitmessage = lastCommitOnMaster.message();
            msg += commitdate + "::" + commitmessage;
            console.log(
              'Last commit: "' + commitmessage + '", at ' + commitdate
            );
            console.log("Collecting all tags from all files...");
            let files = fs.readdirSync(path.resolve(localPath, "_posts"));
            let f = 1;
            files.forEach(function(filename) {
              console.log(f + " of " + files.length + ": " + filename);
              f++;
              let content = fs.readFileSync(
                path.resolve(localPath, "_posts", filename),
                { encoding: "utf8" }
              );
              let fm = frontmatter(content.toString());
              let tags = Array.from(fm.attributes.tags);
              // TODO: make the collection configurable. tags, categories etc.
              for (let i = 0; i < tags.length; i++) {
                if (!alltags.includes(tags[i])) {
                  alltags.push(tags[i]);
                  msg += " [" + tags[i] + "] ";

                  fs.ensureDirSync(path.resolve(localPath, "tag", tags[i]));
                  let newfilename = path.resolve(
                    localPath,
                    "tag",
                    tags[i],
                    "index.html"
                  );
                  fs.copyFileSync(
                    // TODO: Make the base layout to be copied configurable through vars
                    path.resolve(localPath, "_layouts", "archive.html"),
                    newfilename
                  );
                  filesToAdd.push("tag/" + tags[i] + "/index.html");
                  // TODO: add, commit, with the predefined message, and push.
                  // TODO: cleanup the tmp folder
                }
              }
            });
          })

          .then(() => {
            return repo.refreshIndex();
          })
          .then(index => {
            commitindex = index;
            console.log(
              filesToAdd.length + " tags collected to be created as files."
            );
            for (var j = 0; j < filesToAdd.length; j++) {
              console.log(j + 1 + ": " + filesToAdd[j]);
              pushpromises.push(commitindex.addByPath(filesToAdd[j]));
            }
          })
          .then(() => {
            Promise.all(pushpromises)
              //------------------------
              .then(() => {
                console.log("All files added to index.");
                return commitindex.writeTree();
              })
              .then(oidResult => {
                oid = oidResult;
                return NodeGit.Reference.nameToId(repo, "HEAD");
              })
              .then(head => {
                return repo.getCommit(head);
              })
              .then(parent => {
                var author = NodeGit.Signature.now(
                  "Alon Rotem",
                  "alrotem@gmail.com"
                );
                var committer = NodeGit.Signature.now(
                  "Alon Rotem",
                  "alrotem@gmail.com"
                );
                return repo.createCommit(
                  "HEAD",
                  author,
                  committer,
                  "Auto-generated tag pages",
                  oid,
                  [parent]
                );
              })
              //--------
              .then(function() {
                console.log("Commit created. Pushing...");
                return repo.getRemote("origin");
              })
              .then(function(remoteResult) {
                remote = remoteResult;

                // Create the push object for this remote
                return remote.push(["refs/heads/master:refs/heads/master"], {
                  callbacks: {
                    credentials: function(url, userName) {
                      return NodeGit.sshKeyFromAgent(userName);
                    }
                  }
                });
              })

              //--------

              .then(() => {
                console.log("All done. Sending response to browser...");
                res.header("Content-Type", "application/json; charset=utf-8");
                res.write("Latest commit: " + msg);
                res.end(" :: " + alltags.length + " tags");
              });
          });
      }
    );

    // TODO: add some informative messages here
  });
}; //1
