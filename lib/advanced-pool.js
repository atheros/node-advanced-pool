var EventEmitter = require('events').EventEmitter,
	util = require('util'),
	Pool,
	SimpleQueue,
	TimedQueue,
	PriorityQueue;


/**
 * Simplest queue implementation for the pool object.
 *
 * @constructor
 */
SimpleQueue = function () {
	this.queue = [];
};

/**
 * Adds a new client to the queue.
 *
 * @param {Function} callback
 * @param params
 */
SimpleQueue.prototype.push = function (callback, params) {
	this.queue.push(callback);
};

/**
 * Returns the next client to serve.
 * @return {Function}
 */
SimpleQueue.prototype.pop = function () {
	if (this.queue.length) {
		return this.queue.shift();
	} else {
		return null;
	}
};

/**
 * Returns the number of clients in the queue.
 * @return {Number}
 */
SimpleQueue.prototype.size = function () {
	return this.queue.length;
};

/**
 * Advanced object pool.
 *
 * Pool options:
 * name - pool name
 * create - resource create function
 * destroy - resource destroy function
 * queue - the queue object to use (default instance of SimpleQueue)
 * min - minimum number of resources in the pool (default 2)
 * max - maximum number of resources in the pool (default 4)
 * idleTimeout - after how many milliseconds of idling a resource should be freed (default 30000)
 * idleCheckInterval - interval time in milliseconds to recheck for idle resources
 * log - false for no logging,
 *       true to log to console.log,
 *       function (message, severity) for external log.
 *
 *
 * Emitted events:
 * "create-error" (errorMessage) - called when object creation failed
 * "create-success" (object) - called when a new object is created, before it's added to the pool
 * "object-added" (object) - called when a new object is added to the pool
 * "object-error" (object) - object is considered bad, it will be removed (object-removed event will be called too)
 * "object-removed" (object, error) - object was removed, if it was due to an error, error will be set to true, false if it was due to timeout
 * "object-expired" (object) - object expired by idleTimeout when pool contained more objects than minimum - will be followd by object-removed
 * "pool-closed" - called when the close() method is called
 *
 *
 * @param {Object} options
 * @constructor
 */
Pool = function (options) {
	EventEmitter.call(this, options);

	if (typeof options !== 'object') {
		throw new Error('Pool expects an object as it\'s first argument');
	}

	this.priv = {
		// all objects in the pool
		allObjects: [],
		// objects ready
		freeObjects: [],
		// objects busy
		busyObjects: [],
		// pool name
		name: options.name || 'pool',
		// minimum number of objects in the pool
		min: options.min || 2,
		// maximum number of objects in the pool
		max: options.max || 4,
		// how many objects are in the process of being created right now
		pendingCreateCount: 0,
		// create function
		create: options.create,
		// destroy function
		destroy: options.destroy || function (object) {},
		// free objects above `min` will be destroyed after idleTimeout
		idleTimeout: options.idleTimeout || 30000,
		// idle check interval
		idleCheckInterval: options.idleCheckInterval || 1000,
		// interval handle
		idleCheckHandle: null,
		// queue object
		queue: options.queue || new SimpleQueue(),
		// log
		log: null,
		// when closed, all new requests will produce errors
		closed: false
	};

	if (options.log === true) {
		this.priv.log = function (message, severity) {
			console.log('[' + severity + '] ' + this.name + ': ' + message);
		};
	} else if (typeof options.log === 'function') {
		this.priv.log = options.log;
	} else {
		this.priv.log = function () {};
	}

	this.priv.idleCheckHandle = setInterval(this.idleCheckFunction.bind(this), this.idleCheckInterval);

	this.ensureMinimum();
};

util.inherits(Pool, EventEmitter);

/**
 * Create an object for the pool.
 *
 * You don't need to call this function.
 */
Pool.prototype.createObject = function () {
	var self = this;
	this.priv.pendingCreateCount += 1;
	this.priv.create(function (err, object) {
		self.priv.pendingCreateCount -= 1;
		if (err) {
			self.emit('create-error', err);
			self.priv.log('Error creating object: ' + err, 'error');
		} else {
			self.emit('create-success', object);
			self.addObjectToPool(object);
		}
	});
};

/**
 * Add a new object to pool.
 *
 * You don't need to call this function.
 *
 * @param {Object} object
 */
Pool.prototype.addObjectToPool = function (object) {
	this.emit('object-added', object);
	this.priv.allObjects.push(object);
	this.priv.freeObjects.push([object, (new Date()).getTime() + this.priv.idleTimeout]);

	this.feedClientFromQueue();
};

/**
 * Feed a client from the queue with a free object (if available).
 *
 * You don't need to call this function.
 */
Pool.prototype.feedClientFromQueue = function () {
	var client, objectInfo;
	if (this.priv.freeObjects.length === 0) {
		// no free objects
		return;
	} else if (this.priv.queue.size() === 0) {
		// queue empty
		return;
	}

	client = this.priv.queue.pop();
	objectInfo = this.priv.freeObjects.shift();
	this.priv.busyObjects.push(objectInfo[0]);
	client(null, objectInfo[0]);
};

/**
 * This function removes all free resource objects above the minimum required that have timeout.
 *
 * You don't need to call this function.
 */
Pool.prototype.idleCheckFunction = function () {
	var time, objectInfo, pos, count;

	if (this.priv.allObjects.length + this.priv.pendingCreateCount > this.priv.min) {
		time = (new Date()).getTime();
		// this.priv.min is used, so we have the min always ready for new requests!
		while (this.priv.freeObjects.length > this.priv.min && this.priv.freeObjects[0][1] < time) {
//			this.priv.log('will remove timed out object', 'info');
			objectInfo = this.priv.freeObjects.shift();
			this.emit('object-expired', objectInfo[0]);
			pos = this.priv.allObjects.indexOf(objectInfo[0]);
			this.priv.allObjects.splice(pos, 1);
			this.priv.destroy(object);
			this.emit('object-removed', objectInfo[0]);
		}
	}
};

/**
 * Acquire a resource object from the pool.
 *
 * The client param is a function accepting two arguments:
 * 1. error - an error message if something went wrong or null otherwise
 * 2. object - the resource object
 *
 * The object you receive must be returned to the pool using release() method.
 * If the object produce error and you consider it to be broken (like database disconnected), instead of calling
 * release() method, call removeBadObject. This will remove that specific instance from the pool.
 *
 * The default queue object (SimpleQueue) doesn't accept any argument. All queue objects make the queueParam optional.
 *
 * @param {Function} client
 * @param queueParam parameter for the queue object
 */
Pool.prototype.acquire = function (client, queueParam) {
	var objectInfo;

	if (this.priv.closed) {
		client('Pool is being closed now', null);
		return;
	}


	if (this.priv.freeObjects.length === 0) {
		this.priv.queue.push(client, queueParam);
		this.addObjectsIfNeeded();
	} else {
		objectInfo = this.priv.freeObjects.shift();
		this.priv.busyObjects.push(objectInfo[0]);
		client(null, objectInfo[0]);
	}
};

/**
 * Release an object you got from a call to acquire().
 *
 * @param {Object} object
 */
Pool.prototype.release = function (object) {
	var pos = this.priv.busyObjects.indexOf(object),
		pos2;

	if (pos >= 0) {
		this.priv.busyObjects.splice(pos, 1);
		if (this.priv.closed) {
			pos2 = this.priv.allObjects.indexOf(object);
			this.priv.allObjects.splice(pos2, 1);
			this.priv.destroy(object);
			this.emit('object-removed', object);
		} else {
			this.priv.freeObjects.push([object, (new Date()).getTime() + this.priv.idleTimeout]);
			this.feedClientFromQueue();
		}
	} else {
		this.priv.log('released object not found in busy list', 'warn');
	}
};

/**
 * The object got from acquire produced an error and is considered bad and needs to be removed.
 * @param {Object} object
 */
Pool.prototype.removeBadObject = function (object) {
	var pos1 = this.priv.allObjects.indexOf(object),
		pos2 = this.priv.busyObjects.indexOf(object);

	if (pos1 >= 0 && pos2 >= 0) {
		this.emit('object-error', object);
		this.priv.allObjects.splice(pos1, 1);
		this.priv.busyObjects.splice(pos2, 1);
		this.priv.destroy(object);
		this.emit('object-removed', object);
	}

	this.addObjectsIfNeeded();
};

/**
 * Make sure there is at least minimum objects in the pool.
 *
 * You don't need to call this function.
 */
Pool.prototype.ensureMinimum = function () {
	var count = this.priv.min - this.priv.allObjects.length + this.priv.pendingCreateCount;
	while (count > 0) {
		count--;
		this.createObject();
	}
};

/**
 * Add additional resource objects if needed.
 *
 * Objects are needed when:
 * 1. there isn't enough of minimum objects
 * 2. there are clients pending and there is less objects than the maximum specified
 *
 * You don't need to call this function.
 */
Pool.prototype.addObjectsIfNeeded = function () {
	while (this.priv.queue.size() > 0 && this.priv.allObjects.length + this.priv.pendingCreateCount < this.priv.max) {
		this.createObject();
	}

	this.ensureMinimum();
};

/**
 * Close the pool.
 *
 * This will remove all free objects, prevent the creation of new objects, send an error to all following
 * and pending acquire() calls.
 *
 * The pool won't remove objects currently busy and will wait until they get released by release() or removeBadObject() calls.
 */
Pool.prototype.close = function () {
	var client, objectInfo, pos;

	if (this.priv.closed) {
		return;
	}

	this.priv.min = 0;
	this.priv.max = 0;

	this.priv.closed = true;

	this.emit('closed');

	while (this.priv.queue.size()) {
		client = this.priv.queue.pop();
		client('Pool is being closed now', null);
	}

	clearInterval(this.priv.idleCheckHandle);

	while (this.priv.freeObjects.length > 0) {
		objectInfo = this.priv.freeObjects.shift();
		pos = this.priv.allObjects.indexOf(objectInfo[0]);
		this.priv.allObjects.splice(pos, 1);
		this.priv.destroy(objectInfo[0]);
		this.emit('object-removed', objectInfo[0]);
	}

	// now only waiting for remaining objects to be released
};

/**
 * Adjust min and max number of resource objects.
 *
 * If there is a need of creating additional objects right away, they will be created during this call.
 * If the limits lowered, resource objects will only be freed by the idleTimout handler.
 *
 * @param {Number} min
 * @param {Number} max
 */
Pool.prototype.adjustLimits = function (min, max) {
	this.priv.min = min;
	this.priv.max = max;

	this.addObjectsIfNeeded();
};

// Export objects
module.exports = {
	Pool: Pool,
	SimpleQueue: SimpleQueue
	//TimedQueue: TimedQueue,
	//PriorityQueue: PriorityQueue
};