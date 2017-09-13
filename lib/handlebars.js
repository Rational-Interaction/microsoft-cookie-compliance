const _ = require('lodash');
const uuid = require('uuid/v1');
// Handlebars Helpers
module.exports = function (Handlebars) {
	Handlebars.registerHelper('msccConsentRequired', function (mscc, options) {
		if (!mscc || !mscc.IsConsentRequired) {
			return options.fn(this);
		}
		let id = 'mscc-'+uuid();

		return new Handlebars.SafeString(
			'<div id="'+id+'"><script type="text/javascript">' +
			'mscc.on("consent", function() {' +
			'document.getElementById("'+id+'").innerHTML = '+
			JSON.stringify(options.fn(this)).replace('</script', '<"+"/script') +
			'});' +
			'</script></div>'
		);
	});
	Handlebars.registerHelper('msccIncludes', function (mscc, options) {
      if (!mscc || !mscc.IsConsentRequired) {
        return '';
			}
			return new Handlebars.SafeString(
				_(mscc.Css).map((css) => '<link rel="stylesheet" type="text/css" href="'+css+'">').join('') +
				_(mscc.Js).map((js) => '<script src="'+js+'" type="text/javascript"></script>').join('')
			);
  }),
	Handlebars.registerHelper('msccBannerHTML', function (mscc, options) {
		if (!mscc || !mscc.IsConsentRequired) {
			return '';
		}
		return new Handlebars.SafeString(mscc.Markup);
	});
};
