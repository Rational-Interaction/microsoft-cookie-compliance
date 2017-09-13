const DEFAULT_CONSENT_URI = 'https://uhf.microsoft.com/en-us/shell/api/mscc';

const koaMiddlewareFactory = require('./lib/koa');
const expressMiddlewareFactory = require('./lib/express');
const registerHandlebarsHelpers = require('./lib/handlebars');


const request      = require('request-promise');
const cacheManager = require('cache-manager');
const memoryCache  = cacheManager.caching({store: 'memory', max: 100, ttl: 31*24*60*60/*seconds*/}); // 1month

let MSCC = class {
	constructor (options = {}) {
		this.domain = options.domain;
		this.consentUri = options.consentUri || DEFAULT_CONSENT_URI;
		this.siteName = options.siteName || 'unknown';
		this.koa = koaMiddlewareFactory(this);
		this.express = expressMiddlewareFactory(this);
	}

	isConsentRequired(ip) {
		return request({
			uri : 'http://api.wipmania.com/' + ip + '?' + this.domain
		}).then((country) => {
			let uri = this.consentUri + '?sitename=' + this.siteName + '&domain=' + this.domain;

			if(country && country !== 'XX') {
				// may need to check for this format: 50.46.128.150<br>US
				uri = uri + '&country=' + country;
			}

			const key = country;

			return memoryCache.wrap(key, function() {
				return request({
					uri: uri,
					json: true
				}).promise();
			});
		});
	}
}
MSCC.registerHandlebars = registerHandlebarsHelpers;
module.exports = MSCC;
