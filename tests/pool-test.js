var assert     = require('assert');
var advancedPool = require('..');

module.exports = {
	'check1': function (beforeExit) {
		// check 10 clients with 1 object
		var fn;
		var maxClients = 10;
		var maxObjects = 1;
		var createdObjects = 0;
		var destroyedObjects = 0;
		var acquiredObjects = 0;
		var releasedObjects = 0;
		var pool = new advancedPool.Pool({
			name: "check1 pool",
			min: maxObjects,
			max: maxObjects,
			create: function (callback) {
				createdObjects++;
				callback(null, "object");
			},
			destroy: function (object) {
				assert.equal(object, "object");
				destroyedObjects++;
			}
		});

		for (var i = 0; i < maxClients; i++) {
			fn = function (err, obj) {
				acquiredObjects++;
				assert.equal(err, undefined);
				setTimeout(function () {
					releasedObjects++;
					pool.release(obj);
				}, 1);
			};
			pool.acquire(fn);
		}

		setTimeout(function () {
			assert.equal(acquiredObjects, maxClients);
			assert.equal(acquiredObjects, releasedObjects);
			pool.close();
			assert.equal(createdObjects, maxObjects);
			assert.equal(createdObjects, destroyedObjects);
		}, 500);
	},

	'check2': function (beforeExit) {
		// check 10 clients with 2 objects
		var fn;
		var maxClients = 10;
		var maxObjects = 2;
		var createdObjects = 0;
		var destroyedObjects = 0;
		var acquiredObjects = 0;
		var releasedObjects = 0;
		var pool = new advancedPool.Pool({
			name: "check1 pool",
			min: 1,
			max: maxObjects,
			create: function (callback) {
				createdObjects++;
				callback(null, "object");
			},
			destroy: function (object) {
				assert.equal(object, "object");
				destroyedObjects++;
			}
		});

		for (var i = 0; i < maxClients; i++) {
			fn = function (err, obj) {
				acquiredObjects++;
				assert.equal(err, undefined);
				setTimeout(function () {
					releasedObjects++;
					pool.release(obj);
				}, 1);
			};
			pool.acquire(fn);
		}

		setTimeout(function () {
			assert.equal(acquiredObjects, maxClients);
			assert.equal(acquiredObjects, releasedObjects);
			pool.close();
			assert.equal(createdObjects, maxObjects);
			assert.equal(createdObjects, destroyedObjects);
		}, 500);
	},

	'check3': function (beforeExit) {
		// check 3 clients with 3-6 objects
		var fn;
		var maxClients = 3;
		var maxObjects = 6;
		var minObjects = 3;
		var createdObjects = 0;
		var destroyedObjects = 0;
		var acquiredObjects = 0;
		var releasedObjects = 0;
		var pool = new advancedPool.Pool({
			name: "check1 pool",
			min: minObjects,
			max: maxObjects,
			create: function (callback) {
				createdObjects++;
				callback(null, "object");
			},
			destroy: function (object) {
				assert.equal(object, "object");
				destroyedObjects++;
			}
		});

		for (var i = 0; i < maxClients; i++) {
			fn = function (err, obj) {
				acquiredObjects++;
				assert.equal(err, undefined);
				setTimeout(function () {
					releasedObjects++;
					pool.release(obj);
				}, 1);
			};
			pool.acquire(fn);
		}

		setTimeout(function () {
			assert.equal(acquiredObjects, maxClients);
			assert.equal(acquiredObjects, releasedObjects);
			pool.close();
			assert.equal(createdObjects, minObjects);
			assert.equal(createdObjects, destroyedObjects);
		}, 500);
	},

	'check4': function (beforeExit) {
		// check 5 clients with 3-6 objects
		var fn;
		var maxClients = 5;
		var maxObjects = 6;
		var minObjects = 3;
		var createdObjects = 0;
		var destroyedObjects = 0;
		var acquiredObjects = 0;
		var releasedObjects = 0;
		var pool = new advancedPool.Pool({
			name: "check1 pool",
			min: minObjects,
			max: maxObjects,
			create: function (callback) {
				createdObjects++;
				callback(null, "object");
			},
			destroy: function (object) {
				assert.equal(object, "object");
				destroyedObjects++;
			}
		});

		for (var i = 0; i < maxClients; i++) {
			fn = function (err, obj) {
				acquiredObjects++;
				assert.equal(err, undefined);
				setTimeout(function () {
					releasedObjects++;
					pool.release(obj);
				}, 1);
			};
			pool.acquire(fn);
		}

		setTimeout(function () {
			assert.equal(acquiredObjects, maxClients);
			assert.equal(acquiredObjects, releasedObjects);
			pool.close();
			assert.equal(createdObjects, maxClients);
			assert.equal(createdObjects, destroyedObjects);
		}, 500);
	},
	'check close': function (beforeExit) {
		// make sure that:
		// - close triggers appropriate errors on clients
		// - released objects after close are destroyed
		var max = 5;
		var acquires = 0;
		var destroyed = false;
		var pool = new advancedPool.Pool({
			min: 1,
			max: 1,
			create: function (callback) {
				callback(null, {});
			},
			destroy: function (obj) {
				destroyed = true;
			}
		});

		for (var i = 0; i < max; i++) {
			pool.acquire(function (err, res) {
				if (err) {
					assert.equal(err.name, "CloseError");
				} else {
					if (acquires == 0) {
						acquires = 1;
						setTimeout(function () {
							pool.close();
							pool.release(res);
						}, 100);
					} else {
						throw new Error('Acquired object - unexpected condition');
					}
				}
			});
		}

		beforeExit(function () {
			assert.equal(destroyed, true, "Object left behind");
		})

	}
};
