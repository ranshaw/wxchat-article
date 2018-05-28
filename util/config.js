const  fs = require('fs') ;
const  path = require('path')

const HOST = 'mp.weixin.qq.com';
const BASEURL = `https://${HOST}`;

const API = {
    masssendpage: `${BASEURL}/cgi-bin/masssendpage`,
    bizlogin: `${BASEURL}/cgi-bin/bizlogin`,
    loginqrcode: `${BASEURL}/cgi-bin/loginqrcode`,
    operate_appmsg: `${BASEURL}/cgi-bin/operate_appmsg`,
    appmsg: `${BASEURL}/cgi-bin/appmsg`,
    filetransfer: `${BASEURL}/cgi-bin/filetransfer`,
    filepage: `${BASEURL}/cgi-bin/filepage`,
    masssend: `${BASEURL}/cgi-bin/masssend`,
    safeassistant: `${BASEURL}/misc/safeassistant`,
    safeqrconnect: `${BASEURL}/safe/safeqrconnect`,
    safeqrcode: `${BASEURL}/safe/safeqrcode`,
    safeuuid: `${BASEURL}/safe/safeuuid`,
    singlesend: `${BASEURL}/cgi-bin/singlesend`,
    message: `${BASEURL}/cgi-bin/message`,
    uploadimg2cdn: `${BASEURL}/cgi-bin/uploadimg2cdn`,
    verifycode: `${BASEURL}/cgi-bin/verifycode`,
    queryWxList: `${BASEURL}/cgi-bin/searchbiz`,
    sendLoginUrl: `${BASEURL}/cgi-bin/singlesend`
};

const Config = {
    host: HOST,
    baseurl: BASEURL,
    api: API,
    upload: path.join(process.cwd(), 'upload')
};

if (!fs.existsSync(Config.upload)) {
    fs.mkdir(Config.upload, () => {});
}

module.exports = Config;