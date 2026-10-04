const { AppError } = require('../utils/AppError');
const { security } = require('../utils/logger');

/**
 * validate({ body, query, params }) – Joi schemas.
 * Unknown fields are rejected (protection against mass assignment); the
 * validated/converted values are exposed as req.valid.{body,query,params}.
 */
function validate(schemas) {
  return (req, res, next) => {
    req.valid = req.valid || {};
    for (const part of ['params', 'query', 'body']) {
      const schema = schemas[part];
      if (!schema) continue;
      const { value, error } = schema.validate(req[part] ?? {}, {
        abortEarly: false,
        allowUnknown: false,
        convert: true,
      });
      if (error) {
        const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message.replace(/"/g, "'") }));
        if (error.details.some((d) => d.type === 'object.unknown')) {
          security('mass_assignment_attempt', req, { fields: error.details.filter((d) => d.type === 'object.unknown').map((d) => d.path.join('.')) });
        }
        return next(new AppError(400, 'validation_error', 'Validation failed', details));
      }
      req.valid[part] = value;
    }
    return next();
  };
}

module.exports = validate;
