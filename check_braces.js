var fs = require('fs');
var c = fs.readFileSync('js/sprites.js', 'utf8');
var d = 0;
var lines = c.split('\n');
for (var i = 0; i < lines.length; i++) {
  var l = lines[i];
  for (var j = 0; j < l.length; j++) {
    var ch = l[j];
    if (ch === '{') d++;
    if (ch === '}') d--;
  }
  if (i >= 1790 && i <= 1810) {
    console.log('Line ' + (i+1) + ': depth=' + d + ' ' + l.trim().substring(0, 70));
  }
}
console.log('Done');
