
var agents = {};
var watchers = {};
var categories = {};

function Category() {
	this.agents = {};
}

/**
 * broadcast message to all watchers
 */
function broadcast(type, method, msg) {
	var json = JSON.stringify({
		type: type,
		method: method,
		data: msg
	});
	for (var id in watchers) {
		var watcher = watchers[id];
		if (watcher.subscribes[type]) {
			watcher.send(json);
		}
	}
}

/**
 * get category instance
 */
function getCategory(code) {
	if (categories[code]) {
		return categories[code];
	}
	var category = new Category();
	categories[code] = category;
	return category;
}

exports.addAgent = function addAgent(ws) {
	ws.isAgent = true;
	agents[ws.wsid] = ws;
	var category = getCategory(ws.category);
	category.agents[ws.wsid] = ws;
};

exports.addWatcher = function addWatcher(ws) {
	ws.isWatcher = true;
	ws.subscribes = {};
	watchers[ws.wsid] = ws;
};

function removeAgent(ws) {
	delete agents[ws.wsid];
	var category = getCategory(ws.category);
	delete category.agents[ws.wsid];
};

function removeWatcher(ws) {
	delete watchers[ws.wsid];
};

exports.removeClient = function removeClient(ws) {
	if (ws.isAgent) {
		removeAgent(ws);
	}
	if (ws.isWatcher) {
		removeWatcher(ws);
	}
}

exports.broadcast = broadcast;
exports.agents = agents;
exports.watchers = watchers;
exports.categories = categories;
