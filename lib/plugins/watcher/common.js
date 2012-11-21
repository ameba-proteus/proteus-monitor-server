
var manager = require('../../server/manager');

/**
 * subscribe the data
 */
exports.subscribe = function subscribe(data) {
	console.log('client', this.wsid, 'subscribing', data.name);
	if (this.subscribes) {
		this.subscribes[data.name] = true;
	}
};

/**
 * get all hosts connecting to the server
 */
exports.hosts = function hosts() {

	var ws = this;
	var categories = manager.categories;
	var agents = manager.agents;
	
	var obj = {};
	for (var cname in categories) {
		var category = categories[cname];
		obj[cname] = {};
		for (var aname in category.agents) {
			var agent = category.agents[aname];
			obj[cname][agent.hostname] = {
				name: agent.hostname,
				address: agent.address
			};
		}
	}

	ws.json('common', 'hosts', obj); 
};

