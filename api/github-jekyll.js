require("dotenv").config({ silent: true });
const fs = require("fs-extra");
const path = require("path");
const frontmatter = require("front-matter");
const githubsecurity = require("./github-security");
const moment = require("moment-timezone");
const jsyaml = require("js-yaml");

module.exports = function(app) {
  app.post(
    "/api/github-jekyll/fixunhiddendate",
    githubsecurity.validateGitHubWebhookSecret,
    async (req, res) => {
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
      const targetBranch = process.env.JEKYLL_GIT_BRANCH
        ? process.env.JEKYLL_GIT_BRANCH
        : "master";
      const localPath = path.join(__dirname, "tmp");
      let currentfileinfo = [];
      let previousFileVersionsPromises = [];
      let gitMvRenamedFilesPromises = [];
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
      try {
        await simpleGit.clone(gitUrl, localPath, [
          "--single-branch" /*,
            "--branch ",
            targetBranch*/
        ]);
      } catch (err) {
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
      }
      console.log("Cloned. Getting the most recent commit details...");

      //step 2: get the most recent commit details
      let lastCommit = await simpleGit.log(["-1"]);
      if (lastCommit) {
        console.log(
          "Latest commit from " +
            lastCommit.latest.date +
            ", by " +
            lastCommit.latest.author_name +
            "(" +
            lastCommit.latest.author_email +
            "): " +
            lastCommit.latest.message
        );
        successResponse.lastCommitInfo = {
          date: lastCommit.latest.date,
          authorName: lastCommit.latest.author_name,
          authorEmail: lastCommit.latest.author_email,
          commitMessage: lastCommit.latest.message
        };
        //Check the last commit message, to avoid loops
        if (
          !lastCommit.latest.message.startsWith(automatedScriptCommitMessage)
        ) {
          //step 3: set the repo configuration, to prevent weird octet-encoded file names
          await simpleGit.addConfig("core.quotepath", "off");
          await simpleGit.raw([
            "config",
            "user.email",
            process.env.JEKYLL_GIT_EMAIL
          ]);
          successResponse.committerEmail = process.env.JEKYLL_GIT_EMAIL;

          await simpleGit.raw([
            "config",
            "user.name",
            process.env.JEKYLL_GIT_USER
          ]);
          successResponse.committerUser = process.env.JEKYLL_GIT_USER;

          //step 4: get the diff files from the latest commit (HEAD) and the previous one (HEAD~1).
          //filter out (a)dded, (c)opied, (d)eleted, (r)enamed, (t)ype-changed, (u)nmerged or (x)-unknown changes.
          //this leaves only content-(m)odified files.
          let mofifiedFilenames = await simpleGit.diff([
            "--name-only", //only the filenames
            "--diff-filter=acdrtux", //modified files only
            "HEAD~1", //from previous commit
            "HEAD" //to latest version
          ]);

          if (mofifiedFilenames) {
            let files = mofifiedFilenames.trim().split("\n");
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
            let previousFileVersionContents = await Promise.all(
              previousFileVersionsPromises
            );

            //step 5: check the modified files in their previous version, their frontmatter, and their hidden status
            successResponse.changedfiles = [];
            if (previousFileVersionContents) {
              for (let r = 0; r < previousFileVersionContents.length; r++) {
                let previousversion = previousFileVersionContents[r];
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

                  let oldfilecontent = fs.readFileSync(oldfilename).toString();
                  let oldfileFrontmatter = frontmatter(oldfilecontent)
                    .attributes;
                  let oldfileUrl =
                    "/" +
                    path.relative(localPath, oldfilename).replace("\\", "/");
                  oldfileUrl = oldfileUrl
                    .replace("_posts", oldfileFrontmatter.category)
                    .replace(
                      /(^\/[^\/]*\/\d{4})\-(\d{2})\-(\d{2})-(.*)\..*/,
                      "$1/$2/$3/$4"
                    );
                  console.log("Redirect from old url: " + oldfileUrl);
                  let addedNewUrl = false;
                  let redirectfrom = oldfileFrontmatter["redirect_from"];
                  if (redirectfrom) {
                    if (Array.isArray(redirectfrom)) {
                      if (!redirectfrom.includes(oldfileUrl)) {
                        redirectfrom.push(oldfileUrl);
                        addedNewUrl = true;
                      }
                    } else {
                      redirectfrom = [redirectfrom, oldfileUrl];
                      addedNewUrl = true;
                    }
                  } else {
                    redirectfrom = [oldfileUrl];
                    addedNewUrl = true;
                  }
                  if (addedNewUrl) {
                    oldfileFrontmatter["redirect_from"] = redirectfrom;
                    let updatedFrontmatter = jsyaml.safeDump(
                      oldfileFrontmatter
                    );
                    let updatedContent = oldfilecontent.replace(
                      /(^\-{3,}[\r\n]*)[\S\s]*([\n\r]*\-{3,})/,
                      "$1" + updatedFrontmatter + "$2"
                    );
                    //change the url to /yyyy/mm/dd/hh/mm....
                    fs.writeFileSync(oldfilename, updatedContent);
                  }
                  //-------------------------
                  if (!fs.existsSync(newfilename)) {
                    fs.renameSync(oldfilename, newfilename);
                    successResponse.changedfiles.push({
                      oldname: oldfilename,
                      newname: newfilename
                    });
                  }
                  gitMvRenamedFilesPromises.push(
                    simpleGit.raw(["add", "-A", newfilename])
                  );
                  gitMvRenamedFilesPromises.push(
                    simpleGit.raw(["rm", "--cached", oldfilename])
                  );
                }
              }
              //end of loop
              let fileschanged = gitMvRenamedFilesPromises.length > 0;
              console.log(
                "Files changed:" +
                  fileschanged +
                  ", Promises (remove/add) to perform: " +
                  gitMvRenamedFilesPromises.length
              );
              if (fileschanged) {
                console.log(
                  "Awaiting promises for add/remove files from the repo..."
                );
                await Promise.all(gitMvRenamedFilesPromises);

                await simpleGit.commit(automatedScriptCommitMessage);
                successResponse.comitted = true;
                successResponse.commitmessage = automatedScriptCommitMessage;

                await simpleGit.push("origin", targetBranch);
                successResponse.pushed = true;
              }
            }
          }
        } else {
          console.log(
            "Previous commit message is similar to the automated script commit message. Skipping actions"
          );
        }
        let returnobj = JSON.stringify(successResponse, null, 4);
        console.log(returnobj);
        res.send(returnobj);
        res.end();
      }
    }
  );
};
