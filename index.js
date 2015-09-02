var pull  = require('pull-stream')

function once (fn) {
  var done = false
  return function (err, val) {
    if(done) return
    done = true
    fn(err, val)
  }
}

function setup (ipc, _done, send, listen, unlisten) {
  var buffer = [], ended = false, waiting
  var onincomingHandler

  var done = once(function (err, v) {
    ended = err || true
    unlisten()
    _done && _done(err, v)

    // deallocate
    _done = null
    waiting = null
  })

  // incoming msg handler
  listen(function onincoming (msg) {
    // console.log('in', msg)
    // parse if needed
    try {
      if (typeof msg == 'string')
        msg = JSON.parse(msg)
    } catch (e) {
      return
    }

    if (msg.bvalue) {
      // convert buffers to back to binary
      msg.value = new Buffer(msg.bvalue, 'base64')
      delete msg.bvalue
    }

    // send to pull-stream if it's waiting for data
    // otherwise, buffer the data
    if (waiting) {
      var cb = waiting
      waiting = null
      cb(ended, msg)
    }
    else if (!ended)
      buffer.push(msg)
  })

  // outgoing msg handler
  function onoutgoing (msg) { 
    // console.log('out', msg)
    if (msg.value && Buffer.isBuffer(msg.value)) {
      // convert buffers to base64
      msg.bvalue = msg.value.toString('base64')
      delete msg.value
    }
    send(msg)
  }

  // return source/sink
  return {
    source: function (abort, cb) {
      if (abort) {
        cb(abort)
        done(abort !== true ? abort : null)
      }
      else if (buffer.length) cb(null, buffer.shift())
      else if (ended) cb(ended)
      else waiting = cb
    },
    sink  : function (read) {
      pull.drain(function (data) {
        if (ended) return false
        onoutgoing(data)
      }, function (err) {
        done && done(err)
      })
      (read)
    }
  }
}

module.exports = function (channelName, ipc, window, _done) {
  var send, listen, listener

  // handle (ipc, _done) call signature
  if (typeof window == 'function' && !_done) {
    // inside renderer
    _done = window
    window = null

    send = function (msg) {
      ipc.send(channelName, JSON.stringify(msg))
    }
    listen = function (cb) {
      listener = cb
      ipc.on(channelName, cb)
    }
  } else {
    // inside main thread
    send = function (msg) {
      window.webContents.send(channelName, JSON.stringify(msg))
    }
    listen = function (cb) {
      ipc.on(channelName, (listener = function (e, msg) {
        if (e.sender !== window.webContents) return
        cb(msg)
      }))
    }
  }
  var unlisten = function (cb) {
    ipc.removeListener(channelName, listener)
    listener = null
  }

  return setup(ipc, _done, send, listen, unlisten)
}

module.exports.webview = function (channelName, ipc, webview, _done) {
  var send, listen, unlisten, listener

  // handle (ipc, _done) call signature
  if (typeof webview == 'function' && !_done) {
    // inside webview
    _done = webview
    webview = null

    send = function (msg) {
      ipc.sendToHost(channelName, JSON.stringify(msg))
    }
    listen = function (cb) {
      listener = cb
      ipc.on(channelName, cb)
    }
    unlisten = function (cb) {
      ipc.removeListener(channelName, listener)
      listener = null
    }
  } else {
    // inside main thread
    send = function (msg) {
      webview.send(channelName, JSON.stringify(msg))
    }
    listen = function (cb) {
      webview.addEventListener('ipc-message', (listener = function (event) {
        if (event.channel !== channelName) return
        cb(event.args[0])
      }))
    }
    unlisten = function (cb) {
      webview.removeEventListener('ipc-message', listener)
      listener = null
    }
  }

  return setup(ipc, _done, send, listen, unlisten)  
}