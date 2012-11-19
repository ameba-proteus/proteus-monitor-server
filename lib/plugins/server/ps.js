
var manager = require('../../server/manager');

exports.collect = function(data) {
	var ws = this;
	ws.ps = ws.ps || {};
	ws.ps.current = data;
	manager.broadcast('ps', 'update', {
		name: ws.hostname,
		data: data
	});
};
