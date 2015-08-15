var pull     = require('pull-stream')
var pushable = require('pull-pushable')
var etape    = require('electron-tape')
var pullipc  = require('../index')
var ipc      = require('ipc')

etape(function (tape) {
  var ipcStream1 = pullipc('s1', ipc, function (err) {
    console.log('ipc-stream 1 ended', err)
  })

  tape('send/receive 123', function (t) {
    // send 1, 2, 3
    var p = pushable()
    pull(p, ipcStream1)
    p.push(1)
    p.push(2)
    p.push(3)

    // receive 1, 2, 3
    var n = 0
    pull(ipcStream1, pull.drain(
      function (v) {
        t.equal(v, ++n)
        if (n === 3)
          p.end()
      },
      function (err) {
        if (err) throw err
        t.end()
      })
    )
  })
})