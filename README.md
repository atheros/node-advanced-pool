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


Current state
-------------

The current version is not proved to be working in any other way than the example in the tests/ directory.

This package was created to be used in one of my projects, so I'll be fixing bugs and add improvements with time.


API
---


### Exports

	var advancedPool = require('advanced-pool');

advanced-pool comes with 3 constructors:

	advancedPool.Pool(options)
	advancedPool.SimpleQueue(queueSize)
	advancedPool.TimedQueue(options)


### Pool(options)

Pool constructor.

Pool accepts a number of options in the _options_ argument:

* _name_ - name of the pool (default _pool_)
* _create_ - the object creator function, accepts a single argument, which is a callback function
  The callback function takes two aguments, error and object. If error is set, it is assumed something when wrong,
  and object won't be added to the pool.
* _destroy_ - this function is called to destroy objects in the pool. It takes only one argument, the object (optional)
* _min_ - minimum number of objects in the pool (default _2_)
* _max_ - maximum number of objects in the pool (default _4_)
* _idleTimeout_ - time in milliseconds for an idle object above _min_ to timeout (default _30000_)
* _idleCheckInterval_ - interval in milliseconds for checking for timedout objects (default _1000_)
* _log_ - logging accepts the following values:
	* _true_ - console.log will be used for logging (default)
	* _function_ - a function with 2 arguments, message and severity
	* _false_ and any other value - no logging

More information can be found in the source code.

**Arguments:**

* _options_ Pool options object


### Pool.acquire(client, queueOptions)

Acquire an object from the pool.

**Arguments:**

* _client_ is a function with two arguments, error and object. If _error_ argument is null, the _object_ argument will hold an object from the pool.
* _queueOptions_ should hold additional arguments for the queue, however _SimpleQueue_ doesn't require any arguments.

An object received in _client_ callback should either be released with the _release()_ method or marked as bad
object with _removeBadObject()_ method.


**Example:**

	pool.acquire(function (err, obj) {
		if (err) {
			console.log('Could not acquire object! ' + err);
		} else {
			// ...do something with the object
			pool.release(obj);
		}
	});


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

If the limits lowered, resource objects will only be freed by the idleTimout handler.

**Arguments:**

* _min_ - minimum number of objects in the pool
* _max_ - maximum number of objects in the pool


### Pool.close()

Close the pool.

This will remove all free objects, prevent the creation of new objects, send an error to all following and pending _acquire()_ calls.

The pool won't remove objects currently busy and will wait until they get released by _release()_ or _removeBadObject()_ calls.





### SimpleQueue(queueSize)

SimpleQueue implements the simplest queue (First-In, First-Out queue) to be used with advanced-pool. The only methods needed are push(), pop() and
size().

**Arguments:**
* _queueSize_ - the maximum size of the queue or 0 for unlimited


### SimpleQueue.push()

Pushes a client to the queue.

**Arguments:**

* _{function}_ _client_ - a callback function with two arguments, error and object.
* _queueParams_ - queue parameters for this client - SimpleQueue doesn't handle any parameters

**Returns:** nothing


### SimpleQueue.pop()

Returns the next client.

**Returns:** client callback function


### SimpleQueue.size()

**Returns:** the number of clients in the queue


### SimpleQueue.close()

This allows the queue to cleanup some internal state.
This method is called from Pool.close().





### TimedQueue(queueSize)

TimedQueue implements a FIFO queue (First-In, First-Out queue) with optional timeout.

**Arguments:**
* _options_ - the maximum size of the queue or 0 for unlimited

TimedQueue _options_:
* _defaultTimeout_ - Default time a client can be queued in milliseconds or 0 for no limit.
* _queueSize_ - Maximum queue size. 0 means there is no size limit.
* _checkInterval_ - How often should the timeouts be checked. By default it is 1/10 of default timeout or 1000ms if timeout is 0.


### TimedQueue.push()

Pushes a client to the queue.

**Arguments:**

* _{function}_ _client_ - a callback function with two arguments, error and object.
* _{Number}_ _timeout_ - queue parameters for this client - SimpleQueue doesn't handle any parameters

**Returns:** nothing


### TimedQueue.pop()

Returns the next client.

**Returns:** client callback function


### TimedQueue.size()

**Returns:** the number of clients in the queue


### TimedQueue.close()

This allows the queue to cleanup some internal state.
This method is called from Pool.close().

