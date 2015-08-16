var pull     = require('pull-stream')
var pushable = require('pull-pushable')
var etape    = require('electron-tape')
var pullipc  = require('../index')
var ipc      = require('ipc')
var muxrpc   = require('muxrpc')

etape(function (tape) {
  var ipcStream1 = pullipc('s1', ipc, function (err) {
    console.log('ipc-stream 1 ended', err)
  })
  var ipcStream2 = pullipc('s2', ipc, function (err) {
    console.log('ipc-stream 2 ended', err)
  })
  var ipcStream3 = pullipc('s3', ipc, function (err) {
    console.log('ipc-stream 3 ended', err)
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

  tape('muxrpc', function (t) {

    var received = []

    var doneHere = false, doneThere = false
    function done () {
      if (!doneThere || !doneHere)
        return
      t.deepEqual(received, [1,2,3,4,5,6,7,8,9])
      t.end()
    }

    // setup the rpc api
    var manifest = {
      req: 'async',
      source: 'source',
      sink: 'sink',
      done: 'async'
    }
    var rpc = muxrpc(manifest, manifest, serialize)({
      req: function (data, cb) {
        if (!data || typeof data != 'string')
          cb(new Error('Param 1 is a required string'))
        else
          cb(null, data.toUpperCase())
      },
      source: function () {
        return pull.values([1, 2, 3])
      },
      sink: function () {
        return pull.collect(function (err, vs) {
          received = received.concat(vs)
        })
      },
      done: function (cb) {
        doneThere = true
        cb()
        done()
      }
    })
    function serialize (stream) { return stream }
    pull(ipcStream2, rpc.createStream(), ipcStream2)

    // send requests
    pull(pull.values([1,2,3]), rpc.sink())
    pull(pull.values([4,5,6]), rpc.sink())
    pull(pull.values([7,8,9]), rpc.sink())
    rpc.req('foo', function (err, res) {
      if (err) throw err
      t.equal(res, 'FOO')
      rpc.req(null, function (err, res) {
        t.ok(err)
        pull(rpc.source(), pull.collect(function (err, vs) {
          if (err) throw err
          t.deepEqual(vs, [1,2,3])

          doneHere = true
          rpc.done()
          done()
        }))
      })
    })
  })

  tape('muxrpc 100 sources', function (t) {

    // setup the rpc api
    var manifest = {
      source: 'source'
    }
    var rpc = muxrpc(manifest, manifest, serialize)({
      source: function () {
        return pull.values([1, 2, 3, 4, 5, 6, 7, 8, 9])
      }
    })
    function serialize (stream) { return stream }
    pull(ipcStream3, rpc.createStream(), ipcStream3)

    // send requests
    var collections = []
    function collect () {
      pull(rpc.source(), pull.collect(function (err, vs) {
        if (err) throw err
        collections.push(vs)

        if (collections.length === 100) {
          for (var i=0; i < 100; i++) {
            t.deepEqual(collections[i], [1, 2, 3, 4, 5, 6, 7, 8, 9])
          }
          t.end()
        }
      }))
    }
    for (var i = 0; i < 100; i++)
      collect()

  })
})