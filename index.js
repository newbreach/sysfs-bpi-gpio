let fs = require('fs'),
  path = require('path'),
  EventEmitter = require('events').EventEmitter,
  cp = require('child_process'),
  BASE_DIR = '/sys/class/gpio/',
  DIRECTION = { IN: 'in', OUT: 'out' },
  EDGE = { NONE: 'none', RISING: 'rising', FALLING: 'falling', BOTH: 'both' },
  ACTIVE_LOW = { TRUE: '1', FALSE: '0' },
  LOW = '0',
  HIGH = '1';

/**
 * 写入文件
 * @param {String} str 
 * @param {String} file 
 * @param {Function} fn 
 */
let _write = function (str, file, fn) {
  if (typeof fn === 'function') {
    fs.writeFile(file, str, { encoding: 'utf-8' }, fn);
  } else {
    fs.writeFileSync(file, str, { encoding: 'utf-8' });
  }
};

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
/**
 * GPIO
 */
class GPIO extends EventEmitter {
  constructor(pin, direction = DIRECTION.OUT, active_low = ACTIVE_LOW.FALSE, edge = EDGE.NONE) {
    super();
    this._pin = pin;
    this._direction = direction;
    this._active_low = active_low;
    this._edge = edge;
    this._dir_root = `${BASE_DIR}gpio${this._pin}/`;
    this._file_direction = `${this._dir_root}direction`;
    this._file_active_low = `${this._dir_root}active_low`;
    this._file_edge = `${this._dir_root}edge`;
    this._file_value = `${this._dir_root}value`;
    this._timer = null;
    if (!fs.existsSync(this._dir_root)) {
      _write(this._pin, `${BASE_DIR}export`);
    }
    this.active_low = this._active_low;
    this.edge = this._edge;
    this.direction = this._direction;
    GPIO.exportedPins.set(pin, this);
  }
  /**
   * 获取端口
   */
  get pin() {
    return this._pin;
  }
  /**
   * 获取方向
   */
  get direction() {
    return this._direction;
  }
  /**
   * 设置方向
   */
  set direction(val) {
    if ([DIRECTION.OUT, DIRECTION.IN].indexOf(val) === -1) {
      return;
    }
    this._direction = val;
    _write(this._direction, this._file_direction);
  }
  /**
   * 低电平属性，默认0
   */
  get active_low() {
    return this._active_low;
  }
  /**
   * 低电平属性，可以反转接收值。
   */
  set active_low(val) {
    this._active_low = val;
    _write(this._active_low, this._file_active_low);
  }
  /**
   * 获取边缘
   */
  get edge() {
    return this._edge;
  }
  /**
   * 设置边缘
   */
  set edge(val) {
    if ([EDGE.NONE, EDGE.RISING, EDGE.FALLING, EDGE.BOTH].indexOf(val) === -1) {
      console.warn('不是有效的属性值', val);
      return;
    }
    if (val != EDGE.NONE && this._direction === DIRECTION.OUT) {
      console.warn('方向是输入，不能设置');
      return;
    }
    this._edge = val;
    _write(this._edge, this._file_edge);
  }
  /**
   * 获取值
   */
  get value() {
    return parseInt(_read(this._file_value));
  }
  /**
   * 设置
   */
  set value(val) {
    if (this._direction === DIRECTION.IN) {
      return;
    }
    _write(val === true || val === '1' || val === 1 ? '1' : '0', this._file_value);
  }
  /**
   * 回收端口
   */
  unexport() {
    if (this._timer) {
      this._timer.kill();
      this._timer = null;
      //clearInterval(this._timer);
    }
    _write(this._pin, `${BASE_DIR}unexport`);
    GPIO.exportedPins.delete(this._pin);
  }
  /**
   * 字典：低电平
   */
  static get ACTIVE_LOW() {
    return ACTIVE_LOW;
  }
  /**
   * 字典：方向 
   */
  static get DIRECTION() {
    return DIRECTION;
  }
  /**
   * 字典：边缘
   */
  static get EDGE() {
    return EDGE;
  }
  /**
   * 低电平
   */
  static get LOW() {
    return LOW;
  }
  /**
   * 高电平
   */
  static get HIGH() {
    return HIGH;
  }
  /**
   * 转换为按钮
   * @param {Object} opts 
   */
  button(opts) {
    let { clickOften, longPressOften } = opts || {};
    clickOften = clickOften || 2500;
    longPressOften = longPressOften || 4000;
    if (clickOften % 50 != 0 || clickOften < 800) {
      console.error('clickOften: 值必须是50的倍数,并且不能小于800毫秒! ');
      return;
    }
    if (longPressOften % 50 != 0 || longPressOften <= clickOften) {
      console.error('longPressOften: 值必须是50的倍数,且大于clickOften参数!');
      return;
    }
    let clickMaxCount = clickOften / 50,
      longPressMaxCount = longPressOften / 50;
    if (this._timer) {
      this._timer.kill();
      //clearInterval(this._timer);
    }
    //this._timer = setInterval(this._monitor.bind(this, longPressMaxCount, clickMaxCount), 50);
    this._timer = cp.fork(path.join(__dirname, 'button-monitor.js'), [longPressMaxCount, clickMaxCount, this._file_value]);
    this._timer.on('message', this.emit.bind(this));
  }
  /**
   * 全局被导出的端口
   */
  static exportedPins = new Map()
  /**
   * 清除所有端口
   */
  static cleanup() {
    GPIO.exportedPins.forEach((item) => {
      item.unexport();
    });
  }
}
process.on('exit', GPIO.cleanup);
process.on('SIGINT', () => { GPIO.cleanup(); process.exit(); });
module.exports = GPIO;