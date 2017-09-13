# microsoft-cookie-compliance
Tools for bringing Microsoft websites into compliance with the EU cookie policies.

## Usage
Create an instance of the module:
```javascript
var MSCC = require('microsoft-cookie-compliance');
var mscc = new MSCC({
  domain: 'partners.office.com', // Domain of the site
  siteName: 'Office 365 Partner Portal', // This should be same as name the site is registered with on the cookie portal
  consentUri: 'https://uhf.microsoft.com/en-us/shell/api/mscc' // (optional) the locale specified is used to generate a banner with the correct language
});
```

### Express Middleware
For each request the express middleware will ensure the cookie compliance information is attached to `res.locals.mscc` to support the handlebars helpers
```javascript
app.use(mscc.express);
```

### Handlebars Helpers
Includes 3 helpers for displaying the cookie compliance banner and conditionally including code based on compliance status. To use, first register the handlebars helpers:
```javascript
MSCC.registerHandlebars(Handlebars);
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

### Notes:
* Make sure you have your ['trust proxy' setting](http://expressjs.com/en/api.html#trust.proxy.options.table) configured correctly
