const path = require('path')
const fs = require('fs')

const config = {
  development: {
    build: {
      command: 'npm run build',
      dir: path.resolve(__dirname, '../build'),
      compressDir: path.resolve(__dirname, './')
    },
    ssh: {
      host: '121.196.223.197',
      username: 'root',
      privateKey: '/Users/wuguanggui/.ssh/id_rsa'
    },
    serverDir: '/data/wwwroot/default/sshProject',
    projectFileName: 'finance',
    backupsFormat: 'YYYYMMDD' // moment.js
  }
}

module.exports = config