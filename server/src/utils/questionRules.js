const { badRequest } = require('./AppError');

/** Validates the option set against the question type. Throws 400 on violation. */
function assertOptionsValid(type, options) {
  const correct = options.filter((o) => o.isCorrect).length;
  const problems = [];
  if (type === 'truefalse' && options.length !== 2) problems.push('truefalse questions need exactly 2 options');
  if ((type === 'single' || type === 'truefalse') && correct !== 1) problems.push(`${type} questions need exactly 1 correct option`);
  if (type === 'multiple' && correct < 1) problems.push('multiple questions need at least 1 correct option');
  if (type === 'single' && options.length < 2) problems.push('at least 2 options are required');
  const texts = options.map((o) => o.text.trim().toLowerCase());
  if (new Set(texts).size !== texts.length) problems.push('option texts must be unique');
  if (problems.length) throw badRequest('Invalid options', problems.map((message) => ({ field: 'options', message })));
}

module.exports = { assertOptionsValid };
