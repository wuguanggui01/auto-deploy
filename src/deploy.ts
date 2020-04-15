const fs = require('fs')
const path = require('path')
const Inquirer = require('inquirer')
const shell = require('shelljs')
const Ora = require('ora')
const Compress = require('compressing')
const nodeSsh = require('node-ssh')
const Moment = require('moment')
const stringRandom = require('string-random')
const merge = require('lodash/merge')

const inquirerConfig = {
  type: 'list',
  name: 'env',
  message: '请选择部署环境？',
  choices: [
    {name: '开发环境', value: 'development'},
    {name: '生产环境', value: 'production'},
  ],
}

// 用于检测执行 rm -rf xxx 时的检测，以防删库跑路
const rmGroup = ['/', '*', '/*', '.', '']

interface IConfig {
  build: {
    command: String
    dir: String
    compressDir: String
  }
  ssh: {
    host: String
    username: String
    privateKey: String
  }
  serverDir: String
  projectFileName: String
  backupsFormat: String
  zipName: String
}

interface IFullConfig {
  [key: string]: IConfig
}

class AutomaticDeploy {
  // 配置
  fullConfig: IFullConfig
  config: IConfig
  defaultConfig: IConfig
  // 检查非法的 rm -rf xx
  rmGroup: Array<String>
  // 解压文件名
  decompressionFileName: String
  buildFileFormat: String
  ssh: any
  env: string

  constructor() {
    this.rmGroup = rmGroup
    this.buildFileFormat = 'zip'
    this.ssh = new nodeSsh()
    this._setDefaultValue()
  }

  _setDefaultValue(): void {
    this.defaultConfig = {
      build: {
        command: 'npm run build',
        dir: path.resolve(__dirname, '../build'),
        compressDir: path.resolve(__dirname, './'),
      },
      ssh: {
        host: '192.168.1.1',
        username: 'root',
        privateKey: '/Users/xx/.ssh/id_rsa',
      },
      serverDir: '/data/wwwroot/default',
      projectFileName: 'projectName',
      backupsFormat: 'YYYYMMDD',
      zipName: '',
    }
  }

  run(config: IFullConfig): void {
    this.fullConfig = config
    Inquirer.prompt(inquirerConfig).then((answers: any) => {
      this.env = answers.env
      this.config = this.fullConfig[this.env]
      if (!this.config) {
        this.printLog('配置项错误，无该环境相关配置项', true)
      }
      this.config = merge({}, this.defaultConfig, this.config)
      this.validateConfig()
      this.build()
    })
  }

  printLog(...args: any[]): void {
    if (arguments.length) {
      let arr = Array.prototype.slice.apply(arguments)
      let isExit = args[args.length - 1] === true
      isExit && arr.pop()
      console.log('> ', ...arr)
      isExit && process.exit()
    }
  }

  validateConfig() {
    let dir = this.config.build.dir
    let dirList = String(dir).split(path.sep)
    this.decompressionFileName = dirList[dirList.length - 1]
    if (this.rmGroup.indexOf(this.decompressionFileName) >= 0) {
      this.printLog('config error: config.build.dir illegal', true)
    }
    this.config.zipName = `${this.decompressionFileName}.${this.buildFileFormat}`
    this.config.build.compressDir = path.resolve(this.config.build.compressDir, this.config.zipName)
  }

  build() {
    this.printLog('构建开始')
    const spinner = Ora('构建中...').start()
    shell.exec(this.config.build.command, {async: false}, (code: Number): void => {
      if (code === 0) {
        spinner.stop()
        this.printLog('构建成功')
        this.compressionBuild()
      }
    })
  }

  compressionBuild() {
    const {dir, compressDir} = this.config.build
    if (!fs.existsSync(dir)) {
      this.printLog('Error: Build path does not exist,', dir, true)
    }
    this.printLog('生成zip开始')
    const spinner = Ora('生成zip中...').start()
    Compress.zip
      .compressDir(dir, compressDir)
      .then(() => {
        spinner.stop()
        this.printLog('生成zip成功')
        this.connectionSSH()
      })
      .catch((err: any): void => {
        spinner.stop()
        this.printLog('Compression build failed, ', err.toString(), true)
      })
  }

  async connectionSSH(callback?: Function) {
    let spinner = Ora('SSH连接中...').start()
    await this.ssh
      .connect({
        host: this.config.ssh.host,
        username: this.config.ssh.username,
        privateKey: this.config.ssh.privateKey,
      })
      .then(() => {
        this.printLog('SSH连接成功')
        this.uploadFile()
      })
      .catch((err: any): void => {
        spinner.stop()
        this.printLog('SSH连接失败，', err, true)
      })
  }

  uploadFile() {
    const {compressDir} = this.config.build
    this.printLog('开始上传zip文件')
    // 检查文件
    if (!fs.existsSync(compressDir)) {
      this.printLog('Error: 打包文件不存在', true)
    }
    let spinner = Ora('上传Zip中...').start()
    // 处理win平台路径问题
    let serDir = path.join(this.config.serverDir, this.config.zipName)
    if (serDir.indexOf('\\') >= 0) {
      serDir = serDir.replace(/\\/g, '/')
    }
    this.ssh
      .putFile(compressDir, serDir)
      .then(
        (): void => {
          spinner.stop()
          this.printLog('zip上传成功')
          this.deploy()
        },
        (err: any): void => {
          spinner.stop()
          this.printLog('zip上传失败,', err, true)
        }
      )
      .catch((err: any): void => {
        spinner.stop()
        this.printLog('zip上传失败,', err, true)
      })
      .finally(() => {
        spinner && spinner.stop()
      })
  }

  async deploy(): Promise<any> {
    this.printLog('部署开始')
    let spinner = Ora('部署中...').start()
    // 创建目录，暂不用，上传已实现

    // 判断项目文件是否存在，使用创建目录方式进行处理，存在则忽略，不存在则创建
    await this.ssh
      .exec(`mkdir -p ${this.config.projectFileName}`, [], {cwd: this.config.serverDir})
      .catch((err: any): void => {
        this.printLog(err)
      })

    // 对当前进行备份
    let date = Moment().format(this.config.backupsFormat)
    let newProjectFileName = `${this.config.projectFileName}${date}${stringRandom(8, {
      letters: false,
    })}`
    await this.ssh
      .exec(`mv ${this.config.projectFileName} ${newProjectFileName}`, [], {
        cwd: this.config.serverDir,
      })
      .catch((err: any): void => {
        this.printLog(err)
      })

    // 删除 build
    await this.ssh
      .exec(`rm -rf ${this.decompressionFileName}`, [], {cwd: this.config.serverDir})
      .catch((err: any): void => {
        this.printLog(err)
      })

    await this.ssh
      .exec(`unzip ${this.config.zipName}`, [], {cwd: this.config.serverDir})
      .catch((err: any): void => {
        this.printLog(err)
      })

    // 重新命名成项目名
    await this.ssh
      .exec(`mv ${this.decompressionFileName} ${this.config.projectFileName}`, [], {
        cwd: this.config.serverDir,
      })
      .catch((err: any): void => {
        throw Error(err)
      })

    // 删除 zip
    await this.ssh
      .exec(`rm -rf ${this.config.zipName}`, [], {cwd: this.config.serverDir})
      .catch((err: any): void => {
        this.printLog(err)
      })

    this.ssh.dispose()
    spinner.stop()
    this.printLog('部署成功')

    // 删除本地zip
    fs.unlink(this.config.build.compressDir, (): void => {
      this.printLog('本地zip删除成功')
    })

    this.printLog('发布已完成', true)
  }
}

const automaticDeploy = new AutomaticDeploy()

module.exports = automaticDeploy
