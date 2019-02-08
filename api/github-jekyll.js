const git = require("git");
//var sys = require("sys");
var exec = require("child_process").exec;

module.exports = function(app) {
  app.get("/api/github-jekyll/fixunhiddendate", (req, res) => {
    function puts(error, stdout, stderr) {
      //sys.puts(stdout);
      res.write(stdout);
      res.end();
    }
    exec("git version", puts);
    /*
    var x = new git.Repo(
      "https://alonrotem:r0t3mPa$$@github.com/literaturnirazgovori/literaturnirazgovori.github.io.git",
      { working_directory: "C:\\" },
      function() {
        console.log("rep");
      }
    );*/
  });
};
