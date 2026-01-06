// EJS layout shim to support layout('layout') style in templates
import ejs from 'ejs';
export function ejsLayouts(app) {
  app.use((req, res, next) => {
    const _render = res.render.bind(res);
    res.render = function(view, options = {}, callback) {
      const layout = options.layout === undefined ? 'layout' : options.layout;
      options.layout = function(name) { options._layout = name; };
      return _render(view, options, function(err, str) {
        if (err) return callback ? callback(err) : next(err);
        const layoutName = options._layout || layout;
        if (!layoutName) return callback ? callback(null, str) : res.send(str);
        const file = app.get('views') + '/' + layoutName + '.ejs';
        ejs.renderFile(file, { body: str }, {}, function(err2, html) {
          if (err2) return callback ? callback(err2) : next(err2);
          if (callback) return callback(null, html);
          res.send(html);
        });
      });
    };
    next();
  });
}
