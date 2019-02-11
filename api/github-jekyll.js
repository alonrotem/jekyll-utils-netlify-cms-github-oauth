require("dotenv").config();
const fs = require("fs-extra");
const path = require("path");
const parser = require("parse-diff");
const utf8 = require("utf8");
var frontmatter = require("front-matter");

module.exports = function(app) {
  app.psot("/api/github-jekyll/fixunhiddendate", (req, res) => {
    res.set({ "content-type": "application/json; charset=utf-8" });

    let automatedScriptCommitMessage =
      process.env.JEKYLL_FIX_UNHIDDEN_COMMIT_MESSAGE;

    const localPath = path.join(__dirname, "tmp");
    let currentfileinfo = [];
    let previousFileVersionsPromises = [];
    let successResponse = {
      added: false,
      commitmessage: "",
      pushed: false,
      committerUser: "",
      committerEmail: "",
      modifiedFiles: 0,
      error: false,
      errrmessage: ""
    };

    if (fs.existsSync(localPath)) {
      fs.removeSync(localPath);
    }
    fs.ensureDirSync(localPath);
    const simpleGit = require("simple-git/promise")(localPath);
    console.log("Cloning...");
    //step 1: clone
    return (
      simpleGit
        .clone(process.env.JEKYLL_GIT_REPO, localPath)
        .catch(err => {
          console.log(err);
          let returnobj = JSON.stringify(
            {
              error: true,
              errrmessage: err.message
            },
            null,
            4
          );
          console.log(returnobj);
          res.send(returnobj);
          res.end();
          return false;
        })
        //step 2: get the most recent commit details
        .then(() => {
          console.log("Cloned. Getting the most recent commit details...");
          return simpleGit.log(["-1"]);
        })
        .then(result => {
          if (result) {
            console.log(
              "Latest commit from " +
                result.latest.date +
                ", by " +
                result.latest.author_name +
                "(" +
                result.latest.author_email +
                "): " +
                result.latest.message
            );
            successResponse.lastCommitInfo = {
              date: result.latest.date,
              authorName: result.latest.author_name,
              authorEmail: result.latest.author_email,
              commitMessage: result.latest.message
            };
            //Check the last commit message, to avoid loops
            if (
              result.latest.message.startsWith(automatedScriptCommitMessage)
            ) {
              console.log(
                "Previous commit message is similar to the automated script commit message. Skipping actions"
              );
              return false;
            }
          }
          return result;
        })
        //step 3: set the repo configuration, to prevent weird octet-encoded file names
        .then(keeprunning => {
          if (keeprunning) {
            return simpleGit.addConfig("core.quotepath", "off");
          } else {
            return false;
          }
        })
        //step 4: get the diff files from the latest commit (HEAD) and the previous one (HEAD~1).
        //filter out (a)dded, (c)opied, (d)eleted, (r)enamed, (t)ype-changed, (u)nmerged or (x)-unknown changes.
        //this leaves only content-(m)odified files.
        .then(keeprunning => {
          if (keeprunning) {
            return simpleGit.diff([
              "--name-only", //only the filenames
              "--diff-filter=acdrtux", //modified files only
              "HEAD~1", //from previous commit
              "HEAD" //to latest version
            ]);
          } else {
            return false;
          }
        })
        .then(result => {
          if (result) {
            let files = result.split("\n");
            if (files) {
              successResponse.modifiedFiles = files.length;
              for (let i = 0; i < files.length; i++) {
                let file = files[i].replace(/\"*/g, "");
                if (file) {
                  //current state file: get the content, read the front-matter and check if it's a hidden post.
                  var y = fs.readFileSync(path.resolve(localPath, file), {
                    encoding: "utf8"
                  });
                  let fm = frontmatter(y.toString());
                  let isHiddenOnLastCommit = fm.attributes.hidden;

                  currentfileinfo.push({
                    filename: file,
                    hiddenOnLastCommit: isHiddenOnLastCommit
                  });
                  //collect a list of promises for showing previous versions of those files
                  previousFileVersionsPromises.push(
                    simpleGit.show(["HEAD~1:" + file])
                  );
                }
              }
            }
          }
          //move the result ahead, if it's falsy, the next promise handler should also not do anything
          return result;
        })
        //let all the promises run, to get details of the modified files and their previous versions
        .then(result => {
          if (result) {
            return Promise.all(previousFileVersionsPromises);
          } else {
            return false;
          }
        })
        //step 5: check the modified files in their previous version, their frontmatter, and their hidden status
        .then(results => {
          if (results) {
            for (let r = 0; r < results.length; r++) {
              let previousversion = results[r];
              let fm = frontmatter(previousversion);
              let isHiddenOnPreviousCommit = fm.attributes.hidden;
              //if the file was hidden before the latest commit, then unhidden on the last commit, rename its date to today+now
              if (
                isHiddenOnPreviousCommit &&
                !currentfileinfo[r].hiddenOnLastCommit
              ) {
                successResponse.changedfiles = [];
                let now = new Date();
                let nowtring =
                  now.getFullYear() +
                  "-" +
                  ("0" + (now.getMonth() + 1)).slice(-2) +
                  "-" +
                  ("0" + now.getDate()).slice(-2) +
                  "-" +
                  ("0" + now.getHours()).slice(-2) +
                  "-" +
                  ("0" + now.getMinutes()).slice(-2) +
                  "-";

                //break the filename and the path, regex the name and replace the datetime
                let filepath = "";
                let filename = currentfileinfo[r];
                let pathSeparator = currentfileinfo[r].filename.lastIndexOf(
                  "/"
                );
                if (pathSeparator != -1) {
                  filepath = currentfileinfo[r].filename.substr(
                    0,
                    pathSeparator + 1
                  );
                  filename = currentfileinfo[r].filename.substr(
                    pathSeparator + 1
                  );
                }
                let oldfilename = path.resolve(
                  localPath,
                  currentfileinfo[r].filename
                );
                let newfilename = path.resolve(
                  localPath,
                  filepath + filename.replace(/^[\d\-]*/g, nowtring)
                );
                if (!fs.existsSync(newfilename)) {
                  fs.renameSync(oldfilename, newfilename);
                  successResponse.changedfiles.push({
                    oldname: oldfilename,
                    newname: newfilename
                  });
                }
              }
            }
            return true;
          } else {
            return false;
          }
        })
        .then(keeprunning => {
          fileschanged =
            successResponse.changedfiles &&
            successResponse.changedfiles.length > 0;
          if (keeprunning && fileschanged) {
            simpleGit.add("./*");
            successResponse.added = true;
          }
          return keeprunning && fileschanged;
        })
        .then(keeprunning => {
          if (keeprunning) {
            simpleGit.commit(automatedScriptCommitMessage);
            successResponse.comitted = true;
            successResponse.commitmessage = automatedScriptCommitMessage;
          }
          return keeprunning;
        })
        .then(keeprunning => {
          if (keeprunning) {
            simpleGit.push("origin", "master");
            successResponse.pushed = true;
          }
          return keeprunning;
        })
        .then(() => {
          return simpleGit.raw(["config", "user.name"]);
        })
        .then(username => {
          successResponse.committerUser = username;
        })
        .then(() => {
          return simpleGit.raw(["config", "user.email"]);
        })
        .then(email => {
          successResponse.committerEmail = email;
        })
        .then(() => {
          let returnobj = JSON.stringify(successResponse, null, 4);
          console.log(returnobj);
          res.send(returnobj);
          res.end();
        })
    );
  });
};
