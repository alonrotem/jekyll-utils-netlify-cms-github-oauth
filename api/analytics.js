//https://developers.google.com/analytics/devguides/reporting/core/v4/rest/v4/reports/batchGet#MetricFilter
//https://console.developers.google.com/apis/credentials?project=literaturnirazgovori
//https://github.com/googleapis/google-api-nodejs-client/blob/master/samples/analyticsReporting/batchGet.js
//https://developers.google.com/analytics/devguides/reporting/core/dimsmets#view=detail&group=page_tracking
const { google } = require("googleapis");
//const compute = google.compute("v1");
const scopes = "https://www.googleapis.com/auth/analytics.readonly";

module.exports = function(app) {
  app.get("/api/ganalytics/pagevies", (req, res) => {
    //const jwt = new google.auth.JWT(process.env.CLIENT_EMAIL, null, process.env.PRIVATE_KEY, scopes);
    const page =
      "/interviews/2019/01/30/09-54-васил-панайотов-човек-не-бива-да-губи-много-време-със-съвременните-български-писатели.html";
    const jwtoken = new google.auth.JWT(
      "literaturnirazgovori@appspot.gserviceaccount.com",
      null,
      "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDCPLnKK9J6qGHZ\ngxC8jRQOfV1m8Mrl9/7wYfrCCFilUcTZ8MZxi62LOVqHTiyh/xV0hIPE4WH0LAvx\nptlQELdrvpeRFU1dZ6dAlTJx9qaBt1em88WMGlAjIFN5cWOT5H4aEmvRj4CEP/qN\n+h111NXBgWfmPU0XyKSNl8xy7wr4bHvmv5SXTfEbW4/kqtUU9aPlmPspEqv7NPt6\ngpx+ZpEI13F/gfDbFz2HjDhFzfIUyNYOMWSJCkk/hthSvmM0o7JiYM43Utd2mZRb\npUsnzbkOC3+e4MCGRt6JBVmJxxoTb79K2dR/z31Z4W5mMXt9JToBPKa0WUoUE7Sh\nm7suMl+nAgMBAAECggEADRYI8QVRduYP7EGXnRG8KjBpXIgYg18uk9oQtNsvGGQ7\n6PBUePiPcUkklOfAELdI0MLPcIeRZovuehINo1vySkCwTBwCoapcFaPM9D9JKdrE\n/asqwgJRJ9dZCF41S+ohp3avljzJdx+AV+m5QQ5dIF5W4PzRoX/pEN5gmIBhCCou\nMBWtVykIA2dOBodKcZXMO2mMZCuWKjLc6/vToX16dM1nEd4bTG4eziYNIJPPLYrM\no7UP2D4q96zY5Tcha4pmucu0aKj+P75cn30FWTv79AtLITnv52mASvEXUkpzmzy2\nAqPFznOSCORvrnZJGDXwoGO0xZKeWLtMC+doICUhIQKBgQDfrLO/3uVN1V2Z7jVC\noTv1KRs59jCC/9FvTzhOEihAGc97MDT5pePioKLYFmLuHLs8bAvm5GvU/EfODou+\nEtcJRbULK7opeGhHAsIoCoXKc0ubYz1rcHYgAT7cN9/yU+cOGdPmZQb/Do4ZBjD/\nUxac75rU5CKjoPKB4XsG6JDH2QKBgQDeTu1APlvuHpERubKMkIvthCXKm5ifT9M6\nmbe3mV1blfGW4PR1pl9FUWPe+EhvYpUlc4Jmfc95OCndHai7eSp+vJfELwmSUC3h\nIINOWjyxQqAW1qcX71nxBj7hAPANLD83qjalWKoVcKMeeVw8FlKYN9c/jYiPms75\n+gX0WKczfwKBgCn9UtUvM97TsjmmdUsn14ijid/srpi5C4kY1xoY4IOAFOosV5WS\nJeCyhT+JnFLVA/VI10cmFHQsVBKDuooZIVM1SdJqCA2m8/R4uRgpOYqS8FugWrRj\nrVk+wp02xAzK4XJNOPFkf9a71cMu3V3hLDqT5H4YwcPz//KP8LeQSzWpAoGAfy78\ngQKsKYEHUfLBebXAuDQgQtfd61cJ677B4qI1TQ5t1voAIcb7PncgAhJdrovh9Dkv\nY1+a8Sj2mnA7dnYNn9BZq32VpkWE2gV12b+6dVc+q5JGqmTfOgtusd+NdpvX1wrk\nlJgzRmzYhbi80gubWUapOMzKUg4pV8541aBamBUCgYEA1VvFcNsUGs/GmWfRdwFC\n9RR7CWsbCEe/A4XlBXfagjUN1ePg+r9bq9jRj1nKBPpwPaG+LkMMPbRnmZyTUmcF\nH/LrV0Tvy0MXlUtutxZo1wlny9cCnI94FDWOydmmIo1U+hwAwZEtfk/IRkOtFxH3\njazTee7GHiKRL+FbIwYJw4g=\n-----END PRIVATE KEY-----\n",
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
              viewId: "188425543",
              dateRanges: [
                {
                  startDate: "2019-01-01",
                  endDate: "2019-02-07"
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
                      operator: "EXACT",
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
        res.write(
          "Page: " +
            result.data.reports[0].data.rows[0].dimensions[0] +
            "\nViews:" +
            result.data.reports[0].data.rows[0].metrics[0].values[0]
        );
        res.end();
      });
  });
};
