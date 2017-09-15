/* inspired by https://ghinda.net/article/script-tags/ */
// runs an array of async functions in sequential order
var msccHandlebars = {
	scripts: [],
	curIndex: 0,
	isRunning: false
};
msccHandlebars.seq = function (callback) {
	if (msccHandlebars.isRunning) {
		return;
	}
	msccHandlebars.isRunning = true;
	msccHandlebars.scripts[msccHandlebars.curIndex](function () {
		msccHandlebars.isRunning = false;
		msccHandlebars.curIndex++;
		if (msccHandlebars.curIndex === msccHandlebars.scripts.length) {
			typeof callback !== 'function' || callback();
		} else {
			msccHandlebars.seq(callback);
		}
	});
};
msccHandlebars.insertScript = function (script, callback) {
	var s = document.createElement('script');
	s.type = 'text/javascript';
	if (script.src) {
		s.onload = callback;
		s.onerror = callback;
		s.src = script.src;
	} else {
		s.textContent = script.innerText;
	}

	// re-insert the script tag so it executes.
	document.head.appendChild(s);

	// clean-up
	script.parentNode.removeChild(script);

	// run the callback immediately for inline scripts
	if (!script.src) {
		callback();
	}
}

// https://html.spec.whatwg.org/multipage/scripting.html
msccHandlebars.runScriptTypes = [
	'application/javascript',
	'application/ecmascript',
	'application/x-ecmascript',
	'application/x-javascript',
	'text/ecmascript',
	'text/javascript',
	'text/javascript1.0',
	'text/javascript1.1',
	'text/javascript1.2',
	'text/javascript1.3',
	'text/javascript1.4',
	'text/javascript1.5',
	'text/jscript',
	'text/livescript',
	'text/x-ecmascript',
	'text/x-javascript'
];

msccHandlebars.runScripts = function(container) {
	// get scripts tags from a node
	var scripts = container.querySelectorAll('script');
	var typeAttr;

	[].forEach.call(scripts, function (script) {
		typeAttr = script.getAttribute('type')

		// only run script tags without the type attribute
		// or with a javascript mime attribute value
		if (!typeAttr || msccHandlebars.runScriptTypes.indexOf(typeAttr) !== -1) {
			msccHandlebars.scripts.push(function (callback) {
				msccHandlebars.insertScript(script, callback);
			})
		}
	})

	// insert the script tags sequentially
	// to preserve execution order
	msccHandlebars.seq();
}
