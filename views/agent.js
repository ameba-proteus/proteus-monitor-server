
var domain = require('domain');
var WebSocket = require('ws');
var os = require('os');
var path = require('path');
var fs = require('fs');
var log = console.log;

var program = require('commander');
program.version('0.0.1')
.option('-h, --host <hostname>', 'server host to connect')
.option('-g, --group <group>', 'server group')
.option('-p, --plugins <plugins>', 'plugins')
.option('-c, --config <config>', 'configuration path')
;

program.parse(process.argv);

var host = program.host || 'localhost:3333';
// set defaut port
if (host.indexOf(':') < 0) {
	host = host + ':3333';
}
var group = program.group || 'default';

log('starting proteus-monitor agent');

var retrySec = 1;

var plugins = ['dstat'];

var d = domain.create();
d.run(function() {

	(function create() {
		var ws = new WebSocket('ws://'+host);
		log('connecting to the server', host);
		ws.json = function json(type, method, obj) {
			this.send(JSON.stringify({
				type: type,
				method: method,
				data: obj
			}));
		};
		ws.on('open', function() {
			var hostname = os.hostname();
			log('connected to server', host, 'as', hostname);
			ws.connected = true;
			ws.handlers = {
				accept: function(data) {
					log('server accepted the agent');
					for (var i = 0; i < plugins.length; i++) {
						var plugin = plugins[i];
						var lib = require('./lib/plugins/agent/'+plugin);
						log('registering plugin', plugin);
						for (var name in lib) {
							if (name === 'init') {
								lib[name].call(ws);
							} else {
								ws.handlers[name] = lib[name];
							}
						}
					}
				}
			};
			ws.send('agent:'+hostname+':'+group);
		});
		ws.on('message', function(msg) {
			var command = JSON.parse(msg);
			var handler = ws.handlers[command.type];
			if (handler) {
				handler.call(ws, command.data);
			} else {
				log('undefined handler', command.type);
			}
		});
		ws.on('error', function(err) {
			if (err.code === 'ECONNREFUSED') {
				log('failed to connect to the server. retrying after', retrySec, 'seconds');
				setTimeout(create, retrySec*1000);
			} else {
				log(err.message);
			}
		});
		ws.on('close', function() {
			ws.connected = false;
			log('disconnected from server', host);
			create();
		});
		return ws;
	})();

});
