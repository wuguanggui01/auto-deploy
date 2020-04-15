### 说明

使用 `SSH` 进行服务器连接，上传到服务器、备份、解压等，所以需要提前配置到 `SSH` 的无密登录，使用密钥连接。

### 安装

```
yarn add w-auto-deploy
```

#### 使用

新建文件 `deploy.js`，再在 `package.json` 的 `script` 添加 `"deploy": "node deploy.js"`

```
// deploy.js
const deploy = require('w-auto-deploy')
const config = {...}
deploy.run(config)
```

### config

```
const config = {
  development: {
    build: {
      command: 'npm run build', // 打包命令
      dir: path.resolve(__dirname, '../build'), // 打包路径，如 dist 等
      compressDir: path.resolve(__dirname, './')  // 压缩的 zip 目录，一般位于当前的目录
    },
    ssh: {
      host: 'service ip address',
      username: 'username',
      privateKey: '/Users/xx/.ssh/id_rsa' // 私钥地址绝对路径
    },
    serverDir: '/data/wwwroot/default/sshProject',
    projectFileName: '项目目录名称',
    backupsFormat: 'YYYYMMDD' // moment.js 格式，最终如 projectName202004158866445
  },
  production: {...同上}
}
```
