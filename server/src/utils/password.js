const bcrypt = require('bcrypt');

const ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 10;
// Pre-computed hash used to equalise timing when the e-mail is unknown.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', ROUNDS);

const hash = (plain) => bcrypt.hash(plain, ROUNDS);
const compare = (plain, hashed) => bcrypt.compare(plain, hashed || DUMMY_HASH);

// At least 8 chars, a letter, a digit and a special character.
const PASSWORD_RE = /^(?=.*[A-Za-zА-Яа-я])(?=.*\d)(?=.*[^A-Za-zА-Яа-я\d\s]).{8,72}$/;

module.exports = { hash, compare, PASSWORD_RE };
