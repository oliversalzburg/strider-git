
var gitane = require('gitane')
  , exec = require('child_process').exec
  , shellescape = require('shell-escape')

module.exports = {
  gitUrl: gitUrl,
  sshUrl: sshUrl,
  httpsUrl: httpsUrl,
  gitCmd: gitCmd,
  gitaneCmd: gitaneCmd,
  processBranches: processBranches,
  getBranches: getBranches,
  shellEscape: shellEscape
}

function shellEscape(one) {
  return shellescape([one])
}

// returns [real, safe] urls
function gitUrl(config) {
  return (config.auth.type === 'ssh' ? sshUrl : httpsUrl)(config)
}

function sshUrl(config) {
  var url = shellEscape('git@' + config.url.replace('/', ':'))
  return [url, url]
}

function httpsUrl(config) {
  var url = 'https://' + config.auth.username + ':' + config.auth.password + '@' + config.url
    , safe = 'https://[username]:[password]@' + config.url
  return [url, safe]
}

function gitCmd(cmd, cwd, auth, privkey, context, done) {
  if (auth.type === 'ssh') {
    return gitaneCmd(cmd, cwd, auth.privkey || privkey, context, done)
  }
  context.cmd({
    cmd: cmd,
    cwd: cwd
  }, done)
}

// run a strider command with gitane
function gitaneCmd(cmd, dest, privkey, context, done) {
  var start = new Date()
  context.status('command.start', { text: cmd, time: start, plugin: context.plugin })
  gitane.run({
    emitter: {
      emit: context.status
    },
    cmd: cmd,
    baseDir: dest,
    privKey: privkey,
    detached: true
  }, function (err, stdout, stderr, exitCode) {
    var end = new Date()
      , elapsed = end.getTime() - start.getTime()
    if (err) {
      context.log('Gitane error:', err.message)
    }
    context.log('gitane command done %s; exit code %s; duration %s', cmd, exitCode, elapsed)
    context.status('command.done', {exitCode: exitCode, time: end, elapsed: elapsed})
    done(err ? 500 : exitCode, stdout + stderr)
  })
}

function processBranches(data, done) {
  done(null, data.split('\n').map(function (line) {
    return line.split(' ')[1].split('/').slice(-1)[0]
  }))
}

function getBranches(config, privkey, done) {
  if (config.auth.type === 'ssh') {
    gitane.run({
      cmd: 'git ls-remote -h ' + gitUrl(config)[0],
      baseDir: '/',
      privKey: config.auth.privkey || privkey,
      detached: true
    }, function (err, stdout, stderr, exitCode) {
      if (err || exitCode !== 0) return done(err || new Error(stderr))
      processBranches(stdout, done)
    })
  } else {
    exec('git ls-remote -h ' + sshUrl(config)[0], function (err, stdout, stderr) {
      if (err) return done(err)
      processBranches(stdout, done)
    })
  }
}