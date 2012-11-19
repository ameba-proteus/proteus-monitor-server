
/**
 * subscribe the data
 */
exports.subscribe = function subscribe(data) {
	console.log('client', this.wsid, 'subscribing', data.name);
	if (this.subscribes) {
		this.subscribes[data.name] = true;
	}
};
