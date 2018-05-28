const Wechat = require('./wechat');

const API = new Wechat('你的账户名', '你的密码');

API.once('scan.login', (filepath) => {
    // 登录二维码图片地址
    console.log(filepath);
});

API.once('vcode', (filepath) => {
    // 验证码图片地址
    console.log(filepath);
});

API.login().then(data => {
    console.log(data);
    API.queryWxList('前端').then((e) => {
        // console.log('搜索数据', e)
    })
    API.sendLoginUrl('需要确认登录22').then((v) => {
        console.log('vvvvvv', v)
    })
}).catch(console.error.bind(console));

API.qrdecode('./qrcode-login.png').then((v) => {
    // console.log('二维码内容',v)
})