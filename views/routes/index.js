
/*
 * GET home page.
 */

exports.index = function(req, res){
	res.render('index', { title: 'Proteus Monitor' });
};

exports.stats = function(req, res) {
	res.render('stats', { title: 'Server statistics - Proteus Monitor'});
};
