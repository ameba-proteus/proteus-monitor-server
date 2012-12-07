
/**
 * Module dependencies.
 */

var express = require('express')
, routes = require('./routes')
, http = require('http')
, path = require('path')
, domain = require('domain')
, path = require('path')
, fs = require('fs')
, manager = require('./lib/server/manager')
;
var log = console.log;

var program = require('commander');
program.version('0.0.1')
.option('-w, --port <n>', 'server port')
.parse(process.argv);
;

var pluginDir = path.resolve(__dirname, 'lib','plugins');
var agentPlugins = fs.readdirSync(path.resolve(pluginDir,'server'));
var watcherPlugins = fs.readdirSync(path.resolve(pluginDir,'watcher'));

var d = domain.create();

d.run(function() {
	var app = express();

	app.configure(function(){
		app.set('port', Number(program['web-port'] || 3333));
		app.set('views', __dirname + '/views');
		app.set('view engine', 'jade');
		app.use(express.favicon());
		app.use(express.logger('dev'));
		app.use(express.bodyParser());
		app.use(express.methodOverride());
		app.use(app.router);
		app.use(express.static(path.join(__dirname, 'public')));
	});

	app.configure('development', function(){
		app.use(express.errorHandler());
	});

	app.get('/', routes.index);
	app.get('/stats', routes.stats);

	var server = http.createServer(app);

	server.listen(app.get('port'), function(){
		log("Express server listening on port " + app.get('port'));
	});

	// create WebSocketServer
	var WebSocketServer = require('ws').Server;
	var wsid = 0;
	var wss = new WebSocketServer({server:server});
	wss.on('connection', function(ws) {
		ws.wsid = ++wsid;
		ws.handlers = {};
		ws.address = ws.upgradeReq.connection.remoteAddress;
		ws.json = function json(type, method, obj) {
			this.send(JSON.stringify({
				type: type,
				method: method,
				data: obj
			}));
		};
		log('client',ws.wsid,'connected');
		ws.on('message', function(msg) {
			// become agent
			if (msg.indexOf('agent') === 0) {
				// make client as agent
				var split = msg.split(':');
				ws.hostname = split[1];
				ws.category = split[2];
				manager.addAgent(ws);
				log('client',ws.wsid, 'becomes agent. hostname:' + ws.hostname, ' category:' + ws.category);
				agentPlugins
				.filter(function(name) {
					return name.match(/\.js$/);
				})
				.forEach(function(name) {
					ws.handlers[name.replace(/\.js$/,'')] =
						require('./lib/plugins/server/'+name);
				});
				ws.json('common', 'accept');
				return;
			} else if (msg.indexOf('watcher') === 0) {
				// become watcher client
				log('client',ws.wsid,'becomes watcher');
				manager.addWatcher(ws);
				watcherPlugins
				.filter(function(name) {
					return name.match(/\.js$/);
				})
				.forEach(function(name) {
					ws.handlers[name.replace(/\.js$/,'')] =
					   	require('./lib/plugins/watcher/'+name);
				});
				return;
			}
			try {
				var json = JSON.parse(msg);
				var type = json.type;
				var method = json.method;
				var handler = ws.handlers[type];
				if (handler && handler[method]) {
					handler[method].call(ws, json.data);
				}
			} catch (e) {
				log('client', ws.wsid,'handler error', e.stack);
				// TODO error reply
				ws.json('error', { message: e.message });
			}
		});
		ws.on('error', function(e) {
			log('client',ws.wsid,'error', e.stack);
		});
		ws.on('close', function() {
			log('client',ws.wsid,'disconnected');
			manager.removeClient(ws);
		});
	});
});
d.on('error', function(err) {
	log('unexpected server error', err.stack);
});

