const DEFAULT_CONSENT_URI = 'https://uhf.microsoft.com/en-us/shell/api/mscc';
const CONSERVATIVE_COUNTRY = 'euregion';

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

	isConsentRequired(ip, isDebugMode) {
		if (isDebugMode) {
			return this._isConsentRequiredForCountry(CONSERVATIVE_COUNTRY, true)
		} else {
			return request({
				uri : 'http://api.wipmania.com/' + ip + '?' + this.domain
			}).then((country) => this._isConsentRequiredForCountry(country)).catch(() => {
				// if we can't GEOIP the country, assume the worst
				return this._isConsentRequiredForCountry(CONSERVATIVE_COUNTRY);
			});
		}
	}
	_isConsentRequiredForCountry(country, isDebugMode) {
		let uri = this.consentUri + '?sitename=' + this.siteName + '&domain=' + this.domain;

		uri = uri + '&country=' + (!country || country == 'XX' ? CONSERVATIVE_COUNTRY : country);

		if (isDebugMode) {
			uri += '&mscc_eudomain=true';
		}

		return memoryCache.wrap(uri, function() {
			return request({
				uri: uri,
				json: true
			}).promise();
		}).catch(() => {
			return {
				"IsConsentRequired": true,
				"Error": true
			}
		});
	}
}
MSCC.registerHandlebars = registerHandlebarsHelpers;
module.exports = MSCC;
