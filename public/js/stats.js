
$(function() {
(function() {

var categories = {};
var hosts = {};

$('#nav-stats').addClass('active');

setInterval(function() {
	for (var name in categories) {
		categories[name].update();
	}
}, 1000);

var socket = new monitor.MonitorSocket();
socket.register({
	dstat: {
		hosts: function(data) {
			for (var cname in data) {
				var cdata = data[cname];
				var category = categories[cname];
				if (category == null) {
					category = new Category(cname);
					categories[cname] = category;
					$('#main')
					.append(category.header)
					.append(category.table);
				}
				var list = [];
				for (var hname in cdata) {
					var host = cdata[hname];
					list.push(host);
				}
				list.sort(function(a,b) {
					return (a.name > b.name) ? 1 : (a.name < b.name) ? -1 : 0;
				});
				for (var i = 0; i < list.length; i++) {
					var hdata = list[i];
					var host = hosts[hdata.name];
					if (!host) {
						host = new Host(hdata, category);
						hosts[hdata.name] = host;
						category.hosts.push(host);
					}
					// add host line to category table
					category.tbody.append(host.tr);
				}
				category.update();
			}
			// hosts
			// subscribing dstat updates
			this.subscribe('dstat', 'ps');
		},
		update: function(data) {
			var host = hosts[data.name];
			if (host) {
				host.update(data.data);
			}
		}
	},
	ps: {
		update: function(data) {
			var host = hosts[data.name];
			if (host) {
				host.updateps(data.data);
			}
		}
	}
});

function getHost(name) {
	var host = hosts[name];
	if (host) {
		return host;
	}
	host = new Host();
	return host;
}

function numformat(value) {
	return Math.round(value*10)/10;
}

function byteformat(value) {
	if (value === undefined || value === NaN) {
		return '0B';
	}

	var k = 1024;
	var m = k * 1024;
	var g = m * 1024;

	if (value <= k*8) {
		return value + 'B';
	} else if (value < m * 8) {
		return numformat(value / k) + 'K';
	} else if (value < g * 8) {
		return numformat(value / m) + 'M';
	} else {
		return numformat(value / g) + 'G';
	}

}	

function kmgformat(value) {

	if (value === undefined || value === NaN) {
		return '0';
	}

	var k = 1024;
	var m = k * 1024;
	var g = m * 1024;

	if (value < 1000) {
		return String(value);
	} else if (value < 1000000) {
		return numformat(value / k) + 'K';
	} else if (value < 1000000000) {
		return numformat(value / m) + 'M';
	} else {
		return numformat(value / g) + 'G';
	}

}

function Host(data, category) {
	this.name = data.name;
	this.address = data.address;
	this.category = category;
	var tr = this.tr = $.tag('tr', {id: 'host-'+this.name});
	var tds = this.tds = {
		name: $.tag('td.name'),
		cpu: $.tag('td.cpu'),
		load: $.tag('td.load'),
		disk: $.tag('td.disk'),
		memory: $.tag('td.memory'),
		network: $.tag('td.network'),
		process: $.tag('td.process')
	};
	var spans = this.spans = {
		name: {
			host: $.tag('span.host').text(data.name),
			address: $.tag('span.address').text(data.address ? data.address : '')
		},
		disk: {
			write: $.tag('span.write'),
			read: $.tag('span.read')
		},
		network: {
			recv: $.tag('span.recv'),
			send: $.tag('span.send'),
			active: $.tag('span.active'),
			timewait: $.tag('span.timewait')
		}
	}
	var bars = this.bars = {
		cpu: new monitor.charts.Bar(100,18),
		load: new monitor.charts.Bar(50,18),
		memory: new monitor.charts.Bar(100,18),
	};
	tr
	.append(tds.name
			.append(spans.name.host)
			.append(spans.name.address))
	.append(tds.cpu
			.append(bars.cpu.canvas))
	.append(tds.load
			.append(bars.load.canvas))
	.append(tds.disk
			.append(spans.disk.read).append(spans.disk.write))
	.append(tds.memory
			.append(bars.memory.canvas))
	.append(tds.network
			.append(spans.network.recv)
			.append(spans.network.send)
			.append(spans.network.active)
			.append(spans.network.timewait)
	)
	.append(tds.process)
	;

	if (data.dstat) {
		this.update(data.dstat);
	}
}

Host.prototype = {
	// update stat
	update: function(data) {
		var self = this;
		var tds = self.tds;
		var spans = self.spans;
		var bars = self.bars;
		self.dstat = data;
		
		// Name
		if (data.name) {
			spans.name.host.text(data.name);
		}
		// Addres
		if (data.address) {
			spans.name.address.text(data.address);
		}

		// CPU
		if (data.cpu) {
			bars.cpu.update({
				series: [{
					color: color.rgb.normal,
					value: data.cpu.idle
				},{
					color: color.rgb.warn,
					value: data.cpu.user
				},{
					color: color.rgb.notice,
					value: data.cpu.system
				},{
					color: color.rgb.fatal,
					value: data.cpu.iowait
				}],
				label: (100-data.cpu.idle) + '%'
			});
		}
		
		// Load
		if (data.load) {
			var load = data.load['1m'];
			var corecount = data.load.core;
			var loadrate = Math.min(50, Math.round(load / corecount * 50));
			bars.load.update({
				series: [{
					color: color.rgb.normal,
					value: 50-loadrate
				},{
					color: color.rgb.warn,
					value: loadrate
				}],
				label: String(load)
			});
		}
		
		// Disk
		if (data.disk) {
			spans.disk.write.text(byteformat(data.disk.write));
			spans.disk.read.text(byteformat(data.disk.read));
		}
		
		// Memory
		if (data.memory) {
			bars.memory.update({
				series: [{
					color: color.rgb.normal,
					value: data.memory.free
				},{
					color: color.rgb.safe,
					value: data.memory.cache
				},{
					color: color.rgb.notice,
					value: data.memory.buff
				},{
					color: color.rgb.warn,
					value: data.memory.used
				}],
				label: byteformat(data.memory.free)
			});
		}
		
		// Network
		if (data.net) {
			spans.network.recv.text(byteformat(data.net.recv));
			spans.network.send.text(byteformat(data.net.send));
		}
		// TCP
		if (data.tcp) {
			spans.network.active.text(kmgformat(data.tcp.active));
			spans.network.timewait.text(kmgformat(data.tcp.timewait));
		}
	},
	// process update
	updateps: function(data) {
		this.ps = data;
		var tds = this.tds;
		var td = tds.process;
		td.empty();
		for (var name in data) {
			if (data[name] === 1) {
				td.tag('span.success').text(name).gat();
			} else if (data[name] > 0) {
				td.tag('span.warn').text(name).gat();
			} else {
				td.tag('span.fail').text(name).gat();
			}
		}
	}
};

function Category(name) {
	this.name = name;
	this.size = 0;
	this.hosts = [];

	// expand button
	var expand = $.tag('button.btn.btn-mini').text('\u25bc').click(function() {
		var self = $(this);
		if (self.text() === '\u25bc') {
			self.text('\u25b2');
			tbody.show();
		} else {
			self.text('\u25bc');
			tbody.hide();
		}
	});

	var table = this.table = $.tag('table.table.table-bordered.table-striped.table-condensed.stat-group', {id:'category-'+name});

	var thead = this.thead = $.tag('thead');
	thead
		.tag('tr')
		.tag('th.name')
			.append(expand)
			.tag('span').text(name).gat()
		.gat()
		.tag('th')
			.tag('span')
				.text('CPU')
				.attr('title', labelTooltip([
											{ name: 'idle', color: color.rgbhex.normal },
											{ name: 'user', color: color.rgbhex.warn },
											{ name: 'system', color: color.rgbhex.notice },
											{ name: 'iowait', color: color.rgbhex.fatal }
				]))
				.tooltip({html:true})
			.gat()
		.gat()
		.tag('th').text('Load').gat()
		.tag('th')
			.tag('span')
				.text('Disk')
				.attr('title','Read / Write')
				.tooltip()
			.gat()
		.gat()
		.tag('th')
			.tag('span')
				.text('Memory')
				.attr('title',labelTooltip([
										   { name: 'free', color: color.rgbhex.normal },
										   { name: 'cache', color: color.rgbhex.safe },
										   { name: 'notice', color: color.rgbhex.notice },
										   { name: 'used', color: color.rgbhex.warn }
				]))
				.tooltip({html:true})
			.gat()
		.gat()
		.tag('th')
			.tag('span')
				.text('Network')
				.attr('title','receive/send/active/timeout')
				.tooltip()
			.gat()
		.gat()
		.tag('th')
			.text('Process')
		.gat()
		.gat()
	;
	var tbody = this.tbody = $.tag('tbody');

	this.total = new Host({name:'Total'});

	thead.append(this.total.tr);
	table.append(thead);
	table.append(tbody);
	tbody.hide();
}
Category.prototype = {
	update: function() {
		var self = this;
		var tds = self.tds;
		var hosts = self.hosts;
		var data = {
			name: 'Total',
			address: hosts.length,
	 		cpu: { idle: 0, user: 0, system: 0,  iowait: 0},
			load: { "1m": 0, core: 0 },
			disk: { write: 0, read: 0 },
			memory: { used: 0, free: 0, cache: 0, buff: 0 },
			net: { recv: 0, send: 0 },
			tcp: { active: 0, timewait: 0 }
		};
		var allps = {
		};
		var hostlen = hosts.length;
		for (var i = 0; i < hostlen; i++) {
			var dstat = hosts[i].dstat;
			if (dstat.cpu) {
				data.cpu.user += dstat.cpu.user;
				data.cpu.system += dstat.cpu.system;
				data.cpu.iowait += dstat.cpu.iowait;
			}
			if (dstat.load) {
				data.load['1m'] += dstat.load['1m'];
				data.load.core += dstat.load.core;
			}
			if (dstat.memory) {
				data.memory.used += dstat.memory.used;
				data.memory.cache += dstat.memory.cache;
				data.memory.buff += dstat.memory.buff;
				data.memory.free += dstat.memory.free;
			}
			if (dstat.net) {
				data.net.recv += dstat.net.recv;
				data.net.send += dstat.net.send;
			}
			if (dstat.tcp) {
				data.tcp.active += dstat.tcp.active;
				data.tcp.timewait += dstat.tcp.timewait;
			}
			var ps = hosts[i].ps;
			for (var name in ps) {
				if (name in allps) {
					allps[name] += ps[name];
				} else {
					allps[name] = ps[name] ? 1 : 0;
				}
			}
		}
		// get average
		data.cpu.user = data.cpu.user ? Math.round(data.cpu.user / hostlen) : 0;
		data.cpu.system = data.cpu.system ? Math.round(data.cpu.system / hostlen) : 0;
		data.cpu.iowait = data.cpu.iowait ? Math.round(data.cpu.iowait / hostlen) : 0;
		data.cpu.idle = (100 - data.cpu.user - data.cpu.system - data.cpu.iowait);
		data.load['1m'] = data.load['1m'] ? Math.round(data.load['1m'] / hostlen * 100) / 100 : 0;

		// update stat
		this.total.update(data);
		// get ps
		for (var name in allps) {
			if (allps[name] > 0) {
				allps[name] = hostlen / allps[name];
			}
		}
		this.total.updateps(allps);
	}
};

function labelTooltip(series) {
	var html = '';
	for (var i = 0; i < series.length; i++) {
		var item = series[i];
		html += '<span style="color:'+item.color+'">\u25a0</span> '+item.name + ' ';
		if (i % 2 == 1) {
			html += '<br/>';
		}
	}
	return html;
}

})();
});
