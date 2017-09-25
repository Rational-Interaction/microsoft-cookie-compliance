const _ = require('lodash');
const uuid = require('uuid/v1');
const fs = require('fs');
const clientHelpers = fs.readFileSync(__dirname + '/lib/handlebars-clientSide.js');

// Handlebars Helpers
var helpers = function (Handlebars) {
	Handlebars.registerHelper('msccConsentRequired', helpers.msccConsentRequired = function (mscc, options) {
		if (!mscc || !mscc.IsConsentRequired) {
			return options.fn(this);
		} else if (mscc.Error || !mscc.Markup) {
			return '';
		}
		let id = 'mscc-'+uuid();

		return new Handlebars.SafeString(
			'<script type="text/javascript" id="'+id+'">' +
				'msccHandlebars.replaceOnConsent(document.getElementById("'+id+'"), ' +
				JSON.stringify(options.fn(this)).replace(/<\/script/g, '<"+"/script') + '); ' +
			'</script>'
		);
	});
	Handlebars.registerHelper('msccIncludes', helpers.msccIncludes = function (mscc, options) {
		if (!mscc || !mscc.IsConsentRequired || mscc.Error || !mscc.Markup) {
			return new Handlebars.SafeString(
				'<script type="text/javascript">'+clientHelpers+'</script>'
			);
		}
		return new Handlebars.SafeString(
			_(mscc.Css).map((css) => '<link rel="stylesheet" type="text/css" href="'+css+'">').join('') +
			_(mscc.Js).map((js) => '<script src="'+js+'" type="text/javascript"></script>').join('') +
			'<script type="text/javascript">'+clientHelpers+'</script>'
		);
	}),
	Handlebars.registerHelper('msccBannerHTML', helpers.msccBannerHTML = function (mscc, options) {
		if (!mscc || !mscc.IsConsentRequired) {
			return '';
		}
		return new Handlebars.SafeString(mscc.Markup || '');
	});
};
module.exports = helpers;
