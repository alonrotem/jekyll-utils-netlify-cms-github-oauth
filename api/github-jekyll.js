require("dotenv").config({ silent: true });
const fs = require("fs-extra");
const path = require("path");
const parser = require("parse-diff");
const utf8 = require("utf8");
const frontmatter = require("front-matter");
const githubsecurity = require("./github-security");
const moment = require("moment-timezone");

module.exports = function(app) {
  app.post(
    "/api/github-jekyll/fixunhiddendate",
    //githubsecurity.verifyPostData,
    (req, res) => {
      res.set({ "content-type": "application/json; charset=utf-8" });

      let automatedScriptCommitMessage =
        process.env.JEKYLL_FIX_UNHIDDEN_COMMIT_MESSAGE;
      let gitUrl = process.env.JEKYLL_GIT_REPO;
      let usernamepassregex = /http[s]{0,1}\:\/\/(.*\@).*/g;
      if (!usernamepassregex.exec(gitUrl)) {
        if (process.env.JEKYLL_GIT_USERNAME && process.env.JEKYLL_GIT_PASS) {
          gitUrl =
            gitUrl.substring(0, gitUrl.indexOf("//") + 2) +
            process.env.JEKYLL_GIT_USERNAME +
            ":" +
            process.env.JEKYLL_GIT_PASS +
            "@" +
            gitUrl.substring(gitUrl.indexOf("//") + 2);
        }
      }

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
          .clone(gitUrl, localPath)
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
            simpleGit.addConfig("core.quotepath", "off");
            return keeprunning;
          })
          .then(keeprunning => {
            simpleGit.raw([
              "config",
              "user.email",
              process.env.JEKYLL_GIT_EMAIL
            ]);
            successResponse.committerEmail = process.env.JEKYLL_GIT_EMAIL;
            return keeprunning;
          })
          .then(keeprunning => {
            simpleGit.raw(["config", "user.name", process.env.JEKYLL_GIT_USER]);
            successResponse.committerUser = process.env.JEKYLL_GIT_USER;
            return keeprunning;
          })
          .then(keeprunning => {
            simpleGit.raw(["config", "user.name", process.env.JEKYLL_GIT_USER]);
            successResponse.committerUser = process.env.JEKYLL_GIT_USER;
            return keeprunning;
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
              let files = result.trim().split("\n");
              if (files) {
                successResponse.modifiedFiles = files.length;
                console.log(
                  "Found " +
                    files.length +
                    " modified file(s) in the latest commit."
                );
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
            successResponse.changedfiles = [];
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
                  let now = process.env.USER_TIMEZONE
                    ? moment().tz(process.env.USER_TIMEZONE)
                    : moment();

                  let nowtring =
                    now.year() +
                    "-" +
                    ("0" + (now.month() + 1)).slice(-2) +
                    "-" +
                    ("0" + now.date()).slice(-2) +
                    "-" +
                    ("0" + now.hour()).slice(-2) +
                    "-" +
                    ("0" + now.minute()).slice(-2) +
                    "-";

                  console.log(
                    "Timezone set to: " +
                      process.env.USER_TIMEZONE +
                      ". New file time: " +
                      now +
                      ". String: " +
                      nowtring
                  );
                  //break the filename and the path, regex the name and replace the datetime
                  let filepath = "";
                  let filename = currentfileinfo[r].filename;
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
              simpleGit.push("origin", "work");
              successResponse.pushed = true;
            }
            return keeprunning;
          })
          .then(() => {
            let returnobj = JSON.stringify(successResponse, null, 4);
            console.log(returnobj);
            res.send(returnobj);
            res.end();
          })
      );
    }
  );
};
