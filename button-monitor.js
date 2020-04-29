let fs = require('fs'),
  longPressMaxCount = parseInt(process.argv[2]),
  clickMaxCount = parseInt(process.argv[3]),
  file_value = process.argv[4],
  _interval = 0;
/**
* 读取文件
* @param {String} file 
* @param {Function} fn 
*/
let _read = function (file, fn) {
  if (typeof fn === 'function') {
    fs.readFile(file, { encoding: 'utf-8' }, fn);
  } else {
    return fs.readFileSync(file, { encoding: 'utf-8' });
  }
};
setInterval(() => {
  let v = parseInt(_read(file_value));
  if (v === 1) {
    _interval++;
  } else {
    if (_interval >= longPressMaxCount) {
      _interval = 0;
    }
    if (_interval >= 5 && _interval < clickMaxCount) {
      process.send('click');
    }
    _interval = 0;
  }
  if (_interval == longPressMaxCount) {
    process.send('longPress');
    return;
  }
}, 50);