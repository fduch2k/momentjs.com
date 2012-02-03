/*
 * QUnit - A JavaScript Unit Testing Framework
 * 
 * http://docs.jquery.com/QUnit
 *
 * Copyright (c) 2011 John Resig, Jörn Zaefferer
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * or GPL (GPL-LICENSE.txt) licenses.
 */

(function(window) {

var defined = {
	setTimeout: typeof window.setTimeout !== "undefined",
	sessionStorage: (function() {
		try {
			return !!sessionStorage.getItem;
		} catch(e){
			return false;
		}
  })()
};

var testId = 0;

var Test = function(name, testName, expected, testEnvironmentArg, async, callback) {
	this.name = name;
	this.testName = testName;
	this.expected = expected;
	this.testEnvironmentArg = testEnvironmentArg;
	this.async = async;
	this.callback = callback;
	this.assertions = [];
};
Test.prototype = {
	init: function() {
		var tests = id("qunit-tests");
		if (tests) {
			var b = document.createElement("strong");
				b.innerHTML = "Running " + this.name;
			var li = document.createElement("li");
				li.appendChild( b );
				li.className = "running";
				li.id = this.id = "test-output" + testId++;
			tests.appendChild( li );
		}
	},
	setup: function() {
		if (this.module != config.previousModule) {
			if ( config.previousModule ) {
				QUnit.moduleDone( {
					name: config.previousModule,
					failed: config.moduleStats.bad,
					passed: config.moduleStats.all - config.moduleStats.bad,
					total: config.moduleStats.all
				} );
			}
			config.previousModule = this.module;
			config.moduleStats = { all: 0, bad: 0 };
			QUnit.moduleStart( {
				name: this.module
			} );
		}

		config.current = this;
		this.testEnvironment = extend({
			setup: function() {},
			teardown: function() {}
		}, this.moduleTestEnvironment);
		if (this.testEnvironmentArg) {
			extend(this.testEnvironment, this.testEnvironmentArg);
		}

		QUnit.testStart( {
			name: this.testName
		} );

		// allow utility functions to access the current test environment
		// TODO why??
		QUnit.current_testEnvironment = this.testEnvironment;
		
		try {
			if ( !config.pollution ) {
				saveGlobal();
			}

			this.testEnvironment.setup.call(this.testEnvironment);
		} catch(e) {
			QUnit.ok( false, "Setup failed on " + this.testName + ": " + e.message );
		}
	},
	run: function() {
		if ( this.async ) {
			QUnit.stop();
		}

		if ( config.notrycatch ) {
			this.callback.call(this.testEnvironment);
			return;
		}
		try {
			this.callback.call(this.testEnvironment);
		} catch(e) {
			fail("Test " + this.testName + " died, exception and test follows", e, this.callback);
			QUnit.ok( false, "Died on test #" + (this.assertions.length + 1) + ": " + e.message + " - " + QUnit.jsDump.parse(e) );
			// else next test will carry the responsibility
			saveGlobal();

			// Restart the tests if they're blocking
			if ( config.blocking ) {
				start();
			}
		}
	},
	teardown: function() {
		try {
			checkPollution();
			this.testEnvironment.teardown.call(this.testEnvironment);
		} catch(e) {
			QUnit.ok( false, "Teardown failed on " + this.testName + ": " + e.message );
		}
	},
	finish: function() {
		if ( this.expected && this.expected != this.assertions.length ) {
			QUnit.ok( false, "Expected " + this.expected + " assertions, but " + this.assertions.length + " were run" );
		}
		
		var good = 0, bad = 0,
			tests = id("qunit-tests");

		config.stats.all += this.assertions.length;
		config.moduleStats.all += this.assertions.length;

		if ( tests ) {
			var ol  = document.createElement("ol");

			for ( var i = 0; i < this.assertions.length; i++ ) {
				var assertion = this.assertions[i];

				var li = document.createElement("li");
				li.className = assertion.result ? "pass" : "fail";
				li.innerHTML = assertion.message || (assertion.result ? "okay" : "failed");
				ol.appendChild( li );

				if ( assertion.result ) {
					good++;
				} else {
					bad++;
					config.stats.bad++;
					config.moduleStats.bad++;
				}
			}

			// store result when possible
			QUnit.config.reorder && defined.sessionStorage && sessionStorage.setItem("qunit-" + this.testName, bad);

			if (bad == 0) {
				ol.style.display = "none";
			}

			var b = document.createElement("strong");
			b.innerHTML = this.name + " <b class='counts'>(<b class='failed'>" + bad + "</b>, <b class='passed'>" + good + "</b>, " + this.assertions.length + ")</b>";
			
			addEvent(b, "click", function() {
				var next = b.nextSibling, display = next.style.display;
				next.style.display = display === "none" ? "block" : "none";
			});
			
			addEvent(b, "dblclick", function(e) {
				var target = e && e.target ? e.target : window.event.srcElement;
				if ( target.nodeName.toLowerCase() == "span" || target.nodeName.toLowerCase() == "b" ) {
					target = target.parentNode;
				}
				if ( window.location && target.nodeName.toLowerCase() === "strong" ) {
					window.location.search = "?" + encodeURIComponent(getText([target]).replace(/\(.+\)$/, "").replace(/(^\s*|\s*$)/g, ""));
				}
			});

			var li = id(this.id);
			li.className = bad ? "fail" : "pass";
			li.removeChild( li.firstChild );
			li.appendChild( b );
			li.appendChild( ol );

		} else {
			for ( var i = 0; i < this.assertions.length; i++ ) {
				if ( !this.assertions[i].result ) {
					bad++;
					config.stats.bad++;
					config.moduleStats.bad++;
				}
			}
		}

		try {
			QUnit.reset();
		} catch(e) {
			fail("reset() failed, following Test " + this.testName + ", exception and reset fn follows", e, QUnit.reset);
		}

		QUnit.testDone( {
			name: this.testName,
			failed: bad,
			passed: this.assertions.length - bad,
			total: this.assertions.length
		} );
	},
	
	queue: function() {
		var test = this;
		synchronize(function() {
			test.init();
		});
		function run() {
			// each of these can by async
			synchronize(function() {
				test.setup();
			});
			synchronize(function() {
				test.run();
			});
			synchronize(function() {
				test.teardown();
			});
			synchronize(function() {
				test.finish();
			});
		}
		// defer when previous test run passed, if storage is available
		var bad = QUnit.config.reorder && defined.sessionStorage && +sessionStorage.getItem("qunit-" + this.testName);
		if (bad) {
			run();
		} else {
			synchronize(run);
		};
	}
	
};

var QUnit = {

	// call on start of module test to prepend name to all tests
	module: function(name, testEnvironment) {
		config.currentModule = name;
		config.currentModuleTestEnviroment = testEnvironment;
	},

	asyncTest: function(testName, expected, callback) {
		if ( arguments.length === 2 ) {
			callback = expected;
			expected = 0;
		}

		QUnit.test(testName, expected, callback, true);
	},
	
	test: function(testName, expected, callback, async) {
		var name = '<span class="test-name">' + testName + '</span>', testEnvironmentArg;

		if ( arguments.length === 2 ) {
			callback = expected;
			expected = null;
		}
		// is 2nd argument a testEnvironment?
		if ( expected && typeof expected === 'object') {
			testEnvironmentArg =  expected;
			expected = null;
		}

		if ( config.currentModule ) {
			name = '<span class="module-name">' + config.currentModule + "</span>: " + name;
		}

		if ( !validTest(config.currentModule + ": " + testName) ) {
			return;
		}
		
		var test = new Test(name, testName, expected, testEnvironmentArg, async, callback);
		test.module = config.currentModule;
		test.moduleTestEnvironment = config.currentModuleTestEnviroment;
		test.queue();
	},
	
	/**
	 * Specify the number of expected assertions to gurantee that failed test (no assertions are run at all) don't slip through.
	 */
	expect: function(asserts) {
		config.current.expected = asserts;
	},

	/**
	 * Asserts true.
	 * @example ok( "asdfasdf".length > 5, "There must be at least 5 chars" );
	 */
	ok: function(a, msg) {
		a = !!a;
		var details = {
			result: a,
			message: msg
		};
		msg = escapeHtml(msg);
		QUnit.log(details);
		config.current.assertions.push({
			result: a,
			message: msg
		});
	},

	/**
	 * Checks that the first two arguments are equal, with an optional message.
	 * Prints out both actual and expected values.
	 *
	 * Prefered to ok( actual == expected, message )
	 *
	 * @example equal( format("Received {0} bytes.", 2), "Received 2 bytes." );
	 *
	 * @param Object actual
	 * @param Object expected
	 * @param String message (optional)
	 */
	equal: function(actual, expected, message) {
		QUnit.push(expected == actual, actual, expected, message);
	},

	notEqual: function(actual, expected, message) {
		QUnit.push(expected != actual, actual, expected, message);
	},
	
	deepEqual: function(actual, expected, message) {
		QUnit.push(QUnit.equiv(actual, expected), actual, expected, message);
	},

	notDeepEqual: function(actual, expected, message) {
		QUnit.push(!QUnit.equiv(actual, expected), actual, expected, message);
	},

	strictEqual: function(actual, expected, message) {
		QUnit.push(expected === actual, actual, expected, message);
	},

	notStrictEqual: function(actual, expected, message) {
		QUnit.push(expected !== actual, actual, expected, message);
	},

	raises: function(block, expected, message) {
		var actual, ok = false;
	
		if (typeof expected === 'string') {
			message = expected;
			expected = null;
		}
	
		try {
			block();
		} catch (e) {
			actual = e;
		}
	
		if (actual) {
			// we don't want to validate thrown error
			if (!expected) {
				ok = true;
			// expected is a regexp	
			} else if (QUnit.objectType(expected) === "regexp") {
				ok = expected.test(actual);
			// expected is a constructor	
			} else if (actual instanceof expected) {
				ok = true;
			// expected is a validation function which returns true is validation passed	
			} else if (expected.call({}, actual) === true) {
				ok = true;
			}
		}
			
		QUnit.ok(ok, message);
	},

	start: function() {
		config.semaphore--;
		if (config.semaphore > 0) {
			// don't start until equal number of stop-calls
			return;
		}
		if (config.semaphore < 0) {
			// ignore if start is called more often then stop
			config.semaphore = 0;
		}
		// A slight delay, to avoid any current callbacks
		if ( defined.setTimeout ) {
			window.setTimeout(function() {
				if ( config.timeout ) {
					clearTimeout(config.timeout);
				}

				config.blocking = false;
				process();
			}, 13);
		} else {
			config.blocking = false;
			process();
		}
	},
	
	stop: function(timeout) {
		config.semaphore++;
		config.blocking = true;

		if ( timeout && defined.setTimeout ) {
			clearTimeout(config.timeout);
			config.timeout = window.setTimeout(function() {
				QUnit.ok( false, "Test timed out" );
				QUnit.start();
			}, timeout);
		}
	}

};

// Backwards compatibility, deprecated
QUnit.equals = QUnit.equal;
QUnit.same = QUnit.deepEqual;

// Maintain internal state
var config = {
	// The queue of tests to run
	queue: [],

	// block until document ready
	blocking: true,
	
	// by default, run previously failed tests first
	// very useful in combination with "Hide passed tests" checked
	reorder: true
};

// Load paramaters
(function() {
	var location = window.location || { search: "", protocol: "file:" },
		GETParams = location.search.slice(1).split('&');

	for ( var i = 0; i < GETParams.length; i++ ) {
		GETParams[i] = decodeURIComponent( GETParams[i] );
		if ( GETParams[i] === "noglobals" ) {
			GETParams.splice( i, 1 );
			i--;
			config.noglobals = true;
		} else if ( GETParams[i] === "notrycatch" ) {
			GETParams.splice( i, 1 );
			i--;
			config.notrycatch = true;
		} else if ( GETParams[i].search('=') > -1 ) {
			GETParams.splice( i, 1 );
			i--;
		}
	}
	
	// restrict modules/tests by get parameters
	config.filters = GETParams;
	
	// Figure out if we're running the tests from a server or not
	QUnit.isLocal = !!(location.protocol === 'file:');
})();

// Expose the API as global variables, unless an 'exports'
// object exists, in that case we assume we're in CommonJS
if ( typeof exports === "undefined" || typeof require === "undefined" ) {
	extend(window, QUnit);
	window.QUnit = QUnit;
} else {
	extend(exports, QUnit);
	exports.QUnit = QUnit;
}

// define these after exposing globals to keep them in these QUnit namespace only
extend(QUnit, {
	config: config,

	// Initialize the configuration options
	init: function() {
		extend(config, {
			stats: { all: 0, bad: 0 },
			moduleStats: { all: 0, bad: 0 },
			started: +new Date,
			updateRate: 1000,
			blocking: false,
			autostart: true,
			autorun: false,
			filters: [],
			queue: [],
			semaphore: 0
		});

		var tests = id( "qunit-tests" ),
			banner = id( "qunit-banner" ),
			result = id( "qunit-testresult" );

		if ( tests ) {
			tests.innerHTML = "";
		}

		if ( banner ) {
			banner.className = "";
		}

		if ( result ) {
			result.parentNode.removeChild( result );
		}
		
		if ( tests ) {
			result = document.createElement( "p" );
			result.id = "qunit-testresult";
			result.className = "result";
			tests.parentNode.insertBefore( result, tests );
			result.innerHTML = 'Running...<br/>&nbsp;';
		}
	},
	
	/**
	 * Resets the test setup. Useful for tests that modify the DOM.
	 * 
	 * If jQuery is available, uses jQuery's html(), otherwise just innerHTML.
	 */
	reset: function() {
		if ( window.jQuery ) {
			jQuery( "#main, #qunit-fixture" ).html( config.fixture );
		} else {
			var main = id( 'main' ) || id( 'qunit-fixture' );
			if ( main ) {
				main.innerHTML = config.fixture;
			}
		}
	},
	
	/**
	 * Trigger an event on an element.
	 *
	 * @example triggerEvent( document.body, "click" );
	 *
	 * @param DOMElement elem
	 * @param String type
	 */
	triggerEvent: function( elem, type, event ) {
		if ( document.createEvent ) {
			event = document.createEvent("MouseEvents");
			event.initMouseEvent(type, true, true, elem.ownerDocument.defaultView,
				0, 0, 0, 0, 0, false, false, false, false, 0, null);
			elem.dispatchEvent( event );

		} else if ( elem.fireEvent ) {
			elem.fireEvent("on"+type);
		}
	},
	
	// Safe object type checking
	is: function( type, obj ) {
		return QUnit.objectType( obj ) == type;
	},
	
	objectType: function( obj ) {
		if (typeof obj === "undefined") {
				return "undefined";

		// consider: typeof null === object
		}
		if (obj === null) {
				return "null";
		}

		var type = Object.prototype.toString.call( obj )
			.match(/^\[object\s(.*)\]$/)[1] || '';

		switch (type) {
				case 'Number':
						if (isNaN(obj)) {
								return "nan";
						} else {
								return "number";
						}
				case 'String':
				case 'Boolean':
				case 'Array':
				case 'Date':
				case 'RegExp':
				case 'Function':
						return type.toLowerCase();
		}
		if (typeof obj === "object") {
				return "object";
		}
		return undefined;
	},
	
	push: function(result, actual, expected, message) {
		var details = {
			result: result,
			message: message,
			actual: actual,
			expected: expected
		};
		
		message = escapeHtml(message) || (result ? "okay" : "failed");
		message = '<span class="test-message">' + message + "</span>";
		expected = escapeHtml(QUnit.jsDump.parse(expected));
		actual = escapeHtml(QUnit.jsDump.parse(actual));
		var output = message + '<table><tr class="test-expected"><th>Expected: </th><td><pre>' + expected + '</pre></td></tr>';
		if (actual != expected) {
			output += '<tr class="test-actual"><th>Result: </th><td><pre>' + actual + '</pre></td></tr>';
			output += '<tr class="test-diff"><th>Diff: </th><td><pre>' + QUnit.diff(expected, actual) +'</pre></td></tr>';
		}
		if (!result) {
			var source = sourceFromStacktrace();
			if (source) {
				details.source = source;
				output += '<tr class="test-source"><th>Source: </th><td><pre>' + source +'</pre></td></tr>';
			}
		}
		output += "</table>";
		
		QUnit.log(details);
		
		config.current.assertions.push({
			result: !!result,
			message: output
		});
	},
	
	// Logging callbacks; all receive a single argument with the listed properties
	// run test/logs.html for any related changes
	begin: function() {},
	// done: { failed, passed, total, runtime }
	done: function() {},
	// log: { result, actual, expected, message }
	log: function() {},
	// testStart: { name }
	testStart: function() {},
	// testDone: { name, failed, passed, total }
	testDone: function() {},
	// moduleStart: { name }
	moduleStart: function() {},
	// moduleDone: { name, failed, passed, total }
	moduleDone: function() {}
});

if ( typeof document === "undefined" || document.readyState === "complete" ) {
	config.autorun = true;
}

addEvent(window, "load", function() {
	QUnit.begin({});
	
	// Initialize the config, saving the execution queue
	var oldconfig = extend({}, config);
	QUnit.init();
	extend(config, oldconfig);

	config.blocking = false;

	var userAgent = id("qunit-userAgent");
	if ( userAgent ) {
		userAgent.innerHTML = navigator.userAgent;
	}
	var banner = id("qunit-header");
	if ( banner ) {
		var paramsIndex = location.href.lastIndexOf(location.search);
		if ( paramsIndex > -1 ) {
			var mainPageLocation = location.href.slice(0, paramsIndex);
			if ( mainPageLocation == location.href ) {
				banner.innerHTML = '<a href=""> ' + banner.innerHTML + '</a> ';
			} else {
				var testName = decodeURIComponent(location.search.slice(1));
				banner.innerHTML = '<a href="' + mainPageLocation + '">' + banner.innerHTML + '</a> &#8250; <a href="">' + testName + '</a>';
			}
		}
	}
	
	var toolbar = id("qunit-testrunner-toolbar");
	if ( toolbar ) {
		var filter = document.createElement("input");
		filter.type = "checkbox";
		filter.id = "qunit-filter-pass";
		addEvent( filter, "click", function() {
			var ol = document.getElementById("qunit-tests");
			if ( filter.checked ) {
				ol.className = ol.className + " hidepass";
			} else {
				var tmp = " " + ol.className.replace( /[\n\t\r]/g, " " ) + " ";
				ol.className = tmp.replace(/ hidepass /, " ");
			}
			if ( defined.sessionStorage ) {
				sessionStorage.setItem("qunit-filter-passed-tests", filter.checked ? "true" : "");
			}
		});
		if ( defined.sessionStorage && sessionStorage.getItem("qunit-filter-passed-tests") ) {
			filter.checked = true;
			var ol = document.getElementById("qunit-tests");
			ol.className = ol.className + " hidepass";
		}
		toolbar.appendChild( filter );

		var label = document.createElement("label");
		label.setAttribute("for", "qunit-filter-pass");
		label.innerHTML = "Hide passed tests";
		toolbar.appendChild( label );
	}

	var main = id('main') || id('qunit-fixture');
	if ( main ) {
		config.fixture = main.innerHTML;
	}

	if (config.autostart) {
		QUnit.start();
	}
});

function done() {
	config.autorun = true;

	// Log the last module results
	if ( config.currentModule ) {
		QUnit.moduleDone( {
			name: config.currentModule,
			failed: config.moduleStats.bad,
			passed: config.moduleStats.all - config.moduleStats.bad,
			total: config.moduleStats.all
		} );
	}

	var banner = id("qunit-banner"),
		tests = id("qunit-tests"),
		runtime = +new Date - config.started,
		passed = config.stats.all - config.stats.bad,
		html = [
			'Tests completed in ',
			runtime,
			' milliseconds.<br/>',
			'<span class="passed">',
			passed,
			'</span> tests of <span class="total">',
			config.stats.all,
			'</span> passed, <span class="failed">',
			config.stats.bad,
			'</span> failed.'
		].join('');

	if ( banner ) {
		banner.className = (config.stats.bad ? "qunit-fail" : "qunit-pass");
	}

	if ( tests ) {	
		id( "qunit-testresult" ).innerHTML = html;
	}

	QUnit.done( {
		failed: config.stats.bad,
		passed: passed, 
		total: config.stats.all,
		runtime: runtime
	} );
}

function validTest( name ) {
	var i = config.filters.length,
		run = false;

	if ( !i ) {
		return true;
	}
	
	while ( i-- ) {
		var filter = config.filters[i],
			not = filter.charAt(0) == '!';

		if ( not ) {
			filter = filter.slice(1);
		}

		if ( name.indexOf(filter) !== -1 ) {
			return !not;
		}

		if ( not ) {
			run = true;
		}
	}

	return run;
}

// so far supports only Firefox, Chrome and Opera (buggy)
// could be extended in the future to use something like https://github.com/csnover/TraceKit
function sourceFromStacktrace() {
	try {
		throw new Error();
	} catch ( e ) {
		if (e.stacktrace) {
			// Opera
			return e.stacktrace.split("\n")[6];
		} else if (e.stack) {
			// Firefox, Chrome
			return e.stack.split("\n")[4];
		}
	}
}

function escapeHtml(s) {
	if (!s) {
		return "";
	}
	s = s + "";
	return s.replace(/[\&"<>\\]/g, function(s) {
		switch(s) {
			case "&": return "&amp;";
			case "\\": return "\\\\";
			case '"': return '\"';
			case "<": return "&lt;";
			case ">": return "&gt;";
			default: return s;
		}
	});
}

function synchronize( callback ) {
	config.queue.push( callback );

	if ( config.autorun && !config.blocking ) {
		process();
	}
}

function process() {
	var start = (new Date()).getTime();

	while ( config.queue.length && !config.blocking ) {
		if ( config.updateRate <= 0 || (((new Date()).getTime() - start) < config.updateRate) ) {
			config.queue.shift()();
		} else {
			window.setTimeout( process, 13 );
			break;
		}
	}
  if (!config.blocking && !config.queue.length) {
    done();
  }
}

function saveGlobal() {
	config.pollution = [];
	
	if ( config.noglobals ) {
		for ( var key in window ) {
			config.pollution.push( key );
		}
	}
}

function checkPollution( name ) {
	var old = config.pollution;
	saveGlobal();
	
	var newGlobals = diff( old, config.pollution );
	if ( newGlobals.length > 0 ) {
		ok( false, "Introduced global variable(s): " + newGlobals.join(", ") );
		config.current.expected++;
	}

	var deletedGlobals = diff( config.pollution, old );
	if ( deletedGlobals.length > 0 ) {
		ok( false, "Deleted global variable(s): " + deletedGlobals.join(", ") );
		config.current.expected++;
	}
}

// returns a new Array with the elements that are in a but not in b
function diff( a, b ) {
	var result = a.slice();
	for ( var i = 0; i < result.length; i++ ) {
		for ( var j = 0; j < b.length; j++ ) {
			if ( result[i] === b[j] ) {
				result.splice(i, 1);
				i--;
				break;
			}
		}
	}
	return result;
}

function fail(message, exception, callback) {
	if ( typeof console !== "undefined" && console.error && console.warn ) {
		console.error(message);
		console.error(exception);
		console.warn(callback.toString());

	} else if ( window.opera && opera.postError ) {
		opera.postError(message, exception, callback.toString);
	}
}

function extend(a, b) {
	for ( var prop in b ) {
		a[prop] = b[prop];
	}

	return a;
}

function addEvent(elem, type, fn) {
	if ( elem.addEventListener ) {
		elem.addEventListener( type, fn, false );
	} else if ( elem.attachEvent ) {
		elem.attachEvent( "on" + type, fn );
	} else {
		fn();
	}
}

function id(name) {
	return !!(typeof document !== "undefined" && document && document.getElementById) &&
		document.getElementById( name );
}

// Test for equality any JavaScript type.
// Discussions and reference: http://philrathe.com/articles/equiv
// Test suites: http://philrathe.com/tests/equiv
// Author: Philippe Rathé <prathe@gmail.com>
QUnit.equiv = function () {

    var innerEquiv; // the real equiv function
    var callers = []; // stack to decide between skip/abort functions
    var parents = []; // stack to avoiding loops from circular referencing

    // Call the o related callback with the given arguments.
    function bindCallbacks(o, callbacks, args) {
        var prop = QUnit.objectType(o);
        if (prop) {
            if (QUnit.objectType(callbacks[prop]) === "function") {
                return callbacks[prop].apply(callbacks, args);
            } else {
                return callbacks[prop]; // or undefined
            }
        }
    }
    
    var callbacks = function () {

        // for string, boolean, number and null
        function useStrictEquality(b, a) {
            if (b instanceof a.constructor || a instanceof b.constructor) {
                // to catch short annotaion VS 'new' annotation of a declaration
                // e.g. var i = 1;
                //      var j = new Number(1);
                return a == b;
            } else {
                return a === b;
            }
        }

        return {
            "string": useStrictEquality,
            "boolean": useStrictEquality,
            "number": useStrictEquality,
            "null": useStrictEquality,
            "undefined": useStrictEquality,

            "nan": function (b) {
                return isNaN(b);
            },

            "date": function (b, a) {
                return QUnit.objectType(b) === "date" && a.valueOf() === b.valueOf();
            },

            "regexp": function (b, a) {
                return QUnit.objectType(b) === "regexp" &&
                    a.source === b.source && // the regex itself
                    a.global === b.global && // and its modifers (gmi) ...
                    a.ignoreCase === b.ignoreCase &&
                    a.multiline === b.multiline;
            },

            // - skip when the property is a method of an instance (OOP)
            // - abort otherwise,
            //   initial === would have catch identical references anyway
            "function": function () {
                var caller = callers[callers.length - 1];
                return caller !== Object &&
                        typeof caller !== "undefined";
            },

            "array": function (b, a) {
                var i, j, loop;
                var len;

                // b could be an object literal here
                if ( ! (QUnit.objectType(b) === "array")) {
                    return false;
                }   
                
                len = a.length;
                if (len !== b.length) { // safe and faster
                    return false;
                }
                
                //track reference to avoid circular references
                parents.push(a);
                for (i = 0; i < len; i++) {
                    loop = false;
                    for(j=0;j<parents.length;j++){
                        if(parents[j] === a[i]){
                            loop = true;//dont rewalk array
                        }
                    }
                    if (!loop && ! innerEquiv(a[i], b[i])) {
                        parents.pop();
                        return false;
                    }
                }
                parents.pop();
                return true;
            },

            "object": function (b, a) {
                var i, j, loop;
                var eq = true; // unless we can proove it
                var aProperties = [], bProperties = []; // collection of strings

                // comparing constructors is more strict than using instanceof
                if ( a.constructor !== b.constructor) {
                    return false;
                }

                // stack constructor before traversing properties
                callers.push(a.constructor);
                //track reference to avoid circular references
                parents.push(a);
                
                for (i in a) { // be strict: don't ensures hasOwnProperty and go deep
                    loop = false;
                    for(j=0;j<parents.length;j++){
                        if(parents[j] === a[i])
                            loop = true; //don't go down the same path twice
                    }
                    aProperties.push(i); // collect a's properties

                    if (!loop && ! innerEquiv(a[i], b[i])) {
                        eq = false;
                        break;
                    }
                }

                callers.pop(); // unstack, we are done
                parents.pop();

                for (i in b) {
                    bProperties.push(i); // collect b's properties
                }

                // Ensures identical properties name
                return eq && innerEquiv(aProperties.sort(), bProperties.sort());
            }
        };
    }();

    innerEquiv = function () { // can take multiple arguments
        var args = Array.prototype.slice.apply(arguments);
        if (args.length < 2) {
            return true; // end transition
        }

        return (function (a, b) {
            if (a === b) {
                return true; // catch the most you can
            } else if (a === null || b === null || typeof a === "undefined" || typeof b === "undefined" || QUnit.objectType(a) !== QUnit.objectType(b)) {
                return false; // don't lose time with error prone cases
            } else {
                return bindCallbacks(a, callbacks, [b, a]);
            }

        // apply transition with (1..n) arguments
        })(args[0], args[1]) && arguments.callee.apply(this, args.splice(1, args.length -1));
    };

    return innerEquiv;

}();

/**
 * jsDump
 * Copyright (c) 2008 Ariel Flesler - aflesler(at)gmail(dot)com | http://flesler.blogspot.com
 * Licensed under BSD (http://www.opensource.org/licenses/bsd-license.php)
 * Date: 5/15/2008
 * @projectDescription Advanced and extensible data dumping for Javascript.
 * @version 1.0.0
 * @author Ariel Flesler
 * @link {http://flesler.blogspot.com/2008/05/jsdump-pretty-dump-of-any-javascript.html}
 */
QUnit.jsDump = (function() {
	function quote( str ) {
		return '"' + str.toString().replace(/"/g, '\\"') + '"';
	};
	function literal( o ) {
		return o + '';	
	};
	function join( pre, arr, post ) {
		var s = jsDump.separator(),
			base = jsDump.indent(),
			inner = jsDump.indent(1);
		if ( arr.join )
			arr = arr.join( ',' + s + inner );
		if ( !arr )
			return pre + post;
		return [ pre, inner + arr, base + post ].join(s);
	};
	function array( arr ) {
		var i = arr.length,	ret = Array(i);					
		this.up();
		while ( i-- )
			ret[i] = this.parse( arr[i] );				
		this.down();
		return join( '[', ret, ']' );
	};
	
	var reName = /^function (\w+)/;
	
	var jsDump = {
		parse:function( obj, type ) { //type is used mostly internally, you can fix a (custom)type in advance
			var	parser = this.parsers[ type || this.typeOf(obj) ];
			type = typeof parser;			
			
			return type == 'function' ? parser.call( this, obj ) :
				   type == 'string' ? parser :
				   this.parsers.error;
		},
		typeOf:function( obj ) {
			var type;
			if ( obj === null ) {
				type = "null";
			} else if (typeof obj === "undefined") {
				type = "undefined";
			} else if (QUnit.is("RegExp", obj)) {
				type = "regexp";
			} else if (QUnit.is("Date", obj)) {
				type = "date";
			} else if (QUnit.is("Function", obj)) {
				type = "function";
			} else if (typeof obj.setInterval !== undefined && typeof obj.document !== "undefined" && typeof obj.nodeType === "undefined") {
				type = "window";
			} else if (obj.nodeType === 9) {
				type = "document";
			} else if (obj.nodeType) {
				type = "node";
			} else if (typeof obj === "object" && typeof obj.length === "number" && obj.length >= 0) {
				type = "array";
			} else {
				type = typeof obj;
			}
			return type;
		},
		separator:function() {
			return this.multiline ?	this.HTML ? '<br />' : '\n' : this.HTML ? '&nbsp;' : ' ';
		},
		indent:function( extra ) {// extra can be a number, shortcut for increasing-calling-decreasing
			if ( !this.multiline )
				return '';
			var chr = this.indentChar;
			if ( this.HTML )
				chr = chr.replace(/\t/g,'   ').replace(/ /g,'&nbsp;');
			return Array( this._depth_ + (extra||0) ).join(chr);
		},
		up:function( a ) {
			this._depth_ += a || 1;
		},
		down:function( a ) {
			this._depth_ -= a || 1;
		},
		setParser:function( name, parser ) {
			this.parsers[name] = parser;
		},
		// The next 3 are exposed so you can use them
		quote:quote, 
		literal:literal,
		join:join,
		//
		_depth_: 1,
		// This is the list of parsers, to modify them, use jsDump.setParser
		parsers:{
			window: '[Window]',
			document: '[Document]',
			error:'[ERROR]', //when no parser is found, shouldn't happen
			unknown: '[Unknown]',
			'null':'null',
			'undefined':'undefined',
			'function':function( fn ) {
				var ret = 'function',
					name = 'name' in fn ? fn.name : (reName.exec(fn)||[])[1];//functions never have name in IE
				if ( name )
					ret += ' ' + name;
				ret += '(';
				
				ret = [ ret, QUnit.jsDump.parse( fn, 'functionArgs' ), '){'].join('');
				return join( ret, QUnit.jsDump.parse(fn,'functionCode'), '}' );
			},
			array: array,
			nodelist: array,
			arguments: array,
			object:function( map ) {
				var ret = [ ];
				QUnit.jsDump.up();
				for ( var key in map )
					ret.push( QUnit.jsDump.parse(key,'key') + ': ' + QUnit.jsDump.parse(map[key]) );
				QUnit.jsDump.down();
				return join( '{', ret, '}' );
			},
			node:function( node ) {
				var open = QUnit.jsDump.HTML ? '&lt;' : '<',
					close = QUnit.jsDump.HTML ? '&gt;' : '>';
					
				var tag = node.nodeName.toLowerCase(),
					ret = open + tag;
					
				for ( var a in QUnit.jsDump.DOMAttrs ) {
					var val = node[QUnit.jsDump.DOMAttrs[a]];
					if ( val )
						ret += ' ' + a + '=' + QUnit.jsDump.parse( val, 'attribute' );
				}
				return ret + close + open + '/' + tag + close;
			},
			functionArgs:function( fn ) {//function calls it internally, it's the arguments part of the function
				var l = fn.length;
				if ( !l ) return '';				
				
				var args = Array(l);
				while ( l-- )
					args[l] = String.fromCharCode(97+l);//97 is 'a'
				return ' ' + args.join(', ') + ' ';
			},
			key:quote, //object calls it internally, the key part of an item in a map
			functionCode:'[code]', //function calls it internally, it's the content of the function
			attribute:quote, //node calls it internally, it's an html attribute value
			string:quote,
			date:quote,
			regexp:literal, //regex
			number:literal,
			'boolean':literal
		},
		DOMAttrs:{//attributes to dump from nodes, name=>realName
			id:'id',
			name:'name',
			'class':'className'
		},
		HTML:false,//if true, entities are escaped ( <, >, \t, space and \n )
		indentChar:'  ',//indentation unit
		multiline:true //if true, items in a collection, are separated by a \n, else just a space.
	};

	return jsDump;
})();

// from Sizzle.js
function getText( elems ) {
	var ret = "", elem;

	for ( var i = 0; elems[i]; i++ ) {
		elem = elems[i];

		// Get the text from text nodes and CDATA nodes
		if ( elem.nodeType === 3 || elem.nodeType === 4 ) {
			ret += elem.nodeValue;

		// Traverse everything else, except comment nodes
		} else if ( elem.nodeType !== 8 ) {
			ret += getText( elem.childNodes );
		}
	}

	return ret;
};

/*
 * Javascript Diff Algorithm
 *  By John Resig (http://ejohn.org/)
 *  Modified by Chu Alan "sprite"
 *
 * Released under the MIT license.
 *
 * More Info:
 *  http://ejohn.org/projects/javascript-diff-algorithm/
 *  
 * Usage: QUnit.diff(expected, actual)
 * 
 * QUnit.diff("the quick brown fox jumped over", "the quick fox jumps over") == "the  quick <del>brown </del> fox <del>jumped </del><ins>jumps </ins> over"
 */
QUnit.diff = (function() {
	function diff(o, n){
		var ns = new Object();
		var os = new Object();
		
		for (var i = 0; i < n.length; i++) {
			if (ns[n[i]] == null) 
				ns[n[i]] = {
					rows: new Array(),
					o: null
				};
			ns[n[i]].rows.push(i);
		}
		
		for (var i = 0; i < o.length; i++) {
			if (os[o[i]] == null) 
				os[o[i]] = {
					rows: new Array(),
					n: null
				};
			os[o[i]].rows.push(i);
		}
		
		for (var i in ns) {
			if (ns[i].rows.length == 1 && typeof(os[i]) != "undefined" && os[i].rows.length == 1) {
				n[ns[i].rows[0]] = {
					text: n[ns[i].rows[0]],
					row: os[i].rows[0]
				};
				o[os[i].rows[0]] = {
					text: o[os[i].rows[0]],
					row: ns[i].rows[0]
				};
			}
		}
		
		for (var i = 0; i < n.length - 1; i++) {
			if (n[i].text != null && n[i + 1].text == null && n[i].row + 1 < o.length && o[n[i].row + 1].text == null &&
			n[i + 1] == o[n[i].row + 1]) {
				n[i + 1] = {
					text: n[i + 1],
					row: n[i].row + 1
				};
				o[n[i].row + 1] = {
					text: o[n[i].row + 1],
					row: i + 1
				};
			}
		}
		
		for (var i = n.length - 1; i > 0; i--) {
			if (n[i].text != null && n[i - 1].text == null && n[i].row > 0 && o[n[i].row - 1].text == null &&
			n[i - 1] == o[n[i].row - 1]) {
				n[i - 1] = {
					text: n[i - 1],
					row: n[i].row - 1
				};
				o[n[i].row - 1] = {
					text: o[n[i].row - 1],
					row: i - 1
				};
			}
		}
		
		return {
			o: o,
			n: n
		};
	}
	
	return function(o, n){
		o = o.replace(/\s+$/, '');
		n = n.replace(/\s+$/, '');
		var out = diff(o == "" ? [] : o.split(/\s+/), n == "" ? [] : n.split(/\s+/));

		var str = "";
		
		var oSpace = o.match(/\s+/g);
		if (oSpace == null) {
			oSpace = [" "];
		}
		else {
			oSpace.push(" ");
		}
		var nSpace = n.match(/\s+/g);
		if (nSpace == null) {
			nSpace = [" "];
		}
		else {
			nSpace.push(" ");
		}
		
		if (out.n.length == 0) {
			for (var i = 0; i < out.o.length; i++) {
				str += '<del>' + out.o[i] + oSpace[i] + "</del>";
			}
		}
		else {
			if (out.n[0].text == null) {
				for (n = 0; n < out.o.length && out.o[n].text == null; n++) {
					str += '<del>' + out.o[n] + oSpace[n] + "</del>";
				}
			}
			
			for (var i = 0; i < out.n.length; i++) {
				if (out.n[i].text == null) {
					str += '<ins>' + out.n[i] + nSpace[i] + "</ins>";
				}
				else {
					var pre = "";
					
					for (n = out.n[i].row + 1; n < out.o.length && out.o[n].text == null; n++) {
						pre += '<del>' + out.o[n] + oSpace[n] + "</del>";
					}
					str += " " + out.n[i].text + nSpace[i] + pre;
				}
			}
		}
		
		return str;
	};
})();

})(this);(function() {

/**************************************************
  Node
 *************************************************/

var moment;
if (typeof window === 'undefined') {
    moment = require('../../moment');
    module = QUnit.module;
} else {
    moment = window.moment;
}

/**************************************************
  Tests
 *************************************************/


module("create");


test("array", 8, function() {
    ok(moment([2010]).native() instanceof Date, "[2010]");
    ok(moment([2010, 1]).native() instanceof Date, "[2010, 1]");
    ok(moment([2010, 1, 12]).native() instanceof Date, "[2010, 1, 12]");
    ok(moment([2010, 1, 12, 1]).native() instanceof Date, "[2010, 1, 12, 1]");
    ok(moment([2010, 1, 12, 1, 1]).native() instanceof Date, "[2010, 1, 12, 1, 1]");
    ok(moment([2010, 1, 12, 1, 1, 1]).native() instanceof Date, "[2010, 1, 12, 1, 1, 1]");
    ok(moment([2010, 1, 12, 1, 1, 1, 1]).native() instanceof Date, "[2010, 1, 12, 1, 1, 1, 1]");
    deepEqual(moment(new Date(2010, 1, 14, 15, 25, 50, 125)), moment([2010, 1, 14, 15, 25, 50, 125]), "constructing with array === constructing with new Date()");
});


test("number", 2, function() {
    ok(moment(1000).native() instanceof Date, "1000");
    ok((moment(1000).valueOf() === 1000), "testing valueOf");
});


test("date", 1, function() {
    ok(moment(new Date()).native() instanceof Date, "new Date()");
});

test("moment", 2, function() {
    ok(moment(moment()).native() instanceof Date, "moment(moment())");
    ok(moment(moment(moment())).native() instanceof Date, "moment(moment(moment()))");
});

test("undefined", 1, function() {
    ok(moment().native() instanceof Date, "undefined");
});


test("string without format", 2, function() {
    ok(moment("Aug 9, 1995").native() instanceof Date, "Aug 9, 1995");
    ok(moment("Mon, 25 Dec 1995 13:30:00 GMT").native() instanceof Date, "Mon, 25 Dec 1995 13:30:00 GMT");
});

test("string without format - json", 4, function() {
    equal(moment("Date(1325132654000)").valueOf(), 1325132654000, "Date(1325132654000)");
    equal(moment("/Date(1325132654000)/").valueOf(), 1325132654000, "/Date(1325132654000)/");
    equal(moment("/Date(1325132654000+0700)/").valueOf(), 1325132654000, "/Date(1325132654000+0700)/");
    equal(moment("/Date(1325132654000-0700)/").valueOf(), 1325132654000, "/Date(1325132654000-0700)/");
});

test("string with format", 23, function() {
    moment.lang('en');
    var a = [
            ['MM-DD-YYYY',          '12-02-1999'],
            ['DD-MM-YYYY',          '12-02-1999'],
            ['DD/MM/YYYY',          '12/02/1999'],
            ['DD_MM_YYYY',          '12_02_1999'],
            ['DD:MM:YYYY',          '12:02:1999'],
            ['D-M-YY',              '2-2-99'],
            ['YY',                  '99'],
            ['DDD-YYYY',            '300-1999'],
            ['DD-MM-YYYY h:m:s',    '12-02-1999 2:45:10'],
            ['DD-MM-YYYY h:m:s a',  '12-02-1999 2:45:10 am'],
            ['DD-MM-YYYY h:m:s a',  '12-02-1999 2:45:10 pm'],
            ['h:mm a',              '12:00 pm'],
            ['h:mm a',              '12:30 pm'],
            ['h:mm a',              '12:00 am'],
            ['h:mm a',              '12:30 am'],
            ['HH:mm',               '12:00'],
            ['YYYY-MM-DDTHH:mm:ss', '2011-11-11T11:11:11'],
            ['MM-DD-YYYY \\M',      '12-02-1999 M'],
            ['ddd MMM DD HH:mm:ss YYYY', 'Tue Apr 07 22:52:51 2009'],
            ['HH:mm:ss',            '12:00:00'],
            ['HH:mm:ss',            '12:30:00'],
            ['HH:mm:ss',            '00:00:00'],
            ['HH:mm:ss',            '00:30:00']
        ],
        i;
    for (i = 0; i < a.length; i++) {
        equal(moment(a[i][1], a[i][0]).format(a[i][0]), a[i][1], a[i][0] + ' ---> ' + a[i][1]);
    }
});

test("string with format (timezone)", 8, function() {
    equal(moment('5 -0700', 'H ZZ').native().getUTCHours(), 12, 'parse hours "5 -0700" ---> "H ZZ"');
    equal(moment('5 -07:00', 'H Z').native().getUTCHours(), 12, 'parse hours "5 -07:00" ---> "H Z"');
    equal(moment('5 -0730', 'H ZZ').native().getUTCMinutes(), 30, 'parse hours "5 -0730" ---> "H ZZ"');
    equal(moment('5 -07:30', 'H Z').native().getUTCMinutes(), 30, 'parse hours "5 -07:30" ---> "H Z"');
    equal(moment('5 +0100', 'H ZZ').native().getUTCHours(), 4, 'parse hours "5 +0100" ---> "H ZZ"');
    equal(moment('5 +01:00', 'H Z').native().getUTCHours(), 4, 'parse hours "5 +01:00" ---> "H Z"');
    equal(moment('5 +0130', 'H ZZ').native().getUTCMinutes(), 30, 'parse hours "5 +0130" ---> "H ZZ"');
    equal(moment('5 +01:30', 'H Z').native().getUTCMinutes(), 30, 'parse hours "5 +01:30" ---> "H Z"');
});

test("string with format (timezone offset)", 3, function() {
    var a = new Date(Date.UTC(2011, 0, 1, 1));
    var b = moment('2011 1 1 0 -01:00', 'YYYY MM DD HH Z');
    equal(a.getHours(), b.hours(), 'date created with utc == parsed string with timezone offset');
    equal(+a, +b, 'date created with utc == parsed string with timezone offset');
    var c = moment('2011 2 1 10 -05:00', 'YYYY MM DD HH Z');
    var d = moment('2011 2 1 8 -07:00', 'YYYY MM DD HH Z');
    equal(c.hours(), d.hours(), '10 am central time == 8 am pacific time');
});

test("string with array of formats", 3, function() {
    equal(moment('13-02-1999', ['MM-DD-YYYY', 'DD-MM-YYYY']).format('MM DD YYYY'), '02 13 1999', 'switching month and day');
    equal(moment('02-13-1999', ['MM/DD/YYYY', 'YYYY-MM-DD', 'MM-DD-YYYY']).format('MM DD YYYY'), '02 13 1999', 'year last');
    equal(moment('1999-02-13', ['MM/DD/YYYY', 'YYYY-MM-DD', 'MM-DD-YYYY']).format('MM DD YYYY'), '02 13 1999', 'year first');
});

test("string with format - years", 2, function() {
    equal(moment('71', 'YY').format('YYYY'), '1971', '71 > 1971');
    equal(moment('69', 'YY').format('YYYY'), '2069', '69 > 2069');
});

test("implicit cloning", 2, function() {
    var momentA = moment([2011, 10, 10]);
    var momentB = moment(momentA);
    momentA.month(5);
    equal(momentB.month(), 10, "Calling moment() on a moment will create a clone");
    equal(momentA.month(), 5, "Calling moment() on a moment will create a clone");
});

test("explicit cloning", 2, function() {
    var momentA = moment([2011, 10, 10]);
    var momentB = momentA.clone();
    momentA.month(5);
    equal(momentB.month(), 10, "Calling moment() on a moment will create a clone");
    equal(momentA.month(), 5, "Calling moment() on a moment will create a clone");
});

module("add and subtract");


test("add and subtract short", 12, function() {
    var a = moment();
    a.year(2011);
    a.month(9);
    a.date(12);
    a.hours(6);
    a.minutes(7);
    a.seconds(8);
    a.milliseconds(500);

    equal(a.add({ms:50}).milliseconds(), 550, 'Add milliseconds');
    equal(a.add({s:1}).seconds(), 9, 'Add seconds');
    equal(a.add({m:1}).minutes(), 8, 'Add minutes');
    equal(a.add({h:1}).hours(), 7, 'Add hours');
    equal(a.add({d:1}).date(), 13, 'Add date');
    equal(a.add({w:1}).date(), 20, 'Add week');
    equal(a.add({M:1}).month(), 10, 'Add month');
    equal(a.add({y:1}).year(), 2012, 'Add year');

    var b = moment([2010, 0, 31]).add({M:1});
    var c = moment([2010, 1, 28]).subtract({M:1});

    equal(b.month(), 1, 'add month, jan 31st to feb 28th');
    equal(b.date(), 28, 'add month, jan 31st to feb 28th');
    equal(c.month(), 0, 'subtract month, feb 28th to jan 28th');
    equal(c.date(), 28, 'subtract month, feb 28th to jan 28th');
});

test("add and subtract long", 8, function() {
    var a = moment();
    a.year(2011);
    a.month(9);
    a.date(12);
    a.hours(6);
    a.minutes(7);
    a.seconds(8);
    a.milliseconds(500);

    equal(a.add({milliseconds:50}).milliseconds(), 550, 'Add milliseconds');
    equal(a.add({seconds:1}).seconds(), 9, 'Add seconds');
    equal(a.add({minutes:1}).minutes(), 8, 'Add minutes');
    equal(a.add({hours:1}).hours(), 7, 'Add hours');
    equal(a.add({days:1}).date(), 13, 'Add date');
    equal(a.add({weeks:1}).date(), 20, 'Add week');
    equal(a.add({months:1}).month(), 10, 'Add month');
    equal(a.add({years:1}).year(), 2012, 'Add year');
});

test("add and subtract string short", 9, function() {
    var a = moment();
    a.year(2011);
    a.month(9);
    a.date(12);
    a.hours(6);
    a.minutes(7);
    a.seconds(8);
    a.milliseconds(500);

    var b = a.clone();

    equal(a.add('milliseconds', 50).milliseconds(), 550, 'Add milliseconds');
    equal(a.add('seconds', 1).seconds(), 9, 'Add seconds');
    equal(a.add('minutes', 1).minutes(), 8, 'Add minutes');
    equal(a.add('hours', 1).hours(), 7, 'Add hours');
    equal(a.add('days', 1).date(), 13, 'Add date');
    equal(a.add('weeks', 1).date(), 20, 'Add week');
    equal(a.add('months', 1).month(), 10, 'Add month');
    equal(a.add('years', 1).year(), 2012, 'Add year');
    equal(b.add('days', '01').date(), 13, 'Add date');
});

test("add and subtract string short", 8, function() {
    var a = moment();
    a.year(2011);
    a.month(9);
    a.date(12);
    a.hours(6);
    a.minutes(7);
    a.seconds(8);
    a.milliseconds(500);

    equal(a.add('ms', 50).milliseconds(), 550, 'Add milliseconds');
    equal(a.add('s', 1).seconds(), 9, 'Add seconds');
    equal(a.add('m', 1).minutes(), 8, 'Add minutes');
    equal(a.add('h', 1).hours(), 7, 'Add hours');
    equal(a.add('d', 1).date(), 13, 'Add date');
    equal(a.add('w', 1).date(), 20, 'Add week');
    equal(a.add('M', 1).month(), 10, 'Add month');
    equal(a.add('y', 1).year(), 2012, 'Add year');
});

test("adding across DST", 3, function(){
    var a = moment(new Date(2011, 2, 12, 5, 0, 0));
    var b = moment(new Date(2011, 2, 12, 5, 0, 0));
    var c = moment(new Date(2011, 2, 12, 5, 0, 0));
    var d = moment(new Date(2011, 2, 12, 5, 0, 0));
    a.add('days', 1);
    b.add('hours', 24);
    c.add('months', 1);
    equal(a.hours(), 5, 'adding days over DST difference should result in the same hour');
    if (b.isDST() && !d.isDST()) {
        equal(b.hours(), 6, 'adding hours over DST difference should result in a different hour');
    } else {
        equal(b.hours(), 5, 'adding hours over DST difference should result in a same hour if the timezone does not have daylight savings time');
    }
    equal(c.hours(), 5, 'adding months over DST difference should result in the same hour');
});

module("diff");


test("diff", 5, function() {
    equal(moment(1000).diff(0), 1000, "1 second - 0 = 1000");
    equal(moment(1000).diff(500), 500, "1 second - .5 second = -500");
    equal(moment(0).diff(1000), -1000, "0 - 1 second = -1000");
    equal(moment(new Date(1000)).diff(1000), 0, "1 second - 1 second = 0");
    var oneHourDate = new Date(),
    nowDate = new Date();
    oneHourDate.setHours(oneHourDate.getHours() + 1);
    equal(moment(oneHourDate).diff(nowDate), 60 * 60 * 1000, "1 hour from now = 360000");
});

test("diff key after", 9, function() {
    equal(moment([2010]).diff([2011], 'years'), -1, "year diff");
    equal(moment([2010]).diff([2011, 6], 'years', true), -1.5, "year diff, float");
    equal(moment([2010]).diff([2010, 2], 'months'), -2, "month diff");
    equal(moment([2010]).diff([2010, 0, 7], 'weeks'), -1, "week diff");
    equal(moment([2010]).diff([2010, 0, 21], 'weeks'), -3, "week diff");
    equal(moment([2010]).diff([2010, 0, 4], 'days'), -3, "day diff");
    equal(moment([2010]).diff([2010, 0, 1, 4], 'hours'), -4, "hour diff");
    equal(moment([2010]).diff([2010, 0, 1, 0, 5], 'minutes'), -5, "minute diff");
    equal(moment([2010]).diff([2010, 0, 1, 0, 0, 6], 'seconds'), -6, "second diff");
});

test("diff key before", 9, function() {
    equal(moment([2011]).diff([2010], 'years'), 1, "year diff");
    equal(moment([2011, 6]).diff([2010], 'years', true), 1.5, "year diff, float");
    equal(moment([2010, 2]).diff([2010], 'months'), 2, "month diff");
    equal(moment([2010, 0, 4]).diff([2010], 'days'), 3, "day diff");
    equal(moment([2010, 0, 7]).diff([2010], 'weeks'), 1, "week diff");
    equal(moment([2010, 0, 21]).diff([2010], 'weeks'), 3, "week diff");
    equal(moment([2010, 0, 1, 4]).diff([2010], 'hours'), 4, "hour diff");
    equal(moment([2010, 0, 1, 0, 5]).diff([2010], 'minutes'), 5, "minute diff");
    equal(moment([2010, 0, 1, 0, 0, 6]).diff([2010], 'seconds'), 6, "second diff");
});

test("diff month", 1, function() {
    equal(moment([2011, 0, 31]).diff([2011, 2, 1], 'months'), -1, "month diff");
});

test("diff across DST", 2, function() {
    equal(moment([2012, 2, 24]).diff([2012, 2, 10], 'weeks', true), 2, "diff weeks across DST");
    equal(moment([2012, 2, 24]).diff([2012, 2, 10], 'days', true), 14, "diff weeks across DST");
});

test("diff overflow", 4, function() {
    equal(moment([2011]).diff([2010], 'months'), 12, "month diff");
    equal(moment([2010, 0, 2]).diff([2010], 'hours'), 24, "hour diff");
    equal(moment([2010, 0, 1, 2]).diff([2010], 'minutes'), 120, "minute diff");
    equal(moment([2010, 0, 1, 0, 4]).diff([2010], 'seconds'), 240, "second diff");
});


module("leap year");


test("leap year", 4, function() {
    equal(moment([2010, 0, 1]).isLeapYear(), false, '2010');
    equal(moment([2100, 0, 1]).isLeapYear(), false, '2100');
    equal(moment([2008, 0, 1]).isLeapYear(), true, '2008');
    equal(moment([2000, 0, 1]).isLeapYear(), true, '2000');
});


module("getters and setters");


test("getters", 8, function() {
    var a = moment([2011, 9, 12, 6, 7, 8, 9]);
    equal(a.year(), 2011, 'year');
    equal(a.month(), 9, 'month');
    equal(a.date(), 12, 'date');
    equal(a.day(), 3, 'day');
    equal(a.hours(), 6, 'hour');
    equal(a.minutes(), 7, 'minute');
    equal(a.seconds(), 8, 'second');
    equal(a.milliseconds(), 9, 'milliseconds');
});

test("setters", 8, function() {
    var a = moment();
    a.year(2011);
    a.month(9);
    a.date(12);
    a.hours(6);
    a.minutes(7);
    a.seconds(8);
    a.milliseconds(9);
    equal(a.year(), 2011, 'year');
    equal(a.month(), 9, 'month');
    equal(a.date(), 12, 'date');
    equal(a.day(), 3, 'day');
    equal(a.hours(), 6, 'hour');
    equal(a.minutes(), 7, 'minute');
    equal(a.seconds(), 8, 'second');
    equal(a.milliseconds(), 9, 'milliseconds');
});

test("setters - falsey values", 1, function() {
    var a = moment();
    // ensure minutes wasn't coincidentally 0 already
    a.minutes(1);
    a.minutes(0);
    equal(a.minutes(), 0, 'falsey value');
});

test("chaining setters", 7, function() {
    var a = moment();
    a.year(2011)
     .month(9)
     .date(12)
     .hours(6)
     .minutes(7)
     .seconds(8);
    equal(a.year(), 2011, 'year');
    equal(a.month(), 9, 'month');
    equal(a.date(), 12, 'date');
    equal(a.day(), 3, 'day');
    equal(a.hours(), 6, 'hour');
    equal(a.minutes(), 7, 'minute');
    equal(a.seconds(), 8, 'second');
});

test("day setter", 18, function() {
    var a = moment([2011, 0, 15]);
    equal(moment(a).day(0).date(), 9, 'set from saturday to sunday');
    equal(moment(a).day(6).date(), 15, 'set from saturday to saturday');
    equal(moment(a).day(3).date(), 12, 'set from saturday to wednesday');

    a = moment([2011, 0, 9]);
    equal(moment(a).day(0).date(), 9, 'set from sunday to sunday');
    equal(moment(a).day(6).date(), 15, 'set from sunday to saturday');
    equal(moment(a).day(3).date(), 12, 'set from sunday to wednesday');

    a = moment([2011, 0, 12]);
    equal(moment(a).day(0).date(), 9, 'set from wednesday to sunday');
    equal(moment(a).day(6).date(), 15, 'set from wednesday to saturday');
    equal(moment(a).day(3).date(), 12, 'set from wednesday to wednesday');

    equal(moment(a).day(-7).date(), 2, 'set from wednesday to last sunday');
    equal(moment(a).day(-1).date(), 8, 'set from wednesday to last saturday');
    equal(moment(a).day(-4).date(), 5, 'set from wednesday to last wednesday');

    equal(moment(a).day(7).date(), 16, 'set from wednesday to next sunday');
    equal(moment(a).day(13).date(), 22, 'set from wednesday to next saturday');
    equal(moment(a).day(10).date(), 19, 'set from wednesday to next wednesday');

    equal(moment(a).day(14).date(), 23, 'set from wednesday to second next sunday');
    equal(moment(a).day(20).date(), 29, 'set from wednesday to second next saturday');
    equal(moment(a).day(17).date(), 26, 'set from wednesday to second next wednesday');
});


module("format");


test("format YY", 1, function() {
    var b = moment(new Date(2009, 1, 14, 15, 25, 50, 125));
    equal(b.format('YY'), '09', 'YY ---> 09');
});

test("format escape brackets", 5, function() {
    var b = moment(new Date(2009, 1, 14, 15, 25, 50, 125));
    equal(b.format('[day]'), 'day', 'Single bracket');
    equal(b.format('[day] YY [YY]'), 'day 09 YY', 'Double bracket');
    equal(b.format('[YY'), '[09', 'Un-ended bracket');
    equal(b.format('[[YY]]'), '[YY]', 'Double nested brackets');
    equal(b.format('[[]'), '[', 'Escape open bracket');
});

test("format timezone", 4, function() {
    var b = moment(new Date(2010, 1, 14, 15, 25, 50, 125));
    ok(b.format('z').match(/^[A-Z]{3,5}$/), b.format('z') + ' ---> Something like "PST"');
    ok(b.format('zz').match(/^[A-Z]{3,5}$/), b.format('zz') + ' ---> Something like "PST"');
    ok(b.format('Z').match(/^[\+\-]\d\d:\d\d$/), b.format('Z') + ' ---> Something like "+07:30"');
    ok(b.format('ZZ').match(/^[\+\-]\d{4}$/), b.format('ZZ') + ' ---> Something like "+0700"');
});

test("format multiple with zone", 1, function() {
    var b = moment('2012-10-08 -1200', ['YYYY ZZ', 'YYYY-MM-DD ZZ']);
    equals(b.format('YYYY-MM'), '2012-10', 'Parsing multiple formats should not crash with different sized formats');
});

test("isDST", 2, function() {
    var janOffset = new Date(2011, 0, 1).getTimezoneOffset(),
        julOffset = new Date(2011, 6, 1).getTimezoneOffset(),
        janIsDst = janOffset < julOffset,
        julIsDst = julOffset < janOffset,
        jan1 = moment([2011]),
        jul1 = moment([2011, 6]);

    if (janIsDst && julIsDst) {
        ok(0, 'January and July cannot both be in DST');
        ok(0, 'January and July cannot both be in DST');
    } else if (janIsDst) {
        ok(jan1.isDST(), 'January 1 is DST');
        ok(!jul1.isDST(), 'July 1 is not DST');
    } else if (julIsDst) {
        ok(!jan1.isDST(), 'January 1 is not DST');
        ok(jul1.isDST(), 'July 1 is DST');
    } else {
        ok(!jan1.isDST(), 'January 1 is not DST');
        ok(!jul1.isDST(), 'July 1 is not DST');
    }
});

test("zone", 3, function() {
    if (moment().zone() > 0) {
        ok(moment().format('ZZ').indexOf('-') > -1, 'When the zone() offset is greater than 0, the ISO offset should be less than zero');
    }
    if (moment().zone() < 0) {
        ok(moment().format('ZZ').indexOf('+') > -1, 'When the zone() offset is less than 0, the ISO offset should be greater than zero');
    }
    if (moment().zone() == 0) {
        ok(moment().format('ZZ').indexOf('+') > -1, 'When the zone() offset is equal to 0, the ISO offset should be positive zero');
    }
    ok(moment().zone() % 30 === 0, 'moment.fn.zone should be a multiple of 30 (was ' + moment().zone() + ')');
    equal(moment().zone(), new Date().getTimezoneOffset(), 'zone should equal getTimezoneOffset');
});

module("sod");

test("sod", 7, function(){
    var m = moment(new Date(2011, 1, 2, 3, 4, 5, 6)).sod();
    equal(m.year(), 2011, "keep the year");
    equal(m.month(), 1, "keep the month");
    equal(m.date(), 2, "keep the day");
    equal(m.hours(), 0, "strip out the hours"); 
    equal(m.minutes(), 0, "strip out the minutes"); 
    equal(m.seconds(), 0, "strip out the seconds"); 
    equal(m.milliseconds(), 0, "strip out the milliseconds"); 
});

module("eod");

test("eod", 7, function(){
    var m = moment(new Date(2011, 1, 2, 3, 4, 5, 6)).eod();
    equal(m.year(), 2011, "keep the year");
    equal(m.month(), 1, "keep the month");
    equal(m.date(), 2, "keep the day");
    equal(m.hours(), 23, "set the hours"); 
    equal(m.minutes(), 59, "set the minutes"); 
    equal(m.seconds(), 59, "set the seconds"); 
    equal(m.milliseconds(), 999, "set the seconds");
});


})();


/**************************************************
  Català
 *************************************************/

module("lang:ca");

test("parse", 96, function() {
    moment.lang('ca');

    var tests = "Gener Gen._Febrer Febr._Març Mar._Abril Abr._Maig Mai._Juny Jun._Juliol Jul._Agost Ag._Setembre Set._Octubre Oct._Novembre Nov._Desembre Des.".split("_");

    var i;
    function equalTest(input, mmm, i) {
        equal(moment(input, mmm).month(), i, input + ' should be month ' + (i + 1));
    }
    for (i = 0; i < 12; i++) {
        tests[i] = tests[i].split(' ');
        equalTest(tests[i][0], 'MMM', i);
        equalTest(tests[i][1], 'MMM', i);
        equalTest(tests[i][0], 'MMMM', i);
        equalTest(tests[i][1], 'MMMM', i);
        equalTest(tests[i][0].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][0].toLocaleUpperCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleUpperCase(), 'MMMM', i);
    }
});

test("format ordinal", 31, function() {
    moment.lang('ca');
    equal(moment([2011, 0, 1]).format('DDDo'), '1º', '1º');
    equal(moment([2011, 0, 2]).format('DDDo'), '2º', '2º');
    equal(moment([2011, 0, 3]).format('DDDo'), '3º', '3º');
    equal(moment([2011, 0, 4]).format('DDDo'), '4º', '4º');
    equal(moment([2011, 0, 5]).format('DDDo'), '5º', '5º');
    equal(moment([2011, 0, 6]).format('DDDo'), '6º', '6º');
    equal(moment([2011, 0, 7]).format('DDDo'), '7º', '7º');
    equal(moment([2011, 0, 8]).format('DDDo'), '8º', '8º');
    equal(moment([2011, 0, 9]).format('DDDo'), '9º', '9º');
    equal(moment([2011, 0, 10]).format('DDDo'), '10º', '10º');

    equal(moment([2011, 0, 11]).format('DDDo'), '11º', '11º');
    equal(moment([2011, 0, 12]).format('DDDo'), '12º', '12º');
    equal(moment([2011, 0, 13]).format('DDDo'), '13º', '13º');
    equal(moment([2011, 0, 14]).format('DDDo'), '14º', '14º');
    equal(moment([2011, 0, 15]).format('DDDo'), '15º', '15º');
    equal(moment([2011, 0, 16]).format('DDDo'), '16º', '16º');
    equal(moment([2011, 0, 17]).format('DDDo'), '17º', '17º');
    equal(moment([2011, 0, 18]).format('DDDo'), '18º', '18º');
    equal(moment([2011, 0, 19]).format('DDDo'), '19º', '19º');
    equal(moment([2011, 0, 20]).format('DDDo'), '20º', '20º');

    equal(moment([2011, 0, 21]).format('DDDo'), '21º', '21º');
    equal(moment([2011, 0, 22]).format('DDDo'), '22º', '22º');
    equal(moment([2011, 0, 23]).format('DDDo'), '23º', '23º');
    equal(moment([2011, 0, 24]).format('DDDo'), '24º', '24º');
    equal(moment([2011, 0, 25]).format('DDDo'), '25º', '25º');
    equal(moment([2011, 0, 26]).format('DDDo'), '26º', '26º');
    equal(moment([2011, 0, 27]).format('DDDo'), '27º', '27º');
    equal(moment([2011, 0, 28]).format('DDDo'), '28º', '28º');
    equal(moment([2011, 0, 29]).format('DDDo'), '29º', '29º');
    equal(moment([2011, 0, 30]).format('DDDo'), '30º', '30º');

    equal(moment([2011, 0, 31]).format('DDDo'), '31º', '31º');
});

test("format month", 12, function() {
    moment.lang('ca');
    var expected = "Gener Gen._Febrer Febr._Març Mar._Abril Abr._Maig Mai._Juny Jun._Juliol Jul._Agost Ag._Setembre Set._Octubre Oct._Novembre Nov._Desembre Des.".split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, i, 0]).format('MMMM MMM'), expected[i], expected[i]);
    }
});

test("format week", 7, function() {
    moment.lang('ca');
    var expected = "Diumenge Dg._Dilluns Dl._Dimarts Dt._Dimecres Dc._Dijous Dj._Divendres Dv._Dissabte Ds.".split("_");

    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, 0, 2 + i]).format('dddd ddd'), expected[i], expected[i]);
    }
});

test("from", 30, function() {
    moment.lang('ca');
    var start = moment([2007, 1, 28]);
    equal(start.from(moment([2007, 1, 28]).add({s:44}), true),  "uns segons", "44 seconds = a few seconds");
    equal(start.from(moment([2007, 1, 28]).add({s:45}), true),  "un minut",      "45 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:89}), true),  "un minut",      "89 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:90}), true),  "2 minuts",     "90 seconds = 2 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:44}), true),  "44 minuts",    "44 minutes = 44 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:45}), true),  "una hora",       "45 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:89}), true),  "una hora",       "89 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:90}), true),  "2 hores",       "90 minutes = 2 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:5}), true),   "5 hores",       "5 hours = 5 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:21}), true),  "21 hores",      "21 hours = 21 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:22}), true),  "un dia",         "22 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:35}), true),  "un dia",         "35 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:36}), true),  "2 dies",        "36 hours = 2 days");
    equal(start.from(moment([2007, 1, 28]).add({d:1}), true),   "un dia",         "1 day = a day");
    equal(start.from(moment([2007, 1, 28]).add({d:5}), true),   "5 dies",        "5 days = 5 days");
    equal(start.from(moment([2007, 1, 28]).add({d:25}), true),  "25 dies",       "25 days = 25 days");
    equal(start.from(moment([2007, 1, 28]).add({d:26}), true),  "un mes",       "26 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:30}), true),  "un mes",       "30 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:45}), true),  "un mes",       "45 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:46}), true),  "2 mesos",      "46 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:74}), true),  "2 mesos",      "75 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:76}), true),  "3 mesos",      "76 days = 3 months");
    equal(start.from(moment([2007, 1, 28]).add({M:1}), true),   "un mes",       "1 month = a month");
    equal(start.from(moment([2007, 1, 28]).add({M:5}), true),   "5 mesos",      "5 months = 5 months");
    equal(start.from(moment([2007, 1, 28]).add({d:344}), true), "11 mesos",     "344 days = 11 months");
    equal(start.from(moment([2007, 1, 28]).add({d:345}), true), "un any",        "345 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:547}), true), "un any",        "547 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:548}), true), "2 anys",       "548 days = 2 years");
    equal(start.from(moment([2007, 1, 28]).add({y:1}), true),   "un any",        "1 year = a year");
    equal(start.from(moment([2007, 1, 28]).add({y:5}), true),   "5 anys",       "5 years = 5 years");
});

test("suffix", 2, function() {
    moment.lang('ca');
    equal(moment(30000).from(0), "en uns segons",  "prefix");
    equal(moment(0).from(30000), "fa uns segons", "suffix");
});


test("now from now", 1, function() {
    moment.lang('ca');
    equal(moment().fromNow(), "fa uns segons",  "now from now should display as in the past");
});


test("fromNow", 2, function() {
    moment.lang('ca');
    equal(moment().add({s:30}).fromNow(), "en uns segons", "en uns segons");
    equal(moment().add({d:5}).fromNow(), "en 5 dies", "en 5 dies");
});


test("calendar day", 7, function() {
    moment.lang('ca');

    var a = moment().hours(2).minutes(0).seconds(0);

    equal(moment(a).calendar(),                         "avui a les 2:00",     "today at the same time");
    equal(moment(a).add({ m: 25 }).calendar(),          "avui a les 2:25",     "Now plus 25 min");
    equal(moment(a).add({ h: 1 }).calendar(),           "avui a les 3:00",     "Now plus 1 hour");
    equal(moment(a).add({ d: 1 }).calendar(),           "demá a les 2:00",  "tomorrow at the same time");
    equal(moment(a).add({ d: 1, h : -1 }).calendar(),   "demá a la 1:00",   "tomorrow minus 1 hour");
    equal(moment(a).subtract({ h: 1 }).calendar(),      "avui a la 1:00",      "Now minus 1 hour");
    equal(moment(a).subtract({ d: 1 }).calendar(),      "ahir a les 2:00",    "yesterday at the same time");
});

test("calendar next week", 15, function() {
    moment.lang('ca');

    var i;
    var m;

    for (i = 2; i < 7; i++) {
        m = moment().add({ d: i });
        equal(m.calendar(),       m.format('dddd [a ' + ((m.hours() !== 1) ? 'les' : 'la') + '] LT'),  "Today + " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('dddd [a ' + ((m.hours() !== 1) ? 'les' : 'la') + '] LT'),  "Today + " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('dddd [a ' + ((m.hours() !== 1) ? 'les' : 'la') + '] LT'),  "Today + " + i + " days end of day");
    }
});

test("calendar last week", 15, function() {
    moment.lang('ca');

    for (i = 2; i < 7; i++) {
        m = moment().subtract({ d: i });
        equal(m.calendar(),       m.format('[el] dddd [passat a ' + ((m.hours() !== 1) ? 'les' : 'la') + '] LT'),  "Today - " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('[el] dddd [passat a ' + ((m.hours() !== 1) ? 'les' : 'la') + '] LT'),  "Today - " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('[el] dddd [passat a ' + ((m.hours() !== 1) ? 'les' : 'la') + '] LT'),  "Today - " + i + " days end of day");
    }
});

test("calendar all else", 4, function() {
    moment.lang('ca');
    var weeksAgo = moment().subtract({ w: 1 });
    var weeksFromNow = moment().add({ w: 1 });

    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "1 week ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 1 week");

    weeksAgo = moment().subtract({ w: 2 });
    weeksFromNow = moment().add({ w: 2 });

    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "2 weeks ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 2 weeks");
});

/**************************************************
  Danish
 *************************************************/

module("lang:da");

test("parse", 96, function() {
    moment.lang('da');
    var tests = 'Januar Jan_Februar Feb_Marts Mar_April Apr_Maj Maj_Juni Jun_Juli Jul_August Aug_September Sep_Oktober Okt_November Nov_December Dec'.split("_");
    var i;
    function equalTest(input, mmm, i) {
        equal(moment(input, mmm).month(), i, input + ' should be month ' + (i + 1));
    }
    for (i = 0; i < 12; i++) {
        tests[i] = tests[i].split(' ');
        equalTest(tests[i][0], 'MMM', i);
        equalTest(tests[i][1], 'MMM', i);
        equalTest(tests[i][0], 'MMMM', i);
        equalTest(tests[i][1], 'MMMM', i);
        equalTest(tests[i][0].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][0].toLocaleUpperCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleUpperCase(), 'MMMM', i);
    }
});

test("format", 18, function() {
    moment.lang('da');
    var a = [
            ['dddd \\den MMMM Do YYYY, h:mm:ss a', 'Søndag den Februar 14. 2010, 3:25:50 pm'],
            ['ddd hA',                             'Søn 3PM'],
            ['M Mo MM MMMM MMM',                   '2 2. 02 Februar Feb'],
            ['YYYY YY',                            '2010 10'],
            ['D Do DD',                            '14 14. 14'],
            ['d do dddd ddd',                      '0 0. Søndag Søn'],
            ['DDD DDDo DDDD',                      '45 45. 045'],
            ['w wo ww',                            '8 8. 08'],
            ['h hh',                               '3 03'],
            ['H HH',                               '15 15'],
            ['m mm',                               '25 25'],
            ['s ss',                               '50 50'],
            ['a A',                                'pm PM'],
            ['den DDDo \\d\\ag på året',           'the 45. dag på året'],
            ['L',                                  '14/02/2010'],
            ['LL',                                 '14 Februar 2010'],
            ['LLL',                                '14 Februar 2010 3:25 PM'],
            ['LLLL',                               'Søndag d. 14 Februar 2010 3:25 PM']
        ],
        b = moment(new Date(2010, 1, 14, 15, 25, 50, 125)),
        i;
    for (i = 0; i < a.length; i++) {
        equal(b.format(a[i][0]), a[i][1], a[i][0] + ' ---> ' + a[i][1]);
    }
});

test("format ordinal", 31, function() {
    moment.lang('da');
    equal(moment([2011, 0, 1]).format('DDDo'), '1.', '1.');
    equal(moment([2011, 0, 2]).format('DDDo'), '2.', '2.');
    equal(moment([2011, 0, 3]).format('DDDo'), '3.', '3.');
    equal(moment([2011, 0, 4]).format('DDDo'), '4.', '4.');
    equal(moment([2011, 0, 5]).format('DDDo'), '5.', '5.');
    equal(moment([2011, 0, 6]).format('DDDo'), '6.', '6.');
    equal(moment([2011, 0, 7]).format('DDDo'), '7.', '7.');
    equal(moment([2011, 0, 8]).format('DDDo'), '8.', '8.');
    equal(moment([2011, 0, 9]).format('DDDo'), '9.', '9.');
    equal(moment([2011, 0, 10]).format('DDDo'), '10.', '10.');

    equal(moment([2011, 0, 11]).format('DDDo'), '11.', '11.');
    equal(moment([2011, 0, 12]).format('DDDo'), '12.', '12.');
    equal(moment([2011, 0, 13]).format('DDDo'), '13.', '13.');
    equal(moment([2011, 0, 14]).format('DDDo'), '14.', '14.');
    equal(moment([2011, 0, 15]).format('DDDo'), '15.', '15.');
    equal(moment([2011, 0, 16]).format('DDDo'), '16.', '16.');
    equal(moment([2011, 0, 17]).format('DDDo'), '17.', '17.');
    equal(moment([2011, 0, 18]).format('DDDo'), '18.', '18.');
    equal(moment([2011, 0, 19]).format('DDDo'), '19.', '19.');
    equal(moment([2011, 0, 20]).format('DDDo'), '20.', '20.');

    equal(moment([2011, 0, 21]).format('DDDo'), '21.', '21.');
    equal(moment([2011, 0, 22]).format('DDDo'), '22.', '22.');
    equal(moment([2011, 0, 23]).format('DDDo'), '23.', '23.');
    equal(moment([2011, 0, 24]).format('DDDo'), '24.', '24.');
    equal(moment([2011, 0, 25]).format('DDDo'), '25.', '25.');
    equal(moment([2011, 0, 26]).format('DDDo'), '26.', '26.');
    equal(moment([2011, 0, 27]).format('DDDo'), '27.', '27.');
    equal(moment([2011, 0, 28]).format('DDDo'), '28.', '28.');
    equal(moment([2011, 0, 29]).format('DDDo'), '29.', '29.');
    equal(moment([2011, 0, 30]).format('DDDo'), '30.', '30.');

    equal(moment([2011, 0, 31]).format('DDDo'), '31.', '31.');
});

test("format month", 12, function() {
    moment.lang('da');
    var expected = 'Januar Jan_Februar Feb_Marts Mar_April Apr_Maj Maj_Juni Jun_Juli Jul_August Aug_September Sep_Oktober Okt_November Nov_December Dec'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, i, 0]).format('MMMM MMM'), expected[i], expected[i]);
    }
});

test("format week", 7, function() {
    moment.lang('da');
    var expected = 'Søndag Søn_Mandag Man_Tirsdag Tir_Onsdag Ons_Torsdag Tor_Fredag Fre_Lørdag Lør'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, 0, 2 + i]).format('dddd ddd'), expected[i], expected[i]);
    }
});

test("from", 30, function() {
    moment.lang('da');
    var start = moment([2007, 1, 28]);
    equal(start.from(moment([2007, 1, 28]).add({s:44}), true),  "få sekunder", "44 seconds = a few seconds");
    equal(start.from(moment([2007, 1, 28]).add({s:45}), true),  "minut",       "45 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:89}), true),  "minut",       "89 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:90}), true),  "2 minutter",  "90 seconds = 2 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:44}), true),  "44 minutter", "44 minutes = 44 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:45}), true),  "time",        "45 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:89}), true),  "time",        "89 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:90}), true),  "2 timer",     "90 minutes = 2 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:5}), true),   "5 timer",     "5 hours = 5 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:21}), true),  "21 timer",    "21 hours = 21 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:22}), true),  "dag",         "22 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:35}), true),  "dag",         "35 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:36}), true),  "2 dage",      "36 hours = 2 days");
    equal(start.from(moment([2007, 1, 28]).add({d:1}), true),   "a dage",      "1 day = a day");
    equal(start.from(moment([2007, 1, 28]).add({d:5}), true),   "5 dage",      "5 days = 5 days");
    equal(start.from(moment([2007, 1, 28]).add({d:25}), true),  "25 dage",     "25 days = 25 days");
    equal(start.from(moment([2007, 1, 28]).add({d:26}), true),  "månede",      "26 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:30}), true),  "månede",      "30 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:45}), true),  "månede",      "45 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:46}), true),  "2 måneder",   "46 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:74}), true),  "2 måneder",   "75 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:76}), true),  "3 måneder",   "76 days = 3 months");
    equal(start.from(moment([2007, 1, 28]).add({M:1}), true),   "månede",      "1 month = a month");
    equal(start.from(moment([2007, 1, 28]).add({M:5}), true),   "5 måneder",   "5 months = 5 months");
    equal(start.from(moment([2007, 1, 28]).add({d:344}), true), "11 måneder",  "344 days = 11 months");
    equal(start.from(moment([2007, 1, 28]).add({d:345}), true), "år",          "345 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:547}), true), "år",          "547 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:548}), true), "2 år",        "548 days = 2 years");
    equal(start.from(moment([2007, 1, 28]).add({y:1}), true),   "år",          "1 year = a year");
    equal(start.from(moment([2007, 1, 28]).add({y:5}), true),   "5 år",        "5 years = 5 years");
});

test("suffix", 2, function() {
    moment.lang('da');
    equal(moment(30000).from(0), "om få sekunder",  "prefix");
    equal(moment(0).from(30000), "for få sekunder siden", "suffix");
});


test("now from now", 1, function() {
    moment.lang('da');
    equal(moment().fromNow(), "for få sekunder siden",  "now from now should display as in the past");
});


test("fromNow", 2, function() {
    moment.lang('da');
    equal(moment().add({s:30}).fromNow(), "om få sekunder", "in a few seconds");
    equal(moment().add({d:5}).fromNow(), "om 5 dage", "in 5 days");
});


/**************************************************
  German
 *************************************************/

module("lang:de");

test("parse", 96, function() {
    moment.lang('de');
    var tests = 'Januar Jan._Februar Febr._März Mrz._April Apr._Mai Mai_Juni Jun._Juli Jul._August Aug._September Sept._Oktober Okt._November Nov._Dezember Dez.'.split("_");
    var i;
    function equalTest(input, mmm, i) {
        equal(moment(input, mmm).month(), i, input + ' should be month ' + (i + 1));
    }
    for (i = 0; i < 12; i++) {
        tests[i] = tests[i].split(' ');
        equalTest(tests[i][0], 'MMM', i);
        equalTest(tests[i][1], 'MMM', i);
        equalTest(tests[i][0], 'MMMM', i);
        equalTest(tests[i][1], 'MMMM', i);
        equalTest(tests[i][0].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][0].toLocaleUpperCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleUpperCase(), 'MMMM', i);
    }
});

test("format", 18, function() {
    moment.lang('de');
    var a = [
            ['dddd, Do MMMM YYYY, h:mm:ss a',      'Sonntag, 14. Februar 2010, 3:25:50 pm'],
            ['ddd, hA',                            'So., 3PM'],
            ['M Mo MM MMMM MMM',                   '2 2. 02 Februar Febr.'],
            ['YYYY YY',                            '2010 10'],
            ['D Do DD',                            '14 14. 14'],
            ['d do dddd ddd',                      '0 0. Sonntag So.'],
            ['DDD DDDo DDDD',                      '45 45. 045'],
            ['w wo ww',                            '8 8. 08'],
            ['h hh',                               '3 03'],
            ['H HH',                               '15 15'],
            ['m mm',                               '25 25'],
            ['s ss',                               '50 50'],
            ['a A',                                'pm PM'],
            ['t\\he DDDo \\d\\ay of t\\he ye\\ar', 'the 45. day of the year'],
            ['L',                                  '14.02.2010'],
            ['LL',                                 '14. Februar 2010'],
            ['LLL',                                '14. Februar 2010 15:25 Uhr'],
            ['LLLL',                               'Sonntag, 14. Februar 2010 15:25 Uhr']
        ],
        b = moment(new Date(2010, 1, 14, 15, 25, 50, 125)),
        i;
    for (i = 0; i < a.length; i++) {
        equal(b.format(a[i][0]), a[i][1], a[i][0] + ' ---> ' + a[i][1]);
    }
});

test("format ordinal", 31, function() {
    moment.lang('de');
    equal(moment([2011, 0, 1]).format('DDDo'), '1.', '1.');
    equal(moment([2011, 0, 2]).format('DDDo'), '2.', '2.');
    equal(moment([2011, 0, 3]).format('DDDo'), '3.', '3.');
    equal(moment([2011, 0, 4]).format('DDDo'), '4.', '4.');
    equal(moment([2011, 0, 5]).format('DDDo'), '5.', '5.');
    equal(moment([2011, 0, 6]).format('DDDo'), '6.', '6.');
    equal(moment([2011, 0, 7]).format('DDDo'), '7.', '7.');
    equal(moment([2011, 0, 8]).format('DDDo'), '8.', '8.');
    equal(moment([2011, 0, 9]).format('DDDo'), '9.', '9.');
    equal(moment([2011, 0, 10]).format('DDDo'), '10.', '10.');

    equal(moment([2011, 0, 11]).format('DDDo'), '11.', '11.');
    equal(moment([2011, 0, 12]).format('DDDo'), '12.', '12.');
    equal(moment([2011, 0, 13]).format('DDDo'), '13.', '13.');
    equal(moment([2011, 0, 14]).format('DDDo'), '14.', '14.');
    equal(moment([2011, 0, 15]).format('DDDo'), '15.', '15.');
    equal(moment([2011, 0, 16]).format('DDDo'), '16.', '16.');
    equal(moment([2011, 0, 17]).format('DDDo'), '17.', '17.');
    equal(moment([2011, 0, 18]).format('DDDo'), '18.', '18.');
    equal(moment([2011, 0, 19]).format('DDDo'), '19.', '19.');
    equal(moment([2011, 0, 20]).format('DDDo'), '20.', '20.');

    equal(moment([2011, 0, 21]).format('DDDo'), '21.', '21.');
    equal(moment([2011, 0, 22]).format('DDDo'), '22.', '22.');
    equal(moment([2011, 0, 23]).format('DDDo'), '23.', '23.');
    equal(moment([2011, 0, 24]).format('DDDo'), '24.', '24.');
    equal(moment([2011, 0, 25]).format('DDDo'), '25.', '25.');
    equal(moment([2011, 0, 26]).format('DDDo'), '26.', '26.');
    equal(moment([2011, 0, 27]).format('DDDo'), '27.', '27.');
    equal(moment([2011, 0, 28]).format('DDDo'), '28.', '28.');
    equal(moment([2011, 0, 29]).format('DDDo'), '29.', '29.');
    equal(moment([2011, 0, 30]).format('DDDo'), '30.', '30.');

    equal(moment([2011, 0, 31]).format('DDDo'), '31.', '31.');
});

test("format month", 12, function() {
    moment.lang('de');
    var expected = 'Januar Jan._Februar Febr._März Mrz._April Apr._Mai Mai_Juni Jun._Juli Jul._August Aug._September Sept._Oktober Okt._November Nov._Dezember Dez.'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, i, 0]).format('MMMM MMM'), expected[i], expected[i]);
    }
});

test("format week", 7, function() {
    moment.lang('de');
    var expected = 'Sonntag So._Montag Mo._Dienstag Di._Mittwoch Mi._Donnerstag Do._Freitag Fr._Samstag Sa.'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, 0, 2 + i]).format('dddd ddd'), expected[i], expected[i]);
    }
});

test("from", 30, function() {
    moment.lang('de');
    var start = moment([2007, 1, 28]);
    equal(start.from(moment([2007, 1, 28]).add({s:44}), true),  "ein paar Sekunden",  "44 seconds = a few seconds");
    equal(start.from(moment([2007, 1, 28]).add({s:45}), true),  "einer Minute",       "45 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:89}), true),  "einer Minute",       "89 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:90}), true),  "2 Minuten",          "90 seconds = 2 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:44}), true),  "44 Minuten",         "44 minutes = 44 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:45}), true),  "einer Stunde",       "45 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:89}), true),  "einer Stunde",       "89 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:90}), true),  "2 Stunden",          "90 minutes = 2 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:5}), true),   "5 Stunden",          "5 hours = 5 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:21}), true),  "21 Stunden",         "21 hours = 21 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:22}), true),  "einem Tag",          "22 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:35}), true),  "einem Tag",          "35 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:36}), true),  "2 Tagen",            "36 hours = 2 days");
    equal(start.from(moment([2007, 1, 28]).add({d:1}), true),   "einem Tag",          "1 day = a day");
    equal(start.from(moment([2007, 1, 28]).add({d:5}), true),   "5 Tagen",            "5 days = 5 days");
    equal(start.from(moment([2007, 1, 28]).add({d:25}), true),  "25 Tagen",           "25 days = 25 days");
    equal(start.from(moment([2007, 1, 28]).add({d:26}), true),  "einem Monat",        "26 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:30}), true),  "einem Monat",        "30 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:45}), true),  "einem Monat",        "45 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:46}), true),  "2 Monaten",          "46 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:74}), true),  "2 Monaten",          "75 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:76}), true),  "3 Monaten",          "76 days = 3 months");
    equal(start.from(moment([2007, 1, 28]).add({M:1}), true),   "einem Monat",        "1 month = a month");
    equal(start.from(moment([2007, 1, 28]).add({M:5}), true),   "5 Monaten",          "5 months = 5 months");
    equal(start.from(moment([2007, 1, 28]).add({d:344}), true), "11 Monaten",         "344 days = 11 months");
    equal(start.from(moment([2007, 1, 28]).add({d:345}), true), "einem Jahr",         "345 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:547}), true), "einem Jahr",         "547 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:548}), true), "2 Jahren",           "548 days = 2 years");
    equal(start.from(moment([2007, 1, 28]).add({y:1}), true),   "einem Jahr",         "1 year = a year");
    equal(start.from(moment([2007, 1, 28]).add({y:5}), true),   "5 Jahren",           "5 years = 5 years");
});

test("suffix", 2, function() {
    moment.lang('de');
    equal(moment(30000).from(0), "in ein paar Sekunden", "prefix");
    equal(moment(0).from(30000), "vor ein paar Sekunden", "suffix");
});

test("fromNow", 2, function() {
    moment.lang('de');
    equal(moment().add({s:30}).fromNow(), "in ein paar Sekunden", "in a few seconds");
    equal(moment().add({d:5}).fromNow(), "in 5 Tagen", "in 5 days");
});

test("calendar day", 6, function() {
    moment.lang('de');

    var a = moment().hours(2).minutes(0).seconds(0);

    equal(moment(a).calendar(),                     "Heute um 2:00 Uhr",   "today at the same time");
    equal(moment(a).add({ m: 25 }).calendar(),      "Heute um 2:25 Uhr",   "Now plus 25 min");
    equal(moment(a).add({ h: 1 }).calendar(),       "Heute um 3:00 Uhr",   "Now plus 1 hour");
    equal(moment(a).add({ d: 1 }).calendar(),       "Morgen um 2:00 Uhr",  "tomorrow at the same time");
    equal(moment(a).subtract({ h: 1 }).calendar(),  "Heute um 1:00 Uhr",   "Now minus 1 hour");
    equal(moment(a).subtract({ d: 1 }).calendar(),  "Gestern um 2:00 Uhr", "yesterday at the same time");
});

test("calendar next week", 15, function() {
    moment.lang('de');

    var i;
    var m;

    for (i = 2; i < 7; i++) {
        m = moment().add({ d: i });
        equal(m.calendar(),       m.format('dddd [um] LT'),  "Today + " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('dddd [um] LT'),  "Today + " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('dddd [um] LT'),  "Today + " + i + " days end of day");
    }
});

test("calendar last week", 15, function() {
    moment.lang('de');

    for (i = 2; i < 7; i++) {
        m = moment().subtract({ d: i });
        equal(m.calendar(),       m.format('[letzten] dddd [um] LT'),  "Today + " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('[letzten] dddd [um] LT'),  "Today + " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('[letzten] dddd [um] LT'),  "Today + " + i + " days end of day");
    }
});

test("calendar all else", 4, function() {
    moment.lang('de');
    var weeksAgo = moment().subtract({ w: 1 });
    var weeksFromNow = moment().add({ w: 1 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "1 week ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 1 week");

    weeksAgo = moment().subtract({ w: 2 });
    weeksFromNow = moment().add({ w: 2 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "2 weeks ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 2 weeks");
});

/**************************************************
  English
 *************************************************/

module("lang:en-gb");

test("parse", 96, function() {
    moment.lang('en-gb');
    var tests = 'January Jan_February Feb_March Mar_April Apr_May May_June Jun_July Jul_August Aug_September Sep_October Oct_November Nov_December Dec'.split("_");
    var i;
    function equalTest(input, mmm, i) {
        equal(moment(input, mmm).month(), i, input + ' should be month ' + (i + 1));
    }
    for (i = 0; i < 12; i++) {
        tests[i] = tests[i].split(' ');
        equalTest(tests[i][0], 'MMM', i);
        equalTest(tests[i][1], 'MMM', i);
        equalTest(tests[i][0], 'MMMM', i);
        equalTest(tests[i][1], 'MMMM', i);
        equalTest(tests[i][0].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][0].toLocaleUpperCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleUpperCase(), 'MMMM', i);
    }
});

test("format", 18, function() {
    moment.lang('en-gb');
    var a = [
            ['dddd, MMMM Do YYYY, h:mm:ss a',      'Sunday, February 14th 2010, 3:25:50 pm'],
            ['ddd, hA',                            'Sun, 3PM'],
            ['M Mo MM MMMM MMM',                   '2 2nd 02 February Feb'],
            ['YYYY YY',                            '2010 10'],
            ['D Do DD',                            '14 14th 14'],
            ['d do dddd ddd',                      '0 0th Sunday Sun'],
            ['DDD DDDo DDDD',                      '45 45th 045'],
            ['w wo ww',                            '8 8th 08'],
            ['h hh',                               '3 03'],
            ['H HH',                               '15 15'],
            ['m mm',                               '25 25'],
            ['s ss',                               '50 50'],
            ['a A',                                'pm PM'],
            ['t\\he DDDo \\d\\ay of t\\he ye\\ar', 'the 45th day of the year'],
            ['L',                                  '14/02/2010'],
            ['LL',                                 '14 February 2010'],
            ['LLL',                                '14 February 2010 3:25 PM'],
            ['LLLL',                               'Sunday, 14 February 2010 3:25 PM']
        ],
        b = moment(new Date(2010, 1, 14, 15, 25, 50, 125)),
        i;
    for (i = 0; i < a.length; i++) {
        equal(b.format(a[i][0]), a[i][1], a[i][0] + ' ---> ' + a[i][1]);
    }
});

test("format ordinal", 31, function() {
    moment.lang('en-gb');
    equal(moment([2011, 0, 1]).format('DDDo'), '1st', '1st');
    equal(moment([2011, 0, 2]).format('DDDo'), '2nd', '2nd');
    equal(moment([2011, 0, 3]).format('DDDo'), '3rd', '3rd');
    equal(moment([2011, 0, 4]).format('DDDo'), '4th', '4th');
    equal(moment([2011, 0, 5]).format('DDDo'), '5th', '5th');
    equal(moment([2011, 0, 6]).format('DDDo'), '6th', '6th');
    equal(moment([2011, 0, 7]).format('DDDo'), '7th', '7th');
    equal(moment([2011, 0, 8]).format('DDDo'), '8th', '8th');
    equal(moment([2011, 0, 9]).format('DDDo'), '9th', '9th');
    equal(moment([2011, 0, 10]).format('DDDo'), '10th', '10th');

    equal(moment([2011, 0, 11]).format('DDDo'), '11th', '11th');
    equal(moment([2011, 0, 12]).format('DDDo'), '12th', '12th');
    equal(moment([2011, 0, 13]).format('DDDo'), '13th', '13th');
    equal(moment([2011, 0, 14]).format('DDDo'), '14th', '14th');
    equal(moment([2011, 0, 15]).format('DDDo'), '15th', '15th');
    equal(moment([2011, 0, 16]).format('DDDo'), '16th', '16th');
    equal(moment([2011, 0, 17]).format('DDDo'), '17th', '17th');
    equal(moment([2011, 0, 18]).format('DDDo'), '18th', '18th');
    equal(moment([2011, 0, 19]).format('DDDo'), '19th', '19th');
    equal(moment([2011, 0, 20]).format('DDDo'), '20th', '20th');

    equal(moment([2011, 0, 21]).format('DDDo'), '21st', '21st');
    equal(moment([2011, 0, 22]).format('DDDo'), '22nd', '22nd');
    equal(moment([2011, 0, 23]).format('DDDo'), '23rd', '23rd');
    equal(moment([2011, 0, 24]).format('DDDo'), '24th', '24th');
    equal(moment([2011, 0, 25]).format('DDDo'), '25th', '25th');
    equal(moment([2011, 0, 26]).format('DDDo'), '26th', '26th');
    equal(moment([2011, 0, 27]).format('DDDo'), '27th', '27th');
    equal(moment([2011, 0, 28]).format('DDDo'), '28th', '28th');
    equal(moment([2011, 0, 29]).format('DDDo'), '29th', '29th');
    equal(moment([2011, 0, 30]).format('DDDo'), '30th', '30th');

    equal(moment([2011, 0, 31]).format('DDDo'), '31st', '31st');
});

test("format month", 12, function() {
    moment.lang('en-gb');
    var expected = 'January Jan_February Feb_March Mar_April Apr_May May_June Jun_July Jul_August Aug_September Sep_October Oct_November Nov_December Dec'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, i, 0]).format('MMMM MMM'), expected[i], expected[i]);
    }
});

test("format week", 7, function() {
    moment.lang('en-gb');
    var expected = 'Sunday Sun_Monday Mon_Tuesday Tue_Wednesday Wed_Thursday Thu_Friday Fri_Saturday Sat'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, 0, 2 + i]).format('dddd ddd'), expected[i], expected[i]);
    }
});

test("from", 30, function() {
    moment.lang('en-gb');
    var start = moment([2007, 1, 28]);
    equal(start.from(moment([2007, 1, 28]).add({s:44}), true),  "a few seconds", "44 seconds = a few seconds");
    equal(start.from(moment([2007, 1, 28]).add({s:45}), true),  "a minute",      "45 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:89}), true),  "a minute",      "89 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:90}), true),  "2 minutes",     "90 seconds = 2 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:44}), true),  "44 minutes",    "44 minutes = 44 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:45}), true),  "an hour",       "45 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:89}), true),  "an hour",       "89 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:90}), true),  "2 hours",       "90 minutes = 2 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:5}), true),   "5 hours",       "5 hours = 5 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:21}), true),  "21 hours",      "21 hours = 21 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:22}), true),  "a day",         "22 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:35}), true),  "a day",         "35 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:36}), true),  "2 days",        "36 hours = 2 days");
    equal(start.from(moment([2007, 1, 28]).add({d:1}), true),   "a day",         "1 day = a day");
    equal(start.from(moment([2007, 1, 28]).add({d:5}), true),   "5 days",        "5 days = 5 days");
    equal(start.from(moment([2007, 1, 28]).add({d:25}), true),  "25 days",       "25 days = 25 days");
    equal(start.from(moment([2007, 1, 28]).add({d:26}), true),  "a month",       "26 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:30}), true),  "a month",       "30 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:45}), true),  "a month",       "45 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:46}), true),  "2 months",      "46 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:74}), true),  "2 months",      "75 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:76}), true),  "3 months",      "76 days = 3 months");
    equal(start.from(moment([2007, 1, 28]).add({M:1}), true),   "a month",       "1 month = a month");
    equal(start.from(moment([2007, 1, 28]).add({M:5}), true),   "5 months",      "5 months = 5 months");
    equal(start.from(moment([2007, 1, 28]).add({d:344}), true), "11 months",     "344 days = 11 months");
    equal(start.from(moment([2007, 1, 28]).add({d:345}), true), "a year",        "345 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:547}), true), "a year",        "547 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:548}), true), "2 years",       "548 days = 2 years");
    equal(start.from(moment([2007, 1, 28]).add({y:1}), true),   "a year",        "1 year = a year");
    equal(start.from(moment([2007, 1, 28]).add({y:5}), true),   "5 years",       "5 years = 5 years");
});

test("suffix", 2, function() {
    moment.lang('en-gb');
    equal(moment(30000).from(0), "in a few seconds",  "prefix");
    equal(moment(0).from(30000), "a few seconds ago", "suffix");
});


test("now from now", 1, function() {
    moment.lang('en-gb');
    equal(moment().fromNow(), "a few seconds ago",  "now from now should display as in the past");
});


test("fromNow", 2, function() {
    moment.lang('en-gb');
    equal(moment().add({s:30}).fromNow(), "in a few seconds", "in a few seconds");
    equal(moment().add({d:5}).fromNow(), "in 5 days", "in 5 days");
});


test("calendar day", 6, function() {
    moment.lang('en-gb');

    var a = moment().hours(2).minutes(0).seconds(0);

    equal(moment(a).calendar(),                     "Today at 2:00 AM",     "today at the same time");
    equal(moment(a).add({ m: 25 }).calendar(),      "Today at 2:25 AM",     "Now plus 25 min");
    equal(moment(a).add({ h: 1 }).calendar(),       "Today at 3:00 AM",     "Now plus 1 hour");
    equal(moment(a).add({ d: 1 }).calendar(),       "Tomorrow at 2:00 AM",  "tomorrow at the same time");
    equal(moment(a).subtract({ h: 1 }).calendar(),  "Today at 1:00 AM",     "Now minus 1 hour");
    equal(moment(a).subtract({ d: 1 }).calendar(),  "Yesterday at 2:00 AM", "yesterday at the same time");
});

test("calendar next week", 15, function() {
    moment.lang('en-gb');

    var i;
    var m;

    for (i = 2; i < 7; i++) {
        m = moment().add({ d: i });
        equal(m.calendar(),       m.format('dddd [at] LT'),  "Today + " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('dddd [at] LT'),  "Today + " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('dddd [at] LT'),  "Today + " + i + " days end of day");
    }
});

test("calendar last week", 15, function() {
    moment.lang('en-gb');

    for (i = 2; i < 7; i++) {
        m = moment().subtract({ d: i });
        equal(m.calendar(),       m.format('[last] dddd [at] LT'),  "Today - " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('[last] dddd [at] LT'),  "Today - " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('[last] dddd [at] LT'),  "Today - " + i + " days end of day");
    }
});

test("calendar all else", 4, function() {
    moment.lang('en-gb');
    var weeksAgo = moment().subtract({ w: 1 });
    var weeksFromNow = moment().add({ w: 1 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "1 week ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 1 week");

    weeksAgo = moment().subtract({ w: 2 });
    weeksFromNow = moment().add({ w: 2 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "2 weeks ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 2 weeks");
});

/**************************************************
  English
 *************************************************/

module("lang:en");

test("parse", 96, function() {
    moment.lang('en');
    var tests = 'January Jan_February Feb_March Mar_April Apr_May May_June Jun_July Jul_August Aug_September Sep_October Oct_November Nov_December Dec'.split("_");
    var i;
    function equalTest(input, mmm, i) {
        equal(moment(input, mmm).month(), i, input + ' should be month ' + (i + 1));
    }
    for (i = 0; i < 12; i++) {
        tests[i] = tests[i].split(' ');
        equalTest(tests[i][0], 'MMM', i);
        equalTest(tests[i][1], 'MMM', i);
        equalTest(tests[i][0], 'MMMM', i);
        equalTest(tests[i][1], 'MMMM', i);
        equalTest(tests[i][0].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][0].toLocaleUpperCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleUpperCase(), 'MMMM', i);
    }
});

test("format", 18, function() {
    moment.lang('en');
    var a = [
            ['dddd, MMMM Do YYYY, h:mm:ss a',      'Sunday, February 14th 2010, 3:25:50 pm'],
            ['ddd, hA',                            'Sun, 3PM'],
            ['M Mo MM MMMM MMM',                   '2 2nd 02 February Feb'],
            ['YYYY YY',                            '2010 10'],
            ['D Do DD',                            '14 14th 14'],
            ['d do dddd ddd',                      '0 0th Sunday Sun'],
            ['DDD DDDo DDDD',                      '45 45th 045'],
            ['w wo ww',                            '8 8th 08'],
            ['h hh',                               '3 03'],
            ['H HH',                               '15 15'],
            ['m mm',                               '25 25'],
            ['s ss',                               '50 50'],
            ['a A',                                'pm PM'],
            ['t\\he DDDo \\d\\ay of t\\he ye\\ar', 'the 45th day of the year'],
            ['L',                                  '02/14/2010'],
            ['LL',                                 'February 14 2010'],
            ['LLL',                                'February 14 2010 3:25 PM'],
            ['LLLL',                               'Sunday, February 14 2010 3:25 PM']
        ],
        b = moment(new Date(2010, 1, 14, 15, 25, 50, 125)),
        i;
    for (i = 0; i < a.length; i++) {
        equal(b.format(a[i][0]), a[i][1], a[i][0] + ' ---> ' + a[i][1]);
    }
});

test("format ordinal", 31, function() {
    moment.lang('en');
    equal(moment([2011, 0, 1]).format('DDDo'), '1st', '1st');
    equal(moment([2011, 0, 2]).format('DDDo'), '2nd', '2nd');
    equal(moment([2011, 0, 3]).format('DDDo'), '3rd', '3rd');
    equal(moment([2011, 0, 4]).format('DDDo'), '4th', '4th');
    equal(moment([2011, 0, 5]).format('DDDo'), '5th', '5th');
    equal(moment([2011, 0, 6]).format('DDDo'), '6th', '6th');
    equal(moment([2011, 0, 7]).format('DDDo'), '7th', '7th');
    equal(moment([2011, 0, 8]).format('DDDo'), '8th', '8th');
    equal(moment([2011, 0, 9]).format('DDDo'), '9th', '9th');
    equal(moment([2011, 0, 10]).format('DDDo'), '10th', '10th');

    equal(moment([2011, 0, 11]).format('DDDo'), '11th', '11th');
    equal(moment([2011, 0, 12]).format('DDDo'), '12th', '12th');
    equal(moment([2011, 0, 13]).format('DDDo'), '13th', '13th');
    equal(moment([2011, 0, 14]).format('DDDo'), '14th', '14th');
    equal(moment([2011, 0, 15]).format('DDDo'), '15th', '15th');
    equal(moment([2011, 0, 16]).format('DDDo'), '16th', '16th');
    equal(moment([2011, 0, 17]).format('DDDo'), '17th', '17th');
    equal(moment([2011, 0, 18]).format('DDDo'), '18th', '18th');
    equal(moment([2011, 0, 19]).format('DDDo'), '19th', '19th');
    equal(moment([2011, 0, 20]).format('DDDo'), '20th', '20th');

    equal(moment([2011, 0, 21]).format('DDDo'), '21st', '21st');
    equal(moment([2011, 0, 22]).format('DDDo'), '22nd', '22nd');
    equal(moment([2011, 0, 23]).format('DDDo'), '23rd', '23rd');
    equal(moment([2011, 0, 24]).format('DDDo'), '24th', '24th');
    equal(moment([2011, 0, 25]).format('DDDo'), '25th', '25th');
    equal(moment([2011, 0, 26]).format('DDDo'), '26th', '26th');
    equal(moment([2011, 0, 27]).format('DDDo'), '27th', '27th');
    equal(moment([2011, 0, 28]).format('DDDo'), '28th', '28th');
    equal(moment([2011, 0, 29]).format('DDDo'), '29th', '29th');
    equal(moment([2011, 0, 30]).format('DDDo'), '30th', '30th');

    equal(moment([2011, 0, 31]).format('DDDo'), '31st', '31st');
});

test("format month", 12, function() {
    moment.lang('en');
    var expected = 'January Jan_February Feb_March Mar_April Apr_May May_June Jun_July Jul_August Aug_September Sep_October Oct_November Nov_December Dec'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, i, 0]).format('MMMM MMM'), expected[i], expected[i]);
    }
});

test("format week", 7, function() {
    moment.lang('en');
    var expected = 'Sunday Sun_Monday Mon_Tuesday Tue_Wednesday Wed_Thursday Thu_Friday Fri_Saturday Sat'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, 0, 2 + i]).format('dddd ddd'), expected[i], expected[i]);
    }
});

test("from", 30, function() {
    moment.lang('en');
    var start = moment([2007, 1, 28]);
    equal(start.from(moment([2007, 1, 28]).add({s:44}), true),  "a few seconds", "44 seconds = a few seconds");
    equal(start.from(moment([2007, 1, 28]).add({s:45}), true),  "a minute",      "45 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:89}), true),  "a minute",      "89 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:90}), true),  "2 minutes",     "90 seconds = 2 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:44}), true),  "44 minutes",    "44 minutes = 44 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:45}), true),  "an hour",       "45 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:89}), true),  "an hour",       "89 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:90}), true),  "2 hours",       "90 minutes = 2 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:5}), true),   "5 hours",       "5 hours = 5 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:21}), true),  "21 hours",      "21 hours = 21 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:22}), true),  "a day",         "22 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:35}), true),  "a day",         "35 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:36}), true),  "2 days",        "36 hours = 2 days");
    equal(start.from(moment([2007, 1, 28]).add({d:1}), true),   "a day",         "1 day = a day");
    equal(start.from(moment([2007, 1, 28]).add({d:5}), true),   "5 days",        "5 days = 5 days");
    equal(start.from(moment([2007, 1, 28]).add({d:25}), true),  "25 days",       "25 days = 25 days");
    equal(start.from(moment([2007, 1, 28]).add({d:26}), true),  "a month",       "26 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:30}), true),  "a month",       "30 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:45}), true),  "a month",       "45 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:46}), true),  "2 months",      "46 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:74}), true),  "2 months",      "75 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:76}), true),  "3 months",      "76 days = 3 months");
    equal(start.from(moment([2007, 1, 28]).add({M:1}), true),   "a month",       "1 month = a month");
    equal(start.from(moment([2007, 1, 28]).add({M:5}), true),   "5 months",      "5 months = 5 months");
    equal(start.from(moment([2007, 1, 28]).add({d:344}), true), "11 months",     "344 days = 11 months");
    equal(start.from(moment([2007, 1, 28]).add({d:345}), true), "a year",        "345 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:547}), true), "a year",        "547 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:548}), true), "2 years",       "548 days = 2 years");
    equal(start.from(moment([2007, 1, 28]).add({y:1}), true),   "a year",        "1 year = a year");
    equal(start.from(moment([2007, 1, 28]).add({y:5}), true),   "5 years",       "5 years = 5 years");
});

test("suffix", 2, function() {
    moment.lang('en');
    equal(moment(30000).from(0), "in a few seconds",  "prefix");
    equal(moment(0).from(30000), "a few seconds ago", "suffix");
});


test("now from now", 1, function() {
    moment.lang('en');
    equal(moment().fromNow(), "a few seconds ago",  "now from now should display as in the past");
});


test("fromNow", 2, function() {
    moment.lang('en');
    equal(moment().add({s:30}).fromNow(), "in a few seconds", "in a few seconds");
    equal(moment().add({d:5}).fromNow(), "in 5 days", "in 5 days");
});

test("calendar day", 6, function() {
    moment.lang('en');

    var a = moment().hours(2).minutes(0).seconds(0);

    equal(moment(a).calendar(),                     "Today at 2:00 AM",     "today at the same time");
    equal(moment(a).add({ m: 25 }).calendar(),      "Today at 2:25 AM",     "Now plus 25 min");
    equal(moment(a).add({ h: 1 }).calendar(),       "Today at 3:00 AM",     "Now plus 1 hour");
    equal(moment(a).add({ d: 1 }).calendar(),       "Tomorrow at 2:00 AM",  "tomorrow at the same time");
    equal(moment(a).subtract({ h: 1 }).calendar(),  "Today at 1:00 AM",     "Now minus 1 hour");
    equal(moment(a).subtract({ d: 1 }).calendar(),  "Yesterday at 2:00 AM", "yesterday at the same time");
});

test("calendar next week", 15, function() {
    moment.lang('en');

    var i;
    var m;

    for (i = 2; i < 7; i++) {
        m = moment().add({ d: i });
        equal(m.calendar(),       m.format('dddd [at] LT'),  "Today + " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('dddd [at] LT'),  "Today + " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('dddd [at] LT'),  "Today + " + i + " days end of day");
    }
});

test("calendar last week", 15, function() {
    moment.lang('en');

    for (i = 2; i < 7; i++) {
        m = moment().subtract({ d: i });
        equal(m.calendar(),       m.format('[last] dddd [at] LT'),  "Today - " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('[last] dddd [at] LT'),  "Today - " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('[last] dddd [at] LT'),  "Today - " + i + " days end of day");
    }
});

test("calendar all else", 4, function() {
    moment.lang('en');
    var weeksAgo = moment().subtract({ w: 1 });
    var weeksFromNow = moment().add({ w: 1 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "1 week ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 1 week");

    weeksAgo = moment().subtract({ w: 2 });
    weeksFromNow = moment().add({ w: 2 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "2 weeks ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 2 weeks");
});

/**************************************************
  Spanish
 *************************************************/

module("lang:es");

test("parse", 96, function() {
    moment.lang('es');
    var tests = 'Enero Ene._Febrero Feb._Marzo Mar._Abril Abr._Mayo May._Junio Jun._Julio Jul._Agosto Ago._Septiembre Sep._Octubre Oct._Noviembre Nov._Diciembre Dic.'.split("_");
    var i;
    function equalTest(input, mmm, i) {
        equal(moment(input, mmm).month(), i, input + ' should be month ' + (i + 1));
    }
    for (i = 0; i < 12; i++) {
        tests[i] = tests[i].split(' ');
        equalTest(tests[i][0], 'MMM', i);
        equalTest(tests[i][1], 'MMM', i);
        equalTest(tests[i][0], 'MMMM', i);
        equalTest(tests[i][1], 'MMMM', i);
        equalTest(tests[i][0].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][0].toLocaleUpperCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleUpperCase(), 'MMMM', i);
    }
});

test("format ordinal", 31, function() {
    moment.lang('es');
    equal(moment([2011, 0, 1]).format('DDDo'), '1º', '1º');
    equal(moment([2011, 0, 2]).format('DDDo'), '2º', '2º');
    equal(moment([2011, 0, 3]).format('DDDo'), '3º', '3º');
    equal(moment([2011, 0, 4]).format('DDDo'), '4º', '4º');
    equal(moment([2011, 0, 5]).format('DDDo'), '5º', '5º');
    equal(moment([2011, 0, 6]).format('DDDo'), '6º', '6º');
    equal(moment([2011, 0, 7]).format('DDDo'), '7º', '7º');
    equal(moment([2011, 0, 8]).format('DDDo'), '8º', '8º');
    equal(moment([2011, 0, 9]).format('DDDo'), '9º', '9º');
    equal(moment([2011, 0, 10]).format('DDDo'), '10º', '10º');

    equal(moment([2011, 0, 11]).format('DDDo'), '11º', '11º');
    equal(moment([2011, 0, 12]).format('DDDo'), '12º', '12º');
    equal(moment([2011, 0, 13]).format('DDDo'), '13º', '13º');
    equal(moment([2011, 0, 14]).format('DDDo'), '14º', '14º');
    equal(moment([2011, 0, 15]).format('DDDo'), '15º', '15º');
    equal(moment([2011, 0, 16]).format('DDDo'), '16º', '16º');
    equal(moment([2011, 0, 17]).format('DDDo'), '17º', '17º');
    equal(moment([2011, 0, 18]).format('DDDo'), '18º', '18º');
    equal(moment([2011, 0, 19]).format('DDDo'), '19º', '19º');
    equal(moment([2011, 0, 20]).format('DDDo'), '20º', '20º');

    equal(moment([2011, 0, 21]).format('DDDo'), '21º', '21º');
    equal(moment([2011, 0, 22]).format('DDDo'), '22º', '22º');
    equal(moment([2011, 0, 23]).format('DDDo'), '23º', '23º');
    equal(moment([2011, 0, 24]).format('DDDo'), '24º', '24º');
    equal(moment([2011, 0, 25]).format('DDDo'), '25º', '25º');
    equal(moment([2011, 0, 26]).format('DDDo'), '26º', '26º');
    equal(moment([2011, 0, 27]).format('DDDo'), '27º', '27º');
    equal(moment([2011, 0, 28]).format('DDDo'), '28º', '28º');
    equal(moment([2011, 0, 29]).format('DDDo'), '29º', '29º');
    equal(moment([2011, 0, 30]).format('DDDo'), '30º', '30º');

    equal(moment([2011, 0, 31]).format('DDDo'), '31º', '31º');
});

test("format month", 12, function() {
    moment.lang('es');
    var expected = 'Enero Ene._Febrero Feb._Marzo Mar._Abril Abr._Mayo May._Junio Jun._Julio Jul._Agosto Ago._Septiembre Sep._Octubre Oct._Noviembre Nov._Diciembre Dic.'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, i, 0]).format('MMMM MMM'), expected[i], expected[i]);
    }
});

test("format week", 7, function() {
    moment.lang('es');
    var expected = 'Domingo Dom._Lunes Lun._Martes Mar._Miércoles Mié._Jueves Jue._Viernes Vie._Sábado Sáb.'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, 0, 2 + i]).format('dddd ddd'), expected[i], expected[i]);
    }
});

test("from", 30, function() {
    moment.lang('es');
    var start = moment([2007, 1, 28]);
    equal(start.from(moment([2007, 1, 28]).add({s:44}), true),  "unos segundos", "44 seconds = a few seconds");
    equal(start.from(moment([2007, 1, 28]).add({s:45}), true),  "un minuto",      "45 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:89}), true),  "un minuto",      "89 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:90}), true),  "2 minutos",     "90 seconds = 2 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:44}), true),  "44 minutos",    "44 minutes = 44 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:45}), true),  "una hora",       "45 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:89}), true),  "una hora",       "89 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:90}), true),  "2 horas",       "90 minutes = 2 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:5}), true),   "5 horas",       "5 hours = 5 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:21}), true),  "21 horas",      "21 hours = 21 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:22}), true),  "un día",         "22 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:35}), true),  "un día",         "35 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:36}), true),  "2 días",        "36 hours = 2 days");
    equal(start.from(moment([2007, 1, 28]).add({d:1}), true),   "un día",         "1 day = a day");
    equal(start.from(moment([2007, 1, 28]).add({d:5}), true),   "5 días",        "5 days = 5 days");
    equal(start.from(moment([2007, 1, 28]).add({d:25}), true),  "25 días",       "25 days = 25 days");
    equal(start.from(moment([2007, 1, 28]).add({d:26}), true),  "un mes",       "26 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:30}), true),  "un mes",       "30 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:45}), true),  "un mes",       "45 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:46}), true),  "2 meses",      "46 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:74}), true),  "2 meses",      "75 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:76}), true),  "3 meses",      "76 days = 3 months");
    equal(start.from(moment([2007, 1, 28]).add({M:1}), true),   "un mes",       "1 month = a month");
    equal(start.from(moment([2007, 1, 28]).add({M:5}), true),   "5 meses",      "5 months = 5 months");
    equal(start.from(moment([2007, 1, 28]).add({d:344}), true), "11 meses",     "344 days = 11 months");
    equal(start.from(moment([2007, 1, 28]).add({d:345}), true), "un año",        "345 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:547}), true), "un año",        "547 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:548}), true), "2 años",       "548 days = 2 years");
    equal(start.from(moment([2007, 1, 28]).add({y:1}), true),   "un año",        "1 year = a year");
    equal(start.from(moment([2007, 1, 28]).add({y:5}), true),   "5 años",       "5 years = 5 years");
});

test("suffix", 2, function() {
    moment.lang('es');
    equal(moment(30000).from(0), "en unos segundos",  "prefix");
    equal(moment(0).from(30000), "hace unos segundos", "suffix");
});


test("now from now", 1, function() {
    moment.lang('es');
    equal(moment().fromNow(), "hace unos segundos",  "now from now should display as in the past");
});


test("fromNow", 2, function() {
    moment.lang('es');
    equal(moment().add({s:30}).fromNow(), "en unos segundos", "en unos segundos");
    equal(moment().add({d:5}).fromNow(), "en 5 días", "en 5 días");
});


test("calendar day", 7, function() {
    moment.lang('es');

    var a = moment().hours(2).minutes(0).seconds(0);

    equal(moment(a).calendar(),                         "hoy a las 2:00",     "today at the same time");
    equal(moment(a).add({ m: 25 }).calendar(),          "hoy a las 2:25",     "Now plus 25 min");
    equal(moment(a).add({ h: 1 }).calendar(),           "hoy a las 3:00",     "Now plus 1 hour");
    equal(moment(a).add({ d: 1 }).calendar(),           "mañana a las 2:00",  "tomorrow at the same time");
    equal(moment(a).add({ d: 1, h : -1 }).calendar(),   "mañana a la 1:00",   "tomorrow minus 1 hour");
    equal(moment(a).subtract({ h: 1 }).calendar(),      "hoy a la 1:00",      "Now minus 1 hour");
    equal(moment(a).subtract({ d: 1 }).calendar(),      "ayer a las 2:00",    "yesterday at the same time");
});

test("calendar next week", 15, function() {
    moment.lang('es');

    var i;
    var m;

    for (i = 2; i < 7; i++) {
        m = moment().add({ d: i });
        equal(m.calendar(),       m.format('dddd [a la' + ((m.hours() !== 1) ? 's' : '') + '] LT'),  "Today + " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('dddd [a la' + ((m.hours() !== 1) ? 's' : '') + '] LT'),  "Today + " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('dddd [a la' + ((m.hours() !== 1) ? 's' : '') + '] LT'),  "Today + " + i + " days end of day");
    }
});

test("calendar last week", 15, function() {
    moment.lang('es');

    for (i = 2; i < 7; i++) {
        m = moment().subtract({ d: i });
        equal(m.calendar(),       m.format('[el] dddd [pasado a la' + ((m.hours() !== 1) ? 's' : '') + '] LT'),  "Today - " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('[el] dddd [pasado a la' + ((m.hours() !== 1) ? 's' : '') + '] LT'),  "Today - " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('[el] dddd [pasado a la' + ((m.hours() !== 1) ? 's' : '') + '] LT'),  "Today - " + i + " days end of day");
    }
});

test("calendar all else", 4, function() {
    moment.lang('es');
    var weeksAgo = moment().subtract({ w: 1 });
    var weeksFromNow = moment().add({ w: 1 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "1 week ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 1 week");

    weeksAgo = moment().subtract({ w: 2 });
    weeksFromNow = moment().add({ w: 2 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "2 weeks ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 2 weeks");
});

/**************************************************
  Euskara
 *************************************************/

module("lang:eu");

test("parse", 96, function() {
    moment.lang('eu');
    var tests = 'urtarrila urt._otsaila ots._martxoa mar._apirila api._maiatza mai._ekaina eka._uztaila uzt._abuztua abu._iraila ira._urria urr._azaroa aza._abendua abe.'.split("_");
    var i;
    function equalTest(input, mmm, i) {
        equal(moment(input, mmm).month(), i, input + ' should be month ' + (i + 1));
    }
    for (i = 0; i < 12; i++) {
        tests[i] = tests[i].split(' ');
        equalTest(tests[i][0], 'MMM', i);
        equalTest(tests[i][1], 'MMM', i);
        equalTest(tests[i][0], 'MMMM', i);
        equalTest(tests[i][1], 'MMMM', i);
        equalTest(tests[i][0].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][0].toLocaleUpperCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleUpperCase(), 'MMMM', i);
    }
});

test("format", 18, function() {
    moment.lang('eu');
    var a = [
            ['dddd, MMMM Do YYYY, h:mm:ss a',      'igandea, otsaila 14. 2010, 3:25:50 pm'],
            ['ddd, hA',                            'ig., 3PM'],
            ['M Mo MM MMMM MMM',                   '2 2. 02 otsaila ots.'],
            ['YYYY YY',                            '2010 10'],
            ['D Do DD',                            '14 14. 14'],
            ['d do dddd ddd',                      '0 0. igandea ig.'],
            ['DDD DDDo DDDD',                      '45 45. 045'],
            ['w wo ww',                            '8 8. 08'],
            ['h hh',                               '3 03'],
            ['H HH',                               '15 15'],
            ['m mm',                               '25 25'],
            ['s ss',                               '50 50'],
            ['a A',                                'pm PM'],
            ['t\\he DDDo \\d\\ay of t\\he ye\\ar', 'the 45. day of the year'],
            ['L',                                  '2010-02-14'],
            ['LL',                                 '2010ko otsailaren 14a'],
            ['LLL',                                '2010ko otsailaren 14a 15:25'],
            ['LLLL',                               'igandea, 2010ko otsailaren 14a 15:25']
        ],
        b = moment(new Date(2010, 1, 14, 15, 25, 50, 125)),
        i;
    for (i = 0; i < a.length; i++) {
        equal(b.format(a[i][0]), a[i][1], a[i][0] + ' ---> ' + a[i][1]);
    }
});

test("format ordinal", 31, function() {
    moment.lang('eu');
    equal(moment([2011, 0, 1]).format('DDDo'), '1.', '1.');
    equal(moment([2011, 0, 2]).format('DDDo'), '2.', '2.');
    equal(moment([2011, 0, 3]).format('DDDo'), '3.', '3.');
    equal(moment([2011, 0, 4]).format('DDDo'), '4.', '4.');
    equal(moment([2011, 0, 5]).format('DDDo'), '5.', '5.');
    equal(moment([2011, 0, 6]).format('DDDo'), '6.', '6.');
    equal(moment([2011, 0, 7]).format('DDDo'), '7.', '7.');
    equal(moment([2011, 0, 8]).format('DDDo'), '8.', '8.');
    equal(moment([2011, 0, 9]).format('DDDo'), '9.', '9.');
    equal(moment([2011, 0, 10]).format('DDDo'), '10.', '10.');

    equal(moment([2011, 0, 11]).format('DDDo'), '11.', '11.');
    equal(moment([2011, 0, 12]).format('DDDo'), '12.', '12.');
    equal(moment([2011, 0, 13]).format('DDDo'), '13.', '13.');
    equal(moment([2011, 0, 14]).format('DDDo'), '14.', '14.');
    equal(moment([2011, 0, 15]).format('DDDo'), '15.', '15.');
    equal(moment([2011, 0, 16]).format('DDDo'), '16.', '16.');
    equal(moment([2011, 0, 17]).format('DDDo'), '17.', '17.');
    equal(moment([2011, 0, 18]).format('DDDo'), '18.', '18.');
    equal(moment([2011, 0, 19]).format('DDDo'), '19.', '19.');
    equal(moment([2011, 0, 20]).format('DDDo'), '20.', '20.');

    equal(moment([2011, 0, 21]).format('DDDo'), '21.', '21.');
    equal(moment([2011, 0, 22]).format('DDDo'), '22.', '22.');
    equal(moment([2011, 0, 23]).format('DDDo'), '23.', '23.');
    equal(moment([2011, 0, 24]).format('DDDo'), '24.', '24.');
    equal(moment([2011, 0, 25]).format('DDDo'), '25.', '25.');
    equal(moment([2011, 0, 26]).format('DDDo'), '26.', '26.');
    equal(moment([2011, 0, 27]).format('DDDo'), '27.', '27.');
    equal(moment([2011, 0, 28]).format('DDDo'), '28.', '28.');
    equal(moment([2011, 0, 29]).format('DDDo'), '29.', '29.');
    equal(moment([2011, 0, 30]).format('DDDo'), '30.', '30.');

    equal(moment([2011, 0, 31]).format('DDDo'), '31.', '31.');
});

test("format month", 12, function() {
    moment.lang('eu');
    var expected = 'urtarrila urt._otsaila ots._martxoa mar._apirila api._maiatza mai._ekaina eka._uztaila uzt._abuztua abu._iraila ira._urria urr._azaroa aza._abendua abe.'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, i, 0]).format('MMMM MMM'), expected[i], expected[i]);
    }
});

test("format week", 7, function() {
    moment.lang('eu');
    var expected = 'igandea ig._astelehena al._asteartea ar._asteazkena az._osteguna og._ostirala ol._larunbata lr.'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, 0, 2 + i]).format('dddd ddd'), expected[i], expected[i]);
    }
});

test("from", 30, function() {
    moment.lang('eu');
    var start = moment([2007, 1, 28]);
    equal(start.from(moment([2007, 1, 28]).add({s:44}), true),  "segundo batzuk", "44 seconds = a few seconds");
    equal(start.from(moment([2007, 1, 28]).add({s:45}), true),  "minutu bat",     "45 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:89}), true),  "minutu bat",     "89 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:90}), true),  "2 minutu",       "90 seconds = 2 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:44}), true),  "44 minutu",      "44 minutes = 44 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:45}), true),  "ordu bat",       "45 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:89}), true),  "ordu bat",       "89 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:90}), true),  "2 ordu",         "90 minutes = 2 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:5}), true),   "5 ordu",         "5 hours = 5 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:21}), true),  "21 ordu",        "21 hours = 21 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:22}), true),  "egun bat",       "22 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:35}), true),  "egun bat",       "35 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:36}), true),  "2 egun",         "36 hours = 2 days");
    equal(start.from(moment([2007, 1, 28]).add({d:1}), true),   "egun bat",       "1 day = a day");
    equal(start.from(moment([2007, 1, 28]).add({d:5}), true),   "5 egun",         "5 days = 5 days");
    equal(start.from(moment([2007, 1, 28]).add({d:25}), true),  "25 egun",        "25 days = 25 days");
    equal(start.from(moment([2007, 1, 28]).add({d:26}), true),  "hilabete bat",   "26 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:30}), true),  "hilabete bat",   "30 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:45}), true),  "hilabete bat",   "45 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:46}), true),  "2 hilabete",     "46 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:74}), true),  "2 hilabete",     "75 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:76}), true),  "3 hilabete",     "76 days = 3 months");
    equal(start.from(moment([2007, 1, 28]).add({M:1}), true),   "hilabete bat",   "1 month = a month");
    equal(start.from(moment([2007, 1, 28]).add({M:5}), true),   "5 hilabete",     "5 months = 5 months");
    equal(start.from(moment([2007, 1, 28]).add({d:344}), true), "11 hilabete",    "344 days = 11 months");
    equal(start.from(moment([2007, 1, 28]).add({d:345}), true), "urte bat",       "345 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:547}), true), "urte bat",       "547 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:548}), true), "2 urte",         "548 days = 2 years");
    equal(start.from(moment([2007, 1, 28]).add({y:1}), true),   "urte bat",       "1 year = a year");
    equal(start.from(moment([2007, 1, 28]).add({y:5}), true),   "5 urte",         "5 years = 5 years");
});

test("suffix", 2, function() {
    moment.lang('eu');
    equal(moment(30000).from(0), "segundo batzuk barru",  "prefix");
    equal(moment(0).from(30000), "duela segundo batzuk", "suffix");
});


test("now from now", 1, function() {
    moment.lang('eu');
    equal(moment().fromNow(), "duela segundo batzuk",  "now from now should display as in the past");
});


test("fromNow", 2, function() {
    moment.lang('eu');
    equal(moment().add({s:30}).fromNow(), "segundo batzuk barru", "in seconds");
    equal(moment().add({d:5}).fromNow(), "5 egun barru", "in 5 days");
});

test("calendar day", 6, function() {
    moment.lang('eu');

    var a = moment().hours(2).minutes(0).seconds(0);

    equal(moment(a).calendar(),                     "gaur 02:00etan",  "today at the same time");
    equal(moment(a).add({ m: 25 }).calendar(),      "gaur 02:25etan",  "now plus 25 min");
    equal(moment(a).add({ h: 1 }).calendar(),       "gaur 03:00etan",  "now plus 1 hour");
    equal(moment(a).add({ d: 1 }).calendar(),       "bihar 02:00etan", "tomorrow at the same time");
    equal(moment(a).subtract({ h: 1 }).calendar(),  "gaur 01:00etan",  "now minus 1 hour");
    equal(moment(a).subtract({ d: 1 }).calendar(),  "atzo 02:00etan",  "yesterday at the same time");
});

test("calendar next week", 15, function() {
    moment.lang('eu');

    var i;
    var m;

    for (i = 2; i < 7; i++) {
        m = moment().add({ d: i });
        equal(m.calendar(),       m.format('dddd LT[etan]'),  "Today + " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('dddd LT[etan]'),  "Today + " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('dddd LT[etan]'),  "Today + " + i + " days end of day");
    }
});

test("calendar last week", 15, function() {
    moment.lang('eu');

    for (i = 2; i < 7; i++) {
        m = moment().subtract({ d: i });
        equal(m.calendar(),       m.format('[aurreko] dddd LT[etan]'),  "Today - " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('[aurreko] dddd LT[etan]'),  "Today - " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('[aurreko] dddd LT[etan]'),  "Today - " + i + " days end of day");
    }
});

test("calendar all else", 4, function() {
    moment.lang('eu');
    var weeksAgo = moment().subtract({ w: 1 });
    var weeksFromNow = moment().add({ w: 1 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "1 week ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 1 week");

    weeksAgo = moment().subtract({ w: 2 });
    weeksFromNow = moment().add({ w: 2 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "2 weeks ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 2 weeks");
});

/**************************************************
  French
 *************************************************/

module("lang:fr");

test("parse", 96, function() {
    moment.lang('fr');
    var tests = 'janvier janv._février févr._mars mars_avril avr._mai mai_juin juin_juillet juil._août août_septembre sept._octobre oct._novembre nov._décembre déc.'.split("_");
    var i;
    function equalTest(input, mmm, i) {
        equal(moment(input, mmm).month(), i, input + ' should be month ' + (i + 1));
    }
    for (i = 0; i < 12; i++) {
        tests[i] = tests[i].split(' ');
        equalTest(tests[i][0], 'MMM', i);
        equalTest(tests[i][1], 'MMM', i);
        equalTest(tests[i][0], 'MMMM', i);
        equalTest(tests[i][1], 'MMMM', i);
        equalTest(tests[i][0].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][0].toLocaleUpperCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleUpperCase(), 'MMMM', i);
    }
});

test("format", 18, function() {
    moment.lang('fr');
    var a = [
            ['dddd, MMMM Do YYYY, h:mm:ss a',      'dimanche, février 14ème 2010, 3:25:50 pm'],
            ['ddd, hA',                            'dim., 3PM'],
            ['M Mo MM MMMM MMM',                   '2 2ème 02 février févr.'],
            ['YYYY YY',                            '2010 10'],
            ['D Do DD',                            '14 14ème 14'],
            ['d do dddd ddd',                      '0 0ème dimanche dim.'],
            ['DDD DDDo DDDD',                      '45 45ème 045'],
            ['w wo ww',                            '8 8ème 08'],
            ['h hh',                               '3 03'],
            ['H HH',                               '15 15'],
            ['m mm',                               '25 25'],
            ['s ss',                               '50 50'],
            ['a A',                                'pm PM'],
            ['t\\he DDDo \\d\\ay of t\\he ye\\ar', 'the 45ème day of the year'],
            ['L',                                  '14/02/2010'],
            ['LL',                                 '14 février 2010'],
            ['LLL',                                '14 février 2010 15:25'],
            ['LLLL',                               'dimanche 14 février 2010 15:25']
        ],
        b = moment(new Date(2010, 1, 14, 15, 25, 50, 125)),
        i;
    for (i = 0; i < a.length; i++) {
        equal(b.format(a[i][0]), a[i][1], a[i][0] + ' ---> ' + a[i][1]);
    }
});

test("format ordinal", 31, function() {
    moment.lang('fr');
    equal(moment([2011, 0, 1]).format('DDDo'), '1er', '1er');
    equal(moment([2011, 0, 2]).format('DDDo'), '2ème', '2ème');
    equal(moment([2011, 0, 3]).format('DDDo'), '3ème', '3ème');
    equal(moment([2011, 0, 4]).format('DDDo'), '4ème', '4ème');
    equal(moment([2011, 0, 5]).format('DDDo'), '5ème', '5ème');
    equal(moment([2011, 0, 6]).format('DDDo'), '6ème', '6ème');
    equal(moment([2011, 0, 7]).format('DDDo'), '7ème', '7ème');
    equal(moment([2011, 0, 8]).format('DDDo'), '8ème', '8ème');
    equal(moment([2011, 0, 9]).format('DDDo'), '9ème', '9ème');
    equal(moment([2011, 0, 10]).format('DDDo'), '10ème', '10ème');

    equal(moment([2011, 0, 11]).format('DDDo'), '11ème', '11ème');
    equal(moment([2011, 0, 12]).format('DDDo'), '12ème', '12ème');
    equal(moment([2011, 0, 13]).format('DDDo'), '13ème', '13ème');
    equal(moment([2011, 0, 14]).format('DDDo'), '14ème', '14ème');
    equal(moment([2011, 0, 15]).format('DDDo'), '15ème', '15ème');
    equal(moment([2011, 0, 16]).format('DDDo'), '16ème', '16ème');
    equal(moment([2011, 0, 17]).format('DDDo'), '17ème', '17ème');
    equal(moment([2011, 0, 18]).format('DDDo'), '18ème', '18ème');
    equal(moment([2011, 0, 19]).format('DDDo'), '19ème', '19ème');
    equal(moment([2011, 0, 20]).format('DDDo'), '20ème', '20ème');

    equal(moment([2011, 0, 21]).format('DDDo'), '21ème', '21ème');
    equal(moment([2011, 0, 22]).format('DDDo'), '22ème', '22ème');
    equal(moment([2011, 0, 23]).format('DDDo'), '23ème', '23ème');
    equal(moment([2011, 0, 24]).format('DDDo'), '24ème', '24ème');
    equal(moment([2011, 0, 25]).format('DDDo'), '25ème', '25ème');
    equal(moment([2011, 0, 26]).format('DDDo'), '26ème', '26ème');
    equal(moment([2011, 0, 27]).format('DDDo'), '27ème', '27ème');
    equal(moment([2011, 0, 28]).format('DDDo'), '28ème', '28ème');
    equal(moment([2011, 0, 29]).format('DDDo'), '29ème', '29ème');
    equal(moment([2011, 0, 30]).format('DDDo'), '30ème', '30ème');

    equal(moment([2011, 0, 31]).format('DDDo'), '31ème', '31ème');
});

test("format month", 12, function() {
    moment.lang('fr');
    var expected = 'janvier janv._février févr._mars mars_avril avr._mai mai_juin juin_juillet juil._août août_septembre sept._octobre oct._novembre nov._décembre déc.'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, i, 0]).format('MMMM MMM'), expected[i], expected[i]);
    }
});

test("format week", 7, function() {
    moment.lang('fr');
    var expected = 'dimanche dim._lundi lun._mardi mar._mercredi mer._jeudi jeu._vendredi ven._samedi sam.'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, 0, 2 + i]).format('dddd ddd'), expected[i], expected[i]);
    }
});

test("from", 30, function() {
    moment.lang('fr');
    var start = moment([2007, 1, 28]);
    equal(start.from(moment([2007, 1, 28]).add({s:44}), true),  "quelques secondes", "44 seconds = a few seconds");
    equal(start.from(moment([2007, 1, 28]).add({s:45}), true),  "une minute",   "45 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:89}), true),  "une minute",   "89 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:90}), true),  "2 minutes",  "90 seconds = 2 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:44}), true),  "44 minutes", "44 minutes = 44 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:45}), true),  "une heure",    "45 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:89}), true),  "une heure",    "89 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:90}), true),  "2 heures",    "90 minutes = 2 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:5}), true),   "5 heures",    "5 hours = 5 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:21}), true),  "21 heures",   "21 hours = 21 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:22}), true),  "un jour",      "22 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:35}), true),  "un jour",      "35 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:36}), true),  "2 jours",     "36 hours = 2 days");
    equal(start.from(moment([2007, 1, 28]).add({d:1}), true),   "un jour",      "1 day = a day");
    equal(start.from(moment([2007, 1, 28]).add({d:5}), true),   "5 jours",     "5 days = 5 days");
    equal(start.from(moment([2007, 1, 28]).add({d:25}), true),  "25 jours",    "25 days = 25 days");
    equal(start.from(moment([2007, 1, 28]).add({d:26}), true),  "un mois",    "26 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:30}), true),  "un mois",    "30 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:45}), true),  "un mois",    "45 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:46}), true),  "2 mois",   "46 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:74}), true),  "2 mois",   "75 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:76}), true),  "3 mois",   "76 days = 3 months");
    equal(start.from(moment([2007, 1, 28]).add({M:1}), true),   "un mois",    "1 month = a month");
    equal(start.from(moment([2007, 1, 28]).add({M:5}), true),   "5 mois",   "5 months = 5 months");
    equal(start.from(moment([2007, 1, 28]).add({d:344}), true), "11 mois",  "344 days = 11 months");
    equal(start.from(moment([2007, 1, 28]).add({d:345}), true), "une année",     "345 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:547}), true), "une année",     "547 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:548}), true), "2 années",    "548 days = 2 years");
    equal(start.from(moment([2007, 1, 28]).add({y:1}), true),   "une année",     "1 year = a year");
    equal(start.from(moment([2007, 1, 28]).add({y:5}), true),   "5 années",    "5 years = 5 years");
});

test("suffix", 2, function() {
    moment.lang('fr');
    equal(moment(30000).from(0), "dans quelques secondes", "prefix");
    equal(moment(0).from(30000), "il y a quelques secondes", "suffix");
});

test("fromNow", 2, function() {
    moment.lang('fr');
    equal(moment().add({s:30}).fromNow(), "dans quelques secondes", "in a few seconds");
    equal(moment().add({d:5}).fromNow(), "dans 5 jours", "in 5 days");
});


test("same day", 6, function() {
    moment.lang('fr');

    var a = moment().hours(2).minutes(0).seconds(0);

    equal(moment(a).calendar(),                     "Ajourd'hui à 02:00",     "today at the same time");
    equal(moment(a).add({ m: 25 }).calendar(),      "Ajourd'hui à 02:25",     "Now plus 25 min");
    equal(moment(a).add({ h: 1 }).calendar(),       "Ajourd'hui à 03:00",     "Now plus 1 hour");
    equal(moment(a).add({ d: 1 }).calendar(),       "Demain à 02:00",         "tomorrow at the same time");
    equal(moment(a).subtract({ h: 1 }).calendar(),  "Ajourd'hui à 01:00",     "Now minus 1 hour");
    equal(moment(a).subtract({ d: 1 }).calendar(),  "Hier à 02:00",           "yesterday at the same time");
});

test("same next week", 15, function() {
    moment.lang('fr');

    var i;
    var m;

    for (i = 2; i < 7; i++) {
        m = moment().add({ d: i });
        equal(m.calendar(),       m.format('dddd [à] LT'),  "Today + " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('dddd [à] LT'),  "Today + " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('dddd [à] LT'),  "Today + " + i + " days end of day");
    }
});

test("same last week", 15, function() {
    moment.lang('fr');

    for (i = 2; i < 7; i++) {
        m = moment().subtract({ d: i });
        equal(m.calendar(),       m.format('dddd [dernier à] LT'),  "Today - " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('dddd [dernier à] LT'),  "Today - " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('dddd [dernier à] LT'),  "Today - " + i + " days end of day");
    }
});

test("same all else", 4, function() {
    moment.lang('fr');
    var weeksAgo = moment().subtract({ w: 1 });
    var weeksFromNow = moment().add({ w: 1 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "1 week ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 1 week");

    weeksAgo = moment().subtract({ w: 2 });
    weeksFromNow = moment().add({ w: 2 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "2 weeks ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 2 weeks");
});

/**************************************************
  Galego
 *************************************************/

module("lang:gl");

test("parse", 96, function() {
    moment.lang('gl');
    var tests = "Xaneiro Xan._Febreiro Feb._Marzo Mar._Abril Abr._Maio Mai._Xuño Xuñ._Xullo Xul._Agosto Ago._Setembro Set._Octubro Out._Novembro Nov._Decembro Dec.".split("_");

    var i;
    function equalTest(input, mmm, i) {
        equal(moment(input, mmm).month(), i, input + ' should be month ' + (i + 1));
    }
    for (i = 0; i < 12; i++) {
        tests[i] = tests[i].split(' ');
        equalTest(tests[i][0], 'MMM', i);
        equalTest(tests[i][1], 'MMM', i);
        equalTest(tests[i][0], 'MMMM', i);
        equalTest(tests[i][1], 'MMMM', i);
        equalTest(tests[i][0].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][0].toLocaleUpperCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleUpperCase(), 'MMMM', i);
    }
});

test("format ordinal", 31, function() {
    moment.lang('es');
    equal(moment([2011, 0, 1]).format('DDDo'), '1º', '1º');
    equal(moment([2011, 0, 2]).format('DDDo'), '2º', '2º');
    equal(moment([2011, 0, 3]).format('DDDo'), '3º', '3º');
    equal(moment([2011, 0, 4]).format('DDDo'), '4º', '4º');
    equal(moment([2011, 0, 5]).format('DDDo'), '5º', '5º');
    equal(moment([2011, 0, 6]).format('DDDo'), '6º', '6º');
    equal(moment([2011, 0, 7]).format('DDDo'), '7º', '7º');
    equal(moment([2011, 0, 8]).format('DDDo'), '8º', '8º');
    equal(moment([2011, 0, 9]).format('DDDo'), '9º', '9º');
    equal(moment([2011, 0, 10]).format('DDDo'), '10º', '10º');

    equal(moment([2011, 0, 11]).format('DDDo'), '11º', '11º');
    equal(moment([2011, 0, 12]).format('DDDo'), '12º', '12º');
    equal(moment([2011, 0, 13]).format('DDDo'), '13º', '13º');
    equal(moment([2011, 0, 14]).format('DDDo'), '14º', '14º');
    equal(moment([2011, 0, 15]).format('DDDo'), '15º', '15º');
    equal(moment([2011, 0, 16]).format('DDDo'), '16º', '16º');
    equal(moment([2011, 0, 17]).format('DDDo'), '17º', '17º');
    equal(moment([2011, 0, 18]).format('DDDo'), '18º', '18º');
    equal(moment([2011, 0, 19]).format('DDDo'), '19º', '19º');
    equal(moment([2011, 0, 20]).format('DDDo'), '20º', '20º');

    equal(moment([2011, 0, 21]).format('DDDo'), '21º', '21º');
    equal(moment([2011, 0, 22]).format('DDDo'), '22º', '22º');
    equal(moment([2011, 0, 23]).format('DDDo'), '23º', '23º');
    equal(moment([2011, 0, 24]).format('DDDo'), '24º', '24º');
    equal(moment([2011, 0, 25]).format('DDDo'), '25º', '25º');
    equal(moment([2011, 0, 26]).format('DDDo'), '26º', '26º');
    equal(moment([2011, 0, 27]).format('DDDo'), '27º', '27º');
    equal(moment([2011, 0, 28]).format('DDDo'), '28º', '28º');
    equal(moment([2011, 0, 29]).format('DDDo'), '29º', '29º');
    equal(moment([2011, 0, 30]).format('DDDo'), '30º', '30º');

    equal(moment([2011, 0, 31]).format('DDDo'), '31º', '31º');
});

test("format month", 12, function() {
    moment.lang('gl');
    var expected = "Xaneiro Xan._Febreiro Feb._Marzo Mar._Abril Abr._Maio Mai._Xuño Xuñ._Xullo Xul._Agosto Ago._Setembro Set._Octubro Out._Novembro Nov._Decembro Dec.".split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, i, 0]).format('MMMM MMM'), expected[i], expected[i]);
    }
});

test("format week", 7, function() {
    moment.lang('gl');
    var expected = "Domingo Dom._Luns Lun._Martes Mar._Mércores Mér._Xoves Xov._Venres Ven._Sábado Sáb.".split("_");

    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, 0, 2 + i]).format('dddd ddd'), expected[i], expected[i]);
    }
});

test("from", 30, function() {
    moment.lang('gl');
    var start = moment([2007, 1, 28]);

    equal(start.from(moment([2007, 1, 28]).add({s:44}), true),  "uns segundo", "44 seconds = a few seconds");
    equal(start.from(moment([2007, 1, 28]).add({s:45}), true),  "un minuto",      "45 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:89}), true),  "un minuto",      "89 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:90}), true),  "2 minutos",     "90 seconds = 2 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:44}), true),  "44 minutos",    "44 minutes = 44 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:45}), true),  "unha hora",       "45 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:89}), true),  "unha hora",       "89 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:90}), true),  "2 horas",       "90 minutes = 2 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:5}), true),   "5 horas",       "5 hours = 5 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:21}), true),  "21 horas",      "21 hours = 21 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:22}), true),  "un día",         "22 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:35}), true),  "un día",         "35 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:36}), true),  "2 días",        "36 hours = 2 days");
    equal(start.from(moment([2007, 1, 28]).add({d:1}), true),   "un día",         "1 day = a day");
    equal(start.from(moment([2007, 1, 28]).add({d:5}), true),   "5 días",        "5 days = 5 days");
    equal(start.from(moment([2007, 1, 28]).add({d:25}), true),  "25 días",       "25 days = 25 days");
    equal(start.from(moment([2007, 1, 28]).add({d:26}), true),  "un mes",       "26 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:30}), true),  "un mes",       "30 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:45}), true),  "un mes",       "45 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:46}), true),  "2 meses",      "46 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:74}), true),  "2 meses",      "75 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:76}), true),  "3 meses",      "76 days = 3 months");
    equal(start.from(moment([2007, 1, 28]).add({M:1}), true),   "un mes",       "1 month = a month");
    equal(start.from(moment([2007, 1, 28]).add({M:5}), true),   "5 meses",      "5 months = 5 months");
    equal(start.from(moment([2007, 1, 28]).add({d:344}), true), "11 meses",     "344 days = 11 months");
    equal(start.from(moment([2007, 1, 28]).add({d:345}), true), "un ano",        "345 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:547}), true), "un ano",        "547 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:548}), true), "2 anos",       "548 days = 2 years");
    equal(start.from(moment([2007, 1, 28]).add({y:1}), true),   "un ano",        "1 year = a year");
    equal(start.from(moment([2007, 1, 28]).add({y:5}), true),   "5 anos",       "5 years = 5 years");
});

test("suffix", 2, function() {
    moment.lang('gl');
    equal(moment(30000).from(0), "en uns segundo",  "prefix");
    equal(moment(0).from(30000), "fai uns segundo", "suffix");
});


test("now from now", 1, function() {
    moment.lang('gl');
    equal(moment().fromNow(), "fai uns segundo",  "now from now should display as in the past");
});


test("fromNow", 2, function() {
    moment.lang('gl');
    equal(moment().add({s:30}).fromNow(), "en uns segundo", "en unos segundos");
    equal(moment().add({d:5}).fromNow(), "en 5 días", "en 5 días");
});


test("calendar day", 7, function() {
    moment.lang('gl');

    var a = moment().hours(2).minutes(0).seconds(0);

    equal(moment(a).calendar(),                         "hoxe ás 2:00",     "today at the same time");
    equal(moment(a).add({ m: 25 }).calendar(),          "hoxe ás 2:25",     "Now plus 25 min");
    equal(moment(a).add({ h: 1 }).calendar(),           "hoxe ás 3:00",     "Now plus 1 hour");
    equal(moment(a).add({ d: 1 }).calendar(),           "mañá ás 2:00",  "tomorrow at the same time");
    equal(moment(a).add({ d: 1, h : -1 }).calendar(),   "mañá a 1:00",   "tomorrow minus 1 hour");
    equal(moment(a).subtract({ h: 1 }).calendar(),      "hoxe a 1:00",      "Now minus 1 hour");
    equal(moment(a).subtract({ d: 1 }).calendar(),      "onte á 2:00",    "yesterday at the same time");
});

test("calendar next week", 15, function() {
    moment.lang('gl');

    var i;
    var m;

    for (i = 2; i < 7; i++) {
        m = moment().add({ d: i });
        equal(m.calendar(),       m.format('dddd [' + ((m.hours() !== 1) ? 'ás' : 'a') + '] LT'),  "Today + " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('dddd [' + ((m.hours() !== 1) ? 'ás' : 'a') + '] LT'),  "Today + " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('dddd [' + ((m.hours() !== 1) ? 'ás' : 'a') + '] LT'),  "Today + " + i + " days end of day");
    }
});

test("calendar last week", 15, function() {
    moment.lang('gl');

    for (i = 2; i < 7; i++) {
        m = moment().subtract({ d: i });
        equal(m.calendar(),       m.format('[o] dddd [pasado ' + ((m.hours() !== 1) ? 'ás' : 'a') + '] LT'),  "Today - " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('[o] dddd [pasado ' + ((m.hours() !== 1) ? 'ás' : 'a') + '] LT'),  "Today - " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('[o] dddd [pasado ' + ((m.hours() !== 1) ? 'ás' : 'a') + '] LT'),  "Today - " + i + " days end of day");
    }
});

test("calendar all else", 4, function() {
    moment.lang('gl');
    var weeksAgo = moment().subtract({ w: 1 });
    var weeksFromNow = moment().add({ w: 1 });

    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "1 week ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 1 week");

    weeksAgo = moment().subtract({ w: 2 });
    weeksFromNow = moment().add({ w: 2 });

    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "2 weeks ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 2 weeks");
});

/**************************************************
  Italian
 *************************************************/

module("lang:it");

test("parse", 96, function() {
    moment.lang('it');
    var tests = 'Gennaio Gen_Febbraio Feb_Marzo Mar_Aprile Apr_Maggio Mag_Giugno Giu_Luglio Lug_Agosto Ago_Settebre Set_Ottobre Ott_Novembre Nov_Dicembre Dic'.split("_");
    var i;
    function equalTest(input, mmm, i) {
        equal(moment(input, mmm).month(), i, input + ' should be month ' + (i + 1));
    }
    for (i = 0; i < 12; i++) {
        tests[i] = tests[i].split(' ');
        equalTest(tests[i][0], 'MMM', i);
        equalTest(tests[i][1], 'MMM', i);
        equalTest(tests[i][0], 'MMMM', i);
        equalTest(tests[i][1], 'MMMM', i);
        equalTest(tests[i][0].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][0].toLocaleUpperCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleUpperCase(), 'MMMM', i);
    }
});

test("format", 18, function() {
    moment.lang('it');
    var a = [
            ['dddd, MMMM Do YYYY, h:mm:ss a',      'Domenica, Febbraio 14º 2010, 3:25:50 pm'],
            ['ddd, hA',                            'Dom, 3PM'],
            ['M Mo MM MMMM MMM',                   '2 2º 02 Febbraio Feb'],
            ['YYYY YY',                            '2010 10'],
            ['D Do DD',                            '14 14º 14'],
            ['d do dddd ddd',                      '0 0º Domenica Dom'],
            ['DDD DDDo DDDD',                      '45 45º 045'],
            ['w wo ww',                            '8 8º 08'],
            ['h hh',                               '3 03'],
            ['H HH',                               '15 15'],
            ['m mm',                               '25 25'],
            ['s ss',                               '50 50'],
            ['a A',                                'pm PM'],
            ['t\\he DDDo \\d\\ay of t\\he ye\\ar', 'the 45º day of the year'],
            ['L',                                  '14/02/2010'],
            ['LL',                                 '14 Febbraio 2010'],
            ['LLL',                                '14 Febbraio 2010 15:25'],
            ['LLLL',                               'Domenica, 14 Febbraio 2010 15:25']
        ],
        b = moment(new Date(2010, 1, 14, 15, 25, 50, 125)),
        i;
    for (i = 0; i < a.length; i++) {
        equal(b.format(a[i][0]), a[i][1], a[i][0] + ' ---> ' + a[i][1]);
    }
});

test("format ordinal", 31, function() {
    moment.lang('it');
    equal(moment([2011, 0, 1]).format('DDDo'), '1º', '1º');
    equal(moment([2011, 0, 2]).format('DDDo'), '2º', '2º');
    equal(moment([2011, 0, 3]).format('DDDo'), '3º', '3º');
    equal(moment([2011, 0, 4]).format('DDDo'), '4º', '4º');
    equal(moment([2011, 0, 5]).format('DDDo'), '5º', '5º');
    equal(moment([2011, 0, 6]).format('DDDo'), '6º', '6º');
    equal(moment([2011, 0, 7]).format('DDDo'), '7º', '7º');
    equal(moment([2011, 0, 8]).format('DDDo'), '8º', '8º');
    equal(moment([2011, 0, 9]).format('DDDo'), '9º', '9º');
    equal(moment([2011, 0, 10]).format('DDDo'), '10º', '10º');

    equal(moment([2011, 0, 11]).format('DDDo'), '11º', '11º');
    equal(moment([2011, 0, 12]).format('DDDo'), '12º', '12º');
    equal(moment([2011, 0, 13]).format('DDDo'), '13º', '13º');
    equal(moment([2011, 0, 14]).format('DDDo'), '14º', '14º');
    equal(moment([2011, 0, 15]).format('DDDo'), '15º', '15º');
    equal(moment([2011, 0, 16]).format('DDDo'), '16º', '16º');
    equal(moment([2011, 0, 17]).format('DDDo'), '17º', '17º');
    equal(moment([2011, 0, 18]).format('DDDo'), '18º', '18º');
    equal(moment([2011, 0, 19]).format('DDDo'), '19º', '19º');
    equal(moment([2011, 0, 20]).format('DDDo'), '20º', '20º');

    equal(moment([2011, 0, 21]).format('DDDo'), '21º', '21º');
    equal(moment([2011, 0, 22]).format('DDDo'), '22º', '22º');
    equal(moment([2011, 0, 23]).format('DDDo'), '23º', '23º');
    equal(moment([2011, 0, 24]).format('DDDo'), '24º', '24º');
    equal(moment([2011, 0, 25]).format('DDDo'), '25º', '25º');
    equal(moment([2011, 0, 26]).format('DDDo'), '26º', '26º');
    equal(moment([2011, 0, 27]).format('DDDo'), '27º', '27º');
    equal(moment([2011, 0, 28]).format('DDDo'), '28º', '28º');
    equal(moment([2011, 0, 29]).format('DDDo'), '29º', '29º');
    equal(moment([2011, 0, 30]).format('DDDo'), '30º', '30º');

    equal(moment([2011, 0, 31]).format('DDDo'), '31º', '31º');
});

test("format month", 12, function() {
    moment.lang('it');
    var expected = 'Gennaio Gen_Febbraio Feb_Marzo Mar_Aprile Apr_Maggio Mag_Giugno Giu_Luglio Lug_Agosto Ago_Settebre Set_Ottobre Ott_Novembre Nov_Dicembre Dic'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, i, 0]).format('MMMM MMM'), expected[i], expected[i]);
    }
});

test("format week", 7, function() {
    moment.lang('it');
    var expected = 'Domenica Dom_Lunedi Lun_Martedi Mar_Mercoledi Mer_Giovedi Gio_Venerdi Ven_Sabato Sab'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, 0, 2 + i]).format('dddd ddd'), expected[i], expected[i]);
    }
});

test("from", 30, function() {
    moment.lang('it');
    var start = moment([2007, 1, 28]);
    equal(start.from(moment([2007, 1, 28]).add({s:44}), true),  "secondi",    "44 seconds = seconds");
    equal(start.from(moment([2007, 1, 28]).add({s:45}), true),  "un minuto",   "45 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:89}), true),  "un minuto",   "89 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:90}), true),  "2 minuti",  "90 seconds = 2 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:44}), true),  "44 minuti", "44 minutes = 44 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:45}), true),  "un ora",    "45 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:89}), true),  "un ora",    "89 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:90}), true),  "2 ore",    "90 minutes = 2 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:5}), true),   "5 ore",    "5 hours = 5 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:21}), true),  "21 ore",   "21 hours = 21 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:22}), true),  "un giorno",      "22 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:35}), true),  "un giorno",      "35 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:36}), true),  "2 giorni",     "36 hours = 2 days");
    equal(start.from(moment([2007, 1, 28]).add({d:1}), true),   "un giorno",      "1 day = a day");
    equal(start.from(moment([2007, 1, 28]).add({d:5}), true),   "5 giorni",     "5 days = 5 days");
    equal(start.from(moment([2007, 1, 28]).add({d:25}), true),  "25 giorni",    "25 days = 25 days");
    equal(start.from(moment([2007, 1, 28]).add({d:26}), true),  "un mese",    "26 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:30}), true),  "un mese",    "30 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:45}), true),  "un mese",    "45 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:46}), true),  "2 mesi",   "46 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:74}), true),  "2 mesi",   "75 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:76}), true),  "3 mesi",   "76 days = 3 months");
    equal(start.from(moment([2007, 1, 28]).add({M:1}), true),   "un mese",    "1 month = a month");
    equal(start.from(moment([2007, 1, 28]).add({M:5}), true),   "5 mesi",   "5 months = 5 months");
    equal(start.from(moment([2007, 1, 28]).add({d:344}), true), "11 mesi",  "344 days = 11 months");
    equal(start.from(moment([2007, 1, 28]).add({d:345}), true), "un anno",     "345 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:547}), true), "un anno",     "547 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:548}), true), "2 anni",    "548 days = 2 years");
    equal(start.from(moment([2007, 1, 28]).add({y:1}), true),   "un anno",     "1 year = a year");
    equal(start.from(moment([2007, 1, 28]).add({y:5}), true),   "5 anni",    "5 years = 5 years");
});

test("suffix", 2, function() {
    moment.lang('it');
    equal(moment(30000).from(0), "in secondi", "prefix");
    equal(moment(0).from(30000), "secondi fa", "suffix");
});

test("fromNow", 2, function() {
    moment.lang('it');
    equal(moment().add({s:30}).fromNow(), "in secondi", "in seconds");
    equal(moment().add({d:5}).fromNow(), "in 5 giorni", "in 5 days");
});


test("calendar day", 6, function() {
    moment.lang('it');

    var a = moment().hours(2).minutes(0).seconds(0);

    equal(moment(a).calendar(),                     "Oggi alle 02:00",     "today at the same time");
    equal(moment(a).add({ m: 25 }).calendar(),      "Oggi alle 02:25",     "Now plus 25 min");
    equal(moment(a).add({ h: 1 }).calendar(),       "Oggi alle 03:00",     "Now plus 1 hour");
    equal(moment(a).add({ d: 1 }).calendar(),       "Domani alle 02:00",   "tomorrow at the same time");
    equal(moment(a).subtract({ h: 1 }).calendar(),  "Oggi alle 01:00",     "Now minus 1 hour");
    equal(moment(a).subtract({ d: 1 }).calendar(),  "Ieri alle 02:00",     "yesterday at the same time");
});

test("calendar next week", 15, function() {
    moment.lang('it');

    var i;
    var m;

    for (i = 2; i < 7; i++) {
        m = moment().add({ d: i });
        equal(m.calendar(),       m.format('dddd [alle] LT'),  "Today + " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('dddd [alle] LT'),  "Today + " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('dddd [alle] LT'),  "Today + " + i + " days end of day");
    }
});

test("calendar last week", 15, function() {
    moment.lang('it');

    for (i = 2; i < 7; i++) {
        m = moment().subtract({ d: i });
        equal(m.calendar(),       m.format('[lo scorso] dddd [alle] LT'),  "Today - " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('[lo scorso] dddd [alle] LT'),  "Today - " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('[lo scorso] dddd [alle] LT'),  "Today - " + i + " days end of day");
    }
});

test("calendar all else", 4, function() {
    moment.lang('it');
    var weeksAgo = moment().subtract({ w: 1 });
    var weeksFromNow = moment().add({ w: 1 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "1 week ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 1 week");

    weeksAgo = moment().subtract({ w: 2 });
    weeksFromNow = moment().add({ w: 2 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "2 weeks ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 2 weeks");
});


/**************************************************
  Korean
 *************************************************/

module("lang:kr");

test("format", 18, function() {
    moment.lang('kr');
    var a = [
            ['YYYY년 MMMM Do dddd a h:mm:ss',      '2010년 2월 14일 일요일 오후 3:25:50'],
            ['ddd A h',                            '일 오후 3'],
            ['M Mo MM MMMM MMM',                   '2 2일 02 2월 2월'],
            ['YYYY YY',                            '2010 10'],
            ['D Do DD',                            '14 14일 14'],
            ['d do dddd ddd',                      '0 0일 일요일 일'],
            ['DDD DDDo DDDD',                      '45 45일 045'],
            ['w wo ww',                            '8 8일 08'],
            ['h hh',                               '3 03'],
            ['H HH',                               '15 15'],
            ['m mm',                               '25 25'],
            ['s ss',                               '50 50'],
            ['a A',                                '오후 오후'],
            ['일년 중 DDDo째 되는 날', '일년 중 45일째 되는 날'],
            ['L',                                  '2010.02.14'],
            ['LL',                                 '2010년 2월 14일'],
            ['LLL',                                '2010년 2월 14일 오후 3시 25분'],
            ['LLLL',                               '2010년 2월 14일 일요일 오후 3시 25분']
        ],
        b = moment(new Date(2010, 1, 14, 15, 25, 50, 125)),
        i;
    for (i = 0; i < a.length; i++) {
        equal(b.format(a[i][0]), a[i][1], a[i][0] + ' ---> ' + a[i][1]);
    }
});

test("format ordinal", 31, function() {
    moment.lang('kr');
    equal(moment([2011, 0, 1]).format('DDDo'), '1일', '1일');
    equal(moment([2011, 0, 2]).format('DDDo'), '2일', '2일');
    equal(moment([2011, 0, 3]).format('DDDo'), '3일', '3일');
    equal(moment([2011, 0, 4]).format('DDDo'), '4일', '4일');
    equal(moment([2011, 0, 5]).format('DDDo'), '5일', '5일');
    equal(moment([2011, 0, 6]).format('DDDo'), '6일', '6일');
    equal(moment([2011, 0, 7]).format('DDDo'), '7일', '7일');
    equal(moment([2011, 0, 8]).format('DDDo'), '8일', '8일');
    equal(moment([2011, 0, 9]).format('DDDo'), '9일', '9일');
    equal(moment([2011, 0, 10]).format('DDDo'), '10일', '10일');

    equal(moment([2011, 0, 11]).format('DDDo'), '11일', '11일');
    equal(moment([2011, 0, 12]).format('DDDo'), '12일', '12일');
    equal(moment([2011, 0, 13]).format('DDDo'), '13일', '13일');
    equal(moment([2011, 0, 14]).format('DDDo'), '14일', '14일');
    equal(moment([2011, 0, 15]).format('DDDo'), '15일', '15일');
    equal(moment([2011, 0, 16]).format('DDDo'), '16일', '16일');
    equal(moment([2011, 0, 17]).format('DDDo'), '17일', '17일');
    equal(moment([2011, 0, 18]).format('DDDo'), '18일', '18일');
    equal(moment([2011, 0, 19]).format('DDDo'), '19일', '19일');
    equal(moment([2011, 0, 20]).format('DDDo'), '20일', '20일');

    equal(moment([2011, 0, 21]).format('DDDo'), '21일', '21일');
    equal(moment([2011, 0, 22]).format('DDDo'), '22일', '22일');
    equal(moment([2011, 0, 23]).format('DDDo'), '23일', '23일');
    equal(moment([2011, 0, 24]).format('DDDo'), '24일', '24일');
    equal(moment([2011, 0, 25]).format('DDDo'), '25일', '25일');
    equal(moment([2011, 0, 26]).format('DDDo'), '26일', '26일');
    equal(moment([2011, 0, 27]).format('DDDo'), '27일', '27일');
    equal(moment([2011, 0, 28]).format('DDDo'), '28일', '28일');
    equal(moment([2011, 0, 29]).format('DDDo'), '29일', '29일');
    equal(moment([2011, 0, 30]).format('DDDo'), '30일', '30일');

    equal(moment([2011, 0, 31]).format('DDDo'), '31일', '31일');
});

test("format month", 12, function() {
    moment.lang('kr');
    var expected = '1월 1월_2월 2월_3월 3월_4월 4월_5월 5월_6월 6월_7월 7월_8월 8월_9월 9월_10월 10월_11월 11월_12월 12월'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, i, 0]).format('MMMM MMM'), expected[i], expected[i]);
    }
});

test("format week", 7, function() {
    moment.lang('kr');
    var expected = '일요일 일_월요일 월_화요일 화_수요일 수_목요일 목_금요일 금_토요일 토'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, 0, 2 + i]).format('dddd ddd'), expected[i], expected[i]);
    }
});

test("from", 30, function() {
    moment.lang('kr');
    var start = moment([2007, 1, 28]);
    equal(start.from(moment([2007, 1, 28]).add({s:44}), true),  "몇초", "44초 = 몇초");
    equal(start.from(moment([2007, 1, 28]).add({s:45}), true),  "일분",      "45초 = 일분");
    equal(start.from(moment([2007, 1, 28]).add({s:89}), true),  "일분",      "89초 = 일분");
    equal(start.from(moment([2007, 1, 28]).add({s:90}), true),  "2분",     "90초 = 2분");
    equal(start.from(moment([2007, 1, 28]).add({m:44}), true),  "44분",    "44분 = 44분");
    equal(start.from(moment([2007, 1, 28]).add({m:45}), true),  "한시간",       "45분 = 한시간");
    equal(start.from(moment([2007, 1, 28]).add({m:89}), true),  "한시간",       "89분 = 한시간");
    equal(start.from(moment([2007, 1, 28]).add({m:90}), true),  "2시간",       "90분 = 2시간");
    equal(start.from(moment([2007, 1, 28]).add({h:5}), true),   "5시간",       "5시간 = 5시간");
    equal(start.from(moment([2007, 1, 28]).add({h:21}), true),  "21시간",      "21시간 = 21시간");
    equal(start.from(moment([2007, 1, 28]).add({h:22}), true),  "하루",         "22시간 = 하루");
    equal(start.from(moment([2007, 1, 28]).add({h:35}), true),  "하루",         "35시간 = 하루");
    equal(start.from(moment([2007, 1, 28]).add({h:36}), true),  "2일",        "36시간 = 2일");
    equal(start.from(moment([2007, 1, 28]).add({d:1}), true),   "하루",         "하루 = 하루");
    equal(start.from(moment([2007, 1, 28]).add({d:5}), true),   "5일",        "5일 = 5일");
    equal(start.from(moment([2007, 1, 28]).add({d:25}), true),  "25일",       "25일 = 25일");
    equal(start.from(moment([2007, 1, 28]).add({d:26}), true),  "한달",       "26일 = 한달");
    equal(start.from(moment([2007, 1, 28]).add({d:30}), true),  "한달",       "30일 = 한달");
    equal(start.from(moment([2007, 1, 28]).add({d:45}), true),  "한달",       "45일 = 한달");
    equal(start.from(moment([2007, 1, 28]).add({d:46}), true),  "2달",      "46일 = 2달");
    equal(start.from(moment([2007, 1, 28]).add({d:74}), true),  "2달",      "75일 = 2달");
    equal(start.from(moment([2007, 1, 28]).add({d:76}), true),  "3달",      "76일 = 3달");
    equal(start.from(moment([2007, 1, 28]).add({M:1}), true),   "한달",       "1달 = 한달");
    equal(start.from(moment([2007, 1, 28]).add({M:5}), true),   "5달",      "5달 = 5달");
    equal(start.from(moment([2007, 1, 28]).add({d:344}), true), "11달",     "344일 = 11달");
    equal(start.from(moment([2007, 1, 28]).add({d:345}), true), "일년",        "345일 = 일년");
    equal(start.from(moment([2007, 1, 28]).add({d:547}), true), "일년",        "547일 = 일년");
    equal(start.from(moment([2007, 1, 28]).add({d:548}), true), "2년",       "548일 = 2년");
    equal(start.from(moment([2007, 1, 28]).add({y:1}), true),   "일년",        "일년 = 일년");
    equal(start.from(moment([2007, 1, 28]).add({y:5}), true),   "5년",       "5년 = 5년");
});

test("suffix", 2, function() {
    moment.lang('kr');
    equal(moment(30000).from(0), "몇초 후",  "prefix");
    equal(moment(0).from(30000), "몇초 전", "suffix");
});


test("now from now", 1, function() {
    moment.lang('kr');
    equal(moment().fromNow(), "몇초 전",  "now from now should display as in the past");
});


test("fromNow", 2, function() {
    moment.lang('kr');
    equal(moment().add({s:30}).fromNow(), "몇초 후", "in a few seconds");
    equal(moment().add({d:5}).fromNow(), "5일 후", "in 5 days");
});


test("calendar day", 6, function() {
    moment.lang('kr');

    var a = moment().hours(2).minutes(0).seconds(0);

    equal(moment(a).calendar(),                     "오늘 오전 2시 00분",     "today at the same time");
    equal(moment(a).add({ m: 25 }).calendar(),      "오늘 오전 2시 25분",     "Now plus 25 min");
    equal(moment(a).add({ h: 1 }).calendar(),       "오늘 오전 3시 00분",     "Now plus 1 hour");
    equal(moment(a).add({ d: 1 }).calendar(),       "내일 오전 2시 00분",     "tomorrow at the same time");
    equal(moment(a).subtract({ h: 1 }).calendar(),  "오늘 오전 1시 00분",     "Now minus 1 hour");
    equal(moment(a).subtract({ d: 1 }).calendar(),  "어제 오전 2시 00분",     "yesterday at the same time");
});

test("calendar next week", 15, function() {
    moment.lang('kr');

    var i;
    var m;

    for (i = 2; i < 7; i++) {
        m = moment().add({ d: i });
        equal(m.calendar(),       m.format('dddd LT'),  "Today + " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('dddd LT'),  "Today + " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('dddd LT'),  "Today + " + i + " days end of day");
    }
});

test("calendar last week", 15, function() {
    moment.lang('kr');

    for (i = 2; i < 7; i++) {
        m = moment().subtract({ d: i });
        equal(m.calendar(),       m.format('지난주 dddd LT'),  "Today - " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('지난주 dddd LT'),  "Today - " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('지난주 dddd LT'),  "Today - " + i + " days end of day");
    }
});

test("calendar all else", 4, function() {
    moment.lang('kr');
    var weeksAgo = moment().subtract({ w: 1 });
    var weeksFromNow = moment().add({ w: 1 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "1 week ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 1 week");

    weeksAgo = moment().subtract({ w: 2 });
    weeksFromNow = moment().add({ w: 2 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "2 weeks ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 2 weeks");
});


/**************************************************
  Norwegian bokmål
 *************************************************/

module("lang:nb");

test("parse", 96, function() {
    moment.lang('nb');
    var tests = 'januar jan_februar feb_mars mar_april apr_mai mai_juni jun_juli jul_august aug_september sep_oktober okt_november nov_desember des'.split("_");
    var i;
    function equalTest(input, mmm, i) {
        equal(moment(input, mmm).month(), i, input + ' should be month ' + (i + 1));
    }
    for (i = 0; i < 12; i++) {
        tests[i] = tests[i].split(' ');
        equalTest(tests[i][0], 'MMM', i);
        equalTest(tests[i][1], 'MMM', i);
        equalTest(tests[i][0], 'MMMM', i);
        equalTest(tests[i][1], 'MMMM', i);
        equalTest(tests[i][0].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][0].toLocaleUpperCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleUpperCase(), 'MMMM', i);
    }
});

test("format", 18, function() {
    moment.lang('nb');
    var a = [
            ['dddd, MMMM Do YYYY, h:mm:ss a',      'søndag, februar 14. 2010, 3:25:50 pm'],
            ['ddd, hA',                            'søn, 3PM'],
            ['M Mo MM MMMM MMM',                   '2 2. 02 februar feb'],
            ['YYYY YY',                            '2010 10'],
            ['D Do DD',                            '14 14. 14'],
            ['d do dddd ddd',                      '0 0. søndag søn'],
            ['DDD DDDo DDDD',                      '45 45. 045'],
            ['w wo ww',                            '8 8. 08'],
            ['h hh',                               '3 03'],
            ['H HH',                               '15 15'],
            ['m mm',                               '25 25'],
            ['s ss',                               '50 50'],
            ['a A',                                'pm PM'],
            ['t\\he DDDo \\d\\ay of t\\he ye\\ar', 'the 45. day of the year'],
            ['L',                                  '2010-02-14'],
            ['LL',                                 '14 februar 2010'],
            ['LLL',                                '14 februar 2010 15:25'],
            ['LLLL',                               'søndag 14 februar 2010 15:25']
        ],
        b = moment(new Date(2010, 1, 14, 15, 25, 50, 125)),
        i;
    for (i = 0; i < a.length; i++) {
        equal(b.format(a[i][0]), a[i][1], a[i][0] + ' ---> ' + a[i][1]);
    }
});

test("format ordinal", 31, function() {
    moment.lang('nb');
    equal(moment([2011, 0, 1]).format('DDDo'), '1.', '1.');
    equal(moment([2011, 0, 2]).format('DDDo'), '2.', '2.');
    equal(moment([2011, 0, 3]).format('DDDo'), '3.', '3.');
    equal(moment([2011, 0, 4]).format('DDDo'), '4.', '4.');
    equal(moment([2011, 0, 5]).format('DDDo'), '5.', '5.');
    equal(moment([2011, 0, 6]).format('DDDo'), '6.', '6.');
    equal(moment([2011, 0, 7]).format('DDDo'), '7.', '7.');
    equal(moment([2011, 0, 8]).format('DDDo'), '8.', '8.');
    equal(moment([2011, 0, 9]).format('DDDo'), '9.', '9.');
    equal(moment([2011, 0, 10]).format('DDDo'), '10.', '10.');

    equal(moment([2011, 0, 11]).format('DDDo'), '11.', '11.');
    equal(moment([2011, 0, 12]).format('DDDo'), '12.', '12.');
    equal(moment([2011, 0, 13]).format('DDDo'), '13.', '13.');
    equal(moment([2011, 0, 14]).format('DDDo'), '14.', '14.');
    equal(moment([2011, 0, 15]).format('DDDo'), '15.', '15.');
    equal(moment([2011, 0, 16]).format('DDDo'), '16.', '16.');
    equal(moment([2011, 0, 17]).format('DDDo'), '17.', '17.');
    equal(moment([2011, 0, 18]).format('DDDo'), '18.', '18.');
    equal(moment([2011, 0, 19]).format('DDDo'), '19.', '19.');
    equal(moment([2011, 0, 20]).format('DDDo'), '20.', '20.');

    equal(moment([2011, 0, 21]).format('DDDo'), '21.', '21.');
    equal(moment([2011, 0, 22]).format('DDDo'), '22.', '22.');
    equal(moment([2011, 0, 23]).format('DDDo'), '23.', '23.');
    equal(moment([2011, 0, 24]).format('DDDo'), '24.', '24.');
    equal(moment([2011, 0, 25]).format('DDDo'), '25.', '25.');
    equal(moment([2011, 0, 26]).format('DDDo'), '26.', '26.');
    equal(moment([2011, 0, 27]).format('DDDo'), '27.', '27.');
    equal(moment([2011, 0, 28]).format('DDDo'), '28.', '28.');
    equal(moment([2011, 0, 29]).format('DDDo'), '29.', '29.');
    equal(moment([2011, 0, 30]).format('DDDo'), '30.', '30.');

    equal(moment([2011, 0, 31]).format('DDDo'), '31.', '31.');
});

test("format month", 12, function() {
    moment.lang('nb');
	var expected = 'januar jan_februar feb_mars mar_april apr_mai mai_juni jun_juli jul_august aug_september sep_oktober okt_november nov_desember des'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, i, 0]).format('MMMM MMM'), expected[i], expected[i]);
    }
});

test("format week", 7, function() {
    moment.lang('nb');
    var expected = 'søndag søn_mandag man_tirsdag tir_onsdag ons_torsdag tor_fredag fre_lørdag lør'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, 0, 2 + i]).format('dddd ddd'), expected[i], expected[i]);
    }
});

test("from", 30, function() {
    moment.lang('nb');
    var start = moment([2007, 1, 28]);
    equal(start.from(moment([2007, 1, 28]).add({s:44}), true),  "noen sekunder", "44 sekunder = a few seconds");
    equal(start.from(moment([2007, 1, 28]).add({s:45}), true),  "ett minutt",      "45 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:89}), true),  "ett minutt",      "89 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:90}), true),  "2 minutter",     "90 seconds = 2 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:44}), true),  "44 minutter",    "44 minutes = 44 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:45}), true),  "en time",       "45 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:89}), true),  "en time",       "89 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:90}), true),  "2 timer",       "90 minutes = 2 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:5}), true),   "5 timer",       "5 hours = 5 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:21}), true),  "21 timer",      "21 hours = 21 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:22}), true),  "en dag",         "22 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:35}), true),  "en dag",         "35 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:36}), true),  "2 dager",        "36 hours = 2 days");
    equal(start.from(moment([2007, 1, 28]).add({d:1}), true),   "en dag",         "1 day = a day");
    equal(start.from(moment([2007, 1, 28]).add({d:5}), true),   "5 dager",        "5 days = 5 days");
    equal(start.from(moment([2007, 1, 28]).add({d:25}), true),  "25 dager",       "25 days = 25 days");
    equal(start.from(moment([2007, 1, 28]).add({d:26}), true),  "en måned",       "26 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:30}), true),  "en måned",       "30 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:45}), true),  "en måned",       "45 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:46}), true),  "2 måneder",      "46 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:74}), true),  "2 måneder",      "75 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:76}), true),  "3 måneder",      "76 days = 3 months");
    equal(start.from(moment([2007, 1, 28]).add({M:1}), true),   "en måned",       "1 month = a month");
    equal(start.from(moment([2007, 1, 28]).add({M:5}), true),   "5 måneder",      "5 months = 5 months");
    equal(start.from(moment([2007, 1, 28]).add({d:344}), true), "11 måneder",     "344 days = 11 months");
    equal(start.from(moment([2007, 1, 28]).add({d:345}), true), "ett år",        "345 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:547}), true), "ett år",        "547 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:548}), true), "2 år",       "548 days = 2 years");
    equal(start.from(moment([2007, 1, 28]).add({y:1}), true),   "ett år",        "1 year = a year");
    equal(start.from(moment([2007, 1, 28]).add({y:5}), true),   "5 år",       "5 years = 5 years");
});

test("suffix", 2, function() {
    moment.lang('nb');
    equal(moment(30000).from(0), "om noen sekunder",  "prefix");
    equal(moment(0).from(30000), "for noen sekunder siden", "suffix");
});


test("now from now", 1, function() {
    moment.lang('nb');
    equal(moment().fromNow(), "for noen sekunder siden",  "now from now should display as in the past");
});


test("fromNow", 2, function() {
    moment.lang('nb');
    equal(moment().add({s:30}).fromNow(), "om noen sekunder", "in a few seconds");
    equal(moment().add({d:5}).fromNow(), "om 5 dager", "in 5 days");
});



test("calendar day", 6, function() {
    moment.lang('nb');

    var a = moment().hours(2).minutes(0).seconds(0);

    equal(moment(a).calendar(),                     "I dag klokken 02:00",     "today at the same time");
    equal(moment(a).add({ m: 25 }).calendar(),      "I dag klokken 02:25",     "Now plus 25 min");
    equal(moment(a).add({ h: 1 }).calendar(),       "I dag klokken 03:00",     "Now plus 1 hour");
    equal(moment(a).add({ d: 1 }).calendar(),       "I morgen klokken 02:00",  "tomorrow at the same time");
    equal(moment(a).subtract({ h: 1 }).calendar(),  "I dag klokken 01:00",     "Now minus 1 hour");
    equal(moment(a).subtract({ d: 1 }).calendar(),  "I går klokken 02:00",     "yesterday at the same time");
});

test("calendar next week", 15, function() {
    moment.lang('nb');

    var i;
    var m;

    for (i = 2; i < 7; i++) {
        m = moment().add({ d: i });
        equal(m.calendar(),       m.format('dddd [klokken] LT'),  "Today + " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('dddd [klokken] LT'),  "Today + " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('dddd [klokken] LT'),  "Today + " + i + " days end of day");
    }
});

test("calendar last week", 15, function() {
    moment.lang('nb');

    for (i = 2; i < 7; i++) {
        m = moment().subtract({ d: i });
        equal(m.calendar(),       m.format('[Forrige] dddd [klokken] LT'),  "Today - " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('[Forrige] dddd [klokken] LT'),  "Today - " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('[Forrige] dddd [klokken] LT'),  "Today - " + i + " days end of day");
    }
});

test("calendar all else", 4, function() {
    moment.lang('nb');
    var weeksAgo = moment().subtract({ w: 1 });
    var weeksFromNow = moment().add({ w: 1 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "1 week ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 1 week");

    weeksAgo = moment().subtract({ w: 2 });
    weeksFromNow = moment().add({ w: 2 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "2 weeks ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 2 weeks");
});

/**************************************************
  Dutch
 *************************************************/

module("lang:nl");

test("parse", 96, function() {
    moment.lang('nl');
    var tests = 'januari jan._februari feb._maart mar._april apr._mei mei._juni jun._juli jul._augustus aug._september sep._oktober okt._november nov._december dec.'.split("_");
    var i;
    function equalTest(input, mmm, i) {
        equal(moment(input, mmm).month(), i, input + ' should be month ' + (i + 1));
    }
    for (i = 0; i < 12; i++) {
        tests[i] = tests[i].split(' ');
        equalTest(tests[i][0], 'MMM', i);
        equalTest(tests[i][1], 'MMM', i);
        equalTest(tests[i][0], 'MMMM', i);
        equalTest(tests[i][1], 'MMMM', i);
        equalTest(tests[i][0].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][0].toLocaleUpperCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleUpperCase(), 'MMMM', i);
    }
});

test("format", 18, function() {
    moment.lang('nl');
    var a = [
            ['dddd, MMMM Do YYYY, HH:mm:ss',       'zondag, februari 14de 2010, 15:25:50'],
            ['ddd, HH',                            'zo., 15'],
            ['M Mo MM MMMM MMM',                   '2 2de 02 februari feb.'],
            ['YYYY YY',                            '2010 10'],
            ['D Do DD',                            '14 14de 14'],
            ['d do dddd ddd',                      '0 0de zondag zo.'],
            ['DDD DDDo DDDD',                      '45 45ste 045'],
            ['w wo ww',                            '8 8ste 08'],
            ['h hh',                               '3 03'],
            ['H HH',                               '15 15'],
            ['m mm',                               '25 25'],
            ['s ss',                               '50 50'],
            ['a A',                                'pm PM'],
            ['t\\he DDDo \\d\\ay of t\\he ye\\ar', 'the 45ste day of the year'],
            ['L',                                  '14-02-2010'],
            ['LL',                                 '14 februari 2010'],
            ['LLL',                                '14 februari 2010 15:25'],
            ['LLLL',                               'zondag 14 februari 2010 15:25']
        ],
        b = moment(new Date(2010, 1, 14, 15, 25, 50, 125)),
        i;
    for (i = 0; i < a.length; i++) {
        equal(b.format(a[i][0]), a[i][1], a[i][0] + ' ---> ' + a[i][1]);
    }
});

test("format ordinal", 31, function() {
    moment.lang('nl');
    equal(moment([2011, 0, 1]).format('DDDo'), '1ste', '1ste');
    equal(moment([2011, 0, 2]).format('DDDo'), '2de', '2de');
    equal(moment([2011, 0, 3]).format('DDDo'), '3de', '3de');
    equal(moment([2011, 0, 4]).format('DDDo'), '4de', '4de');
    equal(moment([2011, 0, 5]).format('DDDo'), '5de', '5de');
    equal(moment([2011, 0, 6]).format('DDDo'), '6de', '6de');
    equal(moment([2011, 0, 7]).format('DDDo'), '7de', '7de');
    equal(moment([2011, 0, 8]).format('DDDo'), '8ste', '8ste');
    equal(moment([2011, 0, 9]).format('DDDo'), '9de', '9de');
    equal(moment([2011, 0, 10]).format('DDDo'), '10de', '10de');

    equal(moment([2011, 0, 11]).format('DDDo'), '11de', '11de');
    equal(moment([2011, 0, 12]).format('DDDo'), '12de', '12de');
    equal(moment([2011, 0, 13]).format('DDDo'), '13de', '13de');
    equal(moment([2011, 0, 14]).format('DDDo'), '14de', '14de');
    equal(moment([2011, 0, 15]).format('DDDo'), '15de', '15de');
    equal(moment([2011, 0, 16]).format('DDDo'), '16de', '16de');
    equal(moment([2011, 0, 17]).format('DDDo'), '17de', '17de');
    equal(moment([2011, 0, 18]).format('DDDo'), '18de', '18de');
    equal(moment([2011, 0, 19]).format('DDDo'), '19de', '19de');
    equal(moment([2011, 0, 20]).format('DDDo'), '20ste', '20ste');

    equal(moment([2011, 0, 21]).format('DDDo'), '21ste', '21ste');
    equal(moment([2011, 0, 22]).format('DDDo'), '22ste', '22ste');
    equal(moment([2011, 0, 23]).format('DDDo'), '23ste', '23ste');
    equal(moment([2011, 0, 24]).format('DDDo'), '24ste', '24ste');
    equal(moment([2011, 0, 25]).format('DDDo'), '25ste', '25ste');
    equal(moment([2011, 0, 26]).format('DDDo'), '26ste', '26ste');
    equal(moment([2011, 0, 27]).format('DDDo'), '27ste', '27ste');
    equal(moment([2011, 0, 28]).format('DDDo'), '28ste', '28ste');
    equal(moment([2011, 0, 29]).format('DDDo'), '29ste', '29ste');
    equal(moment([2011, 0, 30]).format('DDDo'), '30ste', '30ste');

    equal(moment([2011, 0, 31]).format('DDDo'), '31ste', '31ste');
});

test("format month", 12, function() {
    moment.lang('nl');
    var expected = 'januari jan._februari feb._maart mar._april apr._mei mei._juni jun._juli jul._augustus aug._september sep._oktober okt._november nov._december dec.'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, i, 0]).format('MMMM MMM'), expected[i], expected[i]);
    }
});

test("format week", 7, function() {
    moment.lang('nl');
    var expected = 'zondag zo._maandag ma._dinsdag di._woensdag wo._donderdag do._vrijdag vr._zaterdag za.'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, 0, 2 + i]).format('dddd ddd'), expected[i], expected[i]);
    }
});

test("from", 30, function() {
    moment.lang('nl');
    var start = moment([2007, 1, 28]);
    equal(start.from(moment([2007, 1, 28]).add({s:44}), true),  "een paar seconden", "44 seconds = a few seconds");
    equal(start.from(moment([2007, 1, 28]).add({s:45}), true),  "één minuut",      "45 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:89}), true),  "één minuut",      "89 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:90}), true),  "2 minuten",     "90 seconds = 2 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:44}), true),  "44 minuten",    "44 minutes = 44 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:45}), true),  "één uur",       "45 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:89}), true),  "één uur",       "89 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:90}), true),  "2 uur",       "90 minutes = 2 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:5}), true),   "5 uur",       "5 hours = 5 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:21}), true),  "21 uur",      "21 hours = 21 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:22}), true),  "één dag",         "22 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:35}), true),  "één dag",         "35 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:36}), true),  "2 dagen",        "36 hours = 2 days");
    equal(start.from(moment([2007, 1, 28]).add({d:1}), true),   "één dag",         "1 day = a day");
    equal(start.from(moment([2007, 1, 28]).add({d:5}), true),   "5 dagen",        "5 days = 5 days");
    equal(start.from(moment([2007, 1, 28]).add({d:25}), true),  "25 dagen",       "25 days = 25 days");
    equal(start.from(moment([2007, 1, 28]).add({d:26}), true),  "één maand",       "26 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:30}), true),  "één maand",       "30 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:45}), true),  "één maand",       "45 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:46}), true),  "2 maanden",      "46 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:74}), true),  "2 maanden",      "75 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:76}), true),  "3 maanden",      "76 days = 3 months");
    equal(start.from(moment([2007, 1, 28]).add({M:1}), true),   "één maand",       "1 month = a month");
    equal(start.from(moment([2007, 1, 28]).add({M:5}), true),   "5 maanden",      "5 months = 5 months");
    equal(start.from(moment([2007, 1, 28]).add({d:344}), true), "11 maanden",     "344 days = 11 months");
    equal(start.from(moment([2007, 1, 28]).add({d:345}), true), "één jaar",        "345 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:547}), true), "één jaar",        "547 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:548}), true), "2 jaar",       "548 days = 2 years");
    equal(start.from(moment([2007, 1, 28]).add({y:1}), true),   "één jaar",        "1 year = a year");
    equal(start.from(moment([2007, 1, 28]).add({y:5}), true),   "5 jaar",       "5 years = 5 years");
});

test("suffix", 2, function() {
    moment.lang('nl');
    equal(moment(30000).from(0), "over een paar seconden",  "prefix");
    equal(moment(0).from(30000), "een paar seconden geleden", "suffix");
});


test("now from now", 1, function() {
    moment.lang('nl');
    equal(moment().fromNow(), "een paar seconden geleden",  "now from now should display as in the past");
});


test("fromNow", 2, function() {
    moment.lang('nl');
    equal(moment().add({s:30}).fromNow(), "over een paar seconden", "in a few seconds");
    equal(moment().add({d:5}).fromNow(), "over 5 dagen", "in 5 days");
});



test("calendar day", 6, function() {
    moment.lang('nl');

    var a = moment().hours(2).minutes(0).seconds(0);

    equal(moment(a).calendar(),                     "Vandaag om 02:00",     "today at the same time");
    equal(moment(a).add({ m: 25 }).calendar(),      "Vandaag om 02:25",     "Now plus 25 min");
    equal(moment(a).add({ h: 1 }).calendar(),       "Vandaag om 03:00",     "Now plus 1 hour");
    equal(moment(a).add({ d: 1 }).calendar(),       "Morgen om 02:00",    "tomorrow at the same time");
    equal(moment(a).subtract({ h: 1 }).calendar(),  "Vandaag om 01:00",     "Now minus 1 hour");
    equal(moment(a).subtract({ d: 1 }).calendar(),  "Gisteren om 02:00",   "yesterday at the same time");
});

test("calendar next week", 15, function() {
    moment.lang('nl');

    var i;
    var m;

    for (i = 2; i < 7; i++) {
        m = moment().add({ d: i });
        equal(m.calendar(),       m.format('dddd [om] LT'),  "Today + " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('dddd [om] LT'),  "Today + " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('dddd [om] LT'),  "Today + " + i + " days end of day");
    }
});

test("calendar last week", 15, function() {
    moment.lang('nl');

    for (i = 2; i < 7; i++) {
        m = moment().subtract({ d: i });
        equal(m.calendar(),       m.format('[afgelopen] dddd [om] LT'),  "Today - " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('[afgelopen] dddd [om] LT'),  "Today - " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('[afgelopen] dddd [om] LT'),  "Today - " + i + " days end of day");
    }
});

test("calendar all else", 4, function() {
    moment.lang('nl');
    var weeksAgo = moment().subtract({ w: 1 });
    var weeksFromNow = moment().add({ w: 1 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "1 week ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 1 week");

    weeksAgo = moment().subtract({ w: 2 });
    weeksFromNow = moment().add({ w: 2 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "2 weeks ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 2 weeks");
});

/**************************************************
  Polish
 *************************************************/

module("lang:pl");

test("parse", 96, function() {
    moment.lang('pl');
    var tests = 'styczeń sty_luty lut_marzec mar_kwiecień kwi_maj maj_czerwiec cze_lipiec lip_sierpień sie_wrzesień wrz_październik paź_listopad lis_grudzień gru'.split("_");
    var i;
    function equalTest(input, mmm, i) {
        equal(moment(input, mmm).month(), i, input + ' should be month ' + (i + 1));
    }
    for (i = 0; i < 12; i++) {
        tests[i] = tests[i].split(' ');
        equalTest(tests[i][0], 'MMM', i);
        equalTest(tests[i][1], 'MMM', i);
        equalTest(tests[i][0], 'MMMM', i);
        equalTest(tests[i][1], 'MMMM', i);
        equalTest(tests[i][0].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][0].toLocaleUpperCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleUpperCase(), 'MMMM', i);
    }
});

test("format", 18, function() {
    moment.lang('pl');
    var a = [
            ['dddd, MMMM Do YYYY, h:mm:ss a',      'niedziela, luty 14. 2010, 3:25:50 pm'],
            ['ddd, hA',                            'nie, 3PM'],
            ['M Mo MM MMMM MMM',                   '2 2. 02 luty lut'],
            ['YYYY YY',                            '2010 10'],
            ['D Do DD',                            '14 14. 14'],
            ['d do dddd ddd',                      '0 0. niedziela nie'],
            ['DDD DDDo DDDD',                      '45 45. 045'],
            ['w wo ww',                            '8 8. 08'],
            ['h hh',                               '3 03'],
            ['H HH',                               '15 15'],
            ['m mm',                               '25 25'],
            ['s ss',                               '50 50'],
            ['a A',                                'pm PM'],
            ['t\\he DDDo \\d\\ay of t\\he ye\\ar', 'the 45. day of the year'],
            ['L',                                  '14-02-2010'],
            ['LL',                                 '14 luty 2010'],
            ['LLL',                                '14 luty 2010 15:25'],
            ['LLLL',                               'niedziela, 14 luty 2010 15:25']
        ],
        b = moment(new Date(2010, 1, 14, 15, 25, 50, 125)),
        i;
    for (i = 0; i < a.length; i++) {
        equal(b.format(a[i][0]), a[i][1], a[i][0] + ' ---> ' + a[i][1]);
    }
});

test("format ordinal", 31, function() {
    moment.lang('pl');
    equal(moment([2011, 0, 1]).format('DDDo'), '1.', '1.');
    equal(moment([2011, 0, 2]).format('DDDo'), '2.', '2.');
    equal(moment([2011, 0, 3]).format('DDDo'), '3.', '3.');
    equal(moment([2011, 0, 4]).format('DDDo'), '4.', '4.');
    equal(moment([2011, 0, 5]).format('DDDo'), '5.', '5.');
    equal(moment([2011, 0, 6]).format('DDDo'), '6.', '6.');
    equal(moment([2011, 0, 7]).format('DDDo'), '7.', '7.');
    equal(moment([2011, 0, 8]).format('DDDo'), '8.', '8.');
    equal(moment([2011, 0, 9]).format('DDDo'), '9.', '9.');
    equal(moment([2011, 0, 10]).format('DDDo'), '10.', '10.');

    equal(moment([2011, 0, 11]).format('DDDo'), '11.', '11.');
    equal(moment([2011, 0, 12]).format('DDDo'), '12.', '12.');
    equal(moment([2011, 0, 13]).format('DDDo'), '13.', '13.');
    equal(moment([2011, 0, 14]).format('DDDo'), '14.', '14.');
    equal(moment([2011, 0, 15]).format('DDDo'), '15.', '15.');
    equal(moment([2011, 0, 16]).format('DDDo'), '16.', '16.');
    equal(moment([2011, 0, 17]).format('DDDo'), '17.', '17.');
    equal(moment([2011, 0, 18]).format('DDDo'), '18.', '18.');
    equal(moment([2011, 0, 19]).format('DDDo'), '19.', '19.');
    equal(moment([2011, 0, 20]).format('DDDo'), '20.', '20.');

    equal(moment([2011, 0, 21]).format('DDDo'), '21.', '21.');
    equal(moment([2011, 0, 22]).format('DDDo'), '22.', '22.');
    equal(moment([2011, 0, 23]).format('DDDo'), '23.', '23.');
    equal(moment([2011, 0, 24]).format('DDDo'), '24.', '24.');
    equal(moment([2011, 0, 25]).format('DDDo'), '25.', '25.');
    equal(moment([2011, 0, 26]).format('DDDo'), '26.', '26.');
    equal(moment([2011, 0, 27]).format('DDDo'), '27.', '27.');
    equal(moment([2011, 0, 28]).format('DDDo'), '28.', '28.');
    equal(moment([2011, 0, 29]).format('DDDo'), '29.', '29.');
    equal(moment([2011, 0, 30]).format('DDDo'), '30.', '30.');

    equal(moment([2011, 0, 31]).format('DDDo'), '31.', '31.');
});

test("format month", 12, function() {
    moment.lang('pl');
    var expected = 'styczeń sty_luty lut_marzec mar_kwiecień kwi_maj maj_czerwiec cze_lipiec lip_sierpień sie_wrzesień wrz_październik paź_listopad lis_grudzień gru'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, i, 0]).format('MMMM MMM'), expected[i], expected[i]);
    }
});

test("format week", 7, function() {
    moment.lang('pl');
    var expected = 'niedziela nie_poniedziałek pon_wtorek wt_środa śr_czwartek czw_piątek pt_sobota sb'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, 0, 2 + i]).format('dddd ddd'), expected[i], expected[i]);
    }
});

test("from", 30, function() {
    moment.lang('pl');
    var start = moment([2007, 1, 28]);
    equal(start.from(moment([2007, 1, 28]).add({s:44}), true),  "kilka sekund",  "44 seconds = a few seconds");
    equal(start.from(moment([2007, 1, 28]).add({s:45}), true),  "minuta",        "45 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:89}), true),  "minuta",        "89 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:90}), true),  "2 minuty",      "90 seconds = 2 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:44}), true),  "44 minuty",     "44 minutes = 44 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:45}), true),  "godzina",       "45 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:89}), true),  "godzina",       "89 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:90}), true),  "2 godziny",     "90 minutes = 2 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:5}), true),   "5 godzin",      "5 hours = 5 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:21}), true),  "21 godzin",     "21 hours = 21 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:22}), true),  "1 dzień",       "22 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:35}), true),  "1 dzień",       "35 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:36}), true),  "2 dni",         "36 hours = 2 days");
    equal(start.from(moment([2007, 1, 28]).add({d:1}), true),   "1 dzień",       "1 day = a day");
    equal(start.from(moment([2007, 1, 28]).add({d:5}), true),   "5 dni",         "5 days = 5 days");
    equal(start.from(moment([2007, 1, 28]).add({d:25}), true),  "25 dni",        "25 days = 25 days");
    equal(start.from(moment([2007, 1, 28]).add({d:26}), true),  "miesiąc",       "26 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:30}), true),  "miesiąc",       "30 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:45}), true),  "miesiąc",       "45 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:46}), true),  "2 miesiące",    "46 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:74}), true),  "2 miesiące",    "75 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:76}), true),  "3 miesiące",    "76 days = 3 months");
    equal(start.from(moment([2007, 1, 28]).add({M:1}), true),   "miesiąc",       "1 month = a month");
    equal(start.from(moment([2007, 1, 28]).add({M:5}), true),   "5 miesięcy",    "5 months = 5 months");
    equal(start.from(moment([2007, 1, 28]).add({d:344}), true), "11 miesięcy",   "344 days = 11 months");
    equal(start.from(moment([2007, 1, 28]).add({d:345}), true), "rok",           "345 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:547}), true), "rok",           "547 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:548}), true), "2 lata",        "548 days = 2 years");
    equal(start.from(moment([2007, 1, 28]).add({y:1}), true),   "rok",           "1 year = a year");
    equal(start.from(moment([2007, 1, 28]).add({y:5}), true),   "5 lat",         "5 years = 5 years");
});

test("suffix", 2, function() {
    moment.lang('pl');
    equal(moment(30000).from(0), "za kilka sekund",  "prefix");
    equal(moment(0).from(30000), "kilka sekund temu", "suffix");
});


test("now from now", 1, function() {
    moment.lang('pl');
    equal(moment().fromNow(), "kilka sekund temu",  "now from now should display as in the past");
});


test("fromNow", 3, function() {
    moment.lang('pl');
    equal(moment().add({s:30}).fromNow(), "za kilka sekund", "in a few seconds");
    equal(moment().add({h:1}).fromNow(), "za godzinę", "in an hour");
    equal(moment().add({d:5}).fromNow(), "za 5 dni", "in 5 days");
});



test("calendar day", 6, function() {
    moment.lang('pl');

    var a = moment().hours(2).minutes(0).seconds(0);

    equal(moment(a).calendar(),                     "Dziś o 02:00",     "today at the same time");
    equal(moment(a).add({ m: 25 }).calendar(),      "Dziś o 02:25",     "Now plus 25 min");
    equal(moment(a).add({ h: 1 }).calendar(),       "Dziś o 03:00",     "Now plus 1 hour");
    equal(moment(a).add({ d: 1 }).calendar(),       "Jutro o 02:00",  "tomorrow at the same time");
    equal(moment(a).subtract({ h: 1 }).calendar(),  "Dziś o 01:00",     "Now minus 1 hour");
    equal(moment(a).subtract({ d: 1 }).calendar(),  "Wczoraj o 02:00",     "yesterday at the same time");
});

test("calendar next week", 15, function() {
    moment.lang('pl');

    var i;
    var m;

    for (i = 2; i < 7; i++) {
        m = moment().add({ d: i });
        equal(m.calendar(),       m.format('[W] dddd [o] LT'),  "Today + " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('[W] dddd [o] LT'),  "Today + " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('[W] dddd [o] LT'),  "Today + " + i + " days end of day");
    }
});

test("calendar last week", 15, function() {
    moment.lang('pl');

    for (i = 2; i < 7; i++) {
        m = moment().subtract({ d: i });
        equal(m.calendar(),       m.format('[W zeszły/łą] dddd [o] LT'),  "Today - " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('[W zeszły/łą] dddd [o] LT'),  "Today - " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('[W zeszły/łą] dddd [o] LT'),  "Today - " + i + " days end of day");
    }
});

test("calendar all else", 4, function() {
    moment.lang('pl');
    var weeksAgo = moment().subtract({ w: 1 });
    var weeksFromNow = moment().add({ w: 1 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "1 week ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 1 week");

    weeksAgo = moment().subtract({ w: 2 });
    weeksFromNow = moment().add({ w: 2 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "2 weeks ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 2 weeks");
});

/**************************************************
  Portuguese
 *************************************************/

module("lang:pt");

test("parse", 96, function() {
    moment.lang('pt');
    var tests = 'Janeiro Jan_Fevereiro Fev_Março Mar_Abril Abr_Maio Mai_Junho Jun_Julho Jul_Agosto Ago_Setembro Set_Outubro Out_Novembro Nov_Dezembro Dez'.split("_");
    var i;
    function equalTest(input, mmm, i) {
        equal(moment(input, mmm).month(), i, input + ' should be month ' + (i + 1));
    }
    for (i = 0; i < 12; i++) {
        tests[i] = tests[i].split(' ');
        equalTest(tests[i][0], 'MMM', i);
        equalTest(tests[i][1], 'MMM', i);
        equalTest(tests[i][0], 'MMMM', i);
        equalTest(tests[i][1], 'MMMM', i);
        equalTest(tests[i][0].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][0].toLocaleUpperCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleUpperCase(), 'MMMM', i);
    }
});

test("format", 18, function() {
    moment.lang('pt');
    var a = [
            ['dddd, MMMM Do YYYY, h:mm:ss a',      'Domingo, Fevereiro 14º 2010, 3:25:50 pm'],
            ['ddd, hA',                            'Dom, 3PM'],
            ['M Mo MM MMMM MMM',                   '2 2º 02 Fevereiro Fev'],
            ['YYYY YY',                            '2010 10'],
            ['D Do DD',                            '14 14º 14'],
            ['d do dddd ddd',                      '0 0º Domingo Dom'],
            ['DDD DDDo DDDD',                      '45 45º 045'],
            ['w wo ww',                            '8 8º 08'],
            ['h hh',                               '3 03'],
            ['H HH',                               '15 15'],
            ['m mm',                               '25 25'],
            ['s ss',                               '50 50'],
            ['a A',                                'pm PM'],
            ['t\\he DDDo \\d\\ay of t\\he ye\\ar', 'the 45º day of the year'],
            ['L',                                  '14/02/2010'],
            ['LL',                                 '14 de Fevereiro de 2010'],
            ['LLL',                                '14 de Fevereiro de 2010 15:25'],
            ['LLLL',                               'Domingo, 14 de Fevereiro de 2010 15:25']
        ],
        b = moment(new Date(2010, 1, 14, 15, 25, 50, 125)),
        i;
    for (i = 0; i < a.length; i++) {
        equal(b.format(a[i][0]), a[i][1], a[i][0] + ' ---> ' + a[i][1]);
    }
});

test("format ordinal", 31, function() {
    moment.lang('pt');
    equal(moment([2011, 0, 1]).format('DDDo'), '1º', '1º');
    equal(moment([2011, 0, 2]).format('DDDo'), '2º', '2º');
    equal(moment([2011, 0, 3]).format('DDDo'), '3º', '3º');
    equal(moment([2011, 0, 4]).format('DDDo'), '4º', '4º');
    equal(moment([2011, 0, 5]).format('DDDo'), '5º', '5º');
    equal(moment([2011, 0, 6]).format('DDDo'), '6º', '6º');
    equal(moment([2011, 0, 7]).format('DDDo'), '7º', '7º');
    equal(moment([2011, 0, 8]).format('DDDo'), '8º', '8º');
    equal(moment([2011, 0, 9]).format('DDDo'), '9º', '9º');
    equal(moment([2011, 0, 10]).format('DDDo'), '10º', '10º');

    equal(moment([2011, 0, 11]).format('DDDo'), '11º', '11º');
    equal(moment([2011, 0, 12]).format('DDDo'), '12º', '12º');
    equal(moment([2011, 0, 13]).format('DDDo'), '13º', '13º');
    equal(moment([2011, 0, 14]).format('DDDo'), '14º', '14º');
    equal(moment([2011, 0, 15]).format('DDDo'), '15º', '15º');
    equal(moment([2011, 0, 16]).format('DDDo'), '16º', '16º');
    equal(moment([2011, 0, 17]).format('DDDo'), '17º', '17º');
    equal(moment([2011, 0, 18]).format('DDDo'), '18º', '18º');
    equal(moment([2011, 0, 19]).format('DDDo'), '19º', '19º');
    equal(moment([2011, 0, 20]).format('DDDo'), '20º', '20º');

    equal(moment([2011, 0, 21]).format('DDDo'), '21º', '21º');
    equal(moment([2011, 0, 22]).format('DDDo'), '22º', '22º');
    equal(moment([2011, 0, 23]).format('DDDo'), '23º', '23º');
    equal(moment([2011, 0, 24]).format('DDDo'), '24º', '24º');
    equal(moment([2011, 0, 25]).format('DDDo'), '25º', '25º');
    equal(moment([2011, 0, 26]).format('DDDo'), '26º', '26º');
    equal(moment([2011, 0, 27]).format('DDDo'), '27º', '27º');
    equal(moment([2011, 0, 28]).format('DDDo'), '28º', '28º');
    equal(moment([2011, 0, 29]).format('DDDo'), '29º', '29º');
    equal(moment([2011, 0, 30]).format('DDDo'), '30º', '30º');

    equal(moment([2011, 0, 31]).format('DDDo'), '31º', '31º');
});

test("format month", 12, function() {
    moment.lang('pt');
    var expected = 'Janeiro Jan_Fevereiro Fev_Março Mar_Abril Abr_Maio Mai_Junho Jun_Julho Jul_Agosto Ago_Setembro Set_Outubro Out_Novembro Nov_Dezembro Dez'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, i, 0]).format('MMMM MMM'), expected[i], expected[i]);
    }
});

test("format week", 7, function() {
    moment.lang('pt');
    var expected = 'Domingo Dom_Segunda-feira Seg_Terça-feira Ter_Quarta-feira Qua_Quinta-feira Qui_Sexta-feira Sex_Sábado Sáb'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, 0, 2 + i]).format('dddd ddd'), expected[i], expected[i]);
    }
});

test("from", 30, function() {
    moment.lang('pt');
    var start = moment([2007, 1, 28]);
    equal(start.from(moment([2007, 1, 28]).add({s:44}), true),  "segundos",    "44 seconds = seconds");
    equal(start.from(moment([2007, 1, 28]).add({s:45}), true),  "um minuto",   "45 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:89}), true),  "um minuto",   "89 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:90}), true),  "2 minutos",  "90 seconds = 2 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:44}), true),  "44 minutos", "44 minutes = 44 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:45}), true),  "uma hora",    "45 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:89}), true),  "uma hora",    "89 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:90}), true),  "2 horas",    "90 minutes = 2 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:5}), true),   "5 horas",    "5 hours = 5 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:21}), true),  "21 horas",   "21 hours = 21 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:22}), true),  "um dia",      "22 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:35}), true),  "um dia",      "35 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:36}), true),  "2 dias",     "36 hours = 2 days");
    equal(start.from(moment([2007, 1, 28]).add({d:1}), true),   "um dia",      "1 day = a day");
    equal(start.from(moment([2007, 1, 28]).add({d:5}), true),   "5 dias",     "5 days = 5 days");
    equal(start.from(moment([2007, 1, 28]).add({d:25}), true),  "25 dias",    "25 days = 25 days");
    equal(start.from(moment([2007, 1, 28]).add({d:26}), true),  "um mês",    "26 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:30}), true),  "um mês",    "30 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:45}), true),  "um mês",    "45 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:46}), true),  "2 meses",   "46 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:74}), true),  "2 meses",   "75 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:76}), true),  "3 meses",   "76 days = 3 months");
    equal(start.from(moment([2007, 1, 28]).add({M:1}), true),   "um mês",    "1 month = a month");
    equal(start.from(moment([2007, 1, 28]).add({M:5}), true),   "5 meses",   "5 months = 5 months");
    equal(start.from(moment([2007, 1, 28]).add({d:344}), true), "11 meses",  "344 days = 11 months");
    equal(start.from(moment([2007, 1, 28]).add({d:345}), true), "um ano",     "345 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:547}), true), "um ano",     "547 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:548}), true), "2 anos",    "548 days = 2 years");
    equal(start.from(moment([2007, 1, 28]).add({y:1}), true),   "um ano",     "1 year = a year");
    equal(start.from(moment([2007, 1, 28]).add({y:5}), true),   "5 anos",    "5 years = 5 years");
});

test("suffix", 2, function() {
    moment.lang('pt');
    equal(moment(30000).from(0), "em segundos", "prefix");
    equal(moment(0).from(30000), "segundos atrás", "suffix");
});

test("fromNow", 2, function() {
    moment.lang('pt');
    equal(moment().add({s:30}).fromNow(), "em segundos", "in seconds");
    equal(moment().add({d:5}).fromNow(), "em 5 dias", "in 5 days");
});


test("calendar day", 6, function() {
    moment.lang('pt');

    var a = moment().hours(2).minutes(0).seconds(0);

    equal(moment(a).calendar(),                     "Hoje às 02:00",     "today at the same time");
    equal(moment(a).add({ m: 25 }).calendar(),      "Hoje às 02:25",     "Now plus 25 min");
    equal(moment(a).add({ h: 1 }).calendar(),       "Hoje às 03:00",     "Now plus 1 hour");
    equal(moment(a).add({ d: 1 }).calendar(),       "Amanhã às 02:00",  "tomorrow at the same time");
    equal(moment(a).subtract({ h: 1 }).calendar(),  "Hoje às 01:00",     "Now minus 1 hour");
    equal(moment(a).subtract({ d: 1 }).calendar(),  "Ontem às 02:00",     "yesterday at the same time");
});

test("calendar next week", 15, function() {
    moment.lang('pt');

    var i;
    var m;

    for (i = 2; i < 7; i++) {
        m = moment().add({ d: i });
        equal(m.calendar(),       m.format('dddd [às] LT'),  "Today + " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('dddd [às] LT'),  "Today + " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('dddd [às] LT'),  "Today + " + i + " days end of day");
    }
});

test("calendar last week", 15, function() {
    moment.lang('pt');

    for (i = 2; i < 7; i++) {
        m = moment().subtract({ d: i });
        equal(m.calendar(),       m.format((m.day() === 0 || m.day() === 6) ? '[Último] dddd [às] LT' : '[Última] dddd [às] LT'),  "Today - " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format((m.day() === 0 || m.day() === 6) ? '[Último] dddd [às] LT' : '[Última] dddd [às] LT'),  "Today - " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format((m.day() === 0 || m.day() === 6) ? '[Último] dddd [às] LT' : '[Última] dddd [às] LT'),  "Today - " + i + " days end of day");
    }
});

test("calendar all else", 4, function() {
    moment.lang('pt');
    var weeksAgo = moment().subtract({ w: 1 });
    var weeksFromNow = moment().add({ w: 1 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "1 week ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 1 week");

    weeksAgo = moment().subtract({ w: 2 });
    weeksFromNow = moment().add({ w: 2 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "2 weeks ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 2 weeks");
});

/**************************************************
  Russian
 *************************************************/

module("lang:ru");

test("parse", 96, function() {
    moment.lang('ru');
    var tests = 'январь янв_февраль фев_март мар_апрель апр_май май_июнь июн_июль июл_август авг_сентябрь сен_октябрь окт_ноябрь ноя_декабрь дек'.split("_");
    var i;
    function equalTest(input, mmm, i) {
        equal(moment(input, mmm).month(), i, input + ' should be month ' + (i + 1));
    }
    for (i = 0; i < 12; i++) {
        tests[i] = tests[i].split(' ');
        equalTest(tests[i][0], 'MMM', i);
        equalTest(tests[i][1], 'MMM', i);
        equalTest(tests[i][0], 'MMMM', i);
        equalTest(tests[i][1], 'MMMM', i);
        equalTest(tests[i][0].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][0].toLocaleUpperCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleUpperCase(), 'MMMM', i);
    }
});

test("format", 18, function() {
    moment.lang('ru');
    var a = [
            ['dddd, MMMM Do YYYY, h:mm:ss a',      'воскресенье, февраль 14. 2010, 3:25:50 pm'],
            ['ddd, hA',                            'вск, 3PM'],
            ['M Mo MM MMMM MMM',                   '2 2. 02 февраль фев'],
            ['YYYY YY',                            '2010 10'],
            ['D Do DD',                            '14 14. 14'],
            ['d do dddd ddd',                      '0 0. воскресенье вск'],
            ['DDD DDDo DDDD',                      '45 45. 045'],
            ['w wo ww',                            '8 8. 08'],
            ['h hh',                               '3 03'],
            ['H HH',                               '15 15'],
            ['m mm',                               '25 25'],
            ['s ss',                               '50 50'],
            ['a A',                                'pm PM'],
            ['t\\he DDDo \\d\\ay of t\\he ye\\ar', 'the 45. day of the year'],
            ['L',                                  '14-02-2010'],
            ['LL',                                 '14 февраль 2010'],
            ['LLL',                                '14 февраль 2010 15:25'],
            ['LLLL',                               'воскресенье, 14 февраль 2010 15:25']
        ],
        b = moment(new Date(2010, 1, 14, 15, 25, 50, 125)),
        i;
    for (i = 0; i < a.length; i++) {
        equal(b.format(a[i][0]), a[i][1], a[i][0] + ' ---> ' + a[i][1]);
    }
});

test("format ordinal", 31, function() {
    moment.lang('ru');
    equal(moment([2011, 0, 1]).format('DDDo'), '1.', '1.');
    equal(moment([2011, 0, 2]).format('DDDo'), '2.', '2.');
    equal(moment([2011, 0, 3]).format('DDDo'), '3.', '3.');
    equal(moment([2011, 0, 4]).format('DDDo'), '4.', '4.');
    equal(moment([2011, 0, 5]).format('DDDo'), '5.', '5.');
    equal(moment([2011, 0, 6]).format('DDDo'), '6.', '6.');
    equal(moment([2011, 0, 7]).format('DDDo'), '7.', '7.');
    equal(moment([2011, 0, 8]).format('DDDo'), '8.', '8.');
    equal(moment([2011, 0, 9]).format('DDDo'), '9.', '9.');
    equal(moment([2011, 0, 10]).format('DDDo'), '10.', '10.');

    equal(moment([2011, 0, 11]).format('DDDo'), '11.', '11.');
    equal(moment([2011, 0, 12]).format('DDDo'), '12.', '12.');
    equal(moment([2011, 0, 13]).format('DDDo'), '13.', '13.');
    equal(moment([2011, 0, 14]).format('DDDo'), '14.', '14.');
    equal(moment([2011, 0, 15]).format('DDDo'), '15.', '15.');
    equal(moment([2011, 0, 16]).format('DDDo'), '16.', '16.');
    equal(moment([2011, 0, 17]).format('DDDo'), '17.', '17.');
    equal(moment([2011, 0, 18]).format('DDDo'), '18.', '18.');
    equal(moment([2011, 0, 19]).format('DDDo'), '19.', '19.');
    equal(moment([2011, 0, 20]).format('DDDo'), '20.', '20.');

    equal(moment([2011, 0, 21]).format('DDDo'), '21.', '21.');
    equal(moment([2011, 0, 22]).format('DDDo'), '22.', '22.');
    equal(moment([2011, 0, 23]).format('DDDo'), '23.', '23.');
    equal(moment([2011, 0, 24]).format('DDDo'), '24.', '24.');
    equal(moment([2011, 0, 25]).format('DDDo'), '25.', '25.');
    equal(moment([2011, 0, 26]).format('DDDo'), '26.', '26.');
    equal(moment([2011, 0, 27]).format('DDDo'), '27.', '27.');
    equal(moment([2011, 0, 28]).format('DDDo'), '28.', '28.');
    equal(moment([2011, 0, 29]).format('DDDo'), '29.', '29.');
    equal(moment([2011, 0, 30]).format('DDDo'), '30.', '30.');

    equal(moment([2011, 0, 31]).format('DDDo'), '31.', '31.');
});

test("format month", 12, function() {
    moment.lang('ru');
    var expected = 'январь янв_февраль фев_март мар_апрель апр_май май_июнь июн_июль июл_август авг_сентябрь сен_октябрь окт_ноябрь ноя_декабрь дек'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, i, 0]).format('MMMM MMM'), expected[i], expected[i]);
    }
});

test("format week", 7, function() {
    moment.lang('ru');
    var expected = 'воскресенье вск_понедельник пнд_вторник втр_среда срд_четверг чтв_пятница птн_суббота суб'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, 0, 2 + i]).format('dddd ddd'), expected[i], expected[i]);
    }
});

test("from", 30, function() {
    moment.lang('ru');
    var start = moment([2007, 1, 28]);
    equal(start.from(moment([2007, 1, 28]).add({s:44}), true),  "несколько секунд",    "44 seconds = seconds");
    equal(start.from(moment([2007, 1, 28]).add({s:45}), true),  "минут",   "45 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:89}), true),  "минут",   "89 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:90}), true),  "2 минут",  "90 seconds = 2 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:44}), true),  "44 минут", "44 minutes = 44 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:45}), true),  "часа",    "45 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:89}), true),  "часа",    "89 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:90}), true),  "2 часов",    "90 minutes = 2 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:5}), true),   "5 часов",    "5 hours = 5 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:21}), true),  "21 часов",   "21 hours = 21 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:22}), true),  "1 день",      "22 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:35}), true),  "1 день",      "35 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:36}), true),  "2 дней",     "36 hours = 2 days");
    equal(start.from(moment([2007, 1, 28]).add({d:1}), true),   "1 день",      "1 day = a day");
    equal(start.from(moment([2007, 1, 28]).add({d:5}), true),   "5 дней",     "5 days = 5 days");
    equal(start.from(moment([2007, 1, 28]).add({d:25}), true),  "25 дней",    "25 days = 25 days");
    equal(start.from(moment([2007, 1, 28]).add({d:26}), true),  "месяц",    "26 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:30}), true),  "месяц",    "30 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:45}), true),  "месяц",    "45 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:46}), true),  "2 месяцев",   "46 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:74}), true),  "2 месяцев",   "75 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:76}), true),  "3 месяцев",   "76 days = 3 months");
    equal(start.from(moment([2007, 1, 28]).add({M:1}), true),   "месяц",    "1 month = a month");
    equal(start.from(moment([2007, 1, 28]).add({M:5}), true),   "5 месяцев",   "5 months = 5 months");
    equal(start.from(moment([2007, 1, 28]).add({d:344}), true), "11 месяцев",  "344 days = 11 months");
    equal(start.from(moment([2007, 1, 28]).add({d:345}), true), "год",     "345 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:547}), true), "год",     "547 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:548}), true), "2 лет",    "548 days = 2 years");
    equal(start.from(moment([2007, 1, 28]).add({y:1}), true),   "год",     "1 year = a year");
    equal(start.from(moment([2007, 1, 28]).add({y:5}), true),   "5 лет",    "5 years = 5 years");
});

test("suffix", 2, function() {
    moment.lang('ru');
    equal(moment(30000).from(0), "через несколько секунд", "prefix");
    equal(moment(0).from(30000), "несколько секунд назад", "suffix");
});

test("fromNow", 2, function() {
    moment.lang('ru');
    equal(moment().add({s:30}).fromNow(), "через несколько секунд", "in seconds");
    equal(moment().add({d:5}).fromNow(), "через 5 дней", "in 5 days");
});


test("calendar day", 6, function() {
    moment.lang('ru');

    var a = moment().hours(2).minutes(0).seconds(0);

    equal(moment(a).calendar(),                     "Сегодня в 02:00",     "today at the same time");
    equal(moment(a).add({ m: 25 }).calendar(),      "Сегодня в 02:25",     "Now plus 25 min");
    equal(moment(a).add({ h: 1 }).calendar(),       "Сегодня в 03:00",     "Now plus 1 hour");
    equal(moment(a).add({ d: 1 }).calendar(),       "Завтра в 02:00",      "tomorrow at the same time");
    equal(moment(a).subtract({ h: 1 }).calendar(),  "Сегодня в 01:00",     "Now minus 1 hour");
    equal(moment(a).subtract({ d: 1 }).calendar(),  "Вчера в 02:00",       "yesterday at the same time");
});

test("calendar next week", 15, function() {
    moment.lang('ru');

    var i;
    var m;

    function makeFormat(d) {
        return d.day() === 1 ? '[Во] dddd [в] LT' : '[В] dddd [в] LT';
    }

    for (i = 2; i < 7; i++) {
        m = moment().add({ d: i });
        equal(m.calendar(),       m.format(makeFormat(m)),  "Today + " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format(makeFormat(m)),  "Today + " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format(makeFormat(m)),  "Today + " + i + " days end of day");
    }
});

test("calendar last week", 15, function() {
    moment.lang('ru');

    var i;
    var m;

    function makeFormat(d) {
        switch (d.day()) {
        case 0:
        case 1:
        case 3:
            return '[В прошлый] dddd [в] LT';
        case 6:
            return '[В прошлое] dddd [в] LT';
        default:
            return '[В прошлую] dddd [в] LT';
        }
    }

    for (i = 2; i < 7; i++) {
        m = moment().subtract({ d: i });
        equal(m.calendar(),       m.format(makeFormat(m)),  "Today - " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format(makeFormat(m)),  "Today - " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format(makeFormat(m)),  "Today - " + i + " days end of day");
    }
});

test("calendar all else", 4, function() {
    moment.lang('ru');
    var weeksAgo = moment().subtract({ w: 1 });
    var weeksFromNow = moment().add({ w: 1 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "1 week ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 1 week");

    weeksAgo = moment().subtract({ w: 2 });
    weeksFromNow = moment().add({ w: 2 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "2 weeks ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 2 weeks");
});

/**************************************************
  English
 *************************************************/

module("lang:sv");

test("parse", 96, function() {
    moment.lang('sv');
    var tests = 'januari jan_februari feb_mars mar_april apr_maj maj_juni jun_juli jul_augusti aug_september sep_oktober okt_november nov_december dec'.split("_");
    var i;
    function equalTest(input, mmm, i) {
        equal(moment(input, mmm).month(), i, input + ' should be month ' + (i + 1));
    }
    for (i = 0; i < 12; i++) {
        tests[i] = tests[i].split(' ');
        equalTest(tests[i][0], 'MMM', i);
        equalTest(tests[i][1], 'MMM', i);
        equalTest(tests[i][0], 'MMMM', i);
        equalTest(tests[i][1], 'MMMM', i);
        equalTest(tests[i][0].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][0].toLocaleUpperCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleUpperCase(), 'MMMM', i);
    }
});

test("format", 18, function() {
    moment.lang('sv');
    var a = [
            ['dddd, MMMM Do YYYY, h:mm:ss a',      'söndag, februari 14e 2010, 3:25:50 pm'],
            ['ddd, hA',                            'sön, 3PM'],
            ['M Mo MM MMMM MMM',                   '2 2a 02 februari feb'],
            ['YYYY YY',                            '2010 10'],
            ['D Do DD',                            '14 14e 14'],
            ['d do dddd ddd',                      '0 0e söndag sön'],
            ['DDD DDDo DDDD',                      '45 45e 045'],
            ['w wo ww',                            '8 8e 08'],
            ['h hh',                               '3 03'],
            ['H HH',                               '15 15'],
            ['m mm',                               '25 25'],
            ['s ss',                               '50 50'],
            ['a A',                                'pm PM'],
            ['t\\he DDDo \\d\\ay of t\\he ye\\ar', 'the 45e day of the year'],
            ['L',                                  '2010-02-14'],
            ['LL',                                 '14 februari 2010'],
            ['LLL',                                '14 februari 2010 15:25'],
            ['LLLL',                               'söndag 14 februari 2010 15:25']
        ],
        b = moment(new Date(2010, 1, 14, 15, 25, 50, 125)),
        i;
    for (i = 0; i < a.length; i++) {
        equal(b.format(a[i][0]), a[i][1], a[i][0] + ' ---> ' + a[i][1]);
    }
});

test("format ordinal", 31, function() {
    moment.lang('sv');
    equal(moment([2011, 0, 1]).format('DDDo'), '1a', '1a');
    equal(moment([2011, 0, 2]).format('DDDo'), '2a', '2a');
    equal(moment([2011, 0, 3]).format('DDDo'), '3e', '3e');
    equal(moment([2011, 0, 4]).format('DDDo'), '4e', '4e');
    equal(moment([2011, 0, 5]).format('DDDo'), '5e', '5e');
    equal(moment([2011, 0, 6]).format('DDDo'), '6e', '6e');
    equal(moment([2011, 0, 7]).format('DDDo'), '7e', '7e');
    equal(moment([2011, 0, 8]).format('DDDo'), '8e', '8e');
    equal(moment([2011, 0, 9]).format('DDDo'), '9e', '9e');
    equal(moment([2011, 0, 10]).format('DDDo'), '10e', '10e');

    equal(moment([2011, 0, 11]).format('DDDo'), '11e', '11e');
    equal(moment([2011, 0, 12]).format('DDDo'), '12e', '12e');
    equal(moment([2011, 0, 13]).format('DDDo'), '13e', '13e');
    equal(moment([2011, 0, 14]).format('DDDo'), '14e', '14e');
    equal(moment([2011, 0, 15]).format('DDDo'), '15e', '15e');
    equal(moment([2011, 0, 16]).format('DDDo'), '16e', '16e');
    equal(moment([2011, 0, 17]).format('DDDo'), '17e', '17e');
    equal(moment([2011, 0, 18]).format('DDDo'), '18e', '18e');
    equal(moment([2011, 0, 19]).format('DDDo'), '19e', '19e');
    equal(moment([2011, 0, 20]).format('DDDo'), '20e', '20e');

    equal(moment([2011, 0, 21]).format('DDDo'), '21a', '21a');
    equal(moment([2011, 0, 22]).format('DDDo'), '22a', '22a');
    equal(moment([2011, 0, 23]).format('DDDo'), '23e', '23e');
    equal(moment([2011, 0, 24]).format('DDDo'), '24e', '24e');
    equal(moment([2011, 0, 25]).format('DDDo'), '25e', '25e');
    equal(moment([2011, 0, 26]).format('DDDo'), '26e', '26e');
    equal(moment([2011, 0, 27]).format('DDDo'), '27e', '27e');
    equal(moment([2011, 0, 28]).format('DDDo'), '28e', '28e');
    equal(moment([2011, 0, 29]).format('DDDo'), '29e', '29e');
    equal(moment([2011, 0, 30]).format('DDDo'), '30e', '30e');

    equal(moment([2011, 0, 31]).format('DDDo'), '31a', '31a');
});

test("format month", 12, function() {
    moment.lang('sv');
	var expected = 'januari jan_februari feb_mars mar_april apr_maj maj_juni jun_juli jul_augusti aug_september sep_oktober okt_november nov_december dec'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, i, 0]).format('MMMM MMM'), expected[i], expected[i]);
    }
});

test("format week", 7, function() {
    moment.lang('sv');
    var expected = 'söndag sön_måndag mån_tisdag tis_onsdag ons_torsdag tor_fredag fre_lördag lör'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, 0, 2 + i]).format('dddd ddd'), expected[i], expected[i]);
    }
});

test("from", 30, function() {
    moment.lang('sv');
    var start = moment([2007, 1, 28]);
    equal(start.from(moment([2007, 1, 28]).add({s:44}), true),  "några sekunder", "44 sekunder = a few seconds");
    equal(start.from(moment([2007, 1, 28]).add({s:45}), true),  "en minut",      "45 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:89}), true),  "en minut",      "89 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:90}), true),  "2 minuter",     "90 seconds = 2 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:44}), true),  "44 minuter",    "44 minutes = 44 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:45}), true),  "en timme",       "45 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:89}), true),  "en timme",       "89 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:90}), true),  "2 timmar",       "90 minutes = 2 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:5}), true),   "5 timmar",       "5 hours = 5 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:21}), true),  "21 timmar",      "21 hours = 21 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:22}), true),  "en dag",         "22 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:35}), true),  "en dag",         "35 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:36}), true),  "2 dagar",        "36 hours = 2 days");
    equal(start.from(moment([2007, 1, 28]).add({d:1}), true),   "en dag",         "1 day = a day");
    equal(start.from(moment([2007, 1, 28]).add({d:5}), true),   "5 dagar",        "5 days = 5 days");
    equal(start.from(moment([2007, 1, 28]).add({d:25}), true),  "25 dagar",       "25 days = 25 days");
    equal(start.from(moment([2007, 1, 28]).add({d:26}), true),  "en månad",       "26 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:30}), true),  "en månad",       "30 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:45}), true),  "en månad",       "45 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:46}), true),  "2 månader",      "46 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:74}), true),  "2 månader",      "75 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:76}), true),  "3 månader",      "76 days = 3 months");
    equal(start.from(moment([2007, 1, 28]).add({M:1}), true),   "en månad",       "1 month = a month");
    equal(start.from(moment([2007, 1, 28]).add({M:5}), true),   "5 månader",      "5 months = 5 months");
    equal(start.from(moment([2007, 1, 28]).add({d:344}), true), "11 månader",     "344 days = 11 months");
    equal(start.from(moment([2007, 1, 28]).add({d:345}), true), "ett år",        "345 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:547}), true), "ett år",        "547 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:548}), true), "2 år",       "548 days = 2 years");
    equal(start.from(moment([2007, 1, 28]).add({y:1}), true),   "ett år",        "1 year = a year");
    equal(start.from(moment([2007, 1, 28]).add({y:5}), true),   "5 år",       "5 years = 5 years");
});

test("suffix", 2, function() {
    moment.lang('sv');
    equal(moment(30000).from(0), "om några sekunder",  "prefix");
    equal(moment(0).from(30000), "för några sekunder sen", "suffix");
});


test("now from now", 1, function() {
    moment.lang('sv');
    equal(moment().fromNow(), "för några sekunder sen",  "now from now should display as in the past");
});


test("fromNow", 2, function() {
    moment.lang('sv');
    equal(moment().add({s:30}).fromNow(), "om några sekunder", "in a few seconds");
    equal(moment().add({d:5}).fromNow(), "om 5 dagar", "in 5 days");
});

test("calendar day", 6, function() {
    moment.lang('sv');

    var a = moment().hours(2).minutes(0).seconds(0);

    equal(moment(a).calendar(),                     "Idag klockan 02:00",     "today at the same time");
    equal(moment(a).add({ m: 25 }).calendar(),      "Idag klockan 02:25",     "Now plus 25 min");
    equal(moment(a).add({ h: 1 }).calendar(),       "Idag klockan 03:00",     "Now plus 1 hour");
    equal(moment(a).add({ d: 1 }).calendar(),       "Imorgon klockan 02:00",  "tomorrow at the same time");
    equal(moment(a).subtract({ h: 1 }).calendar(),  "Idag klockan 01:00",     "Now minus 1 hour");
    equal(moment(a).subtract({ d: 1 }).calendar(),  "Igår klockan 02:00",     "yesterday at the same time");
});

test("calendar next week", 15, function() {
    moment.lang('sv');

    var i;
    var m;

    for (i = 2; i < 7; i++) {
        m = moment().add({ d: i });
        equal(m.calendar(),       m.format('dddd [klockan] LT'),  "Today + " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('dddd [klockan] LT'),  "Today + " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('dddd [klockan] LT'),  "Today + " + i + " days end of day");
    }
});

test("calendar last week", 15, function() {
    moment.lang('sv');

    for (i = 2; i < 7; i++) {
        m = moment().subtract({ d: i });
        equal(m.calendar(),       m.format('[Förra] dddd [en klockan] LT'),  "Today - " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('[Förra] dddd [en klockan] LT'),  "Today - " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('[Förra] dddd [en klockan] LT'),  "Today - " + i + " days end of day");
    }
});

test("calendar all else", 4, function() {
    moment.lang('sv');
    var weeksAgo = moment().subtract({ w: 1 });
    var weeksFromNow = moment().add({ w: 1 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "1 week ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 1 week");

    weeksAgo = moment().subtract({ w: 2 });
    weeksFromNow = moment().add({ w: 2 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "2 weeks ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 2 weeks");
});
/**************************************************
  Turkish
 *************************************************/

module("lang:tr");

test("parse", 96, function() {
    moment.lang('tr');
    var tests = 'Ocak Oca_Şubat Şub_Mart Mar_Nisan Nis_Mayıs May_Haziran Haz_Temmuz Tem_Ağustos Ağu_Eylül Eyl_Ekim Eki_Kasım Kas_Aralık Ara'.split("_");
    var i;
    function equalTest(input, mmm, i) {
        equal(moment(input, mmm).month(), i, input + ' should be month ' + (i + 1));
    }
    for (i = 0; i < 12; i++) {
        tests[i] = tests[i].split(' ');
        equalTest(tests[i][0], 'MMM', i);
        equalTest(tests[i][1], 'MMM', i);
        equalTest(tests[i][0], 'MMMM', i);
        equalTest(tests[i][1], 'MMMM', i);
        equalTest(tests[i][0].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleLowerCase(), 'MMMM', i);
        equalTest(tests[i][0].toLocaleUpperCase(), 'MMMM', i);
        equalTest(tests[i][1].toLocaleUpperCase(), 'MMMM', i);
    }
});

test("format", 18, function() {
    moment.lang('tr');
    var a = [
            ['dddd, MMMM Do YYYY, h:mm:ss a',      'Pazar, Şubat 14th 2010, 3:25:50 pm'],
            ['ddd, hA',                            'Paz, 3PM'],
            ['M Mo MM MMMM MMM',                   '2 2nd 02 Şubat Şub'],
            ['YYYY YY',                            '2010 10'],
            ['D Do DD',                            '14 14th 14'],
            ['d do dddd ddd',                      '0 0th Pazar Paz'],
            ['DDD DDDo DDDD',                      '45 45th 045'],
            ['w wo ww',                            '8 8th 08'],
            ['h hh',                               '3 03'],
            ['H HH',                               '15 15'],
            ['m mm',                               '25 25'],
            ['s ss',                               '50 50'],
            ['a A',                                'pm PM'],
            ['t\\he DDDo \\d\\ay of t\\he ye\\ar', 'the 45th day of the year'],
            ['L',                                  '14.02.2010'],
            ['LL',                                 '14 Şubat 2010'],
            ['LLL',                                '14 Şubat 2010 15:25'],
            ['LLLL',                               'Pazar, 14 Şubat 2010 15:25']
        ],
        b = moment(new Date(2010, 1, 14, 15, 25, 50, 125)),
        i;
    for (i = 0; i < a.length; i++) {
        equal(b.format(a[i][0]), a[i][1], a[i][0] + ' ---> ' + a[i][1]);
    }
});

test("format ordinal", 31, function() {
    moment.lang('tr');
    equal(moment([2011, 0, 1]).format('DDDo'), '1st', '1st');
    equal(moment([2011, 0, 2]).format('DDDo'), '2nd', '2nd');
    equal(moment([2011, 0, 3]).format('DDDo'), '3rd', '3rd');
    equal(moment([2011, 0, 4]).format('DDDo'), '4th', '4th');
    equal(moment([2011, 0, 5]).format('DDDo'), '5th', '5th');
    equal(moment([2011, 0, 6]).format('DDDo'), '6th', '6th');
    equal(moment([2011, 0, 7]).format('DDDo'), '7th', '7th');
    equal(moment([2011, 0, 8]).format('DDDo'), '8th', '8th');
    equal(moment([2011, 0, 9]).format('DDDo'), '9th', '9th');
    equal(moment([2011, 0, 10]).format('DDDo'), '10th', '10th');

    equal(moment([2011, 0, 11]).format('DDDo'), '11th', '11th');
    equal(moment([2011, 0, 12]).format('DDDo'), '12th', '12th');
    equal(moment([2011, 0, 13]).format('DDDo'), '13th', '13th');
    equal(moment([2011, 0, 14]).format('DDDo'), '14th', '14th');
    equal(moment([2011, 0, 15]).format('DDDo'), '15th', '15th');
    equal(moment([2011, 0, 16]).format('DDDo'), '16th', '16th');
    equal(moment([2011, 0, 17]).format('DDDo'), '17th', '17th');
    equal(moment([2011, 0, 18]).format('DDDo'), '18th', '18th');
    equal(moment([2011, 0, 19]).format('DDDo'), '19th', '19th');
    equal(moment([2011, 0, 20]).format('DDDo'), '20th', '20th');

    equal(moment([2011, 0, 21]).format('DDDo'), '21st', '21st');
    equal(moment([2011, 0, 22]).format('DDDo'), '22nd', '22nd');
    equal(moment([2011, 0, 23]).format('DDDo'), '23rd', '23rd');
    equal(moment([2011, 0, 24]).format('DDDo'), '24th', '24th');
    equal(moment([2011, 0, 25]).format('DDDo'), '25th', '25th');
    equal(moment([2011, 0, 26]).format('DDDo'), '26th', '26th');
    equal(moment([2011, 0, 27]).format('DDDo'), '27th', '27th');
    equal(moment([2011, 0, 28]).format('DDDo'), '28th', '28th');
    equal(moment([2011, 0, 29]).format('DDDo'), '29th', '29th');
    equal(moment([2011, 0, 30]).format('DDDo'), '30th', '30th');

    equal(moment([2011, 0, 31]).format('DDDo'), '31st', '31st');
});

test("format month", 12, function() {
    moment.lang('tr');
    var expected = 'Ocak Oca_Şubat Şub_Mart Mar_Nisan Nis_Mayıs May_Haziran Haz_Temmuz Tem_Ağustos Ağu_Eylül Eyl_Ekim Eki_Kasım Kas_Aralık Ara'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, i, 0]).format('MMMM MMM'), expected[i], expected[i]);
    }
});

test("format week", 7, function() {
    moment.lang('tr');
    var expected = 'Pazar Paz_Pazartesi Pts_Salı Sal_Çarşamba Çar_Perşembe Per_Cuma Cum_Cumartesi Cts'.split("_");
    var i;
    for (i = 0; i < expected.length; i++) {
        equal(moment([2011, 0, 2 + i]).format('dddd ddd'), expected[i], expected[i]);
    }
});

test("from", 30, function() {
    moment.lang('tr');
    var start = moment([2007, 1, 28]);
    equal(start.from(moment([2007, 1, 28]).add({s:44}), true),  "birkaç saniye", "44 seconds = a few seconds");
    equal(start.from(moment([2007, 1, 28]).add({s:45}), true),  "bir dakika",      "45 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:89}), true),  "bir dakika",      "89 seconds = a minute");
    equal(start.from(moment([2007, 1, 28]).add({s:90}), true),  "2 dakika",     "90 seconds = 2 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:44}), true),  "44 dakika",    "44 minutes = 44 minutes");
    equal(start.from(moment([2007, 1, 28]).add({m:45}), true),  "bir saat",       "45 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:89}), true),  "bir saat",       "89 minutes = an hour");
    equal(start.from(moment([2007, 1, 28]).add({m:90}), true),  "2 saat",       "90 minutes = 2 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:5}), true),   "5 saat",       "5 hours = 5 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:21}), true),  "21 saat",      "21 hours = 21 hours");
    equal(start.from(moment([2007, 1, 28]).add({h:22}), true),  "bir gün",         "22 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:35}), true),  "bir gün",         "35 hours = a day");
    equal(start.from(moment([2007, 1, 28]).add({h:36}), true),  "2 gün",        "36 hours = 2 days");
    equal(start.from(moment([2007, 1, 28]).add({d:1}), true),   "bir gün",         "1 day = a day");
    equal(start.from(moment([2007, 1, 28]).add({d:5}), true),   "5 gün",        "5 days = 5 days");
    equal(start.from(moment([2007, 1, 28]).add({d:25}), true),  "25 gün",       "25 days = 25 days");
    equal(start.from(moment([2007, 1, 28]).add({d:26}), true),  "bir ay",       "26 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:30}), true),  "bir ay",       "30 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:45}), true),  "bir ay",       "45 days = a month");
    equal(start.from(moment([2007, 1, 28]).add({d:46}), true),  "2 ay",      "46 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:74}), true),  "2 ay",      "75 days = 2 months");
    equal(start.from(moment([2007, 1, 28]).add({d:76}), true),  "3 ay",      "76 days = 3 months");
    equal(start.from(moment([2007, 1, 28]).add({M:1}), true),   "bir ay",       "1 month = a month");
    equal(start.from(moment([2007, 1, 28]).add({M:5}), true),   "5 ay",      "5 months = 5 months");
    equal(start.from(moment([2007, 1, 28]).add({d:344}), true), "11 ay",     "344 days = 11 months");
    equal(start.from(moment([2007, 1, 28]).add({d:345}), true), "bir yıl",        "345 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:547}), true), "bir yıl",        "547 days = a year");
    equal(start.from(moment([2007, 1, 28]).add({d:548}), true), "2 yıl",       "548 days = 2 years");
    equal(start.from(moment([2007, 1, 28]).add({y:1}), true),   "bir yıl",        "1 year = a year");
    equal(start.from(moment([2007, 1, 28]).add({y:5}), true),   "5 yıl",       "5 years = 5 years");
});

test("suffix", 2, function() {
    moment.lang('tr');
    equal(moment(30000).from(0), "birkaç saniye sonra",  "prefix");
    equal(moment(0).from(30000), "birkaç saniye önce", "suffix");
});


test("now from now", 1, function() {
    moment.lang('tr');
    equal(moment().fromNow(), "birkaç saniye önce",  "now from now should display as in the past");
});


test("fromNow", 2, function() {
    moment.lang('tr');
    equal(moment().add({s:30}).fromNow(), "birkaç saniye sonra", "in a few seconds");
    equal(moment().add({d:5}).fromNow(), "5 gün sonra", "in 5 days");
});


test("calendar day", 6, function() {
    moment.lang('tr');

    var a = moment().hours(2).minutes(0).seconds(0);

    equal(moment(a).calendar(),                     "bugün saat 02:00",     "today at the same time");
    equal(moment(a).add({ m: 25 }).calendar(),      "bugün saat 02:25",     "Now plus 25 min");
    equal(moment(a).add({ h: 1 }).calendar(),       "bugün saat 03:00",     "Now plus 1 hour");
    equal(moment(a).add({ d: 1 }).calendar(),       "yarın saat 02:00",  "tomorrow at the same time");
    equal(moment(a).subtract({ h: 1 }).calendar(),  "bugün saat 01:00",     "Now minus 1 hour");
    equal(moment(a).subtract({ d: 1 }).calendar(),  "dün 02:00", "yesterday at the same time");
});

test("calendar next week", 15, function() {
    moment.lang('tr');

    var i;
    var m;

    for (i = 2; i < 7; i++) {
        m = moment().add({ d: i });
        equal(m.calendar(),       m.format('[haftaya] dddd [saat] LT'),  "Today + " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('[haftaya] dddd [saat] LT'),  "Today + " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('[haftaya] dddd [saat] LT'),  "Today + " + i + " days end of day");
    }
});

test("calendar last week", 15, function() {
    moment.lang('tr');

    for (i = 2; i < 7; i++) {
        m = moment().subtract({ d: i });
        equal(m.calendar(),       m.format('[geçen hafta] dddd [saat] LT'),  "Today - " + i + " days current time");
        m.hours(0).minutes(0).seconds(0).milliseconds(0);
        equal(m.calendar(),       m.format('[geçen hafta] dddd [saat] LT'),  "Today - " + i + " days beginning of day");
        m.hours(23).minutes(59).seconds(59).milliseconds(999);
        equal(m.calendar(),       m.format('[geçen hafta] dddd [saat] LT'),  "Today - " + i + " days end of day");
    }
});

test("calendar all else", 4, function() {
    moment.lang('tr');
    var weeksAgo = moment().subtract({ w: 1 });
    var weeksFromNow = moment().add({ w: 1 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "1 week ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 1 week");

    weeksAgo = moment().subtract({ w: 2 });
    weeksFromNow = moment().add({ w: 2 });
    
    equal(weeksAgo.calendar(),       weeksAgo.format('L'),  "2 weeks ago");
    equal(weeksFromNow.calendar(),   weeksFromNow.format('L'),  "in 2 weeks");
});