var assert     = require('assert');
var advancedPool = require('..');

module.exports = {
	'check fifo': function (beforeExit) {
		var queue = new advancedPool.TimedQueue();
		var fn;
		var max = 10;

		for (var i = 0; i < max; i++) {
			fn = function (err, obj) {
				assert.equal(err, undefined);
			};
			fn.queueIndex = i;
			queue.push(fn);
		}

		for (var i = 0; i < max; i++) {
			fn = queue.pop();
			assert.equal(fn.queueIndex, i);
		}
		assert.equal(queue.size(), 0);
		queue.close();
	},

	'check queue limit': function (beforeExit) {
		var queue = new advancedPool.TimedQueue({
			queueSize: 10
		});

		var fn;
		var max = 10;
		var max2 = 10;

		// add first clients
		for (var i = 0; i < max; i++) {
			fn = function (err, obj) {
				assert.equal(err, undefined);
			};
			queue.push(fn);
		}

		// add too many clients
		for (var i = 0; i < max2; i++) {
			fn = function (err, obj) {
				assert.notEqual(err, undefined);
			};
			queue.push(fn);
		}

		// there should  be the maximum number of clients, not more, not less
		assert.equal(queue.size(), 10);
		for (var i = 0; i < max; i++) {
			fn = queue.pop();
		}
		assert.equal(queue.size(), 0);
		queue.close();
	},

	'check default timeout': function (beforeExit) {
		// 10 clients should timeout
		var queue = new advancedPool.TimedQueue({
			defaultTimeout: 10
		});
		var fn;
		var max = 10;
		var pending = 0;

		for (var i = 0; i < max; i++) {
			fn = function (err, obj) {
				pending--;
			};
			pending++;
			queue.push(fn);
		}

		var checkLoops = 10;
		var ihandle = setInterval(function () {
			checkLoops--;
			if (checkLoops > 0 && pending > 0) {
				// not ready yet, keep checking
				return;
			}
			clearInterval(ihandle);

			assert.notEqual(checkLoops, 0, "Waiting for client timeout timed out!");
			assert.equal(queue.size(), 0);
			assert.equal(pending, 0);
			queue.close();
		}, 50);
	},

	'check default timeout 2': function (beforeExit) {
		// 10 clients should timeout, 10 clients shouldn't
		var queue = new advancedPool.TimedQueue({
			defaultTimeout: 10
		});
		var fn;
		var max = 10;
		var max2 = 10;
		var pending = 0;

		for (var i = 0; i < max; i++) {
			fn = function (err, obj) {
				pending--;
			};
			pending++;
			queue.push(fn);
		}

		for (var i = 0; i < max; i++) {
			fn = function (err, obj) {
				pending--;
			};
			pending++;
			queue.push(fn, 0);
		}

		var checkLoops = 10;
		var ihandle = setInterval(function () {
			checkLoops--;
			if (checkLoops > 0 && pending > max) {
				// not ready yet, keep checking
				return;
			}
			clearInterval(ihandle);

			assert.notEqual(checkLoops, 0, "Waiting for client timeout timed out!");
			assert.equal(queue.size(), max);
			assert.equal(pending, max);
			queue.close();
		}, 50);
	}
};

