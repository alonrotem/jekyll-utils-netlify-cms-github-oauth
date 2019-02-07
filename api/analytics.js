//https://developers.google.com/analytics/devguides/reporting/core/v4/rest/v4/reports/batchGet#MetricFilter
//https://console.developers.google.com/apis/credentials?project=literaturnirazgovori
//https://github.com/googleapis/google-api-nodejs-client/blob/master/samples/analyticsReporting/batchGet.js
//https://developers.google.com/analytics/devguides/reporting/core/dimsmets#view=detail&group=page_tracking
require("dotenv").config();
const { google } = require("googleapis");
const url = require("url");
const scopes = "https://www.googleapis.com/auth/analytics.readonly";

module.exports = function(app) {
  app.post("/api/ganalytics/pagevies", (req, res) => {
    let tomorrow = new Date();
    tomorrow.setDate(new Date().getDate() + 1);
    let tomorrowDateString =
      tomorrow.getFullYear() +
      "-" +
      ("0" + (tomorrow.getMonth() + 1)).slice(-2) +
      "-" +
      ("0" + tomorrow.getDate()).slice(-2);

    let referrerpage = req.get("referrer");
    let page;
    if (req.body && req.body.page) {
      page = decodeURI(req.body.page);
    } else if (referrerpage) {
      const callerPageUrl = url.parse(req.get("referrer"));
      page = decodeURI(callerPageUrl.path);
    } else {
      page = decodeURI(url.parse(req.url).path);
    }

    const jwtoken = new google.auth.JWT(
      process.env.GOOGLE_API_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_API_PRIVATE_KEY,
      scopes
    );

    const analyticsreporting = google.analyticsreporting({
      version: "v4",
      auth: jwtoken
    });
    analyticsreporting.reports
      .batchGet({
        requestBody: {
          reportRequests: [
            {
              viewId: process.env.GOOGLE_ANALYTICS_VIEW_ID,
              dateRanges: [
                {
                  startDate: process.env.GOOGLE_ANALYTICS_VIEWS_START_DATE,
                  endDate: tomorrowDateString
                }
              ],
              metrics: [
                {
                  expression: "ga:pageviews"
                }
              ],
              dimensions: [{ name: "ga:pagePath" }],
              dimensionFilterClauses: [
                {
                  operator: "OPERATOR_UNSPECIFIED",
                  filters: [
                    {
                      dimensionName: "ga:pagePath",
                      operator: "REGEXP",
                      expressions: [page]
                    }
                  ]
                }
              ],
              samplingLevel: "LARGE"
            }
          ]
        }
      })
      .then(function(result) {
        res.header("Content-Type", "application/json; charset=utf-8");
        if (result.data.reports[0].data.rows) {
          let pviews = 0;
          for (let i = 0; i < result.data.reports[0].data.rows.length; i++) {
            if (result.data.reports[0].data.rows[i].metrics[0].values[0]) {
              let npviews = parseInt(
                result.data.reports[0].data.rows[i].metrics[0].values[0]
              );
              if (!isNaN(npviews)) pviews += npviews;
            }
          }
          res.json({
            error: "",
            page: result.data.reports[0].data.rows[0].dimensions[0],
            views: pviews
          });
        } else {
          res.json({
            error: "No resuls for page " + page
          });
        }
      })
      .catch(function(err) {
        res.json({
          error: err.toString()
        });
      });
  });
};
