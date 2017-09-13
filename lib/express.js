// Express Middleware Factory
const COOKIE_PROPERTY = 'MSCC';
module.exports = function (mscc) {
	return function (req, res, next) {
		if (req.cookies && req.cookies[COOKIE_PROPERTY]) {
			next();
			return false;
		}
		mscc.isConsentRequired(req.ip).then(function (cookieConsent) {
			res.locals.mscc = cookieConsent;
			next();
		});
	}
}
