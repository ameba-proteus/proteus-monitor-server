
$(function() {
(function() {

var categories = {};
var hosts = {};
var detail = null;

$('#nav-stats').addClass('active');

setInterval(function() {
	for (var name in categories) {
		categories[name].update();
	}
}, 1000);

var socket = new monitor.MonitorSocket();
socket.register({
	common: {
		hosts: function(data) {
			var cnames = [];
			for (var cname in data) {
				cnames.push(cname);
			}
			cnames.sort();
			for (var k = 0; k < cnames.length; k++) {
				var cname = cnames[k];
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
			this.subscribe('stat', 'ps');
		}
	},
	stat: {
		update: function(data) {
			var host = hosts[data.name];
			if (host) {
				host.update(data.data);
			}
			if (detail && detail.host === host) {
				detail.update(data.data);
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
	if (value < 100) {
		return Math.round(value*10)/10;
	} else {
		return Math.round(value);
	}
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
			host: data.summary ? $.tag('span.host').text(data.name) : $.tag('span.host').tag('a').text(data.name).gat(),
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
	var self = this;
	if (data.stat) {
		self.update(data.stat);
	}
	if (!data.summary) {
		spans.name.host.click(function() {
			detail = new HostDetail(self);
			detail.show();
		});
	}
}

Host.prototype = {
	// update stat
	update: function(data) {
		var self = this;
		var tds = self.tds;
		var spans = self.spans;
		var bars = self.bars;
		self.stat = data;
		
		// Name
		if (data.name) {
			spans.name.host.text(data.name);
		}
		// Addres
		if (data.address) {
			spans.name.address.text(data.address);
		}

		// CPU
		if (data.stat && data.stat.cpu) {
			var cpu = data.stat.cpu.total;
			bars.cpu.update({
				series: [{
					color: color.rgb.normal,
					value: cpu.idle
				},{
					color: color.rgb.warn,
					value: cpu.user
				},{
					color: color.rgb.notice,
					value: cpu.system
				},{
					color: color.rgb.fatal,
					value: cpu.iowait
				}],
				label: (100-cpu.idle) + '%'
			});
		}
		
		// Load
		if (data.load) {
			var load = data.load[0];
			load = Math.round(load*100)/100;
			var loadrate = data.loadrate;
			var corecount = data.stat.cpu.core;
			loadrate = Math.min(50, Math.round(loadrate * 50));
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
			spans.disk.read.text(byteformat(data.disk.total.read.sector*512));
			spans.disk.write.text(byteformat(data.disk.total.write.sector*512));
		}
		
		// Memory
		if (data.mem) {
			data.mem.used = data.mem.total - data.mem.free - data.mem.cached - data.mem.buffer;
			bars.memory.update({
				series: [{
					color: color.rgb.normal,
					value: data.mem.free
				},{
					color: color.rgb.safe,
					value: data.mem.cached
				},{
					color: color.rgb.notice,
					value: data.mem.buffer
				},{
					color: color.rgb.warn,
					value: data.mem.used
				}],
				label: byteformat(data.mem.used*1024)
			});
		}
		
		// Network
		if (data.net) {
			spans.network.recv.text(byteformat(data.net.total.receive));
			spans.network.send.text(byteformat(data.net.total.send));
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
				.attr('title','Receive / Send')
				.tooltip()
			.gat()
		.gat()
		.tag('th')
			.text('Process')
		.gat()
		.gat()
	;
	var tbody = this.tbody = $.tag('tbody');

	this.total = new Host({name:'Total',summary:true});
	this.max = new Host({name:'Max',summary:true});

	thead.append(this.total.tr).append(this.max.tr);
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
			name: 'Total/Average',
			address: hosts.length,
	 		stat: {
				cpu: {
					total: { idle: 0, user: 0, system: 0, iowait: 0 },
					core: 0
				},
				system: { interrupt: 0, contextsw: 0 },
				process: { running: 0, blocked: 0 }
			},
			load: [0],
			disk: {
				total: {
					write: { sector: 0 },
					read: { sector: 0 }
				}
			},
			mem: { used: 0, free: 0, cached: 0, buffer: 0, total: 0 },
			net: {
			   total: { receive: 0, send: 0 }
			}
		};
		var max = {
			name: 'Max',
	 		stat: {
				cpu: {
					total: { idle: 100, user: 0, system: 0, iowait: 0 },
					core: 0
				},
				system: { interrupt: 0, contextsw: 0 },
				process: { running: 0, blocked: 0 }
			},
			load: [0],
			loadrate: 0,
			disk: {
				total: {
					write: { sector: 0 },
					read: { sector: 0 }
				}
			},
			mem: { used: 0, free: 0, cached: 0, buffer: 0, total: 0, rate: 0 },
			net: {
			   total: { receive: 0, send: 0 }
			}
		};
		var allps = {
		};
		var hostlen = hosts.length;
		var hostcount = 0;
		for (var i = 0; i < hostlen; i++) {
			var stat = hosts[i].stat;
			if (!stat) {
				continue;
			}
			hostcount++;
			if (stat.stat) {
				data.stat.cpu.core += stat.stat.cpu.core;
				data.stat.cpu.total.user   += stat.stat.cpu.total.user;
				data.stat.cpu.total.system += stat.stat.cpu.total.system;
				data.stat.cpu.total.iowait += stat.stat.cpu.total.iowait;
				data.stat.cpu.total.idle += stat.stat.cpu.total.idle;
				if (max.stat.cpu.total.idle > stat.stat.cpu.total.idle) {
					max.stat.cpu = stat.stat.cpu;
				}
			}
			if (stat.load) {
				data.load[0] += stat.load[0];
				stat.loadrate = stat.load[0] / stat.stat.cpu.core;
				if (max.loadrate < stat.loadrate) {
					max.load = stat.load;
					max.loadrate = stat.loadrate;
				}
			}
			if (stat.mem) {
				data.mem.cached += stat.mem.cached;
				data.mem.buffer += stat.mem.buffer;
				data.mem.free += stat.mem.free;
				data.mem.total += stat.mem.total;
				stat.mem.used = stat.mem.total - stat.mem.free - stat.mem.buffer - stat.mem.cached;
				stat.mem.rate = stat.mem.used / stat.mem.total;
				if (max.mem.rate < stat.mem.rate) {
					max.mem = stat.mem;
				}
			}
			if (stat.net) {
				data.net.total.receive += stat.net.total.receive;
				data.net.total.send += stat.net.total.send;
				if (max.net.total.receive < stat.net.total.receive) {
					max.net.total.receive = stat.net.total.receive;
				}
				if (max.net.total.send < stat.net.total.send) {
					max.net.total.send = stat.net.total.send;
				}
			}
			if (stat.disk) {
				data.disk.total.read.sector += stat.disk.total.read.sector;
				data.disk.total.write.sector += stat.disk.total.write.sector;
				if (max.disk.total.read.sector < stat.disk.total.read.sector) {
					max.disk.total.read.sector = stat.disk.total.read.sector;
				}
				if (max.disk.total.write.sector < stat.disk.total.write.sector) {
					max.disk.total.write.sector = stat.disk.total.write.sector;
				}
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
		var cpu = data.stat.cpu.total;
		cpu.user = cpu.user ? Math.round(cpu.user / hostcount) : 0;
		cpu.system = cpu.system ? Math.round(cpu.system / hostcount) : 0;
		cpu.iowait = cpu.iowait ? Math.round(cpu.iowait / hostcount) : 0;
		cpu.idle = (100 - cpu.user - cpu.system - cpu.iowait);
		data.load[0] = data.load[0] ? Math.round(data.load[0] / hostcount * 100) / 100 : 0;

		// update stat
		this.total.update(data);
		this.max.update(max);
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

function HostDetail(host) {
	var self = this;
	self.host = host;
	var page = self.page = $.tag('div#host-detail');
	var stat = host.stat;

	self.cpu  = $.tag('section.cpu')
	.tag('h5').text('CPU').gat();
	self.cpus = [];

	var core = stat.stat.cpu.core;
	for (var i = 0; i < core; i++) {
		var elem = $.tag('div.cpu-unit');
		var pie = new monitor.charts.Pie(32,32);
		self.cpus.push(pie);
		self.cpu.append(elem
						.tag('span').text(i).gat()
						.append(pie.canvas));
	}

	self.load = $.tag('section.load')
	.tag('h5').text('Load').gat();
	self.loads = [];
	var loadlabels = ['1m','5m','15m'];
	for (i = 0; i < 3; i++) {
		var elem = $.tag('div.load-unit');
		var bar = new monitor.charts.Bar(100,18);
		self.loads.push(bar);
		self.load.append(elem
						 .tag('span').text(loadlabels[i]).gat()
						 .append(bar.canvas));
	}

	self.disk = $.tag('section.disk')
	.tag('h5').text('Disk').gat();
	self.disks = {};

	for (var name in stat.disk) {
		if (name === 'total') continue;
		var disk = stat.disk[name];
		var elem = $.tag('div.disk-unit');
		elem
		.tag('table.table.table-bordered')
		.tag('tr').tag('th').text(name).gat().gat()
		.tag('tr').tag('td').text('').gat().gat()
		.gat();
		self.disk.append(elem);
		self.disks[name] = elem.find('td');
	}

	self.net  = $.tag('section.net')
	.tag('h5').text('Network').gat();
	self.nets = {};

	for (var name in stat.net) {
		if (name === 'total') continue;
		var net = stat.net[name];
		var elem = $.tag('div.net-unit');
		elem
		.tag('table.table.table-bordered')
		.tag('tr').tag('th').text(name).gat().gat()
		.tag('tr').tag('td').text('').gat().gat()
		.gat();
		self.net.append(elem);
		self.nets[name] = elem.find('td');
	}

	page
	.tag('div.modal-header').tag('h3').text(host.name + ' - ' + host.address).gat().gat()
	.tag('div.modal-body')
		.append(self.cpu)
		.tag('div.clearfix').gat()
		.append(self.load)
		.tag('div.clearfix').gat()
		.append(self.disk)
		.tag('div.clearfix').gat()
		.append(self.net)
		.tag('div.clearfix').gat()
	.gat()
	.tag('div.modal-footer').gat();

	self.update(host.stat);
}
HostDetail.prototype = {
	show: function() {
		var self = this;
		$('#modal')
		.empty()
		.append(self.page)
		.modal()
		.on('hide', function() {
			detail = null;
		});
		;
	},
	update: function(stat) {
		var self = this;
		var core = stat.stat.cpu.core;
		for (var i = 0; i < core; i++) {
			var cpu = stat.stat.cpu['cpu'+i];
			var pie = self.cpus[i];
			pie.update({
				series: [{
					color: color.rgb.warn,
					value: cpu.user
				},{
					color: color.rgb.notice,
					value: cpu.system
				},{
					color: color.rgb.fatal,
					value: cpu.iowait
				},{
					color: color.rgb.normal,
					value: cpu.idle
				}],
				label: (100-cpu.idle) + '%'
			});
		}	
		for (i = 0; i < 3; i++) {
			var load = stat.load[i];
			load = Math.round(load*100)/100;
			var bar = self.loads[i];
			var loadrate = Math.min(50, Math.round(load/core*50));
			bar.update({
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
		for (var name in stat.disk) {
			var disk = stat.disk[name];
			var td = self.disks[name];
			if (td) {
				td.empty()
				.tag('span.read').text(kmgformat(disk.read.sector*512)).gat()
				.tag('span.write').text(kmgformat(disk.write.sector*512)).gat()
				;
			}
		}
		for (var name in stat.net) {
			var net = stat.net[name];
			var td = self.nets[name];
			if (td) {
				td.empty()
				.tag('span.receive').text(kmgformat(net.receive)).gat()
				.tag('span.send').text(kmgformat(net.send)).gat()
				;
			}
		}
	}
};

})();
});
