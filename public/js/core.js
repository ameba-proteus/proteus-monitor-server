/**
 * jQuery Tag Extension
 */
(function($) {
	
	$.tag = function(name, attrs) {
		var classes = null;
		if (name.indexOf('.') >= 0) {
			classes = name.substring(name.indexOf('.')+1).split('.');
			name = name.substring(0, name.indexOf('.'));
		}
		var element = $(document.createElement(name));
		if (classes) {
			element.addClass(classes.join(' '));
		}
		if (attrs) {
			for (var aname in attrs) {
				element.attr(aname, attrs[aname]);
			}
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
		return self.pushStack(elem);
	};
	$.fn.gat = function() {
		var self = this;
		return self.end().append(self);
	};

})(jQuery); // function($)

var monitor = {};
var color = {};

/**
 * MonitorSocket to connect to the monitor server.
 */
(function(monitor) {

	var handlers = {};
	var categories = {};


	function createWebSocket(parent) {
		var ws = new WebSocket('ws://'+location.host);
		ws.onopen = function() {
			console.log('socket open');
			// become watcher
			ws.send('watcher');
			// get hosts
			setTimeout(function() {
				parent.send('common', 'hosts');
			}, 0);
		};
		ws.onmessage = function(message) {
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

	MonitorSocket.prototype.subscribe = function() {
		for (var i = 0; i < arguments.length; i++) {
			var name = arguments[i];
			console.log('subscribing', name);
			this.send('common','subscribe', { name: name });
		}
	};

	MonitorSocket.prototype.handle = function handle(type, method, data) {
		var self = this;
		var handler = this.handlers[type];
		if (handler) {
			var func = handler[method];
			if (func) {
				func.call(self, data);
			}
		}
	};

	MonitorSocket.prototype.register = function(functions) {
		var self = this;
		// copy handlers
		for (var name in functions) {
			self.handlers[name] = functions[name];
		}
	};

	monitor.MonitorSocket = MonitorSocket;

})(monitor);

/**
 * Dashboard Charts
 */
(function(monitor) {

	function Pie(width,height) {
		var canvas = this.canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height= height;
		this.context = canvas.getContext('2d');
	}
	Pie.prototype = {
		update: function(data) {
			var total = 0, name, unit;
			var context = this.context;
			var canvas = this.canvas;
			context.clearRect(0,0,canvas.width,canvas.height);
			for (name in data) {
				unit = data[name];
				total += unit.value;
			}
			var start, end;
			for (name in data) {
				unit = data[name];
				end = unit.value / total * Math.PI*2;
				context.fillStyle = unit.color;
			}
			return this;
		}
	}

	function Bar(width,height,option) {
		var canvas = this.canvas = document.createElement('canvas');
		canvas.width = width || 100;
		canvas.height = height || 20;
		this.context = canvas.getContext('2d');
		this.option = option || {};
	}
	Bar.prototype = {
		update: function(data) {
			var list = data.series;
			var context = this.context;
			var canvas = this.canvas;
			var total = 0, i;
			context.clearRect(0,0,canvas.width,canvas.height);
			for (i = 0; i < list.length; i++) {
				total += list[i].value;
			}
			var x = 0;
			for (i = 0; i < list.length; i++) {
				var unit = list[i];
				var val = unit.value;
				var len = unit.value / total * canvas.width;
				context.fillStyle = unit.color;
				context.beginPath();
				context.rect(x,0,x+len,canvas.height);
				context.fill();
				x += len;
			}
			if (data.label) {
				var len = context.measureText(data.label);
				context.fillStyle = 'rgb(0,0,0)';
				context.fillText(
					data.label,
					canvas.width/2-len.width/2,14
				);
			}
		}
	}

	monitor.charts = {
		Pie: Pie,
		Bar: Bar
	};
})(monitor);

(function(color) {
	color.rgb = {
		 safe: 'rgb(95,126,100)'
		,normal: 'rgb(153,189,150)'
		,notice: 'rgb(220,189,150)'
		,warn: 'rgb(254,162,110)'
		,fatal: 'rgb(254,97,91)'
	};
	color.rgbhex = {
		 safe: '#5F7E64'
		,normal: '#99BD96'
		,notice: '#DCBD96'
		,warn: '#FEA26E'
		,fatal: '#FE615B'
	};
})(color);

