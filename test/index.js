const nock = require('nock');
const fs = require('fs');
const _ = require('lodash');
const chai = require('chai');
const should = chai.should();
const expect = chai.expect;
const sinon = require('sinon');
chai.use(require('sinon-chai'))
chai.use(require('chai-as-promised'));
const {mockReq, mockRes} = require('sinon-express-mock')

const MSCC = require('../index.js');
const Handlebars = require('handlebars');

const makeReq = (req) => {
	return mockReq(_.merge({}, {
		ip: '127.0.0.1',
		headers: {},
		connection: { remoteAddress: !req || req.ip }
	}, req));
}
const makeCtx = (ctx) => {
	return _.merge({}, {
		ip: '127.0.0.1',
		state: {},
		req: {
			headers: {},
			connection: { remoteAddress: !ctx || ctx.ip }
		},
		request: {
			query: {}
		},
		cookies: {
			get: function() {
				return null;
			}
		}
	}, ctx);
}

beforeEach(() => {
	nock.cleanAll();
	this.mscc = new MSCC({
		domain: 'example.com',
		siteName: 'testing',
		consentUri: 'http://test.microsoft.com/'
	});
	this.ipRequest = nock('http://api.wipmania.com/')
		.get('/127.0.0.1?example.com')
		.reply(200, 'US');

	this.microsoftRequest = nock('http://test.microsoft.com/')
		.get('/?sitename=testing&domain=example.com&country=US')
		.reply(200, require('../mock/msccResponse.noConsent'));
})

describe("basic functionality", () => {
	it("can be instantiated", () => {
		let mscc = new MSCC({
			domain: 'example.com'
		});
		should.exist(mscc);
		mscc.should.be.instanceof(MSCC);
	});
	it("finds the current user's country from their IP address, then queries the compliance API", () => {
		return this.mscc.isConsentRequired('127.0.0.1').then((cookieConsent) => {
			expect(this.ipRequest.isDone()).to.be.true;
			expect(this.microsoftRequest.isDone()).to.be.true;
			expect(cookieConsent).to.deep.equal(require('../mock/msccResponse.noConsent'));
		});
	});
	it('if it cannot contact an the MSCC API it should fail conservatively', () => {
		this.ipRequest = nock('http://api.wipmania.com/')
			.get('/127.0.0.2?example.com')
			.reply(200, 'euregion');
		this.microsoftRequest = nock('http://test.microsoft.com/')
			.get('/?sitename=testing&domain=example.com&country=euregion')
			.reply(500);
		return this.mscc.isConsentRequired('127.0.0.2').then((cookieConsent) => {
			expect(this.ipRequest.isDone()).to.be.true;
			expect(this.microsoftRequest.isDone()).to.be.true;
			expect(cookieConsent).to.deep.equal({
				"IsConsentRequired": true,
				"Error": true
			});
		});
	});
	it('if it cannot determine the country from the IP, it assumes euregion', () => {
		this.ipRequest = nock('http://api.wipmania.com/')
			.get('/127.0.0.2?example.com')
			.reply(200, 'XX');
		this.microsoftRequest = nock('http://test.microsoft.com/')
			.get('/?sitename=testing&domain=example.com&country=euregion')
			.reply(200, require('../mock/msccResponse.consentRequired'));

		return this.mscc.isConsentRequired('127.0.0.2').then((cookieConsent) => {
			expect(this.ipRequest.isDone()).to.be.true;
			expect(this.microsoftRequest.isDone()).to.be.true;
			expect(cookieConsent).to.deep.equal(require('../mock/msccResponse.consentRequired'));
		});
	});
	it('if it cannot contact an the geolocation API it should fail conservatively', () => {
		this.ipRequest = nock('http://api.wipmania.com/')
			.get('/127.0.0.2?example.com')
			.reply(500);
		return this.mscc.isConsentRequired('127.0.0.2').then((cookieConsent) => {
			expect(this.ipRequest.isDone()).to.be.true;
			expect(cookieConsent).to.deep.equal(require('../mock/msccResponse.consentRequired'));
		})
	});
	it('supports a debug mode', () => {
		this.microsoftRequest = nock('http://test.microsoft.com/')
			.get('/?sitename=testing&domain=example.com&country=euregion&mscc_eudomain=true')
			.reply(200, require('../mock/msccResponse.consentRequired'));

		return this.mscc.isConsentRequired('127.0.0.1', true).then((cookieConsent) => {
			expect(this.ipRequest.isDone()).not.to.be.true;
			expect(this.microsoftRequest.isDone()).to.be.true;
			expect(cookieConsent).to.deep.equal(require('../mock/msccResponse.consentRequired'));
		});
	});

});
describe("caching", () => {
	it("caches requests for the microsoft API", () => {
		this.ipRequest = nock('http://api.wipmania.com/')
			.get('/127.0.0.2?example.com')
			.times(2)
			.reply(200, 'UK');
		this.microsoftRequest = nock('http://test.microsoft.com/')
			.get('/?sitename=testing&domain=example.com&country=UK')
			.reply(200, require('../mock/msccResponse.noConsent'));
		return this.mscc.isConsentRequired('127.0.0.2').then((cookieConsent) => {
			expect(this.ipRequest.isDone()).to.be.false;
			expect(this.microsoftRequest.isDone()).to.be.true;
			expect(cookieConsent).to.deep.equal(require('../mock/msccResponse.noConsent'));
			return this.mscc.isConsentRequired('127.0.0.2');
		}).then((cookieConsent) => {
				expect(this.ipRequest.isDone()).to.be.true;
				expect(this.microsoftRequest.isDone()).to.be.true;
				expect(cookieConsent).to.deep.equal(require('../mock/msccResponse.noConsent'));
		});
	});
});
describe("express middleware", () => {
	beforeEach(() => {
		this.req = makeReq({ip: '127.0.0.1'});
		this.res = mockRes();
	});
	it("pulls the IP from the request object", (done) => {
		this.mscc.express(this.req, this.res, () => {
			expect(this.ipRequest.isDone()).to.be.true;
			done();
		});
	});
	it("respects the X-Forwarded-For header", (done) => {
		this.req = makeReq({
			ip: '203.0.113.19',
			headers: {
				'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178'
			}
		});
		this.ipRequest = nock('http://api.wipmania.com/')
			.get('/203.0.113.195?example.com')
			.reply(200, 'euregion');
		this.mscc.express(this.req, this.res, () => {
			expect(this.ipRequest.isDone()).to.be.true;
			done();
		});
	});
	it("ignores the end of the X-Forwarded-For chain if it contains unroutable IPs", (done) => {
		this.req = makeReq({
			ip: '203.0.113.19',
			headers: {
				'x-forwarded-for': '127.0.0.1, 10.0.0.1, 192.168.0.1, 150.172.238.178'
			}
		});
		this.ipRequest = nock('http://api.wipmania.com/')
			.get('/150.172.238.178?example.com')
			.reply(200, 'euregion');
		this.mscc.express(this.req, this.res, () => {
			expect(this.ipRequest.isDone()).to.be.true;
			done();
		});
	});
	it("automatically attaches cookie compliance information to the locals", (done) => {
		this.mscc.express(this.req, this.res, () => {
			expect(this.res.locals.mscc).to.deep.equal(require('../mock/msccResponse.noConsent'));
			done();
		});
	});
	it("skips the cookie compliance check if the user already has given consent (tracked via cookie)", (done) => {
		this.req = makeReq({
			ip: '127.0.0.1',
			cookies: {
				'MSCC': 'true'
			}
		});
		this.mscc.express(this.req, this.res, () => {
			expect(this.ipRequest.isDone()).to.be.false;
			expect(this.res.locals).to.exist;
			expect(this.res.locals.mscc).not.to.exist;
			done();
		});
	});
	it("should enable debug mode if the mscc_eudomain=true query string parameter is present", (done) => {
		this.req = makeReq({
			ip: '127.0.0.1',
			query: {
				mscc_eudomain: 'true'
			}
		});
		this.mscc.express(this.req, this.res, () => {
			expect(this.ipRequest.isDone()).to.be.false;
			expect(this.res.locals.mscc).to.deep.equal(require('../mock/msccResponse.consentRequired'));
			done();
		});
	});
});
describe("koa middleware", () => {
	beforeEach(() => {
		this.ctx = makeCtx({
			ip: '127.0.0.1'
		});
	});
	it("pulls the correct IP from the request object", (done) => {
		this.ctx = makeCtx({
			ip: '127.0.0.1'
		});
		this.mscc.koa(this.ctx, () => {
			expect(this.ipRequest.isDone()).to.be.true;
			done();
		});
	});
	it("respects the X-Forwarded-For header", (done) => {
		this.ctx = makeCtx({
			ip: '203.0.113.19',
			req: {
				headers: {
					'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178'
				}
			}
		});
		this.ipRequest = nock('http://api.wipmania.com/')
			.get('/203.0.113.195?example.com')
			.reply(200, 'euregion');
		this.mscc.koa(this.ctx, () => {
			expect(this.ipRequest.isDone()).to.be.true;
			done();
		});
	});
	it("ignores the end of the X-Forwarded-For chain if it contains unroutable IPs", (done) => {
		this.ctx = makeCtx({
			ip: '203.0.113.19',
			req: {
				headers: {
					'x-forwarded-for': '127.0.0.1, 10.0.0.1, 192.168.0.1, 150.172.238.178'
				}
			}
		});
		this.ipRequest = nock('http://api.wipmania.com/')
			.get('/150.172.238.178?example.com')
			.reply(200, 'euregion');
		this.mscc.koa(this.ctx, () => {
			expect(this.ipRequest.isDone()).to.be.true;
			done();
		});
	});
	it("automatically attaches cookie compliance information to the locals", (done) => {
		this.mscc.koa(this.ctx, () => {
			expect(this.ctx.state.mscc).to.deep.equal(require('../mock/msccResponse.noConsent'));
			done();
		});
	});
	it("skips the cookie compliance check if the user already has given consent (tracked via cookie)", (done) => {
		this.ctx = makeCtx({
			ip: '127.0.0.1',
			cookies: {
				get: function() {
					return true;
				}
			}
		});
		this.mscc.koa(this.ctx, () => {
			expect(this.ipRequest.isDone()).to.be.false;
			expect(this.ctx.state).to.exist;
			expect(this.ctx.state.mscc).not.to.exist;
			done();
		});
	});
	it("should enable debug mode if the mscc_eudomain=true query string parameter is present", (done) => {
		this.ctx = makeCtx({
			ip: '127.0.0.1',
			request: {
				query: {
					mscc_eudomain: 'true'
				}
			}
		});
		this.mscc.koa(this.ctx, () => {
			expect(this.ipRequest.isDone()).to.be.false;
			expect(this.ctx.state.mscc).to.deep.equal(require('../mock/msccResponse.consentRequired'));
			done();
		});
	});
});
describe("handlebars helper", () => {
	it('can automatically register the helpers', () => {
		MSCC.registerHandlebars(Handlebars);
	})
	describe('msccConsentRequired', () => {
		beforeEach(() => {
			this.template = Handlebars.compile('{{#msccConsentRequired mscc}}Done{{/msccConsentRequired}}');
		})
		it("lets content through if the user has given consent", () => {
			let rendered = this.template();
			expect(rendered).to.equal('Done');
		});
		it("lets content through if consent isn't required", () => {
			let rendered = this.template({
				mscc: require('../mock/msccResponse.noConsent')
			});
			expect(rendered).to.equal('Done');
		});
		it("wraps content with a delayed loader if consent is required but hasn't been given yet", () => {
			let rendered = this.template({
				mscc: require('../mock/msccResponse.consentRequired')
			});
			expect(rendered).to.have.string('</script>');
		});
		it("properly escapes HTML/Javascript content for the delayed loader", () => {
			this.template = Handlebars.compile(
				'{{#msccConsentRequired mscc}}<div>\'"<script></script><script></script></div>{{/msccConsentRequired}}', {
					strict: true
				}
			);
			let rendered = this.template({
				mscc: require('../mock/msccResponse.consentRequired')
			});
			rendered = rendered.slice(0, -1*'</script>'.length);
			expect(rendered).not.to.have.string('</script>');
			expect(rendered).to.have.string('"<div>\'\\"<script><"+"/script><script><"+"/script></div>"');
		});
		it("is blank if it cannot contact the MSCC API servers", () => {
			let rendered = this.template({
				mscc: require('../mock/msccResponse.error')
			});
			expect(rendered).to.equal('');
		});
	});
	describe("msccIncludes", () => {
		beforeEach(() => {
			this.template = Handlebars.compile('{{msccIncludes mscc}}');
		})
		it("embeds the assets (CSS, Javascript) required for the compliance banner when consent is required", () => {
			let rendered = this.template({
				mscc: require('../mock/msccResponse.consentRequired')
			});
			expect(rendered).to.contain('<link rel="stylesheet" type="text/css" href="https://uhf.microsoft.com/mscc/statics/mscc-0.2.2.min.css">');
			expect(rendered).to.contain('<script src="https://uhf.microsoft.com/mscc/statics/mscc-0.2.2.min.js" type="text/javascript"></script>');
			expect(rendered).to.contain(fs.readFileSync('lib/handlebars-clientSide.js').toString());
		});
		it("not to contain JS/CSS includes if consent isn't required", () => {
			let rendered = this.template({
				mscc: require('../mock/msccResponse.noConsent')
			});

			expect(rendered).not.to.contain('<link rel="stylesheet" type="text/css" href="https://uhf.microsoft.com/mscc/statics/mscc-0.2.2.min.css">');
			expect(rendered).not.to.contain('<script src="https://uhf.microsoft.com/mscc/statics/mscc-0.2.2.min.js" type="text/javascript"></script>');
			expect(rendered).to.contain(fs.readFileSync('lib/handlebars-clientSide.js').toString());

		});
		it("not to contain JS/CSS includes if consent is already provided", () => {
			let rendered = this.template();

			expect(rendered).not.to.contain('<link rel="stylesheet" type="text/css" href="https://uhf.microsoft.com/mscc/statics/mscc-0.2.2.min.css">');
			expect(rendered).not.to.contain('<script src="https://uhf.microsoft.com/mscc/statics/mscc-0.2.2.min.js" type="text/javascript"></script>');
			expect(rendered).to.contain(fs.readFileSync('lib/handlebars-clientSide.js').toString());
		});
		it("not to contain JS/CSS includes if it cannot contact the MSCC API servers", () => {
			let rendered = this.template({
				mscc: require('../mock/msccResponse.error')
			});

			expect(rendered).not.to.contain('<link rel="stylesheet" type="text/css" href="https://uhf.microsoft.com/mscc/statics/mscc-0.2.2.min.css">');
			expect(rendered).not.to.contain('<script src="https://uhf.microsoft.com/mscc/statics/mscc-0.2.2.min.js" type="text/javascript"></script>');
			expect(rendered).to.contain(fs.readFileSync('lib/handlebars-clientSide.js').toString());
		});
	});
	describe("msccBannerHTML", () => {
		beforeEach(() => {
			this.template = Handlebars.compile('{{msccBannerHTML mscc}}');
		})
		it('include the html required for the compliance banner', () => {
			let rendered = this.template({
				mscc: require('../mock/msccResponse.consentRequired')
			});
			expect(rendered).to.equal(require('../mock/msccResponse.consentRequired').Markup);
		});
		it("is blank if consent isn't required", () => {
			let rendered = this.template({
				mscc: require('../mock/msccResponse.noConsent')
			});
			expect(rendered).to.equal('');
		});
		it("is blank if consent is already provided", () => {
			let rendered = this.template();
			expect(rendered).to.equal('');
		});
		it("is blank if it cannot contact the MSCC API servers", () => {
			let rendered = this.template({
				mscc: require('../mock/msccResponse.error')
			});
			expect(rendered).to.equal('');
		});
	});
	describe("logging", () => {
		it('should call the provided log method when you make requests', (done) => {
			this.mscc = new MSCC({
				domain: 'example.com',
				siteName: 'testing',
				consentUri: 'http://test.microsoft.com/',
				log: this.logger = sinon.spy()
			});
			this.logger.should.not.have.been.called;
			this.mscc.isConsentRequired('127.0.0.1').then(() => {
				this.logger.should.have.been.called;
				done();
			});
		});
	});
});
