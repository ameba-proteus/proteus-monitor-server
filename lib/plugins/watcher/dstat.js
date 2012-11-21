
var manager = require('../../server/manager');

exports.hosts = function host(vars) {
	var ws = this;

	var categories = manager.categories;
	var agents = manager.agents;

	var obj = {};
	for (var name in categories) {
		var category = categories[name];
		obj[name] = {};
		for (var aname in category.agents) {
			var agent = category.agents[aname];
			if (agent.dstat) {
				obj[name][aname] = {
					name: agent.hostname,
					address: agent.address,
					dstat: agent.dstat.current
				};
			}
		}
	}

	ws.json('dstat', 'hosts', obj); 
};
