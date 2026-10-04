// Removes HTML tags from user-supplied text so that markup never reaches the database.
// Repeated until stable: "<<b>script>" must not reassemble into a tag after one pass.
// Only sequences that look like a tag ("<a", "</a", "<!") are removed, so "2 < 3" survives.
const TAG_RE = /<\/?[a-zA-Z!][^>]*>?/g;

function stripTags(value) {
  let out = value;
  let prev;
  do {
    prev = out;
    out = out.replace(TAG_RE, '');
  } while (out !== prev);
  return out;
}

module.exports = { stripTags };
