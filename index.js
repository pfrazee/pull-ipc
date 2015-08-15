var pull  = require('pull-stream')

function once (fn) {
  var done = false
  return function (err, val) {
    if(done) return
    done = true
    fn(err, val)
  }
}

module.exports = function (channelName, ipc, window, _done) {
  var buffer = [], ended = false, waiting
  var onincomingHandler

  // handle (ipc, _done) call signature
  if (typeof window == 'function' && !_done) {
    _done = window
    window = null
  }

  var done = once(function (err, v) {
    ended = err || true
    ipc.removeListener(channelName, onincomingHandler)
    _done && _done(err, v)

    // deallocate
    _done = null
    window = null
    waiting = null
  })

  // incoming msg handler
  function onincoming (msg) {
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
  }

  // outgoing msg handler
  function onoutgoing (msg) { 
    if (msg.value && Buffer.isBuffer(msg.value)) {
      // convert buffers to base64
      msg.bvalue = msg.value.toString('base64')
      delete msg.value
    }
    if (window) window.webContents.send(channelName, JSON.stringify(msg))
    else        ipc.send(channelName, JSON.stringify(msg))
  }

  // handle incoming messages
  onincomingHandler = (window) ?
    (function (e, msg) {
      if (e.sender !== window.webContents) return
      onincoming(msg)
    }) : onincoming
  ipc.on(channelName, onincomingHandler)

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