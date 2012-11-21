
var manager = require('../../server/manager');

exports.collect = function(data) {
	var ws = this;
	// broadcast to watcher
	manager.broadcast('stat', 'update', {
		name: ws.hostname,
		data: data
	});
};

