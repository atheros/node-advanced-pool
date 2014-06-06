
/**
 * Timed queue implementation for the pool object.
 *
 * Clients that wait in the queue longer than given timeout will get dropped.
 *
 * Queue can have a limited size. If it is filled, it will reject new clients with errors.
 * queueSize of 0 means there is no limit.
 *
 * When calling Pool.acquire(), the second argument should be the timeout in milliseconds.
 *
 * @param {Object} options Queue options.
 * @constructor
 *
 * Queue options:
 * defaultTimeout - Default time a client can be queued in milliseconds.
 * queueSize - Maximum queue size.
 * checkInterval - How often should the timeouts be checked. By default it is 1/10 of default timeout or 1000ms if timeout is 0.
 */
TimedQueue = function (options) {
	options = options || {};
	this.defaultTimeout = options.defaultTimeout || 0;
	this.queueSize = options.queueSize || 0;
	this.checkInterval = options.checkInterval;
	if (!options.checkInterval) {
		this.checkInterval = this.timeout ? math.floor(this.timeout / 10) : 1000;
	}
	this.queue = [];
	this.timeouts = [];

	this.timeoutHandle = null;
	this.closed = false;
};

/**
 * Start timeout check and clears the timeout handle.
 *
 * @private
 */
function startTimeoutCheck() {
	this.timeoutHandle = null;
	this.checkTimeouts();
}

/**
 * Register a timeout check.
 *
 * @private
 */
TimedQueue.prototype.registerTimeoutCheck = function () {
	if (!this.timeoutHandle && !this.closed) {
//		console.log("TimedQueue.registerTimeoutCheck()");
//		console.log((new Error()).stack);
		this.timeoutHandle = setTimeout(startTimeoutCheck.bind(this), this.checkInterval);
	}
};

/**
 * Stop timeout check.
 *
 * @private
 */
TimedQueue.prototype.stopTimeoutCheck = function () {
	if (this.timeoutHandle) {
//		console.log("TimedQueue.stopTimeoutCheck()");
//		console.log((new Error()).stack);
		clearTimeout(this.timeoutHandle);
		this.timeoutHandle = null;
	}
};

/**
 * Adds a new client to the queue.
 *
 * @param {Function} callback Client callback.
 * @param {Number} [timeout] Timeout in milliseconds
 */
TimedQueue.prototype.push = function (callback, timeout) {
	if (this.queueSize && this.queue.length >= this.queueSize) {
		// queue is full, reject
		process.nextTick(function () {
			var e = new Error("Pool queue is full");
			e.name = 'OverflowError';
			callback(e, null);
		});
	} else {
		// select timeout
		if (timeout) {
			// timeout in milliseconds given
			this.timeouts.push(timeout + (new Date()).getTime());
		} else if (timeout === 0) {
			// don't timeout this client
			this.timeouts.push(0);
		} else {
			// use default timeout
			this.timeouts.push(this.defaultTimeout);
		}
		// add client to queue
		this.queue.push(callback);

		// if there was no timeout check running, start it now
		if (!this.timeoutHandle) {
			this.registerTimeoutCheck();
		}
	}
};

/**
 * Returns the next client to serve.
 * @return {Function}
 */
TimedQueue.prototype.pop = function () {
	if (this.queue.length) {
		this.timeouts.shift();
		if (this.timeouts.length == 0) {
			// there are no more clients, stop the timeout check as it is unneeded.
			this.stopTimeoutCheck();
		}
		return this.queue.shift();
	} else {
		return null;
	}
};

/**
 * Returns the number of clients in the queue.
 * @return {Number}
 */
TimedQueue.prototype.size = function () {
	return this.queue.length;
};

/**
 * Close queue.
 */
TimedQueue.prototype.close = function () {
//	console.log("closed");
	this.stopTimeoutCheck();
	this.closed = true;
};


/**
 * Reject a client with a timeout error.
 *
 * @param {Function} client
 * @private
 */
function timeoutClient(client) {
	process.nextTick(function () {
		var e = new Error("Resource request timeout");
		e.name = "TimeoutError";
		client(e, null);
	});
}

/**
 * Check clients for timeout events.
 *
 * You don't need to call this funciton manually. It will be called from time to time automatically,
 * as configured in constructor.
 */
TimedQueue.prototype.checkTimeouts = function () {
	var i = 0;
	var len = this.queue.length;
	var time = (new Date()).getTime();
	var timeout;

//	console.log("TimedQueue.checkTimeouts()");
//	console.log((new Error()).stack);

	while (i < len) {
		timeout = this.timeouts[i];
		if (timeout && timeout < time) {
			// call client asynchronously with error
			timeoutClient(this.queue[i]);
			this.timeouts.splice(i, 1);
			this.queue.splice(i, 1);
			len--;
		} else {
			i++;
		}
	}

	if (len > 0) {
		// start an other loop if needed
		this.registerTimeoutCheck();
	}
};

module.exports = TimedQueue;
