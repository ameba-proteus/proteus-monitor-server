
var manager = require('../../server/manager');

exports.collect = function(data) {
	var ws = this;
	ws.dstat = ws.dstat || {};
	ws.dstat.current = data;
	// broadcast to watcher
	manager.broadcast('dstat', 'update', {
		name: ws.hostname,
		data: data
	});
};

