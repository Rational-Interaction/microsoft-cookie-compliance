const nock = require('nock');
const fs = require('fs');
const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const GeoIP = require('../lib/geoip');
const Promise = require('bluebird');
chai.use(require('sinon-chai'))
chai.use(require('chai-as-promised'));

describe("geoip", () => {
	beforeEach(() => {
		this.maxmindDBRequest = nock('https://download.maxmind.com/')
			.get('/app/geoip_download?edition_id=GeoLite2-Country&license_key=secretKey&suffix=tar.gz')
			.replyWithFile(200, __dirname + '/../mock/GeoLite2-Country.tar.gz', { 'Content-Type': 'application/gzip' });
	});
	afterEach(() => {
		nock.cleanAll();
		if (this.clock) {
			this.clock.restore();
		}
	});

	describe('basic functionality', () => {
		it('should download and parse the file', () => {
			expect(this.maxmindDBRequest.isDone()).not.to.be.true;

			let geoip = new GeoIP({ geoIPKey: 'secretKey' });

			expect(this.maxmindDBRequest.isDone()).not.to.be.true;
			return geoip.get('71.231.28.78').then((country) => {
				expect(this.maxmindDBRequest.isDone()).to.be.true;
			});
		});
		it('can correctly identify IPs', () => {
			let geoip = new GeoIP({ geoIPKey: 'secretKey' });
			return Promise.props({
				US: geoip.get('71.231.28.78'),
				GB: geoip.get('2.31.223.212'),
				IPV6: geoip.get('2001:470:1:18::125'),
				LOCAL: geoip.get('127.0.0.1'),
				IPV6LOCAL: geoip.get('::ffff:172.18.0.1'),
				NULL: geoip.get('BadIP')
			}).then((results) => {
				expect(results.US).to.equal('US');
				expect(results.GB).to.equal('GB');
				expect(results.IPV6).to.equal('US');
				expect(results.LOCAL).to.equal(null);
				expect(results.IPV6LOCAL).to.equal(null);
				expect(results.NULL).to.equal(null);
			});
		});
		it('allows the db to be updated', () => {
			this.updateDBRequest = nock('https://download.maxmind.com/')
				.get('/app/geoip_download?edition_id=GeoLite2-Country&license_key=secretKey&suffix=tar.gz')
				.replyWithFile(200, __dirname + '/../mock/GeoLite2-Country.tar.gz', { 'Content-Type': 'application/gzip' });

			let geoip = new GeoIP({ geoIPKey: 'secretKey' });
			return geoip.get('71.231.28.78').then((country) => {
				this.lookup = geoip.lookup;
				this.loadedPromise = geoip.loadedPromise;
				this.file = geoip.file;
				expect(fs.existsSync(this.file.path)).to.be.true
				expect(this.maxmindDBRequest.isDone()).to.be.true;
				expect(this.updateDBRequest.isDone()).not.to.be.true;
				return geoip.updateDB();
			}).then(() => {
				expect(this.lookup).not.to.equal(geoip.lookup);
				expect(this.loadedPromise).not.to.equal(geoip.loadedPromise);
				expect(this.updateDBRequest.isDone()).to.be.true;
				return new Promise((resolve) => {
					setTimeout(resolve, 200);
				});
			}).then(() => {
				expect(fs.existsSync(this.file.path)).not.to.be.true
			});
		});
		it('updates on cron', (done) => {
			this.clock = sinon.useFakeTimers();
			this.updateDBRequest = nock('https://download.maxmind.com/')
				.get('/app/geoip_download?edition_id=GeoLite2-Country&license_key=secretKey&suffix=tar.gz')
				.replyWithFile(200, __dirname + '/../mock/GeoLite2-Country.tar.gz', { 'Content-Type': 'application/gzip' });

			let geoip = new GeoIP({ geoIPKey: 'secretKey' });
			sinon.spy(GeoIP.prototype, 'updateDB');
			geoip.startAutoUpdate();
			geoip.updateDB.should.not.have.been.called;
			this.clock.tick(1000*60*60*24*7);
			geoip.updateDB.should.have.been.called;
			geoip.stopAutoUpdate();
			done();

		});
	});
	describe('error handling', () => {
		beforeEach(() => {
			//expect(process.env.npm_config_geoIPKey).not.to.be.null;

			this.geoip = new GeoIP({ geoIPKey: 'secretKey' });
			return this.geoip.get('71.231.28.78').then((country) => {
				expect(this.maxmindDBRequest.isDone()).to.be.true;
			});
		});
		it('correctly handles errors downloading the file', () => {
			this.updateDBRequest = nock('https://download.maxmind.com/')
				.get('/app/geoip_download?edition_id=GeoLite2-Country&license_key=secretKey&suffix=tar.gz')
				.replyWithError('something awful happened');
			var stub = sinon.stub(this.geoip, '_downloadDBFile').callThrough();
			return this.geoip.updateDB().catch((err) => {
				expect(err.message).to.equal('something awful happened');
				expect(this.updateDBRequest.isDone()).to.be.true;
				return this.geoip.get('71.231.28.78')
			}).then((country) => {
				expect(country).to.equal('US');
				return new Promise((resolve) => {
					setTimeout(resolve, 200);
				});
			}).then(() => {
				expect(fs.existsSync(stub.args[0][1].path)).not.to.be.true
			});
		});
		it('correctly handles errors parsing the file', () => {
			this.updateDBRequest = nock('https://download.maxmind.com/')
				.get('/app/geoip_download?edition_id=GeoLite2-Country&license_key=secretKey&suffix=tar.gz')
				.replyWithFile(500, __dirname + '/../mock/msccResponse.consentRequired.js', { 'Content-Type': 'application/gzip' });
			var stub = sinon.stub(this.geoip, '_downloadDBFile').callThrough();
			return this.geoip.updateDB().catch((err) => {
				expect(err.code).to.equal('Z_DATA_ERROR');
				expect(this.updateDBRequest.isDone()).to.be.true;
				return this.geoip.get('71.231.28.78')
			}).then((country) => {
				expect(country).to.equal('US');
				return new Promise((resolve) => {
					setTimeout(resolve, 200);
				});
			}).then(() => {
				expect(fs.existsSync(stub.args[0][1].path)).not.to.be.true
			});
		});
	});
});
