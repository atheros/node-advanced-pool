var assert = require('assert');
var advancedPool = require('..');


describe('SimpleQueue', function () {
	describe('fifo', function () {
		it('queue order', function () {
			var queue = new advancedPool.SimpleQueue();
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
			var queue = new advancedPool.SimpleQueue(10);
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
});
