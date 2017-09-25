const COOKIE_PROPERTY = 'MSCC';
// Koa Middleware Factory
module.exports = function (mscc) {
	return (async function (ctx, next) {
		if (ctx.cookies && ctx.cookies.get(COOKIE_PROPERTY)) {
			await next();
			return;
		}
		let cookieConsent = await mscc.isConsentRequired(mscc.getIPFromRequest(ctx.req), ctx.request.query && ctx.request.query.mscc_eudomain);
		if (cookieConsent) {
			ctx.state.mscc = cookieConsent;
		}
		await next();
	});
}
