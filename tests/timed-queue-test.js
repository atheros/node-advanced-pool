var assert     = require('assert');
var advancedPool = require('..');


describe('Pool', function () {
	describe('fifo', function () {
		it('queue order', function () {
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
		});

		it('queue limit', function () {
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
		});
	});

	describe('timeouts', function () {
		it('10 clients should timeout', function (done) {
			var queue = new advancedPool.TimedQueue({
				defaultTimeout: 10,
				checkInterval: 10
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
				assert.notEqual(checkLoops, 0, "Waiting for client timeout timed out!" + "[" + checkLoops + "]");
				assert.equal(queue.size(), 0);
				assert.equal(pending, 0);
				queue.close();
				done();
			}, 50);
		});

		it('10 clients should timeout, 10 clients shouldn\'t', function (done) {
			var queue = new advancedPool.TimedQueue({
				defaultTimeout: 10,
				checkInterval: 10
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

				assert.notEqual(checkLoops, 0, "Waiting for client timeout timed out!" + "[" + checkLoops + "]");
				assert.equal(queue.size(), max);
				assert.equal(pending, max);
				queue.close();
				done();
			}, 50);
		});

		it('10 clients should timeout, 10 clients shouldn\'t, order of clients is mixed', function (done) {
			var queue = new advancedPool.TimedQueue({
				defaultTimeout: 10,
				checkInterval: 10
			});
			var fn;
			var max = 10;
			var max2 = 10;
			var pending = 0;

			for (var i = 0; i < max + max2; i++) {
				if (i % 2 == 0) {
					// even - timeout
					fn = function (err, obj) {
						pending--;
					};
					queue.push(fn);
				} else {
					// odd - don't timeout
					fn = function (err, obj) {
						pending--;
						throw new Error("Timed out a non timingout client");
					};
					queue.push(fn, 0);
				}
				pending++;
			}

			var checkLoops = 10;
			var ihandle = setInterval(function () {
				checkLoops--;
				if (checkLoops > 0 && pending > max) {
					// not ready yet, keep checking
					return;
				}
				clearInterval(ihandle);

				assert.notEqual(checkLoops, 0, "Waiting for client timeout timed out!" + "[" + checkLoops + "]");
				assert.equal(queue.size(), max);
				assert.equal(pending, max);
				queue.close();
				done();
			}, 50);
		});
	});
});
