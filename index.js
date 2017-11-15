const DEFAULT_CONSENT_URI = 'https://uhf.microsoft.com/en-us/shell/api/mscc';
const CONSERVATIVE_COUNTRY = 'euregion';

const request      = require('request-promise');
const GeoIP        = require('./lib/geoip');
const cacheManager = require('cache-manager');
const memoryCache  = cacheManager.caching({store: 'memory', max: 100, ttl: 31*24*60*60/*seconds*/}); // 1month
const proxyAddr    = require('proxy-addr');
const _            = require('lodash');

let MSCC = class {
	constructor (options = {}) {
		this.domain = options.domain;
		this.consentUri = options.consentUri || DEFAULT_CONSENT_URI;
		this.log = options.log || _.noop;
		this.geoip = new GeoIP();
		this.geoip.startAutoUpdate();
		this.siteName = options.siteName || 'unknown';
		this.requestTimeout = options.requestTimeout || 1500;
	}

	isConsentRequired(ip, isDebugMode) {
		if (isDebugMode) {
			this.log('Debug mode is on, defaulting country to '+CONSERVATIVE_COUNTRY)

			return this._isConsentRequiredForCountry(CONSERVATIVE_COUNTRY, true)
		} else {
			return this.geoip.get(ip).then((country) => {
				this.log('IP '+ip+' resolved to country '+country);
				return this._isConsentRequiredForCountry(country);
			}).catch(() => {
				// if we can't GEOIP the country, assume the worst
				this.log('Error contacting GEOIP api, defaulting country to '+CONSERVATIVE_COUNTRY)
				return this._isConsentRequiredForCountry(CONSERVATIVE_COUNTRY);
			});
		}
	}
	_isConsentRequiredForCountry(country, isDebugMode) {
		let uri = this.consentUri + '?sitename=' + this.siteName + '&domain=' + this.domain;

		uri = uri + '&country=' + (!country || country == 'XX' ? CONSERVATIVE_COUNTRY : country);

		if (isDebugMode) {
			this.log('Debug mode enabled, adding mscc_eudomain parameter')

			uri += '&mscc_eudomain=true';
		}

		return memoryCache.wrap(uri, () => {
			return request({
				uri: uri,
				json: true,
				timeout: this.requestTimeout
			}).promise();
		}).then((result) => {
			this.log('Response received from MSCC: '+JSON.stringify(result));
			return result;
		}, () => {
			this.log('Error contacting MSCC API')
			return {
				"IsConsentRequired": true,
				"Error": true
			}
		});
	}
	getIPFromRequest(req) {
		let ips = proxyAddr.all(req, () => true);
		this.log('X-Forwarded-For IP chain: '+ips)
		let isUnroutable = proxyAddr.compile(['loopback', 'linklocal', 'uniquelocal']);
		let ip = _.findLast(ips, (ip) => !isUnroutable(ip)) || req.ip || (req.connection && req.connection.remoteAddress);

		if (ip.split(':').length === 2) { // IPv6 addresses should have at least 2 colons, so this should be OK
			return ip.split(':')[0];
		} else {
			return ip;
		}
	}
}
module.exports = MSCC;
