const maxmind = require('maxmind');
const request = require('request');
const zlib = require('zlib');
const tar = require('tar-stream');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const tmp = require('tmp-promise');
tmp.setGracefulCleanup();

/*
 * Create an object that loads the latest information
 */
class GeoIP {
	constructor (options) {
		this.options = _.defaults({}, options, {
			source: 'GeoLite2-Country',
			lifetime: 1000*60*60*24*7 // get new databaase every week
		});
		this.dbUri = 'http://geolite.maxmind.com/download/geoip/database/'+this.options.source+'.tar.gz';

		this.loadedPromise = this.updateDB();
	}

	get(ip) {
		return this.loadedPromise.then((geoIPFn) => {
			return geoIPFn(ip);
		});
	}

	startAutoUpdate() {
		if (this.options.lifetime) {
			this.interval = setInterval(this.updateDB.bind(this), this.options.lifetime);
		}
	}

	stopAutoUpdate() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}

	_downloadDBFile(source, target) {
		return new Promise((resolve, reject) => {
			request(this.dbUri)
				.on('error', (err) => { reject(err); })
				.pipe(zlib.createGunzip())
				.on('error', (err) => { reject(err); })
				.pipe(tar.extract())
				.on('entry', (header, entry, next) => {
					var fileName = path.parse(header.name).base;
					if (fileName === source+'.mmdb') {
						entry.pipe(fs.createWriteStream(null, {fd: target.fd}));
						entry.on('end', () => {
							next();
						})
					} else {
						next();
					}
				})
				.on('error', (err) => { reject(err); })
				.on('finish', () => { resolve(target); });
		});
	}

	updateDB() {
			// TODO: retries?
		var updateFile = null;
		var updatePromise = tmp.file({ prefix: 'geoip-', postfix: '.mmdb' }).then((tmpFile) => {
			updateFile = tmpFile
			return this._downloadDBFile('GeoLite2-Country', tmpFile);
		}).then((tmpFile) => {
			return new Promise((resolve, reject) => {
				maxmind.open(tmpFile.path, {
					cache: {
						max: 1000 // max items in cache TODO: make this an option?
					}
				}, (err, lookup) => {
					if (err) {
						reject(err);
					} else {
						if (this.file) {
							this.file.cleanup();
						}
						this.file = tmpFile;
						this.lookup = lookup;
						this.loadedPromise = updatePromise; // keep .loadedPromise as a reference to the most recently completed promise
						resolve(function (ip) {
							var result = lookup.get(ip);
							var country = result && result.country && result.country.iso_code;
							return Promise.resolve(country);
						});
					}
				});
			});
		}).catch((err) => {
			updateFile.cleanup(); // delete the tmp file if something went wrong
			throw(err);
		});

		return updatePromise;
	}
}
module.exports = GeoIP;
