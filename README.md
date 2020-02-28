# microsoft-cookie-compliance
Tools for bringing Microsoft websites into compliance with the EU cookie policies.

## Usage
Create an instance of the module:
```javascript
var MSCC = require('microsoft-cookie-compliance');
var mscc = new MSCC({
  domain: 'partners.office.com', // Domain of the site
  siteName: 'Office 365 Partner Portal', // This should be same as name the site is registered with on the cookie portal
  geoIPKey: 'secretKey', // secret key for the GEOIP database service
  overrideGeoIP: 'US', // (optional) allow GEOIP database to be skipped and hardcoded to a specific value - useful to avoid downloading the database a lot during development
  consentUri: 'https://uhf.microsoft.com/en-us/shell/api/mscc' // (optional) the locale specified is used to generate a banner with the correct language
});
```

### Express Middleware
For each request the express middleware will ensure the cookie compliance information is attached to `res.locals.mscc` to support the handlebars helpers
```javascript
app.use(require('microsoft-cookie-compliance/express')(mscc));
```

### Koa 2 Middleware
For each request the koa middleware will ensure the cookie compliance information is attached to `ctx.state.mscc` to support the handlebars helpers
```javascript
app.use(require('microsoft-cookie-compliance/koa')(mscc));
```

### Handlebars Helpers
Includes 3 helpers for displaying the cookie compliance banner and conditionally including code based on compliance status. To use, first register the handlebars helpers:
```javascript
var msccRegisterHandlebars = require('microsoft-cookie-compliance/handlebars');
msccRegisterHandlebars(Handlebars);
```

#### msccConsentRequired
If consent has been obtained, or is not required, this block helper simply passes the content through to the HTML. If consent hasn't been obtained yet, it wraps the content in a javascript function that adds it to the page once consent is obtained.
```handlebars
{{#msccConsentRequired mscc}}
<!-- Analytics code goes here -->
{{/msccConsentRequired}}
```

#### msccIncludes
Inserts the Javascript and CSS references that are required to display the notification banner, and to obtain consent. This should be used once, in the header
```handlebars
{{msccIncludes mscc}}
```

#### msccBannerHTML
Inserts the HTML for the consent banner
```handlebars
{{msccBannerHTML mscc}}
```

## Development
There are two ways to run the unit tests, normally:
```bash
npm test
```
and in debug mode (using electron for debugging):
```bash
npm run debug-test
```
