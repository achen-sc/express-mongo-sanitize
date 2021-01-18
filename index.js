'use strict';

const TEST_REGEX = /^\$|\./;
const REPLACE_REGEX = /^\$|\./g;

function isPlainObject(obj) {
  return typeof obj === 'object' && obj !== null;
}

function withEach(target, cb) {
  (function act(obj) {
    if(Array.isArray(obj)) {
      obj.forEach(act);

    } else if(isPlainObject(obj)) {
      Object.keys(obj).forEach(function(key) {
        const val = obj[key];
        const resp = cb(obj, val, key);
        if(resp.shouldRecurse) {
          act(obj[resp.key || key]);
        }
      });
    }
  })(target);

}

function has(target) {
  let hasProhibited = false;
  withEach(target, function(obj, val, key) {
    if(TEST_REGEX.test(key)) {
      hasProhibited = true;
      return { shouldRecurse: false };
    } else {
      return { shouldRecurse: true };
    }
  });

  return hasProhibited;
}

function _sanitize(target, options){
  let isSanitized = false;
  let replaceWith = null;
  let dryRun = Boolean(options.dryRun);
  if(!(TEST_REGEX.test(options.replaceWith))) {
    replaceWith = options.replaceWith;
  }

  withEach(target, function(obj, val, key) {
    let shouldRecurse = true;

    if(TEST_REGEX.test(key)) {
      isSanitized = true;
      // if dryRun is enabled, do not modify the target
      if (dryRun) {
        return {
          shouldRecurse: shouldRecurse,
          key: key
        };
      }
      delete obj[key];
      if(replaceWith) {
        key = key.replace(REPLACE_REGEX, replaceWith);
        // Avoid to set __proto__ and constructor.prototype
        // https://portswigger.net/daily-swig/prototype-pollution-the-dangerous-and-underrated-vulnerability-impacting-javascript-applications
        // https://snyk.io/vuln/SNYK-JS-LODASH-73638
        if (key !== "__proto__" && key !== "constructor" && key !== "prototype") {
          obj[key] = val;
        }
      } else {
        shouldRecurse = false;
      }
    }

    return {
      shouldRecurse: shouldRecurse,
      key: key
    };
  });

  return {
    isSanitized,
    target
  }
}

function sanitize(target, options) {
  return _sanitize(target, options).target;
}

/**
 * @param {{replaceWith?: string, onSanitize?: function, dryRun?: boolean}} options
 * @returns {function}
 */
function middleware(options) {
  options = options || {};
  const hasOnSanitize = typeof options.onSanitize === "function";
  return function(req, res, next) {
    ['body', 'params', 'headers', 'query'].forEach(function(key) {
      if(req[key]) {
        const { target, isSanitized } = _sanitize(req[key], options);
        req[key] = target;
        if (isSanitized && hasOnSanitize) {
          options.onSanitize({
            req,
            key
          })
        }
      }
    });
    next();
  };
}

module.exports = middleware;
module.exports.sanitize = sanitize;
module.exports.has = has;
