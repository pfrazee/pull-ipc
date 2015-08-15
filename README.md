# pull-ipc

A pull-stream wrapper around electron's ipc channel.

## Usage

Main thread:

```js
var ipc = require('ipc')
var pullIpc = require('pull-ipc')

// `window` is the BrowserWindow instance you want to communicate with
var ipcStream = pullIpc(ipc, window, function (err) {
  console.log('ipc-stream ended', err)
})
pull(ipcStream, someOtherStream, ipcStream)
```

UI thread:

```js
var ipc = require('ipc')
var pullIpc = require('pull-ipc')

var ipcStream = pullIpc(ipc, function (err) {
  console.log('ipc-stream ended', err)
})
pull(ipcStream, someOtherStream, ipcStream)
```