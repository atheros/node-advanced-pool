advanced-pool
=============

About
-----

advanced-pool provides a simple and generic ways to manage resource pools in NodeJS applications.

Unlike the other pool libraries I found, advanced-pool allows easy extension of both, the pool object as well as
the container managing the request queue.

Travis-CI status: [![Build Status](https://secure.travis-ci.org/atheros/node-advanced-pool.png)](http://travis-ci.org/atheros/node-advanced-pool)



Installation
------------

	npm install advanced-pool


Changes
-------

    0.3.3 - 24.07.2017:
        - Fixed bug: Support min pool size of 0 in constructor (thanks petrsloup).

    0.3.2 - 04.05.2016:
        - Fixed bug in object creation.

	0.3.1 - 23.07.2014:
		- Removed some old (and not existing) reference from testing code.

	0.3.0 - 23.07.2014:
		- Moved from Expresso to Mocha test framework.
		- Added acquireThunk() to work with co

	0.2.0 - 07.06.2014:
		- Reworked error handling.
		- Improved documentation.
		- Acquire callbacks are always called asynchronously.

	0.1.1 - 05.06.2014:
		- Added .gitignore removing some files fro NPM release.

	0.1.0 - 05.06.2014:
		- Added travis-ci and tests.
		- Added TimedQueue.
		- Added queue size limit.

	0.0.1 - 28.11.2012:
		- Initial release


Current state
-------------

This package was created to be used in one of my projects. I'll be fixing bugs and add improvements with time.

If you find any issues, please report them on GitHub: https://github.com/atheros/node-advanced-pool/issues


Selecting the appropriate queue class
-------------------------------------

Once pool resources runs out, following acquire requests are queued while waiting for resources to get
released or created. There are currently two queue classes: _SimpleQueue_ and _TimedQueue_.
Choosing the correct queue for your needs is very important.


### SimpleQueue

SimpleQueue offers only the basics. A FIFO queue with an optional size limit. This sort of queue is lightweight,
both in memory and CPU usage, but lacks some of the features needed in many applications.

This queue should be used in data processing applications, when clients waiting for resources are not interactive.
If resources stored within the pool can become unavailable (like database connections), clients requesting then
will hang forever. In such cases you should use TimedQueue.


### TimedQueue

TimedQueue implements a FIFO queue with timeout feature. This is very important for interactive application, where it is
better to display an error message if resource is not available than to hang for ever. So this is the queue to use to
pool resources like database connections and sockets in web applications.


Simple example
--------------

Example bellow demonstrates how to use the pool. It creates 10 workers trying to get access to limited resources.
Once all workers received their access to requested resource, the pool is closed.

	var advancedPool = require('advanced-pool');
	var resources = 0;
	var finished = 0;
	var count = 10;
	var pool = new advancedPool.Pool({
		min: 3,
		max: 4,
		create: function (callback) {
			// create the resource
			var resource = {name: "Resource #" + resources};
			console.log("created resource #" + resource.name);
			callback(null, resource);
			resources++;
		}
	});
	var i, fn;

	// create some resource requests
	for (i = 0; i < count; i++) {
		fn = function (err, resource) {
			if (err) {
				// something went wrong
				console.log(err);
			} else {
				// we got our resource!
				console.log("FN #" + this.id + " got resource: " + resource.name);
				setTimeout(function () {
					// release it after some time
					pool.release(resource);
					finished++;
				}, 10);
			}
		};
		// request resource
		// the bind part is there only to get an ID of the request and is optional
		pool.acquire(fn.bind({ id: i }));
	}

	// wait for all requests to complete
	var interval = setInterval(function () {
		if (finished == count) {
			console.log('All workers finished, closing pool');
			pool.close();
			clearInterval(interval);
		}
	}, 100);


Pool API
--------

### Exports

	var advancedPool = require('advanced-pool');

advanced-pool comes with 3 constructors:

	advancedPool.Pool(options)
	advancedPool.SimpleQueue(queueSize)
	advancedPool.TimedQueue(options)


### Pool(options)

Pool constructor.

Pool accepts a number of options in the _options_ argument:

* _name_ - Name of the pool, defaults to _pool_.
* _create_ - The object creator function, accepts a single argument, which is a callback function.
  The callback function takes two aguments, error and object. If error is set, it is assumed something when wrong,
  and object won't be added to the pool.
* _destroy_ - This function is called to destroy objects in the pool. It takes only one argument, the object.
  This function is optional.
* _queue_ - Queue object instance to use. If not specified, an instance of _SimpleQueue_ object will be created.
* _min_ - Minimum number of objects in the pool (default _2_).
* _max_ - Maximum number of objects in the pool (default _4_). It must be greater or equal than _min_.
* _idleTimeout_ - time in milliseconds for an idle object above _min_ to timeout (default _30000_)
* _idleCheckInterval_ - interval in milliseconds for checking for timedout objects (default _1000_)
* _log_ - logging accepts the following values:
	* _true_ - console.log will be used for logging (default)
	* _function_ - a function with 2 arguments, message and severity
	* _false_ and any other value - no logging

More information can be found in the source code.

Pool derives from EventEmitter and produce the following events:
* _create-error_ (errorMessage) - Called when object creation failed.
* _object-added_ (object) - Called when a new object is added to the pool.
* _object-error_ (object) - Object is considered bad, it will be removed (object-removed event will be called too).
* _object-removed_ (object, error) - Object was removed, if it was due to an error, error will be set to true, false if it was due to a timeout.
* _object-expired_ (object) - Object expired by idleTimeout when pool contained more objects than minimum - will be followed by object-removed event.
* _pool-closed_ - Called when the close() method is called.


**Arguments:**

* _options_ Pool options object


### Pool.acquire(client, queueOptions)

Acquire an object from the pool.

**Arguments:**

* _client_ is a function with two arguments, error and object. If _error_ argument is null, the _object_ argument will hold an object from the pool.
* _queueOptions_ should hold additional arguments for the queue, however _SimpleQueue_ doesn't require any arguments (optional).

An object received in _client_ callback should either be released with the _release()_ method or marked as bad
object with _removeBadObject()_ method.

Client can receive the following errors: (Error.name property)

- _TimeoutError_ when the request times out.
- _OverflowError_ when the request queue gets filled.
- _CloseError_ when the pool gets closed.

**Example:**

	pool.acquire(function (err, obj) {
		if (err) {
			console.log('Could not acquire object! ' + err);
		} else {
			// ...do something with the object
			pool.release(obj);
		}
	});

### Pool.acquireThunk(queueOptions)

Acquire an object from the pool using thunk.

**Arguments**
* _queueOptions_ should hold additional arguments for the queue, however _SimpleQueue_ doesn't require any arguments (optional).

The behavior of this method is similar to Pool.acquire() with different asynchronous model. This method works with co (https://github.com/visionmedia/co).

This method only works with ES6 generators. That means nodejs version 0.11.0 or newer is needed, called with --harmony or --harmony-generators switch.

**Example**

	co(function *() {
		db = yield pool.acquireThunk();
		yield db.insert({name: "Object"});
	})();

### Pool.release(object)

Release an object previously acquired with _acquire()_ method.

**Arguments:**

* _object_ the object to release


### Pool.removeBadObject(object)

Mark an object as bad and remove it from the pool.

This will only work for an object that is currently busy (acquired with the _acquire()_ method).

**Arguments:**

* _object_ the object to remove


**Example:**

	pool.acquire(function (err, obj) {
		if (err) {
			console.log('Could not acquire object! ' + err);
		} else {
			// ...do something with the object
			// ...something went wrong
			pool.removeBadObject(obj);
		}
	});

### Pool.adjustLimits(min, max)

Changes the limits of the pool.

If there is a need of creating additional objects right away, they will be created during this call.

If the limits lowered, resource objects will only be freed by the idleTimeout handler.

**Arguments:**

* _min_ - minimum number of objects in the pool
* _max_ - maximum number of objects in the pool


### Pool.close()

Close the pool.

This will remove all free objects, prevent the creation of new objects, send an error to all following and pending _acquire()_ calls.

The pool won't remove objects currently busy and will wait until they get released by _release()_ or _removeBadObject()_ calls.



### Queue: SimpleQueue(queueSize)

SimpleQueue implements the simplest queue (First-In, First-Out queue) to be used with advanced-pool. The only methods needed are push(), pop() and
size().

**Arguments:**
* _queueSize_ - the maximum size of the queue or 0 for unlimited


### Queue: TimedQueue(queueSize)

TimedQueue implements a FIFO queue (First-In, First-Out queue) with optional timeout.

When using TimedQueue, the second argument of Pool.acquire() can be the timeout of the client, 0 for no timeout
or null/undefined to use the default timeout.

**Arguments:**
* _options_ - the maximum size of the queue or 0 for unlimited

TimedQueue _options_:
* _defaultTimeout_ - Default time a client can be queued in milliseconds or 0 for no limit.
* _queueSize_ - Maximum queue size. 0 means there is no size limit.
* _checkInterval_ - How often should the timeouts be checked. By default it is 1/10 of default timeout or 1000ms if timeout is 0.


Queue API
---------

If none of the queue classes fits your need, you can implement your own.
Bellow is a description of the required interface.

### queue.push()

Push a client to the queue.

**Arguments:**

* _client_ - a callback function with two arguments, error and object.
* _queueParams_ - Queue parameters for this client. This is the second argument of Pool.acquire() call.

**Returns:** nothing


### queue.pop()

Returns the next client.

**Returns:** client callback function


### queue.size()

**Returns:** the number of clients in the queue


### queue.close()

This allows the queue to cleanup some internal state.
This method is called from Pool.close().



