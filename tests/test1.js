var apool = require('../');
var objRefIds = 0;
var objDestroyed = 0;
var workerRefIds = 0;
var workerFinished = 0;

var useRandom = true;
var workerCount = 200;

var pool = new apool.Pool({
	min: 2,
	max: 4,
	log: true,
	create: function (callback) {
		objRefIds++;
		callback(null, {id: objRefIds});
	},
	destroy: function (obj) {
		objDestroyed++;
		console.log('object #' + obj.id + ' destroyed, objects left: ' + (objRefIds - objDestroyed));
	}
});


function dumpState() {
	console.log(
		'pool status - all: ' + pool.priv.allObjects.length + ', free: ' + pool.priv.freeObjects.length + ', busy: ' + pool.priv.busyObjects.length + ', creating: ' + pool.priv.pendingCreateCount
	);
}


function createWorker() {
	workerRefIds++;
	var acquireAfter = Math.floor(Math.random() * 500) + 500;
	var releaseAfter = Math.floor(Math.random() * 200) + 100;

	var workerId = workerRefIds;

	if (!useRandom) {
		acquireAfter = 500;
		releaseAfter = 500;
	}

	console.log('Worker #' + workerId + ': request after ' + acquireAfter + 'ms, releasing after ' + releaseAfter + 'ms');
	setTimeout(function () {
		console.log('Worker #' + workerId + ': waiting for resource');
		pool.acquire(function (err, obj) {
			if (err) {
				console.log('Worker #' + workerId + ': error: ' + err);
				workerFinished++;
			} else {
				console.log('Worker #' + workerId + ': acquired resource #' + obj.id);
				setTimeout(function () {
					if (Math.floor(Math.random() * 10) === 0) {
						// 1/10 resources are bad, just for the fun!
						console.log('Worker #' + workerId + ': decided that #' + obj.id + ' is bad, removing it!');
						pool.removeBadObject(obj);
					} else {
						console.log('Worker #' + workerId + ': releasing resource #' + obj.id);
						pool.release(obj);
					}
					workerFinished++;
				}, releaseAfter);
			}
		});
	}, acquireAfter);
}

var cleanupInterval = setInterval(function () {
	if (workerFinished === workerRefIds) {
		console.log('ALL WORKERS FINISHED');
		console.log('Closing pool');
		pool.close();
		clearInterval(cleanupInterval);
	} else {
		console.log('worker status - all: ' + workerRefIds + ', finished: ' + workerFinished);
		dumpState();
	}
}, 1000);

dumpState();

for (var i = 0; i < workerCount; i++) {
	createWorker();
}

setTimeout(function () {
	console.log('New limits - min: 4, max: 8');
	pool.adjustLimits(4, 8);
}, 1000);

setTimeout(function () {
	console.log('Closing pool because 5sek run out');
	pool.close();
}, 5000);
