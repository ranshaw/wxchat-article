/**
 * Created by Ranshaw on 2017/12/14.
 */
const fs = require('fs');
const path = require('path') ;
const events = require('events');
const {
	createHash
} = require('crypto') ;
const request = require('request') ;
const WechatRequest = require('./util/request') ;
const Config = require('./util/config')
const Log = require('./util/log') ;
const {
	login
} = require('./decorators/index') ;

const WECHATFILE = path.join(__dirname, '_data', 'wechat.json');
class Wechat extends events {
  constructor(username, pwd) {
	super();

	this.username = username;
	this.pwd = createHash('md5').update(pwd.substr(0, 16)).digest('hex');
	this.islogin = false;
	try {
	  let data = JSON.parse(fs.readFileSync(WECHATFILE));
	  this.data = data || {};
	} catch (error) {
	  this.data = {};
	}
  }
  _startlogin(imgcode = '') {
	return WechatRequest({
	  url: `${Config.api.bizlogin}?action=startlogin`,
	  form: {
		username: this.username,
		pwd: this.pwd,
		imgcode: imgcode,
		f: 'json'
	  }
	}).then(body => {
	  if (body.base_resp.ret === 0) {
		return Config.baseurl + body.redirect_url;
	  } else {
		// 200023 您输入的帐号或者密码不正确，请重新输入。
		// 200008 验证码
		if (body.base_resp.ret === 200008) {
		  let filename = 'verifycode.png';
		  let writeStream = fs.createWriteStream(filename);
		  WechatRequest.get(`${Config.api.verifycode}?username=${this.username}&r=${Date.now()}`).pipe(writeStream);
		  writeStream.on('finish', () => {
			this.emit('vcode', filename);
		  });
		}
		throw body;
	  }
	});
  }
  _checkLogin() {
	const dologin = (resolve, reject) => {
	  WechatRequest.getJSON(`${Config.api.loginqrcode}?action=ask&f=json&ajax=1&random=${Math.random()}`).then(body => {
		if (body.status === 1) {
		  resolve(body);
		} else {
		  setTimeout(() => {
			dologin(resolve, reject);
		  }, 3000);
		}
	  }).catch(reject);
	};
	return new Promise((resolve, reject) => {
	  let filename = 'qrcode-login.png';
	  let writeStream = fs.createWriteStream(filename);
	  WechatRequest.get(`${Config.api.loginqrcode}?action=getqrcode&param=4300`).pipe(writeStream).on('error', reject);
	  writeStream.on('finish', () => {
		this.emit('scan.login', filename);
		Log.info('请扫描二维码确认登录！');
		dologin(resolve, reject);
	  });
	});
  }
  _doLogin(referer) {
	let loginAction = (resolve, reject) => {
	  WechatRequest({
		url: `${Config.api.bizlogin}?action=login`,
		headers: {
		  'Referer': referer
		},
		form: {
		  f: 'json',
		  ajax: 1,
		  random: Math.random()
		}
	  }).then(body => {
		let token = null;
		if (body.base_resp.ret === 0 && (token = body.redirect_url.match(/token=(\d+)/))) {
		  this.data.token = token[1];
		  Log.info('登录成功，token=' + this.data.token);
		  resolve(token[1]);
		} else if (body.base_resp.ret === -1) {
		  loginAction(resolve, reject);
		} else {
		  reject(body);
		}
	  });
	};
	return new Promise(loginAction);
  }
  _wechatData() {
	return new Promise((resolve, reject) => {
	  WechatRequest.get(`${Config.api.masssendpage}?t=mass/send&token=${this.data.token}`, (e, r, body) => {
		if (e) {
		  reject(e);
		} else {
		  let ticketMatch = body.match(/ticket:"(\w+)"/);
		  let userNameMatch = body.match(/user_name:"(\w+)"/);
		  let massProtectMatch = body.match(/"protect_status":(\d+)/);
		  let operationMatch = body.match(/operation_seq:\s*"(\d+)"/);
		  if (ticketMatch && userNameMatch) {
			this.data.ticket = ticketMatch[1];
			this.data.user_name = userNameMatch[1];
			if (operationMatch) {
			  this.data.operation_seq = operationMatch[1];
			}
			if (massProtectMatch && (2 & massProtectMatch[1]) === 2) {
			  // 群发保护
			  this.data.mass_protect = 1;
			}
			this.islogin = true;
			resolve(this.data);
			fs.writeFile(WECHATFILE, JSON.stringify(this.data), function () {

			});
		  } else {
			reject('解析wxdata失败');
		  }
		}
	  });
	});
  }
  _loginstep(resolve, reject, imgcode) {
	this._startlogin(imgcode).then(redirectUrl => {
	  this._checkLogin().then(() => {
		this._doLogin(redirectUrl).then(() => {
		  this._wechatData().then(resolve).catch(reject);
		}).catch(reject);
	  }).catch(reject);
	}).catch(reject);
  }
  /**
   * @desc 登录公众号
   * @param {string} imgcode - [可选]验证码
   * @return {Promise<object>} data
   */
  login(imgcode) {
	return new Promise((resolve, reject) => {
	  if (this.islogin) {
		resolve(this.data);
	  } else if (this.data.token) {
		let req = WechatRequest.get(Config.baseurl, (error, response, body) => {
		  if (error) {
			this._loginstep(resolve, reject, imgcode);
		  } else {
			let redirects = req._redirect.redirects;
			if (redirects && redirects.length) {
			  let redirectUri = redirects[redirects.length - 1].redirectUri;
			  if (/token=(\d+)/.test(redirectUri)) {
				this.islogin = true;
				resolve(this.data);
			  } else {
				this._loginstep(resolve, reject, imgcode);
			  }
			} else {
			  this._loginstep(resolve, reject, imgcode);
			}
		  }
		});
	  } else {
		this._loginstep(resolve, reject);
	  }
	});
  }
 
  /**
   * 二维码解析
   * @param {string} url - 远程图片地址/本地图片路径
   * @return {Promise<object>}
   */
  qrdecode(url) {
	return new Promise((resolve, reject) => {
	  let formData = {};
	  if (/^https?:\/\//.test(url)) {
		formData.url = url;
	  } else {
		try {
		  formData.qrcode = fs.createReadStream(url);
		} catch (error) {
		  reject(error);
		}
	  }
	  request({
		method: 'POST',
		url: 'http://tool.oschina.net/action/qrcode/decode',
		headers: {
		  'Host': 'tool.oschina.net',
		  'Referer': 'http://tool.oschina.net/qr?type=2',
		  'Origin': 'http://tool.oschina.net',
		  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36',
		  'Upgrade-Insecure-Requests': 1
		},
		json: true,
		formData: formData
	  }, (e, r, body) => {
		e ? reject(e) : resolve(body[0]);
	  });
	});
	}
	
	queryWxList (value) {
		return new Promise((resolve, reject) => {
			WechatRequest.get(`${Config.api.queryWxList}?action=search_biz&token=${this.data.token}&lang=zh_CN&f=json&ajax=1&random=${Math.random()}&query=${value}&begin=0&count=5`, (err, res, body) => {
				if(err) {
					reject(err)
				} else {
					resolve(body)
				}
			});
		})
		
	}

	sendLoginUrl (content) {
		return WechatRequest({
			url: `${Config.api.sendLoginUrl}?t=ajax-response&f=json&token=${this.data.token}&lang=zh_CN`,
			form: {
				token: this.data.token,
				lang: 'zh_CN',
				f: 'json',
				ajax: 1,
				random: Math.random(),
				type: 1,
				content,
				tofakeid: 'o-2eYuFVJKfj9WExhdw2buiZO9Fg',
				quickReplyId: 462506423
			}
		})
	}

}

module.exports = Wechat;