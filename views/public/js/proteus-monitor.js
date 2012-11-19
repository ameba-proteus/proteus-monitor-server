/**
 * jQuery Tag Extension
 */
(function($) {
	
	$.tag = function(name) {
		var classes = null;
		if (name.indexOf('.') >= 0) {
			name = name.substring(0, name.indexOf('.'));
			classes = name.substring(name.indexOf('.')+1).split('.');
		}
		var element = $(document.createElement(name));
		if (classes) {
			element.addClass(classes.join(' '));
		}
		return element;
	};
	$.fn.tag = function(name, attrs) {
		var self = this;
		var elem = $.tag(name);
		if (attrs) {
			for (var n in attrs) {
				var v = attrs[n];
				elem.attr(n,v);
			}
		}
		return self.pushStack($.tag(name));
	};
	$.fn.gat = function() {
		var self = this;
		return self.end().append(self);
	};

})(jQuery); // function($)

var monitor = {};

(function() {

	function createWebSocket(parent) {
		var ws = new WebSocket('ws://'+location.host);
		ws.onopen = function() {
			console.log('socket open');
			// become watcher
			ws.send('watcher');
			// get hosts
			setTimeout(function() {
				parent.send('dstat', 'hosts');
			}, 0);
		};
		ws.onmessage = function(message) {
			//console.log('msg received', message.data);
			var data = JSON.parse(message.data);
			parent.handle(data.type, data.method, data.data);
		};
		ws.onclose = function() {
			console.log('socket closed. retrying to connect');
			// reconnecting
			setTimeout(function() {
				parent.ws = createWebSocket(parent);
			}, 5000);
		};
		return ws;
	}

	function MonitorSocket() {
		var self = this;
		self.ws = createWebSocket(this);
		self.handlers = {};
	}
	MonitorSocket.prototype.send = function(type, method, data) {
		var self = this;
		if (self.ws) {
			self.ws.send(JSON.stringify({
				type: type,
				method: method,
				data: data
			}));
		}
	};

	MonitorSocket.prototype.subscribe = function(name) {
		console.log('subscribing', name);
		this.send('common','subscribe', { name: name });
	};

	MonitorSocket.prototype.handle = function handle(type, method, data) {
		var self = this;
		var handler = this.handlers[type];
		if (handler) {
			var func = handler[method];
			if (func) {
				func.apply(self, data);
			}
		}
	};

	// register handler
	MonitorSocket.prototype.register(functions) {
		// copy handlers
		for (var name in functions) {
			this.handlers[name] = functions[name];
		}
	};

	monitor.MonitorSocket = MonitorSocket;

})();

