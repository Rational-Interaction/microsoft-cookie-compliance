const COOKIE_PROPERTY = 'MSCC';
// Koa Middleware Factory
module.exports = function (mscc) {
	return (async function (ctx, next) {
		if (ctx.cookies && ctx.cookies.get(COOKIE_PROPERTY)) {
			await next();
			return;
		}
		let cookieConsent = await mscc.isConsentRequired(ctx.ip);
		if (cookieConsent) {
			ctx.state.mscc = cookieConsent;
		}
		await next();
	});
}
