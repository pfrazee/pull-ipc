# pull-ipc

A pull-stream wrapper around electron's ipc channel.

## Usage

```js
pullIpc(channelName, ipc, [window], doneCb)
```

Main thread:

```js
var ipc = require('ipc')
var pullIpc = require('pull-ipc')

// `window` is the BrowserWindow instance you want to communicate with
var ipcStream = pullIpc('pull-channel', ipc, window, function (err) {
  console.log('ipc-stream ended', err)
})
pull(ipcStream, someOtherStream, ipcStream)
```

UI thread:

```js
var ipc = require('ipc')
var pullIpc = require('pull-ipc')

var ipcStream = pullIpc('pull-channel', ipc, function (err) {
  console.log('ipc-stream ended', err)
})
pull(ipcStream, someOtherStream, ipcStream)
```