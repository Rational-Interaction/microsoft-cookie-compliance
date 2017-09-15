const _ = require('lodash');
const uuid = require('uuid/v1');
const fs = require('fs');
const clientHelpers = fs.readFileSync(__dirname + '/handlebars-clientSide.js');
// Handlebars Helpers
module.exports = function (Handlebars) {
	Handlebars.registerHelper('msccConsentRequired', function (mscc, options) {
		if (!mscc || !mscc.IsConsentRequired) {
			return options.fn(this);
		} else if (mscc.Error || !mscc.Markup) {
			return '';
		}
		let id = 'mscc-'+uuid();

		return new Handlebars.SafeString(
			'<div id="'+id+'"><script type="text/javascript">' +
			'mscc.on("consent", function() { ' +
			'var target = document.getElementById("'+id+'"); '+
			'target.innerHTML = '+
			JSON.stringify(options.fn(this)).replace('</script', '<"+"/script') + '; ' +
			'msccHandlebars.runScripts(target); ' +
			'});' +
			'</script></div>'
		);
	});
	Handlebars.registerHelper('msccIncludes', function (mscc, options) {
      if (!mscc || !mscc.IsConsentRequired || mscc.Error || !mscc.Markup) {
        return '';
			}
			return new Handlebars.SafeString(
				_(mscc.Css).map((css) => '<link rel="stylesheet" type="text/css" href="'+css+'">').join('') +
				_(mscc.Js).map((js) => '<script src="'+js+'" type="text/javascript"></script>').join('') +
				'<script type="text/javascript">'+clientHelpers+'</script>'
			);
  }),
	Handlebars.registerHelper('msccBannerHTML', function (mscc, options) {
		if (!mscc || !mscc.IsConsentRequired) {
			return '';
		}
		return new Handlebars.SafeString(mscc.Markup || '');
	});
};
